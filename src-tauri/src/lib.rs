use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::TrayIconBuilder,
    Emitter, Manager, WindowEvent,
};

#[tauri::command]
fn greet(name: &str) -> String {
    format!("你好, {}! 小光来陪你啦～ ✨", name)
}

#[tauri::command]
fn get_pet_position(window: tauri::Window) -> Result<(i32, i32), String> {
    let pos = window.outer_position().map_err(|e| e.to_string())?;
    Ok((pos.x, pos.y))
}

#[tauri::command]
fn move_pet(window: tauri::Window, x: i32, y: i32) -> Result<(), String> {
    window
        .set_position(tauri::Position::Physical(tauri::PhysicalPosition::new(x, y)))
        .map_err(|e| e.to_string())
}

/// 获取主屏幕尺寸
#[tauri::command]
fn get_screen_size(window: tauri::Window) -> Result<(u32, u32), String> {
    let monitors = window.primary_monitor().map_err(|e| e.to_string())?;
    let (w, h) = monitors.map(|m| (m.size().width, m.size().height)).unwrap_or((1920, 1080));
    Ok((w, h))
}

/// 获取窗口尺寸
#[tauri::command]
fn get_window_size(window: tauri::Window) -> Result<(u32, u32), String> {
    let size = window.inner_size().map_err(|e| e.to_string())?;
    Ok((size.width, size.height))
}

/// 开始拖拽窗口（调用 Tauri 内置拖拽，操作系统原生体验）
#[tauri::command]
async fn start_drag(window: tauri::Window) -> Result<(), String> {
    window.start_dragging().map_err(|e| e.to_string())
}

/// 显示宠物窗口
#[tauri::command]
fn show_window(window: tauri::Window) -> Result<(), String> {
    window.show().map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())
}

/// 隐藏宠物窗口（最小化到托盘）
#[tauri::command]
fn hide_window(window: tauri::Window) -> Result<(), String> {
    window.hide().map_err(|e| e.to_string())
}

/// 切换宠物窗口显示/隐藏
#[tauri::command]
fn toggle_window(window: tauri::Window) -> Result<(), String> {
    if window.is_visible().map_err(|e| e.to_string())? {
        window.hide().map_err(|e| e.to_string())
    } else {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .invoke_handler(tauri::generate_handler![
            greet,
            get_pet_position,
            move_pet,
            get_screen_size,
            get_window_size,
            start_drag,
            show_window,
            hide_window,
            toggle_window,
        ])
        .setup(|app| {
            // ---- 系统托盘 ----
            let show_item = MenuItemBuilder::with_id("show", "显示小光").build(app)?;
            let hide_item = MenuItemBuilder::with_id("hide", "隐藏小光").build(app)?;
            let settings_item = MenuItemBuilder::with_id("settings", "设置").build(app)?;
            let quit_item = MenuItemBuilder::with_id("quit", "退出").build(app)?;

            let menu = MenuBuilder::new(app)
                .item(&show_item)
                .item(&hide_item)
                .separator()
                .item(&settings_item)
                .separator()
                .item(&quit_item)
                .build()?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().cloned().unwrap())
                .tooltip("小光 Desktop Pet")
                .menu(&menu)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("pet") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "hide" => {
                        if let Some(window) = app.get_webview_window("pet") {
                            let _ = window.hide();
                        }
                    }
                    "settings" => {
                        if let Some(window) = app.get_webview_window("pet") {
                            let _ = window.show();
                            let _ = window.set_focus();
                            let _ = window.emit("tray-open-settings", ());
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    // 左键点击托盘图标 → 切换窗口显示
                    if let tauri::tray::TrayIconEvent::Click {
                        button: tauri::tray::MouseButton::Left,
                        button_state: tauri::tray::MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("pet") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            // ---- 窗口关闭事件 → 隐藏到托盘而非退出 ----
            if let Some(window) = app.get_webview_window("pet") {
                let win = window.clone();
                window.on_window_event(move |event| {
                    if let WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = win.hide();
                    }
                });
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
