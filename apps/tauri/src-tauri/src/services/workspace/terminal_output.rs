use super::WorkspaceState;
use std::collections::HashMap;
use std::sync::{
    atomic::{AtomicU64, Ordering},
    Arc, Mutex,
};
use std::time::{Duration, Instant};
use tauri::ipc::Channel;
use tokio::sync::{mpsc, OwnedSemaphorePermit, Semaphore};
use tokio_util::sync::CancellationToken;

const PENDING_BATCHES: usize = 8;
struct OutputBatch {
    tab_id: String,
    chunk: String,
    skipped_bytes_before: usize,
}

const IN_FLIGHT_BATCHES: usize = 4;
const BATCH_BYTES: usize = 16 * 1024;

pub(crate) struct TerminalOutputSubscription {
    window_label: String,
    output: mpsc::Sender<OutputBatch>,
    closed: CancellationToken,
    skipped_bytes: Mutex<usize>,
    channel: Channel<serde_json::Value>,
    credit: Arc<Semaphore>,
    next_delivery_id: AtomicU64,
    pending: Mutex<HashMap<u64, OwnedSemaphorePermit>>,
    last_warning: Mutex<Option<Instant>>,
}

impl TerminalOutputSubscription {
    pub(crate) fn close(&self) {
        self.closed.cancel();
        self.credit.close();
        if let Ok(mut pending) = self.pending.lock() {
            pending.clear();
        }
    }

    fn enqueue(&self, tab_id: &str, chunk: &str) {
        let Ok(mut skipped) = self.skipped_bytes.lock() else {
            return;
        };
        let message = OutputBatch {
            tab_id: tab_id.to_owned(),
            chunk: chunk.to_owned(),
            skipped_bytes_before: *skipped,
        };
        match self.output.try_send(message) {
            Ok(()) => *skipped = 0,
            Err(mpsc::error::TrySendError::Full(_)) => {
                *skipped = skipped.saturating_add(chunk.len());
                if self.should_warn() {
                    crate::services::logging::warn_global(
                        "terminal:output",
                        format!(
                            "window display queue saturated window={} skipped_display_bytes={}",
                            self.window_label, *skipped
                        ),
                    );
                }
            }
            Err(mpsc::error::TrySendError::Closed(_)) => self.close(),
        }
    }

    fn should_warn(&self) -> bool {
        self.last_warning.lock().is_ok_and(|mut last| {
            if last.is_some_and(|last| last.elapsed() < Duration::from_secs(30)) {
                return false;
            }
            *last = Some(Instant::now());
            true
        })
    }

    async fn send(&self, message: OutputBatch) -> bool {
        let started = Instant::now();
        let Ok(permit) = Arc::clone(&self.credit).acquire_owned().await else {
            return false;
        };
        let should_warn = started.elapsed() >= Duration::from_secs(1) && self.should_warn();
        if should_warn {
            crate::services::logging::warn_global("terminal:output", format!(
                "renderer backpressure window={} tab={} wait_ms={} in_flight_limit={IN_FLIGHT_BATCHES}",
                self.window_label, message.tab_id, started.elapsed().as_millis()
            ));
        }
        let delivery_id = self.next_delivery_id.fetch_add(1, Ordering::Relaxed);
        let Ok(mut pending) = self.pending.lock() else {
            return false;
        };
        if self.credit.is_closed() {
            return false;
        }
        pending.insert(delivery_id, permit);
        drop(pending);
        if self
            .channel
            .send(serde_json::json!({
                "tabId": message.tab_id, "chunk": message.chunk, "deliveryId": delivery_id, "skippedBytesBefore": message.skipped_bytes_before
            }))
            .is_err()
        {
            self.close();
            return false;
        }
        true
    }
}

impl WorkspaceState {
    pub(super) fn terminal_output_health(&self) -> Option<serde_json::Value> {
        let channels = self.terminal_output_channels.try_lock().ok()?;
        let in_flight = channels.values().try_fold(0, |total, subscription| {
            Some(total + subscription.pending.try_lock().ok()?.len())
        });
        Some(serde_json::json!({
            "windows": channels.len(),
            "inFlight": in_flight,
            "queuedBatches": channels.values().map(|subscription|
                subscription.output.max_capacity() - subscription.output.capacity()).sum::<usize>(),
        }))
    }

