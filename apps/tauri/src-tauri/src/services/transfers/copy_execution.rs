async fn resolve_copy_tabs(
    app: &AppHandle,
    task: &TransferTask,
) -> Result<(String, String), AppError> {
    let source = task
        .copy_source
        .as_ref()
        .ok_or_else(|| transfer_error("复制任务缺少源端信息"))?;
    let source_tab = find_refreshable_tab(app, &source.profile_id, Some("user"))
        .await
        .ok_or_else(|| transfer_error("请先连接源服务器并切回普通用户文件模式"))?;
    let target_tab = find_refreshable_tab(
        app,
        task.profile_id.as_deref().unwrap_or_default(),
        Some("user"),
    )
    .await
    .ok_or_else(|| transfer_error("请先连接目标服务器并切回普通用户文件模式"))?;
    let current_source = copy_session(app, &source_tab).await?;
    let current_target = copy_session(app, &target_tab).await?;
    if current_source.2 != source.source_endpoint || current_target.2 != source.target_endpoint {
        return Err(transfer_error("源端或目标端连接配置已改变，请新建复制任务"));
    }
    Ok((source_tab, target_tab))
}

async fn copy_file_identity(
    app: &AppHandle,
    tab: &str,
    path: &str,
    cancel: &CancellationToken,
) -> Result<TransferFileIdentity, AppError> {
    let stat = worker_call_with_cancel(app, tab, cancel, |respond_to, cancellation| {
        WorkerCmd::StatRemoteFile {
            path: path.into(),
            cancellation,
            respond_to,
        }
    })
    .await?
    .ok_or_else(|| transfer_error(format!("文件不存在：{path}")))?;
    Ok(TransferFileIdentity {
        size: stat.size,
        modified_at: stat.modified_at,
    })
}

async fn scan_copy_manifest(
    app: &AppHandle,
    tab: &str,
    task: &TransferTask,
    cancel: &CancellationToken,
) -> Result<TransferManifest, AppError> {
    let root = task
        .source_path
        .as_deref()
        .ok_or_else(|| transfer_error("缺少源路径"))?;
    let destination = task
        .destination_path
        .as_deref()
        .ok_or_else(|| transfer_error("缺少目标路径"))?;
    let mut directories = Vec::new();
    let mut files = Vec::new();
    let mut pending = vec![(
        root.to_string(),
        task.target_type.as_deref() == Some("folder"),
        0,
    )];
    let mut total = 0_u64;
    while let Some((path, folder, depth)) = pending.pop() {
        if cancel.is_cancelled() {
            return Err(transfer_error("传输已取消"));
        }
        let relative = if path == root {
            String::new()
        } else {
            relative_remote_path(root, &path)?
        };
        let target = if relative.is_empty() {
            destination.to_string()
        } else {
            join_remote_path(destination, &relative)
        };
        if folder {
            directories.push(target);
            let children = worker_call_with_cancel(app, tab, cancel, |respond_to, cancellation| {
                WorkerCmd::ListRemoteFiles {
                    path: path.clone(),
                    cancellation,
                    respond_to,
                }
            })
            .await?;
            for child in children {
                let name = child
                    .get("name")
                    .and_then(Value::as_str)
                    .unwrap_or_default();
                if matches!(name, "." | "..") {
                    continue;
                }
                validate_transfer_name(name, false)?;
                if child
                    .get("isSymlink")
                    .and_then(Value::as_bool)
                    .unwrap_or(false)
                {
                    return Err(transfer_error(format!(
                        "目录包含符号链接，请排除后重试：{name}"
                    )));
                }
                if depth >= MAX_REMOTE_TREE_DEPTH
                    || pending.len() + files.len() + directories.len() >= MAX_REMOTE_TREE_ENTRIES
                {
                    return Err(transfer_error("目录超过支持的深度或条目数"));
                }
                pending.push((
                    join_remote_path(&path, name),
                    child.get("type").and_then(Value::as_str) == Some("folder"),
                    depth + 1,
                ));
            }
        } else {
            let identity = copy_file_identity(app, tab, &path, cancel).await?;
            total = total
                .checked_add(identity.size)
                .filter(|n| *n <= MAX_REMOTE_TREE_BYTES)
                .ok_or_else(|| transfer_error("目录大小超过支持范围"))?;
            files.push(TransferManifestEntry {
                relative_path: relative,
                source_path: path,
                partial_path: format!("{target}.{}.fileterm-part", task.id),
                destination_path: target,
                staging_path: None,
                source_identity: identity,
                status: "pending".into(),
                transferred_bytes: 0,
            });
        }
    }
    directories.sort();
    Ok(TransferManifest {
        version: 1,
        directories,
        files,
    })
}

