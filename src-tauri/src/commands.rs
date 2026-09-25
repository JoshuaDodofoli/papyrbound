use crate::comic_engine::ComicEngine;
use crate::db::Database;
use crate::epub_engine::EpubEngine;
use crate::models::{
    BookDetails, BookSettings, BookSummary, Bookmark, ChapterContent, Highlight, ReadingInsights,
    ReadingProgress, ReadingSession, ResourceData,
};
use chrono::Utc;
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub async fn import_book(
    db: State<'_, Database>,
    file_path: String,
) -> Result<BookDetails, String> {
    // Check if book already exists
    if let Ok(Some(existing_book)) = db.get_book_by_path(&file_path) {
        return Ok(existing_book);
    }

    let parsed_book = if ComicEngine::is_comic_file(&file_path) {
        ComicEngine::parse_comic(&file_path)?
    } else {
        EpubEngine::parse_book(&file_path)?
    };

    db.insert_or_update_book(&parsed_book)
        .map_err(|e| format!("Failed to save book to database: {e}"))?;

    Ok(parsed_book)
}

#[tauri::command]
pub async fn get_library(db: State<'_, Database>) -> Result<Vec<BookSummary>, String> {
    db.get_all_books()
        .map_err(|e| format!("Failed to fetch library: {e}"))
}

#[tauri::command]
pub async fn get_book_details(
    db: State<'_, Database>,
    book_id: String,
) -> Result<BookDetails, String> {
    db.get_book_details(&book_id)
        .map_err(|e| format!("Database error: {e}"))?
        .ok_or_else(|| format!("Book not found: {book_id}"))
}

#[tauri::command]
pub async fn get_chapter_content(
    db: State<'_, Database>,
    book_id: String,
    chapter_index: usize,
) -> Result<ChapterContent, String> {
    let book = db
        .get_book_details(&book_id)
        .map_err(|e| format!("Database error: {e}"))?
        .ok_or_else(|| format!("Book not found: {book_id}"))?;

    if ComicEngine::is_comic_file(&book.file_path) {
        ComicEngine::get_page_content(&book.file_path, &book_id, chapter_index)
    } else {
        EpubEngine::get_chapter(&book.file_path, &book_id, chapter_index)
    }
}

#[tauri::command]
pub async fn get_book_resource(
    db: State<'_, Database>,
    book_id: String,
    resource_path: String,
) -> Result<ResourceData, String> {
    let book = db
        .get_book_details(&book_id)
        .map_err(|e| format!("Database error: {e}"))?
        .ok_or_else(|| format!("Book not found: {book_id}"))?;

    if ComicEngine::is_comic_file(&book.file_path) {
        Err("Resources not applicable for standalone comic archives".to_string())
    } else {
        EpubEngine::get_resource(&book.file_path, &resource_path)
    }
}

#[tauri::command]
pub async fn save_reading_progress(
    db: State<'_, Database>,
    book_id: String,
    chapter_index: usize,
    scroll_position: f64,
    progress_percent: f64,
) -> Result<(), String> {
    db.save_progress(&book_id, chapter_index, scroll_position, progress_percent)
        .map_err(|e| format!("Failed to save progress: {e}"))
}

#[tauri::command]
pub async fn get_reading_progress(
    db: State<'_, Database>,
    book_id: String,
) -> Result<Option<ReadingProgress>, String> {
    db.get_progress(&book_id)
        .map_err(|e| format!("Failed to get progress: {e}"))
}

#[tauri::command]
pub async fn delete_book(
    db: State<'_, Database>,
    book_id: String,
) -> Result<bool, String> {
    db.delete_book(&book_id)
        .map_err(|e| format!("Failed to delete book: {e}"))
}

#[tauri::command]
pub async fn create_highlight(
    db: State<'_, Database>,
    book_id: String,
    chapter_index: usize,
    selected_text: String,
    color: String,
    note: Option<String>,
    cfi_or_range: Option<String>,
) -> Result<Highlight, String> {
    let highlight = Highlight {
        id: Uuid::new_v4().to_string(),
        book_id,
        chapter_index,
        selected_text,
        color,
        note,
        cfi_or_range,
        created_at: Utc::now().to_rfc3339(),
    };

    db.save_highlight(&highlight)
        .map_err(|e| format!("Failed to save highlight: {e}"))?;

    Ok(highlight)
}

#[tauri::command]
pub async fn get_book_highlights(
    db: State<'_, Database>,
    book_id: String,
    chapter_index: Option<usize>,
) -> Result<Vec<Highlight>, String> {
    db.get_highlights(&book_id, chapter_index)
        .map_err(|e| format!("Failed to retrieve highlights: {e}"))
}

#[tauri::command]
pub async fn delete_highlight(
    db: State<'_, Database>,
    highlight_id: String,
) -> Result<bool, String> {
    db.delete_highlight(&highlight_id)
        .map_err(|e| format!("Failed to delete highlight: {e}"))
}

#[tauri::command]
pub async fn toggle_bookmark(
    db: State<'_, Database>,
    book_id: String,
    chapter_index: usize,
    chapter_title: Option<String>,
    scroll_position: f64,
) -> Result<bool, String> {
    db.toggle_bookmark(&book_id, chapter_index, chapter_title, scroll_position)
        .map_err(|e| format!("Failed to toggle bookmark: {e}"))
}

#[tauri::command]
pub async fn get_book_bookmarks(
    db: State<'_, Database>,
    book_id: String,
) -> Result<Vec<Bookmark>, String> {
    db.get_bookmarks(&book_id)
        .map_err(|e| format!("Failed to retrieve bookmarks: {e}"))
}

#[tauri::command]
pub async fn get_all_highlights(db: State<'_, Database>) -> Result<Vec<Highlight>, String> {
    db.get_all_highlights()
        .map_err(|e| format!("Failed to retrieve all highlights: {e}"))
}

#[tauri::command]
pub async fn get_all_bookmarks(db: State<'_, Database>) -> Result<Vec<Bookmark>, String> {
    db.get_all_bookmarks()
        .map_err(|e| format!("Failed to retrieve all bookmarks: {e}"))
}

#[tauri::command]
pub async fn delete_bookmark(
    db: State<'_, Database>,
    bookmark_id: String,
) -> Result<bool, String> {
    db.delete_bookmark(&bookmark_id)
        .map_err(|e| format!("Failed to delete bookmark: {e}"))
}

#[tauri::command]
pub async fn save_book_settings(
    db: State<'_, Database>,
    settings: BookSettings,
) -> Result<(), String> {
    db.save_book_settings(&settings)
        .map_err(|e| format!("Failed to save book settings: {e}"))
}

#[tauri::command]
pub async fn get_book_settings(
    db: State<'_, Database>,
    book_id: String,
) -> Result<Option<BookSettings>, String> {
    db.get_book_settings(&book_id)
        .map_err(|e| format!("Failed to fetch book settings: {e}"))
}

#[tauri::command]
pub async fn record_reading_session(
    db: State<'_, Database>,
    session: ReadingSession,
) -> Result<(), String> {
    db.record_reading_session(&session)
        .map_err(|e| format!("Failed to record reading session: {e}"))
}

#[tauri::command]
pub async fn get_reading_insights(
    db: State<'_, Database>,
) -> Result<ReadingInsights, String> {
    db.get_reading_insights()
        .map_err(|e| format!("Failed to compute reading insights: {e}"))
}

