const MAX_SSH_JUMP_HOSTS: usize = 8;

fn resolve_ssh_route(profile: &Value, profiles: &[Value]) -> Result<Vec<Value>, String> {
    let mut route = Vec::new();
    let mut current = profile.clone();
    let mut visited = std::collections::HashSet::new();
    loop {
        let id = current.get("id").and_then(Value::as_str).unwrap_or("");
        if !id.is_empty() && !visited.insert(id.to_string()) {
            return Err(format!(
                "SSH Jump Host route contains a cycle at profile '{id}'"
            ));
        }
        if current.get("type").and_then(Value::as_str) != Some("ssh") {
            return Err(format!("Jump Host profile '{id}' must be an SSH profile"));
        }
        port_from_profile(&current, 22, "SSH")?;
        let jump_id = match current
            .get("jumpProfileId")
            .filter(|value| !value.is_null())
        {
            Some(value) => Some(
                value
                    .as_str()
                    .filter(|id| !id.trim().is_empty())
                    .ok_or_else(|| {
                        format!("SSH profile '{id}' has an invalid Jump Host reference")
                    })?
                    .to_string(),
            ),
            None => None,
        };
        let has_proxy_reference = current
            .get("proxyProfileId")
            .and_then(Value::as_str)
            .is_some_and(|id| !id.trim().is_empty());
        if jump_id.is_some()
            && (has_proxy_reference
                || current
                    .get("proxy")
                    .and_then(|proxy| proxy.get("type"))
                    .and_then(Value::as_str)
                    .unwrap_or("none")
                    != "none")
        {
            return Err(format!(
                "Proxy and Jump Host are mutually exclusive for SSH profile '{id}'"
            ));
        }
        // Legacy per-profile overrides also belong to an intermediate hop's transport.
        for field in ["useEmptyPassword", "legacyAlgorithms"] {
            if let Some(value) = current
                .get("connectionOverrides")
                .and_then(|overrides| overrides.get(field))
                .cloned()
            {
                current[field] = value;
            }
        }
        route.push(current);
        let Some(jump_id) = jump_id else { break };
        if visited.contains(&jump_id) {
            return Err(format!(
                "SSH Jump Host route contains a cycle at profile '{jump_id}'"
            ));
        }
        if route.len() > MAX_SSH_JUMP_HOSTS {
            return Err(format!(
                "SSH route supports at most {MAX_SSH_JUMP_HOSTS} Jump Hosts"
            ));
        }
        current = profiles
            .iter()
            .find(|profile| profile.get("id").and_then(Value::as_str) == Some(&jump_id))
            .cloned()
            .ok_or_else(|| format!("Jump Host profile '{jump_id}' not found"))?;
    }
    route.reverse();
    Ok(route)
}

// Channels retain russh senders after Handle::drop; explicitly disconnect every hop.
struct SshSessionCleanup<H: Handler + 'static> {
    handles: Vec<Arc<Handle<H>>>,
}

impl<H: Handler + 'static> Drop for SshSessionCleanup<H> {
    fn drop(&mut self) {
        if let Ok(runtime) = tokio::runtime::Handle::try_current() {
            let handles = std::mem::take(&mut self.handles);
            runtime.spawn(async move {
                for handle in handles.into_iter().rev() {
                    let _ = timeout(
                        Duration::from_secs(3),
                        handle.disconnect(Disconnect::ByApplication, "SSH route closed", "en"),
                    )
                    .await;
                }
            });
        }
    }
}

async fn open_session(
    profile: &Value,
    app: &AppHandle,
    tab_id: &str,
    interaction_timeout: Duration,
    interaction_window_label: Option<String>,
    flow: SshInteractionFlow,
    cancellation: CancellationToken,
) -> Result<OpenSshSession, String> {
    let profiles = if profile
        .get("jumpProfileId")
        .is_some_and(|value| !value.is_null())
    {
        let state = app.state::<crate::services::workspace::WorkspaceState>();
        let _guard = state.library_mutation.lock().await;
        crate::services::profile_ops::read_and_heal_profiles(app)
            .map(|(profiles, _)| profiles)
            .map_err(|error| format!("Failed to read SSH Jump Host profiles: {error}"))?
    } else {
        Vec::new()
    };
    let route = resolve_ssh_route(profile, &profiles)?;
    let mut cleanup = SshSessionCleanup {
        handles: Vec::new(),
    };
    let mut remote_sshid = Vec::new();
    let mut disconnect_reason = Arc::new(StdMutex::new(None));
    for (index, hop) in route.iter().enumerate() {
        let authentication_target = if route.len() == 1 {
            SshAuthenticationTarget::Direct
        } else if index + 1 == route.len() {
            SshAuthenticationTarget::Target(index as u32)
        } else {
            SshAuthenticationTarget::JumpHost(index as u32)
        };
        let result = tokio::select! {
            biased;
            _ = cancellation.cancelled() => return Err("SSH connection canceled".to_string()),
            result = open_session_hop(hop, app, tab_id, interaction_timeout,
                interaction_window_label.clone(), authentication_target, flow.clone(),
                cancellation.clone(), &mut cleanup) => result,
        };
        (remote_sshid, disconnect_reason) = result.map_err(|error| {
            let name = hop.get("name").and_then(Value::as_str).unwrap_or("SSH");
            format!("SSH hop {} ({name}): {error}", index + 1)
        })?;
    }
    Ok(OpenSshSession {
        handle: cleanup.handles.last().unwrap().clone(),
        cleanup,
        remote_sshid,
        disconnect_reason,
    })
}
