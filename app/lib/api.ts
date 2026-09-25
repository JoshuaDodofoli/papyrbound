import type {
  BookDetails,
  BookSummary,
  Bookmark,
  ChapterContent,
  Highlight,
  ReadingProgress,
  ResourceData,
} from "../types/epub";

// Dynamic import or check for Tauri runtime
async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    const { invoke: tauriInvoke } = await import("@tauri-apps/api/core");
    return tauriInvoke<T>(cmd, args);
  }
  throw new Error("Tauri API is not available in web mode");
}

export async function importBook(filePath: string): Promise<BookDetails> {
  return invoke<BookDetails>("import_book", { filePath });
}

export async function getLibrary(): Promise<BookSummary[]> {
  return invoke<BookSummary[]>("get_library");
}

export async function getBookDetails(bookId: string): Promise<BookDetails> {
  return invoke<BookDetails>("get_book_details", { bookId });
}

export async function getChapterContent(
  bookId: string,
  chapterIndex: number
): Promise<ChapterContent> {
  return invoke<ChapterContent>("get_chapter_content", {
    bookId,
    chapterIndex,
  });
}

export async function getBookResource(
  bookId: string,
  resourcePath: string
): Promise<ResourceData> {
  return invoke<ResourceData>("get_book_resource", {
    bookId,
    resourcePath,
  });
}

export async function saveReadingProgress(
  bookId: string,
  chapterIndex: number,
  scrollPosition: number,
  progressPercent: number
): Promise<void> {
  return invoke<void>("save_reading_progress", {
    bookId,
    chapterIndex,
    scrollPosition,
    progressPercent,
  });
}

export async function getReadingProgress(
  bookId: string
): Promise<ReadingProgress | null> {
  return invoke<ReadingProgress | null>("get_reading_progress", { bookId });
}

export async function deleteBook(bookId: string): Promise<boolean> {
  return invoke<boolean>("delete_book", { bookId });
}

export async function createHighlight(
  bookId: string,
  chapterIndex: number,
  selectedText: string,
  color: string,
  note?: string,
  cfiOrRange?: string
): Promise<Highlight> {
  return invoke<Highlight>("create_highlight", {
    bookId,
    chapterIndex,
    selectedText,
    color,
    note,
    cfiOrRange,
  });
}

export async function getBookHighlights(
  bookId: string,
  chapterIndex?: number
): Promise<Highlight[]> {
  return invoke<Highlight[]>("get_book_highlights", {
    bookId,
    chapterIndex,
  });
}

export async function deleteHighlight(highlightId: string): Promise<boolean> {
  return invoke<boolean>("delete_highlight", { highlightId });
}

export async function toggleBookmark(
  bookId: string,
  chapterIndex: number,
  chapterTitle?: string | null,
  scrollPosition: number = 0
): Promise<boolean> {
  return invoke<boolean>("toggle_bookmark", {
    bookId,
    chapterIndex,
    chapterTitle: chapterTitle || null,
    scrollPosition,
  });
}

export async function getBookBookmarks(bookId: string): Promise<Bookmark[]> {
  return invoke<Bookmark[]>("get_book_bookmarks", { bookId });
}

export async function deleteBookmark(bookmarkId: string): Promise<boolean> {
  return invoke<boolean>("delete_bookmark", { bookmarkId });
}

export async function openBookFileDialog(): Promise<string | null> {
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({
      multiple: false,
      filters: [
        {
          name: "All Supported Books & Comics",
          extensions: ["epub", "cbz", "zip", "cbr"],
        },
        {
          name: "Comic Archives (CBZ, ZIP)",
          extensions: ["cbz", "zip", "cbr"],
        },
        {
          name: "EPUB eBooks",
          extensions: ["epub"],
        },
      ],
    });
    if (typeof selected === "string") {
      return selected;
    }
  }
  return null;
}