    pub fn register_terminal_output_channel(
        &self,
        window_label: &str,
        channel: Channel<serde_json::Value>,
    ) {
        if let Ok(mut channels) = self.terminal_output_channels.lock() {
            // A reload replaces the renderer; its old credit can never be acknowledged.
            channels.retain(|_, subscription| {
                if subscription.window_label == window_label {
                    subscription.close();
                    false
                } else {
                    true
                }
            });
            let (output, mut receiver) = mpsc::channel(PENDING_BATCHES);
            let subscription = Arc::new(TerminalOutputSubscription {
                window_label: window_label.to_owned(),
                channel,
                output,
                closed: CancellationToken::new(),
                skipped_bytes: Mutex::new(0),
                credit: Arc::new(Semaphore::new(IN_FLIGHT_BATCHES)),
                next_delivery_id: AtomicU64::new(0),
                pending: Mutex::new(HashMap::new()),
                last_warning: Mutex::new(None),
            });
            channels.insert(subscription.channel.id(), Arc::clone(&subscription));
            tauri::async_runtime::spawn(async move {
                loop {
                    let message = tokio::select! {
                        biased;
                        _ = subscription.closed.cancelled() => break,
                        message = receiver.recv() => match message { Some(message) => message, None => break },
                    };
                    if !subscription.send(message).await {
                        break;
                    }
                }
            });
        }
    }

    pub fn ack_terminal_output(&self, window_label: &str, channel_id: u32, delivery_id: u64) {
        if let Ok(channels) = self.terminal_output_channels.lock() {
            if let Some(subscription) = channels
                .get(&channel_id)
                .filter(|s| s.window_label == window_label)
            {
                if let Ok(mut pending) = subscription.pending.lock() {
                    pending.remove(&delivery_id);
                }
            }
        }
    }

    pub fn publish_uncontrolled_terminal_output(&self, tab_id: &str, chunk: &str) {
        let channels: Vec<_> = match self.terminal_output_channels.lock() {
            Ok(channels) => channels.values().cloned().collect(),
            Err(_) => return,
        };
        for subscription in channels {
            if subscription
                .channel
                .send(serde_json::json!({ "tabId": tab_id, "chunk": chunk }))
                .is_err()
            {
                subscription.close();
            }
        }
        if let Ok(mut channels) = self.terminal_output_channels.lock() {
            channels.retain(|_, current| !current.credit.is_closed());
        }
    }

