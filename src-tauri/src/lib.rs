use tauri::Manager;

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, get_pet_position, move_pet])
        .setup(|app| {
            // Set the pet window to be transparent
            if let Some(window) = app.get_webview_window("pet") {
                let _ = window.set_ignore_cursor_events(true);
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