async fn ensure_copy_directory(
    app: &AppHandle,
    tab: &str,
    path: &str,
    cancel: &CancellationToken,
) -> Result<(), AppError> {
    let mut current = String::new();
    for part in path.split('/').filter(|p| !p.is_empty()) {
        validate_transfer_name(part, false)?;
        current = join_remote_path(&current, part);
        if let Some(entry) = copy_entry_metadata(app, tab, &current, cancel).await? {
            if entry.get("type").and_then(Value::as_str) != Some("folder")
                || entry
                    .get("isSymlink")
                    .and_then(Value::as_bool)
                    .unwrap_or(false)
            {
                return Err(transfer_error(format!(
                    "目标目录被文件或符号链接占用：{current}"
                )));
            }
        } else {
            ensure_remote_directory(app, tab, &current, Some(cancel)).await?;
        }
    }
    Ok(())
}

async fn run_remote_copy(
    app: &AppHandle,
    mut task: TransferTask,
    cancel: &CancellationToken,
) -> Result<(), AppError> {
    let (source_tab, target_tab) = resolve_copy_tabs(app, &task).await?;
    let _power = power::acquire(app.clone()).await;
    let source = task
        .copy_source
        .clone()
        .ok_or_else(|| transfer_error("缺少源端信息"))?;
    patch_task(
        app,
        &task.id,
        |stored| {
            stored.tab_id = Some(target_tab.clone());
            if let Some(source) = &mut stored.copy_source {
                source.tab_id = source_tab.clone();
            }
            stored.status = "running".into();
            stored.message = Some("正在扫描源文件…".into());
        },
        PatchDelivery::PersistedEvent,
    )
    .await?;
    if task.manifest.is_none() {
        let manifest = scan_copy_manifest(app, &source_tab, &task, cancel).await?;
        patch_task(
            app,
            &task.id,
            |stored| {
                stored.total_bytes =
                    Some(manifest.files.iter().map(|e| e.source_identity.size).sum());
                stored.manifest = Some(manifest.clone());
            },
            PatchDelivery::PersistedEvent,
        )
        .await?;
        task.manifest = Some(manifest);
    }
    let manifest = task.manifest.as_ref().unwrap();
    for directory in &manifest.directories {
        ensure_copy_directory(app, &target_tab, directory, cancel).await?;
    }
    let total = manifest.files.iter().map(|e| e.source_identity.size).sum();
    let mut completed = 0;
    let mut skipped = 0;
    let mut throttler = DirectoryTransferThrottler::new();
    for (index, entry) in manifest.files.iter().enumerate() {
        patch_task(
            app,
            &task.id,
            |stored| {
                stored.status = "running".into();
                stored.message = Some(entry.source_path.clone());
            },
            throttler.delivery_for_file_start(),
        )
        .await?;
        if copy_entry_metadata(app, &source_tab, &entry.source_path, cancel)
            .await?
            .as_ref()
            .is_none_or(|entry| {
                entry
                    .get("isSymlink")
                    .and_then(Value::as_bool)
                    .unwrap_or(false)
                    || entry.get("type").and_then(Value::as_str) != Some("file")
            })
        {
            return Err(transfer_error("源文件不存在或已变为目录/符号链接"));
        }
        let current = copy_file_identity(app, &source_tab, &entry.source_path, cancel).await?;
        if !same_transfer_identity(&current, &entry.source_identity) {
            return Err(transfer_error("源文件已变化，请重新创建任务"));
        }
        ensure_copy_directory(
            app,
            &target_tab,
            &parent_remote_path(&entry.destination_path),
            cancel,
        )
        .await?;
        let before = copy_entry_metadata(app, &target_tab, &entry.destination_path, cancel).await?;
        let already_done = entry.status == "done"
            && before.as_ref().is_some_and(|entry| {
                entry.get("type").and_then(Value::as_str) == Some("file")
                    && !entry
                        .get("isSymlink")
                        .and_then(Value::as_bool)
                        .unwrap_or(false)
            })
            && stat_remote_transfer_size(app, &target_tab, &entry.destination_path, Some(cancel))
                .await?
                == Some(current.size)
            && copy_remote_hash(app, &source_tab, &entry.source_path, current.size, cancel).await?
                == copy_remote_hash(
                    app,
                    &target_tab,
                    &entry.destination_path,
                    current.size,
                    cancel,
                )
                .await?;
        if !already_done && before.is_some() && !source.replace_existing {
            remove_remote_transfer_file(app, &target_tab, &entry.partial_path, Some(cancel))
                .await?;
            skipped += 1;
        } else if !already_done {
            if before.as_ref().is_some_and(|entry| {
                entry
                    .get("isSymlink")
                    .and_then(Value::as_bool)
                    .unwrap_or(false)
                    || entry.get("type").and_then(Value::as_str) == Some("folder")
            }) {
                return Err(transfer_error("目标是目录或符号链接，拒绝覆盖"));
            }
            if copy_entry_metadata(app, &target_tab, &entry.partial_path, cancel)
                .await?
                .as_ref()
                .is_some_and(|entry| {
                    entry
                        .get("isSymlink")
                        .and_then(Value::as_bool)
                        .unwrap_or(false)
                        || entry.get("type").and_then(Value::as_str) == Some("folder")
                })
            {
                return Err(transfer_error("目标断点不是普通文件，拒绝写入"));
            }
            let offset =
                stat_remote_transfer_size(app, &target_tab, &entry.partial_path, Some(cancel))
                    .await?
                    .unwrap_or(0);
            if offset > current.size {
                return Err(transfer_error("断点超过源长度，请丢弃后重试"));
            }
            if offset > 0
                && copy_remote_hash(app, &source_tab, &entry.source_path, offset, cancel).await?
                    != copy_remote_hash(app, &target_tab, &entry.partial_path, offset, cancel)
                        .await?
            {
                return Err(transfer_error("源文件与目标断点前缀不一致，请丢弃后重传"));
            }
            relay_copy_bytes(
                app,
                &task.id,
                &source_tab,
                &target_tab,
                entry,
                offset,
                completed,
                total,
                cancel,
            )
            .await?;
            patch_task(
                app,
                &task.id,
                |stored| {
                    stored.status = "verifying".into();
                },
                PatchDelivery::Event,
            )
            .await?;
            if stat_remote_transfer_size(app, &target_tab, &entry.partial_path, Some(cancel))
                .await?
                != Some(current.size)
                || copy_remote_hash(app, &source_tab, &entry.source_path, current.size, cancel)
                    .await?
                    != copy_remote_hash(app, &target_tab, &entry.partial_path, current.size, cancel)
                        .await?
            {
                return Err(transfer_error("跨服务器复制内容校验失败，断点已保留"));
            }
            if !same_transfer_identity(
                &copy_file_identity(app, &source_tab, &entry.source_path, cancel).await?,
                &current,
            ) {
                return Err(transfer_error("源文件在传输期间发生变化"));
            }
            if before
                != copy_entry_metadata(app, &target_tab, &entry.destination_path, cancel).await?
            {
                return Err(transfer_error(
                    "目标在传输期间发生变化，已保留断点，请检查后继续",
                ));
            }
            patch_task(
                app,
                &task.id,
                |stored| {
                    stored.status = "finalizing".into();
                },
                PatchDelivery::Event,
            )
            .await?;
            // Finish replacement/rollback before honoring pause or discard.
            worker_call(app, &target_tab, |respond_to, cancellation| {
                WorkerCmd::ReplaceRemoteFile {
                    partial_path: entry.partial_path.clone(),
                    destination_path: entry.destination_path.clone(),
                    cancellation,
                    respond_to,
                }
            })
            .await?;
        }
        completed += current.size;
        patch_task(
            app,
            &task.id,
            |stored| {
                if let Some(manifest) = &mut stored.manifest {
                    manifest.files[index].status =
                        if !already_done && before.is_some() && !source.replace_existing {
                            "skipped"
                        } else {
                            "done"
                        }
                        .into();
                    manifest.files[index].transferred_bytes = current.size;
                }
            },
            throttler.delivery_for_file_completed(),
        )
        .await?;
        report_progress(app, &task.id, completed, total).await;
    }
    patch_task(
        app,
        &task.id,
        |stored| {
            stored.status = "done".into();
            stored.resumable = false;
            stored.progress = 100.0;
            stored.speed = None;
            stored.message = Some(format!("复制完成，跳过 {skipped} 个同名文件"));
            stored.manifest = None;
        },
        PatchDelivery::PersistedEvent,
    )
    .await?;
    Ok(())
}
