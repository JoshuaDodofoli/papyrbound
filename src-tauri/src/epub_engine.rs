use crate::models::{BookDetails, ChapterContent, ResourceData, TocItem};
use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use chrono::Utc;
use epub::doc::{EpubDoc, NavPoint};
use std::path::Path;
use uuid::Uuid;

pub struct EpubEngine;

impl EpubEngine {
    pub fn parse_book<P: AsRef<Path>>(path: P) -> Result<BookDetails, String> {
        let path_ref = path.as_ref();
        let path_str = path_ref.to_string_lossy().to_string();

        let mut doc = EpubDoc::new(path_ref).map_err(|e| format!("Failed to open EPUB: {e}"))?;

        let title = doc
            .mdata("title")
            .map(|m| m.value.clone())
            .unwrap_or_else(|| path_ref.file_stem().unwrap_or_default().to_string_lossy().to_string());

        let author = doc.mdata("creator").map(|m| m.value.clone());
        let publisher = doc.mdata("publisher").map(|m| m.value.clone());
        let description = doc.mdata("description").map(|m| m.value.clone());
        let language = doc.mdata("language").map(|m| m.value.clone());
        let identifier = doc.mdata("identifier").map(|m| m.value.clone());

        // Extract cover image
        let cover_image = doc.get_cover().map(|(data, mime)| {
            let encoded = BASE64.encode(&data);
            format!("data:{};base64,{}", mime, encoded)
        });

        // Parse Table of Contents
        let toc = Self::convert_toc(&doc.toc);

        // Spine chapter count
        let total_chapters = doc.spine.len();

        let id = Uuid::new_v4().to_string();
        let created_at = Utc::now().to_rfc3339();

        Ok(BookDetails {
            id,
            title,
            author,
            publisher,
            description,
            language,
            identifier,
            cover_image,
            total_chapters,
            toc,
            file_path: path_str,
            created_at,
        })
    }

    fn convert_toc(nav_points: &[NavPoint]) -> Vec<TocItem> {
        nav_points
            .iter()
            .map(|nav| TocItem {
                title: nav.label.clone(),
                play_order: nav.play_order.unwrap_or(0),
                content_src: nav.content.to_string_lossy().to_string(),
                children: Self::convert_toc(&nav.children),
            })
            .collect()
    }

    pub fn get_chapter<P: AsRef<Path>>(
        path: P,
        book_id: &str,
        chapter_index: usize,
    ) -> Result<ChapterContent, String> {
        let mut doc = EpubDoc::new(path.as_ref()).map_err(|e| format!("Failed to open EPUB: {e}"))?;

        let total_chapters = doc.spine.len();
        if chapter_index >= total_chapters {
            return Err(format!(
                "Chapter index {} out of bounds (total: {})",
                chapter_index, total_chapters
            ));
        }

        if !doc.set_current_chapter(chapter_index) {
            return Err(format!("Failed to set chapter index {}", chapter_index));
        }

        let html_content = doc
            .get_current_str()
            .map(|(content, _mime)| content)
            .ok_or_else(|| format!("Failed to load chapter content for index {}", chapter_index))?;

        let title = doc.spine.get(chapter_index).map(|s| s.idref.clone());

        Ok(ChapterContent {
            book_id: book_id.to_string(),
            chapter_index,
            title,
            html_content,
            total_chapters,
        })
    }

    pub fn get_resource<P: AsRef<Path>>(
        path: P,
        resource_id_or_path: &str,
    ) -> Result<ResourceData, String> {
        let mut doc = EpubDoc::new(path.as_ref()).map_err(|e| format!("Failed to open EPUB: {e}"))?;

        let (data, mime_type) = if let Some(res) = doc.get_resource(resource_id_or_path) {
            res
        } else if let Some(bytes) = doc.get_resource_by_path(Path::new(resource_id_or_path)) {
            let mime = Self::guess_mime_type(resource_id_or_path);
            (bytes, mime.to_string())
        } else {
            return Err(format!("Resource not found: {}", resource_id_or_path));
        };

        let data_base64 = BASE64.encode(&data);

        Ok(ResourceData {
            mime_type,
            data_base64,
        })
    }

    fn guess_mime_type(path: &str) -> &'static str {
        let lower = path.to_lowercase();
        if lower.ends_with(".png") {
            "image/png"
        } else if lower.ends_with(".jpg") || lower.ends_with(".jpeg") {
            "image/jpeg"
        } else if lower.ends_with(".gif") {
            "image/gif"
        } else if lower.ends_with(".webp") {
            "image/webp"
        } else if lower.ends_with(".svg") {
            "image/svg+xml"
        } else if lower.ends_with(".css") {
            "text/css"
        } else if lower.ends_with(".js") {
            "application/javascript"
        } else if lower.ends_with(".woff2") {
            "font/woff2"
        } else if lower.ends_with(".woff") {
            "font/woff"
        } else if lower.ends_with(".ttf") {
            "font/ttf"
        } else if lower.ends_with(".otf") {
            "font/otf"
        } else if lower.ends_with(".xhtml") || lower.ends_with(".html") {
            "application/xhtml+xml"
        } else {
            "application/octet-stream"
        }
    }
}
