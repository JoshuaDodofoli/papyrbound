export interface TocItem {
  title: string;
  play_order: number;
  content_src: string;
  children: TocItem[];
}

export interface BookSummary {
  id: string;
  title: string;
  author: string | null;
  cover_image: string | null;
  total_chapters: number;
  current_chapter: number;
  progress_percent: number;
  last_read_at: string | null;
  created_at: string;
  file_path: string;
}

export interface BookDetails {
  id: string;
  title: string;
  author: string | null;
  publisher: string | null;
  description: string | null;
  language: string | null;
  identifier: string | null;
  cover_image: string | null;
  total_chapters: number;
  toc: TocItem[];
  file_path: string;
  created_at: string;
}

export interface ChapterContent {
  book_id: string;
  chapter_index: number;
  title: string | null;
  html_content: string;
  total_chapters: number;
}

export interface ReadingProgress {
  book_id: string;
  chapter_index: number;
  scroll_position: number;
  progress_percent: number;
  updated_at: string;
}

export interface ResourceData {
  mime_type: string;
  data_base64: string;
}

export interface Highlight {
  id: string;
  book_id: string;
  chapter_index: number;
  selected_text: string;
  color: string; // "yellow" | "green" | "blue" | "pink" | "purple"
  note: string | null;
  cfi_or_range: string | null;
  created_at: string;
}

export interface Bookmark {
  id: string;
  book_id: string;
  chapter_index: number;
  chapter_title: string | null;
  scroll_position: number;
  created_at: string;
}
