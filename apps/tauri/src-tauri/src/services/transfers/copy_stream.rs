use sha2::{Digest, Sha256};
use tokio::io::{AsyncReadExt, AsyncWriteExt};

async fn relay_command(
    app: &AppHandle,
    tab_id: &str,
    request: crate::sessions::relay_io::RelayRequest,
    stream: tokio::io::DuplexStream,
    cancel: &CancellationToken,
) -> Result<(), AppError> {
    worker_data_call_with_cancel(app, tab_id, cancel, |respond_to, cancellation| {
        WorkerCmd::RelayFile {
            request,
            stream,
            cancellation,
            respond_to,
        }
    })
    .await
}

async fn copy_remote_hash(
    app: &AppHandle,
    tab: &str,
    path: &str,
    length: u64,
    cancel: &CancellationToken,
) -> Result<String, AppError> {
    let (mut reader, writer) = tokio::io::duplex(crate::sessions::TRANSFER_IO_BUFFER_BYTES);
    let request = crate::sessions::relay_io::RelayRequest {
        path: path.into(),
        offset: 0,
        length,
        upload: false,
    };
    let read = async {
        let mut hash = Sha256::new();
        let mut remaining = length;
        let mut buffer = vec![0; crate::sessions::TRANSFER_IO_BUFFER_BYTES];
        while remaining > 0 {
            let limit = remaining.min(buffer.len() as u64) as usize;
            let n = tokio::select! {
                biased;
                _ = cancel.cancelled() => return Err(transfer_error("transfer canceled")),
                value = tokio::time::timeout(TRANSFER_WORKER_CONTROL_TIMEOUT, reader.read(&mut buffer[..limit])) => value.map_err(|_| transfer_error("读取校验数据超时"))?.map_err(|e| transfer_error(e.to_string()))?,
            };
            if n == 0 {
                return Err(transfer_error("校验源提前结束"));
            }
            hash.update(&buffer[..n]);
            remaining -= n as u64;
        }
        Ok(format!("{:x}", hash.finalize()))
    };
    let (hash, ()) = tokio::try_join!(read, relay_command(app, tab, request, writer, cancel))?;
    Ok(hash)
}

#[allow(clippy::too_many_arguments)]
async fn relay_copy_bytes(
    app: &AppHandle,
    task_id: &str,
    source_tab: &str,
    target_tab: &str,
    entry: &TransferManifestEntry,
    offset: u64,
    completed: u64,
    total: u64,
    cancel: &CancellationToken,
) -> Result<(), AppError> {
    let length = entry.source_identity.size - offset;
    let (mut reader, source_stream) = tokio::io::duplex(crate::sessions::TRANSFER_IO_BUFFER_BYTES);
    let (target_stream, mut writer) = tokio::io::duplex(crate::sessions::TRANSFER_IO_BUFFER_BYTES);
    let source = crate::sessions::relay_io::RelayRequest {
        path: entry.source_path.clone(),
        offset,
        length,
        upload: false,
    };
    let target = crate::sessions::relay_io::RelayRequest {
        path: entry.partial_path.clone(),
        offset,
        length,
        upload: true,
    };
    let pump = async {
        let mut remaining = length;
        let mut buffer = vec![0; crate::sessions::TRANSFER_IO_BUFFER_BYTES];
        while remaining > 0 {
            let limit = remaining.min(buffer.len() as u64) as usize;
            let n = reader
                .read(&mut buffer[..limit])
                .await
                .map_err(|e| transfer_error(e.to_string()))?;
            if n == 0 {
                return Err(transfer_error("中转源提前结束"));
            }
            writer
                .write_all(&buffer[..n])
                .await
                .map_err(|e| transfer_error(e.to_string()))?;
            remaining -= n as u64;
            report_progress(
                app,
                task_id,
                completed + entry.source_identity.size - remaining,
                total,
            )
            .await;
        }
        writer
            .shutdown()
            .await
            .map_err(|e| transfer_error(e.to_string()))
    };
    let result = tokio::try_join!(
        pump,
        relay_command(app, source_tab, source, source_stream, cancel),
        relay_command(app, target_tab, target, target_stream, cancel)
    );
    result.map(|_| ())
}
