use crate::models::{BookDetails, ChapterContent, TocItem};
use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use chrono::Utc;
use std::fs::File;
use std::io::Read;
use std::path::Path;
use uuid::Uuid;
use zip::ZipArchive;

pub struct ComicEngine;

impl ComicEngine {
    pub fn is_comic_file<P: AsRef<Path>>(path: P) -> bool {
        let path_str = path.as_ref().to_string_lossy().to_lowercase();
        path_str.ends_with(".cbz") || path_str.ends_with(".zip") || path_str.ends_with(".cbr")
    }

    pub fn parse_comic<P: AsRef<Path>>(path: P) -> Result<BookDetails, String> {
        let path_ref = path.as_ref();
        let path_str = path_ref.to_string_lossy().to_string();

        let file = File::open(path_ref).map_err(|e| format!("Failed to open comic file: {e}"))?;
        let mut archive = ZipArchive::new(file).map_err(|e| format!("Failed to read comic ZIP archive: {e}"))?;

        let mut image_names: Vec<String> = Vec::new();
        for i in 0..archive.len() {
            let entry = archive.by_index(i).map_err(|e| format!("ZIP entry error: {e}"))?;
            let name = entry.name().to_string();
            if Self::is_image_filename(&name) && !name.starts_with("__MACOSX") {
                image_names.push(name);
            }
        }

        if image_names.is_empty() {
            return Err("No comic page images found in the archive.".to_string());
        }

        // Natural sort image filenames
        image_names.sort_by(|a, b| alphanumeric_sort(a, b));

        let total_pages = image_names.len();

        // Extract first page as cover
        let cover_image = if let Ok(mut first_entry) = archive.by_name(&image_names[0]) {
            let mut buffer = Vec::new();
            if first_entry.read_to_end(&mut buffer).is_ok() {
                let mime = Self::guess_image_mime(&image_names[0]);
                Some(format!("data:{};base64,{}", mime, BASE64.encode(&buffer)))
            } else {
                None
            }
        } else {
            None
        };

        let file_stem = path_ref
            .file_stem()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        // Generate TOC with pages
        let toc: Vec<TocItem> = image_names
            .iter()
            .enumerate()
            .map(|(idx, name)| TocItem {
                title: format!("Page {}", idx + 1),
                play_order: idx + 1,
                content_src: name.clone(),
                children: Vec::new(),
            })
            .collect();

        let id = Uuid::new_v4().to_string();
        let created_at = Utc::now().to_rfc3339();

        Ok(BookDetails {
            id,
            title: file_stem,
            author: Some("Comic / Manga".to_string()),
            publisher: None,
            description: Some(format!("Comic book archive containing {} illustrated pages.", total_pages)),
            language: None,
            identifier: None,
            cover_image,
            total_chapters: total_pages,
            toc,
            file_path: path_str,
            created_at,
        })
    }

    pub fn get_page_content<P: AsRef<Path>>(
        path: P,
        book_id: &str,
        page_index: usize,
    ) -> Result<ChapterContent, String> {
        let file = File::open(path.as_ref()).map_err(|e| format!("Failed to open comic file: {e}"))?;
        let mut archive = ZipArchive::new(file).map_err(|e| format!("Failed to read ZIP archive: {e}"))?;

        let mut image_names: Vec<String> = Vec::new();
        for i in 0..archive.len() {
            let entry = archive.by_index(i).map_err(|e| format!("ZIP entry error: {e}"))?;
            let name = entry.name().to_string();
            if Self::is_image_filename(&name) && !name.starts_with("__MACOSX") {
                image_names.push(name);
            }
        }

        image_names.sort_by(|a, b| alphanumeric_sort(a, b));

        let total_pages = image_names.len();
        if page_index >= total_pages {
            return Err(format!("Page index {} out of range (total: {})", page_index, total_pages));
        }

        let target_name = &image_names[page_index];
        let mut entry = archive
            .by_name(target_name)
            .map_err(|e| format!("Failed to find page entry {}: {e}", target_name))?;

        let mut buffer = Vec::new();
        entry
            .read_to_end(&mut buffer)
            .map_err(|e| format!("Failed to read image data: {e}"))?;

        let mime = Self::guess_image_mime(target_name);
        let base64_data = BASE64.encode(&buffer);

        // Render clean HTML comic page wrapper
        let html_content = format!(
            r#"<div class="comic-page flex flex-col items-center justify-center min-h-[70vh] w-full select-none">
                <img src="data:{};base64,{}" alt="Page {}" class="max-h-[85vh] max-w-full object-contain mx-auto rounded-md shadow-md shadow-black/15" />
            </div>"#,
            mime,
            base64_data,
            page_index + 1
        );

        Ok(ChapterContent {
            book_id: book_id.to_string(),
            chapter_index: page_index,
            title: Some(format!("Page {} of {}", page_index + 1, total_pages)),
            html_content,
            total_chapters: total_pages,
        })
    }

    fn is_image_filename(name: &str) -> bool {
        let lower = name.to_lowercase();
        lower.ends_with(".jpg")
            || lower.ends_with(".jpeg")
            || lower.ends_with(".png")
            || lower.ends_with(".webp")
            || lower.ends_with(".gif")
            || lower.ends_with(".avif")
    }

    fn guess_image_mime(name: &str) -> &'static str {
        let lower = name.to_lowercase();
        if lower.ends_with(".png") {
            "image/png"
        } else if lower.ends_with(".webp") {
            "image/webp"
        } else if lower.ends_with(".gif") {
            "image/gif"
        } else if lower.ends_with(".avif") {
            "image/avif"
        } else {
            "image/jpeg"
        }
    }
}

// Natural alphanumeric sorting (e.g., page2.png comes before page10.png)
fn alphanumeric_sort(a: &str, b: &str) -> std::cmp::Ordering {
    let mut a_chars = a.chars().peekable();
    let mut b_chars = b.chars().peekable();

    loop {
        match (a_chars.peek(), b_chars.peek()) {
            (None, None) => return std::cmp::Ordering::Equal,
            (None, Some(_)) => return std::cmp::Ordering::Less,
            (Some(_), None) => return std::cmp::Ordering::Greater,
            (Some(ac), Some(bc)) if ac.is_ascii_digit() && bc.is_ascii_digit() => {
                let mut a_num = 0u64;
                while let Some(c) = a_chars.peek() {
                    if let Some(digit) = c.to_digit(10) {
                        a_num = a_num * 10 + digit as u64;
                        a_chars.next();
                    } else {
                        break;
                    }
                }

                let mut b_num = 0u64;
                while let Some(c) = b_chars.peek() {
                    if let Some(digit) = c.to_digit(10) {
                        b_num = b_num * 10 + digit as u64;
                        b_chars.next();
                    } else {
                        break;
                    }
                }

                if a_num != b_num {
                    return a_num.cmp(&b_num);
                }
            }
            (Some(&ac), Some(&bc)) => {
                let cmp = ac.to_ascii_lowercase().cmp(&bc.to_ascii_lowercase());
                if cmp != std::cmp::Ordering::Equal {
                    return cmp;
                }
                a_chars.next();
                b_chars.next();
            }
        }
    }
}
