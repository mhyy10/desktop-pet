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

/// 开始拖拽窗口（调用 Tauri 内置拖拽，操作系统原生体验）
#[tauri::command]
async fn start_drag(window: tauri::Window) -> Result<(), String> {
    window.start_dragging().map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            get_pet_position,
            move_pet,
            start_drag,
        ])
        .setup(|_app| {
            // 不再设置 ignore_cursor_events — 让窗口正常接收鼠标事件
            // 这样用户才能拖拽宠物窗口
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
