// Keep UI interaction facts in the final response: MCP hosts may hide progress.
fn record_interaction(history: &mut Vec<Value>, progress: &BridgeProgress) {
    if !progress.is_interaction() {
        return;
    }
    let event = json!({
        "event": progress.event,
        "status": progress.status,
        "code": progress.code,
    });
    history.push(event);
}

fn attach_interaction_history(mut value: Value, progress: Vec<BridgeProgress>) -> Value {
    let mut history = Vec::new();
    for event in progress {
        record_interaction(&mut history, &event);
    }
    if !history.is_empty() {
        value["interactionHistory"] = json!(history);
    }
    value
}

fn attach_tool_interaction_history(mut result: Value, history: Vec<BridgeProgress>) -> Value {
    if history.is_empty() {
        return result;
    }
    let is_error = result["isError"].as_bool().unwrap_or(false);
    let value = result["structuredContent"].take();
    tool_result(attach_interaction_history(value, history), is_error)
}

fn finalize_bridge_interactions(
    mut response: BridgeResponse,
    mut history: Vec<BridgeProgress>,
    receiver: &mut mpsc::Receiver<BridgeProgress>,
) -> BridgeResponse {
    // Dispatch may finish in the same poll as its final event. Keep the queued
    // outcome even if live notifications were dropped by the writer or host.
    while let Ok(progress) = receiver.try_recv() {
        if progress.is_interaction() {
            history.push(progress);
        }
    }
    response.interaction_history = history;
    response
}

fn with_interaction_output_schema(mut schema: Value) -> Value {
    schema["properties"]["interactionHistory"] = json!({
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "event": { "type": "string" },
                "status": { "type": "string" },
                "code": { "type": "string" }
            },
            "required": ["event", "status", "code"],
            "additionalProperties": false
        }
    });
    schema
}

#[cfg(test)]
mod interaction_tests {
    use super::*;

    #[test]
    fn final_history_only_contains_safe_interaction_fields_for_success_and_error() {
        let mut requested = BridgeProgress::privileged_password_prompt(
            SUDO_PASSWORD_NEEDED,
            Some(json!("private-progress-token")),
        );
        requested.message = "secret-value-that-must-not-reach-agent".to_string();
        let mut unrelated = requested.clone();
        unrelated.event = "terminal-output".to_string();
        unrelated.message = "secret-output".to_string();
        for ok in [true, false] {
            for status in [
                "input-completed",
                "cancelled",
                "timed-out",
                "unavailable",
                "aborted",
            ] {
                let resolved =
                    BridgeProgress::privileged_password_state(SUDO_PASSWORD_NEEDED, status, None);
                let response = attach_interaction_history(
                    json!({"id": 1, "ok": ok}),
                    vec![requested.clone(), unrelated.clone(), resolved],
                );
                assert_eq!(response["interactionHistory"].as_array().unwrap().len(), 2);
                assert_eq!(response["interactionHistory"][1]["status"], status);
                let encoded = response.to_string();
                assert!(!encoded.contains("private-progress-token"));
                assert!(!encoded.contains("secret-value-that-must-not-reach-agent"));
                assert!(!encoded.contains("secret-output"));
                assert!(!encoded.contains("progressToken"));
            }
        }
        requested.event = "action-approval-resolved".to_string();
        requested.status = "approved".to_string();
        let response = attach_interaction_history(json!({}), vec![requested]);
        assert_eq!(response["interactionHistory"][0]["status"], "approved");
    }

    #[test]
    fn legacy_bridge_response_does_not_establish_passwordless_authentication() {
        let response: BridgeResponse =
            serde_json::from_value(json!({"ok": true, "result": {"exitCode": 0}})).unwrap();
        assert!(response.interaction_history.is_empty());
        let result = attach_interaction_history(response.result.unwrap(), Vec::new());
        assert!(result.get("interactionHistory").is_none());
    }
}

#[cfg(test)]
mod interaction_delivery_tests {
    use super::*;

    #[test]
    fn queued_final_event_survives_dispatch_completion_race() {
        let (sender, mut receiver) = mpsc::channel(4);
        let requested = BridgeProgress::privileged_password_prompt(SUDO_PASSWORD_NEEDED, None);
        let completed = BridgeProgress::privileged_password_state(
            SUDO_PASSWORD_NEEDED,
            "input-completed",
            None,
        );
        sender.try_send(completed).unwrap();
        let response = finalize_bridge_interactions(
            BridgeResponse::success(json!({})),
            vec![requested],
            &mut receiver,
        );
        assert_eq!(response.interaction_history.len(), 2);
        assert_eq!(response.interaction_history[1].status, "input-completed");
    }

    #[test]
    fn every_tool_output_schema_allows_only_sanitized_interaction_fields() {
        for tool in tool_definitions() {
            let schema = &tool["outputSchema"]["properties"]["interactionHistory"];
            assert_eq!(schema["type"], "array", "{}", tool["name"]);
            assert_eq!(schema["items"]["additionalProperties"], false);
            assert_eq!(schema["items"]["properties"].as_object().unwrap().len(), 3);
        }
    }

    #[test]
    fn storage_and_response_errors_do_not_imply_disconnection_or_no_side_effects() {
        let storage = public_app_error(AppError::Storage("secret-path".to_string()));
        assert!(!storage.contains("secret-path"));
        assert_eq!(
            mcp_error_code(&storage),
            "FILETERM_STORAGE_OPERATION_FAILED"
        );
        let response = public_app_error(AppError::Serialization("secret-value".to_string()));
        assert!(!response.contains("secret-value"));
        for error in [&storage, &response, FILETERM_CLI_JSONL_REQUEST_CANCELLED] {
            let metadata =
                agent_error_metadata("write_remote_file", &json!({"tab_id": "tab-1"}), error);
            assert_eq!(metadata["outcome"], "unknown");
            assert_eq!(metadata["safeToRetry"], false);
            assert_eq!(metadata["recovery"]["type"], "inspect-before-retry");
        }
        assert_eq!(
            mcp_error_code(FILETERM_CONNECTION_FAILED),
            FILETERM_CONNECTION_FAILED
        );
    }

    #[test]
    fn ssh_prompt_metadata_never_contains_prompts_answers_or_identifiers() {
        for kind in [
            "credentials",
            "host-verification",
            "key-passphrase",
            "keyboard-interactive",
        ] {
            let result = attach_interaction_history(
                json!({}),
                vec![BridgeProgress::ssh_interaction(
                    kind,
                    "input-completed",
                    Some(json!("internal-id")),
                )],
            );
            let encoded = result.to_string();
            assert!(!encoded.contains("internal-id"));
            assert!(!encoded.contains("message"));
            assert_eq!(result["interactionHistory"][0]["status"], "input-completed");
        }
    }
}
