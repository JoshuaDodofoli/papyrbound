use crate::models::{
    BookDetails, BookProgressStat, BookSettings, BookSummary, Bookmark, DailyActivity,
    Highlight, HourlyActivity, ReadingInsights, ReadingProgress, ReadingSession, TocItem,
};
use chrono::Utc;
use rusqlite::{params, Connection, Result};
use std::path::Path;
use std::sync::Mutex;
use uuid::Uuid;

pub struct Database {
    pub conn: Mutex<Connection>,
}

impl Database {
    pub fn new<P: AsRef<Path>>(db_path: P) -> Result<Self> {
        let conn = Connection::open(db_path)?;
        let db = Database {
            conn: Mutex::new(conn),
        };
        db.init_schema()?;
        Ok(db)
    }

    pub fn init_schema(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS books (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                author TEXT,
                publisher TEXT,
                description TEXT,
                language TEXT,
                identifier TEXT,
                cover_image TEXT,
                total_chapters INTEGER NOT NULL DEFAULT 0,
                toc_json TEXT,
                file_path TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS reading_progress (
                book_id TEXT PRIMARY KEY,
                chapter_index INTEGER NOT NULL DEFAULT 0,
                scroll_position REAL NOT NULL DEFAULT 0.0,
                progress_percent REAL NOT NULL DEFAULT 0.0,
                updated_at TEXT NOT NULL,
                FOREIGN KEY(book_id) REFERENCES books(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS book_settings (
                book_id TEXT PRIMARY KEY,
                layout_mode TEXT NOT NULL DEFAULT 'single',
                reading_direction TEXT NOT NULL DEFAULT 'ltr',
                comic_fit_mode TEXT NOT NULL DEFAULT 'contain',
                font_size INTEGER NOT NULL DEFAULT 18,
                theme TEXT NOT NULL DEFAULT 'paper',
                font_family TEXT NOT NULL DEFAULT 'serif',
                line_height TEXT NOT NULL DEFAULT 'relaxed',
                text_align TEXT NOT NULL DEFAULT 'justify',
                column_width TEXT NOT NULL DEFAULT 'normal',
                updated_at TEXT NOT NULL,
                FOREIGN KEY(book_id) REFERENCES books(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS highlights (
                id TEXT PRIMARY KEY,
                book_id TEXT NOT NULL,
                chapter_index INTEGER NOT NULL,
                selected_text TEXT NOT NULL,
                color TEXT NOT NULL,
                note TEXT,
                cfi_or_range TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY(book_id) REFERENCES books(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS bookmarks (
                id TEXT PRIMARY KEY,
                book_id TEXT NOT NULL,
                chapter_index INTEGER NOT NULL,
                chapter_title TEXT,
                scroll_position REAL NOT NULL DEFAULT 0.0,
                created_at TEXT NOT NULL,
                FOREIGN KEY(book_id) REFERENCES books(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS reading_sessions (
                id TEXT PRIMARY KEY,
                book_id TEXT NOT NULL,
                start_time TEXT NOT NULL,
                end_time TEXT NOT NULL,
                duration_seconds INTEGER NOT NULL DEFAULT 0,
                chapters_read INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY(book_id) REFERENCES books(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_books_created_at ON books(created_at);
            CREATE INDEX IF NOT EXISTS idx_progress_updated_at ON reading_progress(updated_at);
            CREATE INDEX IF NOT EXISTS idx_highlights_book ON highlights(book_id, chapter_index);
            CREATE INDEX IF NOT EXISTS idx_bookmarks_book ON bookmarks(book_id, chapter_index);
            CREATE INDEX IF NOT EXISTS idx_sessions_book ON reading_sessions(book_id);
            CREATE INDEX IF NOT EXISTS idx_sessions_start ON reading_sessions(start_time);
            ",
        )?;
        Ok(())
    }

    pub fn insert_or_update_book(&self, book: &BookDetails) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let toc_json = serde_json::to_string(&book.toc).unwrap_or_else(|_| "[]".to_string());

        conn.execute(
            "
            INSERT INTO books (
                id, title, author, publisher, description, language,
                identifier, cover_image, total_chapters, toc_json, file_path, created_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
            ON CONFLICT(file_path) DO UPDATE SET
                title = excluded.title,
                author = excluded.author,
                publisher = excluded.publisher,
                description = excluded.description,
                language = excluded.language,
                identifier = excluded.identifier,
                cover_image = excluded.cover_image,
                total_chapters = excluded.total_chapters,
                toc_json = excluded.toc_json
            ",
            params![
                book.id,
                book.title,
                book.author,
                book.publisher,
                book.description,
                book.language,
                book.identifier,
                book.cover_image,
                book.total_chapters,
                toc_json,
                book.file_path,
                book.created_at,
            ],
        )?;

        Ok(())
    }

    pub fn get_all_books(&self) -> Result<Vec<BookSummary>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "
            SELECT 
                b.id, b.title, b.author, b.cover_image, b.total_chapters,
                COALESCE(p.chapter_index, 0) as current_chapter,
                COALESCE(p.progress_percent, 0.0) as progress_percent,
                p.updated_at as last_read_at,
                b.created_at, b.file_path
            FROM books b
            LEFT JOIN reading_progress p ON b.id = p.book_id
            ORDER BY COALESCE(p.updated_at, b.created_at) DESC
            ",
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(BookSummary {
                id: row.get(0)?,
                title: row.get(1)?,
                author: row.get(2)?,
                cover_image: row.get(3)?,
                total_chapters: row.get::<_, i64>(4)? as usize,
                current_chapter: row.get::<_, i64>(5)? as usize,
                progress_percent: row.get(6)?,
                last_read_at: row.get(7)?,
                created_at: row.get(8)?,
                file_path: row.get(9)?,
            })
        })?;

        let mut books = Vec::new();
        for book in rows {
            books.push(book?);
        }
        Ok(books)
    }

    pub fn get_book_details(&self, book_id: &str) -> Result<Option<BookDetails>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "
            SELECT id, title, author, publisher, description, language,
                   identifier, cover_image, total_chapters, toc_json, file_path, created_at
            FROM books
            WHERE id = ?1
            ",
        )?;

        let mut rows = stmt.query_map(params![book_id], |row| {
            let toc_raw: String = row.get(9)?;
            let toc: Vec<TocItem> = serde_json::from_str(&toc_raw).unwrap_or_default();

            Ok(BookDetails {
                id: row.get(0)?,
                title: row.get(1)?,
                author: row.get(2)?,
                publisher: row.get(3)?,
                description: row.get(4)?,
                language: row.get(5)?,
                identifier: row.get(6)?,
                cover_image: row.get(7)?,
                total_chapters: row.get::<_, i64>(8)? as usize,
                toc,
                file_path: row.get(10)?,
                created_at: row.get(11)?,
            })
        })?;

        if let Some(book) = rows.next() {
            Ok(Some(book?))
        } else {
            Ok(None)
        }
    }

    pub fn get_book_by_path(&self, file_path: &str) -> Result<Option<BookDetails>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "
            SELECT id, title, author, publisher, description, language,
                   identifier, cover_image, total_chapters, toc_json, file_path, created_at
            FROM books
            WHERE file_path = ?1
            ",
        )?;

        let mut rows = stmt.query_map(params![file_path], |row| {
            let toc_raw: String = row.get(9)?;
            let toc: Vec<TocItem> = serde_json::from_str(&toc_raw).unwrap_or_default();

            Ok(BookDetails {
                id: row.get(0)?,
                title: row.get(1)?,
                author: row.get(2)?,
                publisher: row.get(3)?,
                description: row.get(4)?,
                language: row.get(5)?,
                identifier: row.get(6)?,
                cover_image: row.get(7)?,
                total_chapters: row.get::<_, i64>(8)? as usize,
                toc,
                file_path: row.get(10)?,
                created_at: row.get(11)?,
            })
        })?;

        if let Some(book) = rows.next() {
            Ok(Some(book?))
        } else {
            Ok(None)
        }
    }

    pub fn save_progress(
        &self,
        book_id: &str,
        chapter_index: usize,
        scroll_position: f64,
        progress_percent: f64,
    ) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let now = Utc::now().to_rfc3339();

        conn.execute(
            "
            INSERT INTO reading_progress (book_id, chapter_index, scroll_position, progress_percent, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5)
            ON CONFLICT(book_id) DO UPDATE SET
                chapter_index = excluded.chapter_index,
                scroll_position = excluded.scroll_position,
                progress_percent = excluded.progress_percent,
                updated_at = excluded.updated_at
            ",
            params![book_id, chapter_index as i64, scroll_position, progress_percent, now],
        )?;

        Ok(())
    }

    pub fn get_progress(&self, book_id: &str) -> Result<Option<ReadingProgress>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "
            SELECT book_id, chapter_index, scroll_position, progress_percent, updated_at
            FROM reading_progress
            WHERE book_id = ?1
            ",
        )?;

        let mut rows = stmt.query_map(params![book_id], |row| {
            Ok(ReadingProgress {
                book_id: row.get(0)?,
                chapter_index: row.get::<_, i64>(1)? as usize,
                scroll_position: row.get(2)?,
                progress_percent: row.get(3)?,
                updated_at: row.get(4)?,
            })
        })?;

        if let Some(progress) = rows.next() {
            Ok(Some(progress?))
        } else {
            Ok(None)
        }
    }

