// Windows Toast Notification Interceptor using UserNotificationListener
#![cfg_attr(not(windows), allow(dead_code))]

use serde::Serialize;
use tauri::{AppHandle, Emitter};

pub const NOTIFICATION_EVENT: &str = "windows-notification";

#[derive(Clone, Debug, Serialize)]
pub struct NotificationPayload {
    pub id: u32,
    pub app_name: String,
    pub title: String,
    pub body: String,
    pub timestamp_ms: u64,
}

pub fn setup(app: &AppHandle) {
    #[cfg(windows)]
    start_listener(app.clone());
    #[cfg(not(windows))]
    let _ = app;
}

#[cfg(windows)]
fn start_listener(app: AppHandle) {
    std::thread::Builder::new()
        .name("coucou-notifications".into())
        .spawn(move || {
            if let Err(err) = run_listener(app) {
                eprintln!("notification listener error: {:?}", err);
            }
        })
        .expect("failed to spawn notification thread");
}

#[cfg(windows)]
fn run_listener(app: AppHandle) -> windows::core::Result<()> {
    use std::collections::HashSet;
    use std::time::Duration;
    use windows::UI::Notifications::Management::{
        UserNotificationListener, UserNotificationListenerAccessStatus,
    };
    use windows::UI::Notifications::{KnownNotificationBindings, NotificationKinds};

    let listener = UserNotificationListener::Current()?;
    let status = listener.RequestAccessAsync()?.get()?;
    if status != UserNotificationListenerAccessStatus::Allowed {
        eprintln!("UserNotificationListener access status: {:?}", status);
        return Ok(());
    }

    // Populate existing notification IDs so we don't alert old notifications at app launch
    let mut seen_ids: HashSet<u32> = HashSet::new();
    if let Ok(initial_op) = listener.GetNotificationsAsync(NotificationKinds::Toast) {
        if let Ok(initial) = initial_op.get() {
            for n in initial {
                if let Ok(id) = n.Id() {
                    seen_ids.insert(id);
                }
            }
        }
    }

    loop {
        std::thread::sleep(Duration::from_millis(1000));

        let notifs_op = match listener.GetNotificationsAsync(NotificationKinds::Toast) {
            Ok(op) => op,
            Err(_) => continue,
        };

        let notifs = match notifs_op.get() {
            Ok(n) => n,
            Err(_) => continue,
        };

        for n in notifs {
            let id = match n.Id() {
                Ok(id) => id,
                Err(_) => continue,
            };

            if seen_ids.insert(id) {
                // New notification received!
                let app_name = n
                    .AppInfo()
                    .and_then(|a| a.DisplayInfo())
                    .and_then(|d| d.DisplayName())
                    .map(|s| s.to_string())
                    .unwrap_or_else(|_| "App".into());

                let mut title = String::new();
                let mut body = String::new();

                if let Ok(notification) = n.Notification() {
                    if let Ok(visual) = notification.Visual() {
                        if let Ok(toast_generic) = KnownNotificationBindings::ToastGeneric() {
                            if let Ok(binding) = visual.GetBinding(&toast_generic) {
                                if let Ok(texts) = binding.GetTextElements() {
                                    if let Ok(t0) = texts.GetAt(0) {
                                        title = t0.Text().map(|s| s.to_string()).unwrap_or_default();
                                    }
                                    if let Ok(t1) = texts.GetAt(1) {
                                        body = t1.Text().map(|s| s.to_string()).unwrap_or_default();
                                    }
                                }
                            }
                        }
                    }
                }

                if !title.is_empty() || !body.is_empty() {
                    let now = std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .map(|d| d.as_millis() as u64)
                        .unwrap_or(0);

                    let payload = NotificationPayload {
                        id,
                        app_name,
                        title,
                        body,
                        timestamp_ms: now,
                    };

                    let _ = app.emit(NOTIFICATION_EVENT, &payload);
                    crate::log::line(format!("notification [{}] {}: {}", payload.app_name, payload.title, payload.body));
                }
            }
        }

        if seen_ids.len() > 1000 {
            seen_ids.clear();
        }
    }
}
