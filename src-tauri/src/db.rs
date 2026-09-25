use crate::models::{BookDetails, BookSummary, Bookmark, Highlight, ReadingProgress, TocItem};
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

            CREATE INDEX IF NOT EXISTS idx_books_created_at ON books(created_at);
            CREATE INDEX IF NOT EXISTS idx_progress_updated_at ON reading_progress(updated_at);
            CREATE INDEX IF NOT EXISTS idx_highlights_book ON highlights(book_id, chapter_index);
            CREATE INDEX IF NOT EXISTS idx_bookmarks_book ON bookmarks(book_id, chapter_index);
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

    pub fn delete_bookmark(&self, bookmark_id: &str) -> Result<bool> {
        let conn = self.conn.lock().unwrap();
        let rows = conn.execute("DELETE FROM bookmarks WHERE id = ?1", params![bookmark_id])?;
        Ok(rows > 0)
    }
}
