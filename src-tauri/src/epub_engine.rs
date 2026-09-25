use crate::models::{BookDetails, ChapterContent, ResourceData, TocItem};
use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use chrono::Utc;
use epub::doc::{EpubDoc, NavPoint};
use regex::Regex;
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

        let raw_html = doc
            .get_current_str()
            .map(|(content, _mime)| content)
            .ok_or_else(|| format!("Failed to load chapter content for index {}", chapter_index))?;

        let raw_title = doc.spine.get(chapter_index).map(|s| s.idref.clone());

        let (sanitized_html, extracted_title) = Self::sanitize_chapter_html(&raw_html, raw_title.as_deref(), chapter_index);

        let final_title = extracted_title.or(raw_title);

        Ok(ChapterContent {
            book_id: book_id.to_string(),
            chapter_index,
            title: final_title,
            html_content: sanitized_html,
            total_chapters,
        })
    }

    /// Sanitizes reflowable HTML, stripping out raw XML headers, DOCTYPEs,
    /// noisy script tags, structural boilerplate, and raw internal ID headers (e.g. ID142).
    pub fn sanitize_chapter_html(
        raw_html: &str,
        spine_id: Option<&str>,
        chapter_index: usize,
    ) -> (String, Option<String>) {
        let mut html = raw_html.to_string();

        // 1. Strip XML declaration and DOCTYPE
        if let Ok(re_xml) = Regex::new(r"(?is)<\?xml[^>]*\?>") {
            html = re_xml.replace_all(&html, "").to_string();
        }
        if let Ok(re_doctype) = Regex::new(r"(?is)<!DOCTYPE[^>]*>") {
            html = re_doctype.replace_all(&html, "").to_string();
        }

        // 2. Strip scripts for security and clean rendering
        if let Ok(re_script) = Regex::new(r"(?is)<script[^>]*>.*?</script>") {
            html = re_script.replace_all(&html, "").to_string();
        }

        // 3. Extract clean body content if whole document is wrapped in <html>...<body>
        if let Ok(re_body) = Regex::new(r"(?is)<body[^>]*>(.*?)</body>") {
            if let Some(captures) = re_body.captures(&html) {
                if let Some(body_inner) = captures.get(1) {
                    html = body_inner.as_str().to_string();
                }
            }
        } else if let Ok(re_head) = Regex::new(r"(?is)<head[^>]*>.*?</head>") {
            html = re_head.replace_all(&html, "").to_string();
        }

        // 4. Strip raw structural ID headers (e.g. <h1>ID142</h1>, <h2 id="x_id">ID142</h2>, <div>ID142</div>)
        if let Ok(re_raw_header_ids) = Regex::new(r"(?is)<h[1-6][^>]*>\s*(?:ID\d+|id\d+|pgepubid\d+|x_id\d+|chapter_\d+|section_\d+|item\d+)\s*</h[1-6]>") {
            html = re_raw_header_ids.replace_all(&html, "").to_string();
        }

        // 5. Strip raw bracketed or standalone ID paragraphs: e.g. <p class="... font-mono">[ID142]</p> or <p>ID142</p>
        if let Ok(re_id_p) = Regex::new(r"(?is)<p[^>]*>\s*(?:\[?\s*(?:ID\d+|id\d+|pgepubid\d+|x_id\d+)\s*\]?)\s*</p>") {
            html = re_id_p.replace_all(&html, "").to_string();
        }

        // 6. Strip empty anchor structural markers e.g. <a id="ID142"></a>
        if let Ok(re_anchor_ids) = Regex::new(r#"(?is)<a\s+id=["'](?:ID\d+|id\d+|pgepubid\d+|x_id\d+)["'][^>]*>\s*</a>"#) {
            html = re_anchor_ids.replace_all(&html, "").to_string();
        }

        // 7. Strip empty span ID markers e.g. <span id="ID142"></span>
        if let Ok(re_span_ids) = Regex::new(r#"(?is)<span\s+id=["'](?:ID\d+|id\d+|pgepubid\d+|x_id\d+)["'][^>]*>\s*</span>"#) {
            html = re_span_ids.replace_all(&html, "").to_string();
        }

        // 8. Collapse excessive empty paragraphs
        if let Ok(re_empty_p) = Regex::new(r"(?is)(?:<p[^>]*>\s*(?:&nbsp;|\s)*\s*</p>\s*){3,}") {
            html = re_empty_p.replace_all(&html, "<p>&nbsp;</p>").to_string();
        }

        // 9. Extract an intuitive chapter title if current spine title is raw ID (e.g. "id142", "item15")
        let mut extracted_title = None;
        let is_spine_raw = spine_id.map(|id| {
            let lower = id.to_lowercase();
            lower.starts_with("id") || lower.starts_with("item") || lower.starts_with("x_") || lower.starts_with("pgepub")
        }).unwrap_or(true);

        if is_spine_raw {
            // Check for real heading text in first <h1> or <h2>
            if let Ok(re_heading) = Regex::new(r"(?is)<h[1-2][^>]*>(.*?)</h[1-2]>") {
                if let Some(caps) = re_heading.captures(&html) {
                    if let Some(h_text) = caps.get(1) {
                        // Strip internal tags from the heading text
                        if let Ok(re_tags) = Regex::new(r"<[^>]*>") {
                            let clean = re_tags.replace_all(h_text.as_str(), "").trim().to_string();
                            if !clean.is_empty() && clean.len() < 80 {
                                extracted_title = Some(clean);
                            }
                        }
                    }
                }
            }

            if extracted_title.is_none() {
                extracted_title = Some(format!("Chapter {}", chapter_index + 1));
            }
        }

        (html.trim().to_string(), extracted_title)
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

