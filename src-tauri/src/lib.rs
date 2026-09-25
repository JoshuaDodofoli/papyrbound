pub mod comic_engine;
pub mod commands;
pub mod db;
pub mod epub_engine;
pub mod models;

use commands::*;
use db::Database;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Initialize SQLite DB in App Data Directory
            let app_data_dir = app
                .path()
                .app_data_dir()
                .map_err(|e| format!("Failed to resolve app data dir: {e}"))?;

            std::fs::create_dir_all(&app_data_dir)
                .map_err(|e| format!("Failed to create app data dir: {e}"))?;

            let db_path = app_data_dir.join("papyrbound.db");
            let database = Database::new(db_path)
                .map_err(|e| format!("Failed to initialize database: {e}"))?;

            app.manage(database);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            import_book,
            get_library,
            get_book_details,
            get_chapter_content,
            get_book_resource,
            save_reading_progress,
            get_reading_progress,
            delete_book,
            create_highlight,
            get_book_highlights,
            delete_highlight,
            toggle_bookmark,
            get_book_bookmarks,
            delete_bookmark
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