    pub fn publish_terminal_output(&self, tab_id: &str, chunk: &str) {
        let channels: Vec<_> = match self.terminal_output_channels.lock() {
            Ok(channels) => channels.values().cloned().collect(),
            Err(_) => return,
        };
        let mut remaining = chunk;
        while !remaining.is_empty() {
            let mut end = remaining.len().min(BATCH_BYTES);
            while !remaining.is_char_boundary(end) {
                end -= 1;
            }
            let (batch, tail) = remaining.split_at(end);
            for subscription in &channels {
                subscription.enqueue(tab_id, batch);
            }
            remaining = tail;
        }
        if let Ok(mut channels) = self.terminal_output_channels.lock() {
            channels.retain(|_, subscription| !subscription.credit.is_closed());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn synchronous_window_command_can_register_without_tokio_context() {
        let state = WorkspaceState::default();
        state.register_terminal_output_channel("main", Channel::new(|_| Ok(())));
        for subscription in state.terminal_output_channels.lock().unwrap().values() {
            subscription.close();
        }
    }

    #[tokio::test]
    async fn slow_window_does_not_block_other_window() {
        let state = Arc::new(WorkspaceState::default());
        let slow_count = Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let slow_receiver = Arc::clone(&slow_count);
        state.register_terminal_output_channel(
            "slow",
            Channel::new(move |_| {
                slow_receiver.fetch_add(1, Ordering::Relaxed);
                Ok(())
            }),
        );
        let healthy_count = Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let healthy_receiver = Arc::clone(&healthy_count);
        let receiver_state = Arc::clone(&state);
        let channel_id = Arc::new(std::sync::atomic::AtomicU32::new(0));
        let receiver_id = Arc::clone(&channel_id);
        let channel = Channel::new(move |body| {
            let payload: serde_json::Value = body.deserialize().unwrap();
            receiver_state.ack_terminal_output(
                "main",
                receiver_id.load(Ordering::Relaxed),
                payload["deliveryId"].as_u64().unwrap(),
            );
            healthy_receiver.fetch_add(1, Ordering::Relaxed);
            Ok(())
        });
        channel_id.store(channel.id(), Ordering::Relaxed);
        state.register_terminal_output_channel("main", channel);
        tokio::time::timeout(Duration::from_secs(5), async {
            for index in 0..2000 {
                state.publish_terminal_output("tab", "output");
                while healthy_count.load(Ordering::Relaxed) <= index {
                    tokio::task::yield_now().await;
                }
            }
        })
        .await
        .unwrap();
        assert_eq!(healthy_count.load(Ordering::Relaxed), 2000);
        assert_eq!(slow_count.load(Ordering::Relaxed), IN_FLIGHT_BATCHES);
        let health = state.terminal_output_health().unwrap();
        assert_eq!(health["windows"], 2);
        assert_eq!(health["inFlight"], IN_FLIGHT_BATCHES);
        assert!(health["queuedBatches"].as_u64().unwrap() <= (PENDING_BATCHES * 2) as u64);
        let mut channels = state.terminal_output_channels.lock().unwrap();
        assert!(
            state.terminal_output_health().is_none(),
            "diagnostics must never wait on a busy queue"
        );
        for subscription in channels.values() {
            subscription.close();
        }
        channels.clear();
    }

    #[tokio::test]
    async fn shared_device_workers_do_not_wait_for_display_credit() {
        let state = WorkspaceState::default();
        let count = Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let received = Arc::clone(&count);
        state.register_terminal_output_channel(
            "main",
            Channel::new(move |body| {
                let payload: serde_json::Value = body.deserialize().unwrap();
                assert!(payload.get("deliveryId").is_none());
                received.fetch_add(1, Ordering::Relaxed);
                Ok(())
            }),
        );
        for _ in 0..100 {
            state.publish_uncontrolled_terminal_output("serial", "device response");
        }
        assert_eq!(count.load(Ordering::Relaxed), 100);
    }

    #[tokio::test]
    async fn slow_renderer_limits_in_flight_utf8_output_and_rejects_foreign_ack() {
        let state = Arc::new(WorkspaceState::default());
        let messages = Arc::new(Mutex::new(Vec::<serde_json::Value>::new()));
        let received = Arc::clone(&messages);
        let channel = Channel::new(move |body| {
            received.lock().unwrap().push(body.deserialize().unwrap());
            Ok(())
        });
        let channel_id = channel.id();
        state.register_terminal_output_channel("main", channel);
        let sender = Arc::clone(&state);
        let chunk = "中文🔒".repeat(BATCH_BYTES / 2);
        let expected = chunk.clone();
        let task = tokio::spawn(async move { sender.publish_terminal_output("tab", &chunk) });
        while messages.lock().unwrap().len() < IN_FLIGHT_BATCHES {
            tokio::task::yield_now().await;
        }
        tokio::task::yield_now().await;
        assert!(task.is_finished());
        assert_eq!(messages.lock().unwrap().len(), IN_FLIGHT_BATCHES);
        state.ack_terminal_output("other", channel_id, 0);
        tokio::task::yield_now().await;
        assert_eq!(messages.lock().unwrap().len(), IN_FLIGHT_BATCHES);
        let mut acknowledged = 0;
        while messages
            .lock()
            .unwrap()
            .iter()
            .map(|p| p["chunk"].as_str().unwrap().len())
            .sum::<usize>()
            < expected.len()
        {
            let length = messages.lock().unwrap().len();
            while acknowledged < length {
                state.ack_terminal_output("main", channel_id, acknowledged as u64);
                acknowledged += 1;
            }
            tokio::task::yield_now().await;
        }
        task.await.unwrap();
        let messages = messages.lock().unwrap();
        let actual: String = messages
            .iter()
            .map(|p| p["chunk"].as_str().unwrap())
            .collect();
        assert_eq!(actual, expected);
        assert!(messages
            .iter()
            .all(|p| p["chunk"].as_str().unwrap().len() <= BATCH_BYTES));
    }

    #[tokio::test]
    async fn reload_releases_waiters_and_replaces_old_subscription() {
        let state = WorkspaceState::default();
        let channel = Channel::new(|_| Ok(()));
        let id = channel.id();
        state.register_terminal_output_channel("main", channel);
        let previous = Arc::downgrade(
            state
                .terminal_output_channels
                .lock()
                .unwrap()
                .get(&id)
                .unwrap(),
        );
        state.publish_terminal_output("tab", &"x".repeat(BATCH_BYTES * 8));
        loop {
            let pending = previous.upgrade().unwrap().pending.lock().unwrap().len();
            if pending == IN_FLIGHT_BATCHES {
                break;
            }
            tokio::task::yield_now().await;
        }
        state.register_terminal_output_channel("main", Channel::new(|_| Ok(())));
        tokio::time::timeout(Duration::from_secs(1), async {
            while previous.upgrade().is_some() {
                tokio::task::yield_now().await;
            }
        })
        .await
        .unwrap();
        assert_eq!(state.terminal_output_channels.lock().unwrap().len(), 1);
    }
}