    pub fn delete_book(&self, book_id: &str) -> Result<bool> {
        let conn = self.conn.lock().unwrap();
        let rows = conn.execute("DELETE FROM books WHERE id = ?1", params![book_id])?;
        Ok(rows > 0)
    }

    // Highlights & Annotations
    pub fn save_highlight(&self, highlight: &Highlight) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "
            INSERT INTO highlights (
                id, book_id, chapter_index, selected_text, color, note, cfi_or_range, created_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
            ON CONFLICT(id) DO UPDATE SET
                color = excluded.color,
                note = excluded.note
            ",
            params![
                highlight.id,
                highlight.book_id,
                highlight.chapter_index as i64,
                highlight.selected_text,
                highlight.color,
                highlight.note,
                highlight.cfi_or_range,
                highlight.created_at,
            ],
        )?;
        Ok(())
    }

    pub fn get_highlights(&self, book_id: &str, chapter_index: Option<usize>) -> Result<Vec<Highlight>> {
        let conn = self.conn.lock().unwrap();
        let mut highlights = Vec::new();

        if let Some(idx) = chapter_index {
            let mut stmt = conn.prepare(
                "
                SELECT id, book_id, chapter_index, selected_text, color, note, cfi_or_range, created_at
                FROM highlights
                WHERE book_id = ?1 AND chapter_index = ?2
                ORDER BY created_at ASC
                ",
            )?;
            let rows = stmt.query_map(params![book_id, idx as i64], |row| {
                Ok(Highlight {
                    id: row.get(0)?,
                    book_id: row.get(1)?,
                    chapter_index: row.get::<_, i64>(2)? as usize,
                    selected_text: row.get(3)?,
                    color: row.get(4)?,
                    note: row.get(5)?,
                    cfi_or_range: row.get(6)?,
                    created_at: row.get(7)?,
                })
            })?;
            for h in rows {
                highlights.push(h?);
            }
        } else {
            let mut stmt = conn.prepare(
                "
                SELECT id, book_id, chapter_index, selected_text, color, note, cfi_or_range, created_at
                FROM highlights
                WHERE book_id = ?1
                ORDER BY chapter_index ASC, created_at ASC
                ",
            )?;
            let rows = stmt.query_map(params![book_id], |row| {
                Ok(Highlight {
                    id: row.get(0)?,
                    book_id: row.get(1)?,
                    chapter_index: row.get::<_, i64>(2)? as usize,
                    selected_text: row.get(3)?,
                    color: row.get(4)?,
                    note: row.get(5)?,
                    cfi_or_range: row.get(6)?,
                    created_at: row.get(7)?,
                })
            })?;
            for h in rows {
                highlights.push(h?);
            }
        }

        Ok(highlights)
    }

    pub fn delete_highlight(&self, highlight_id: &str) -> Result<bool> {
        let conn = self.conn.lock().unwrap();
        let rows = conn.execute("DELETE FROM highlights WHERE id = ?1", params![highlight_id])?;
        Ok(rows > 0)
    }

    // Bookmarks
    pub fn toggle_bookmark(
        &self,
        book_id: &str,
        chapter_index: usize,
        chapter_title: Option<String>,
        scroll_position: f64,
    ) -> Result<bool> {
        let conn = self.conn.lock().unwrap();
        // Check if bookmark exists for this chapter
        let mut stmt = conn.prepare(
            "SELECT id FROM bookmarks WHERE book_id = ?1 AND chapter_index = ?2",
        )?;
        let mut rows = stmt.query(params![book_id, chapter_index as i64])?;

        if let Some(row) = rows.next()? {
            let id: String = row.get(0)?;
            conn.execute("DELETE FROM bookmarks WHERE id = ?1", params![id])?;
            Ok(false) // Removed
        } else {
            let id = Uuid::new_v4().to_string();
            let now = Utc::now().to_rfc3339();
            conn.execute(
                "
                INSERT INTO bookmarks (id, book_id, chapter_index, chapter_title, scroll_position, created_at)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                ",
                params![id, book_id, chapter_index as i64, chapter_title, scroll_position, now],
            )?;
            Ok(true) // Created
        }
    }

    pub fn get_bookmarks(&self, book_id: &str) -> Result<Vec<Bookmark>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "
            SELECT id, book_id, chapter_index, chapter_title, scroll_position, created_at
            FROM bookmarks
            WHERE book_id = ?1
            ORDER BY chapter_index ASC, created_at ASC
            ",
        )?;

        let rows = stmt.query_map(params![book_id], |row| {
            Ok(Bookmark {
                id: row.get(0)?,
                book_id: row.get(1)?,
                chapter_index: row.get::<_, i64>(2)? as usize,
                chapter_title: row.get(3)?,
                scroll_position: row.get(4)?,
                created_at: row.get(5)?,
            })
        })?;

        let mut bookmarks = Vec::new();
        for b in rows {
            bookmarks.push(b?);
        }
        Ok(bookmarks)
    }

    pub fn get_all_highlights(&self) -> Result<Vec<Highlight>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "
            SELECT id, book_id, chapter_index, selected_text, color, note, cfi_or_range, created_at
            FROM highlights
            ORDER BY created_at DESC
            ",
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(Highlight {
                id: row.get(0)?,
                book_id: row.get(1)?,
                chapter_index: row.get::<_, i64>(2)? as usize,
                selected_text: row.get(3)?,
                color: row.get(4)?,
                note: row.get(5)?,
                cfi_or_range: row.get(6)?,
                created_at: row.get(7)?,
            })
        })?;

        let mut highlights = Vec::new();
        for h in rows {
            highlights.push(h?);
        }
        Ok(highlights)
    }

    pub fn get_all_bookmarks(&self) -> Result<Vec<Bookmark>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "
            SELECT id, book_id, chapter_index, chapter_title, scroll_position, created_at
            FROM bookmarks
            ORDER BY created_at DESC
            ",
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(Bookmark {
                id: row.get(0)?,
                book_id: row.get(1)?,
                chapter_index: row.get::<_, i64>(2)? as usize,
                chapter_title: row.get(3)?,
                scroll_position: row.get(4)?,
                created_at: row.get(5)?,
            })
        })?;

        let mut bookmarks = Vec::new();
        for b in rows {
            bookmarks.push(b?);
        }
        Ok(bookmarks)
    }

    pub fn delete_bookmark(&self, bookmark_id: &str) -> Result<bool> {
        let conn = self.conn.lock().unwrap();
        let rows = conn.execute("DELETE FROM bookmarks WHERE id = ?1", params![bookmark_id])?;
        Ok(rows > 0)
    }

    // Per-Book Settings Persistence
    pub fn save_book_settings(&self, settings: &BookSettings) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let now = Utc::now().to_rfc3339();

        conn.execute(
            "
            INSERT INTO book_settings (
                book_id, layout_mode, reading_direction, comic_fit_mode,
                font_size, theme, font_family, line_height, text_align, column_width, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
            ON CONFLICT(book_id) DO UPDATE SET
                layout_mode = excluded.layout_mode,
                reading_direction = excluded.reading_direction,
                comic_fit_mode = excluded.comic_fit_mode,
                font_size = excluded.font_size,
                theme = excluded.theme,
                font_family = excluded.font_family,
                line_height = excluded.line_height,
                text_align = excluded.text_align,
                column_width = excluded.column_width,
                updated_at = excluded.updated_at
            ",
            params![
                settings.book_id,
                settings.layout_mode,
                settings.reading_direction,
                settings.comic_fit_mode,
                settings.font_size,
                settings.theme,
                settings.font_family,
                settings.line_height,
                settings.text_align,
                settings.column_width,
                now,
            ],
        )?;

        Ok(())
    }

    pub fn get_book_settings(&self, book_id: &str) -> Result<Option<BookSettings>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "
            SELECT book_id, layout_mode, reading_direction, comic_fit_mode,
                   font_size, theme, font_family, line_height, text_align, column_width, updated_at
            FROM book_settings
            WHERE book_id = ?1
            ",
        )?;

        let mut rows = stmt.query_map(params![book_id], |row| {
            Ok(BookSettings {
                book_id: row.get(0)?,
                layout_mode: row.get(1)?,
                reading_direction: row.get(2)?,
                comic_fit_mode: row.get(3)?,
                font_size: row.get(4)?,
                theme: row.get(5)?,
                font_family: row.get(6)?,
                line_height: row.get(7)?,
                text_align: row.get(8)?,
                column_width: row.get(9)?,
                updated_at: row.get(10)?,
            })
        })?;

        if let Some(res) = rows.next() {
            Ok(Some(res?))
        } else {
            Ok(None)
        }
    }

    // Reading Sessions & Analytics Engine
    pub fn record_reading_session(&self, session: &ReadingSession) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "
            INSERT INTO reading_sessions (
                id, book_id, start_time, end_time, duration_seconds, chapters_read
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
            ",
            params![
                session.id,
                session.book_id,
                session.start_time,
                session.end_time,
                session.duration_seconds,
                session.chapters_read,
            ],
        )?;
        Ok(())
    }

    pub fn get_reading_insights(&self) -> Result<ReadingInsights> {
        let conn = self.conn.lock().unwrap();

        // 1. Overall stats
        let total_reading_seconds: i64 = conn.query_row(
            "SELECT COALESCE(SUM(duration_seconds), 0) FROM reading_sessions",
            [],
            |r| r.get(0),
        ).unwrap_or(0);

        let total_sessions: i64 = conn.query_row(
            "SELECT COUNT(*) FROM reading_sessions",
            [],
            |r| r.get(0),
        ).unwrap_or(0);

        let today_reading_seconds: i64 = conn.query_row(
            "SELECT COALESCE(SUM(duration_seconds), 0) FROM reading_sessions WHERE date(start_time) = date('now')",
            [],
            |r| r.get(0),
        ).unwrap_or(0);

        // 2. Hourly distribution (0..23)
        let mut hourly_map = std::collections::HashMap::new();
        {
            let mut stmt = conn.prepare(
                "
                SELECT CAST(strftime('%H', start_time) AS INTEGER) as hr,
                       COALESCE(SUM(duration_seconds), 0)
                FROM reading_sessions
                GROUP BY hr
                ",
            )?;
            let rows = stmt.query_map([], |row| {
                let hr: u32 = row.get(0)?;
                let secs: i64 = row.get(1)?;
                Ok((hr, secs))
            })?;
            for r in rows.flatten() {
                hourly_map.insert(r.0, r.1);
            }
        }

        let mut hourly_distribution = Vec::new();
        for h in 0..24 {
            let total_seconds = *hourly_map.get(&h).unwrap_or(&0);
            hourly_distribution.push(HourlyActivity {
                hour: h,
                total_seconds,
            });
        }

        // 3. Daily activity history (last 30 active days)
        let mut daily_history = Vec::new();
        {
            let mut stmt = conn.prepare(
                "
                SELECT date(start_time) as day,
                       COALESCE(SUM(duration_seconds), 0),
                       COUNT(*)
                FROM reading_sessions
                GROUP BY day
                ORDER BY day DESC
                LIMIT 30
                ",
            )?;
            let rows = stmt.query_map([], |row| {
                Ok(DailyActivity {
                    date: row.get(0)?,
                    total_seconds: row.get(1)?,
                    session_count: row.get(2)?,
                })
            })?;
            for r in rows.flatten() {
                daily_history.push(r);
            }
        }

        // 4. Calculate streak (consecutive days)
        let mut current_streak_days: u32 = 0;
        {
            let mut stmt = conn.prepare(
                "
                SELECT DISTINCT date(start_time) as day
                FROM reading_sessions
                ORDER BY day DESC
                ",
            )?;
            let days: Vec<String> = stmt
                .query_map([], |row| row.get(0))?
                .filter_map(|r| r.ok())
                .collect();

            if !days.is_empty() {
                let today_str = Utc::now().format("%Y-%m-%d").to_string();
                let yesterday_str = (Utc::now() - chrono::Duration::days(1)).format("%Y-%m-%d").to_string();

                if days[0] == today_str || days[0] == yesterday_str {
                    let mut check_date = if days[0] == today_str {
                        Utc::now()
                    } else {
                        Utc::now() - chrono::Duration::days(1)
                    };
                    for d in &days {
                        let expected = check_date.format("%Y-%m-%d").to_string();
                        if d == &expected {
                            current_streak_days += 1;
                            check_date = check_date - chrono::Duration::days(1);
                        } else {
                            break;
                        }
                    }
                }
            }
        }

        // 5. Per-book progress and time spent
        let mut book_stats = Vec::new();
        let mut completed_books_count = 0;
        let mut in_progress_books_count = 0;

        {
            let mut stmt = conn.prepare(
                "
                SELECT b.id, b.title, b.author, b.cover_image, b.total_chapters,
                       COALESCE(rp.chapter_index, 0),
                       COALESCE(rp.progress_percent, 0.0),
                       COALESCE((SELECT SUM(rs.duration_seconds) FROM reading_sessions rs WHERE rs.book_id = b.id), 0),
                       rp.updated_at
                FROM books b
                LEFT JOIN reading_progress rp ON b.id = rp.book_id
                ORDER BY rp.updated_at DESC, b.created_at DESC
                ",
            )?;

            let rows = stmt.query_map([], |row| {
                let total_ch: usize = row.get(4)?;
                let curr_ch: usize = row.get(5)?;
                let prog: f64 = row.get(6)?;
                let total_sec: i64 = row.get(7)?;
                let is_completed = prog >= 99.0 || (total_ch > 0 && curr_ch + 1 >= total_ch && prog >= 80.0);

                Ok(BookProgressStat {
                    book_id: row.get(0)?,
                    title: row.get(1)?,
                    author: row.get(2)?,
                    cover_image: row.get(3)?,
                    total_chapters: total_ch,
                    current_chapter: curr_ch,
                    progress_percent: prog,
                    total_reading_seconds: total_sec,
                    is_completed,
                    last_read_at: row.get(8)?,
                })
            })?;

            for r in rows.flatten() {
                if r.is_completed {
                    completed_books_count += 1;
                } else if r.progress_percent > 0.0 || r.current_chapter > 0 {
                    in_progress_books_count += 1;
                }
                book_stats.push(r);
            }
        }

        Ok(ReadingInsights {
            total_reading_seconds,
            total_sessions,
            completed_books_count,
            in_progress_books_count,
            current_streak_days,
            today_reading_seconds,
            hourly_distribution,
            daily_history,
            book_stats,
        })
    }
}

