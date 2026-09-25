use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TocItem {
    pub title: String,
    pub play_order: usize,
    pub content_src: String,
    pub children: Vec<TocItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BookSummary {
    pub id: String,
    pub title: String,
    pub author: Option<String>,
    pub cover_image: Option<String>, // base64 data URL or thumbnail URI
    pub total_chapters: usize,
    pub current_chapter: usize,
    pub progress_percent: f64,
    pub last_read_at: Option<String>,
    pub created_at: String,
    pub file_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BookDetails {
    pub id: String,
    pub title: String,
    pub author: Option<String>,
    pub publisher: Option<String>,
    pub description: Option<String>,
    pub language: Option<String>,
    pub identifier: Option<String>,
    pub cover_image: Option<String>,
    pub total_chapters: usize,
    pub toc: Vec<TocItem>,
    pub file_path: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChapterContent {
    pub book_id: String,
    pub chapter_index: usize,
    pub title: Option<String>,
    pub html_content: String,
    pub total_chapters: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReadingProgress {
    pub book_id: String,
    pub chapter_index: usize,
    pub scroll_position: f64,
    pub progress_percent: f64,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceData {
    pub mime_type: String,
    pub data_base64: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Highlight {
    pub id: String,
    pub book_id: String,
    pub chapter_index: usize,
    pub selected_text: String,
    pub color: String, // "yellow" | "green" | "blue" | "pink" | "purple"
    pub note: Option<String>,
    pub cfi_or_range: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Bookmark {
    pub id: String,
    pub book_id: String,
    pub chapter_index: usize,
    pub chapter_title: Option<String>,
    pub scroll_position: f64,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BookSettings {
    pub book_id: String,
    pub layout_mode: String,
    pub reading_direction: String,
    pub comic_fit_mode: String,
    pub font_size: i64,
    pub theme: String,
    pub font_family: String,
    pub line_height: String,
    pub text_align: String,
    pub column_width: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReadingSession {
    pub id: String,
    pub book_id: String,
    pub start_time: String,
    pub end_time: String,
    pub duration_seconds: i64,
    pub chapters_read: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HourlyActivity {
    pub hour: u32,
    pub total_seconds: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyActivity {
    pub date: String,
    pub total_seconds: i64,
    pub session_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BookProgressStat {
    pub book_id: String,
    pub title: String,
    pub author: Option<String>,
    pub cover_image: Option<String>,
    pub total_chapters: usize,
    pub current_chapter: usize,
    pub progress_percent: f64,
    pub total_reading_seconds: i64,
    pub is_completed: bool,
    pub last_read_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReadingInsights {
    pub total_reading_seconds: i64,
    pub total_sessions: i64,
    pub completed_books_count: usize,
    pub in_progress_books_count: usize,
    pub current_streak_days: u32,
    pub today_reading_seconds: i64,
    pub hourly_distribution: Vec<HourlyActivity>,
    pub daily_history: Vec<DailyActivity>,
    pub book_stats: Vec<BookProgressStat>,
}

