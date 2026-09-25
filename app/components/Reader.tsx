"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  getChapterContent,
  getBookResource,
  saveReadingProgress,
  getReadingProgress,
  createHighlight,
  getBookHighlights,
  deleteHighlight,
  toggleBookmark,
  getBookBookmarks,
  deleteBookmark,
} from "../lib/api";
import type { BookDetails, Bookmark, ChapterContent, Highlight, TocItem } from "../types/epub";

interface ReaderProps {
  book: BookDetails;
  onClose: () => void;
}

type ReadingTheme = "paper" | "sepia" | "dark";
type LayoutMode = "single" | "dual";
type FontFamily = "serif" | "sans" | "mono";
type LineHeight = "compact" | "relaxed" | "spacious";
type TextAlign = "left" | "justify";
type ColumnWidth = "narrow" | "normal" | "wide";
type HighlightColor = "yellow" | "green" | "blue" | "pink" | "purple";
type DrawerTab = "contents" | "notes" | "bookmarks";

interface ReaderSettings {
  fontSize: number;
  theme: ReadingTheme;
  layoutMode: LayoutMode;
  fontFamily: FontFamily;
  lineHeight: LineHeight;
  textAlign: TextAlign;
  columnWidth: ColumnWidth;
}

const DEFAULT_SETTINGS: ReaderSettings = {
  fontSize: 18,
  theme: "paper",
  layoutMode: "single",
  fontFamily: "serif",
  lineHeight: "relaxed",
  textAlign: "justify",
  columnWidth: "normal",
};

const HIGHLIGHT_COLORS: { id: HighlightColor; name: string; bgClass: string; dotClass: string }[] = [
  { id: "yellow", name: "Yellow", bgClass: "bg-amber-300/40 dark:bg-amber-400/30", dotClass: "bg-amber-400" },
  { id: "green", name: "Green", bgClass: "bg-emerald-300/40 dark:bg-emerald-400/30", dotClass: "bg-emerald-400" },
  { id: "blue", name: "Blue", bgClass: "bg-sky-300/40 dark:bg-sky-400/30", dotClass: "bg-sky-400" },
  { id: "pink", name: "Pink", bgClass: "bg-pink-300/40 dark:bg-pink-400/30", dotClass: "bg-pink-400" },
  { id: "purple", name: "Purple", bgClass: "bg-purple-300/40 dark:bg-purple-400/30", dotClass: "bg-purple-400" },
];

export default function Reader({ book, onClose }: ReaderProps) {
  const [currentChapter, setCurrentChapter] = useState(0);
  const [chapterContent, setChapterContent] = useState<ChapterContent | null>(null);
  const [processedHtml, setProcessedHtml] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  
  // Drawer states
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<DrawerTab>("contents");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<ReaderSettings>(DEFAULT_SETTINGS);
  const [scrollPercentage, setScrollPercentage] = useState<number>(0);
  
  // Highlighting state
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [selectionPopup, setSelectionPopup] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);
  const [noteInputOpen, setNoteInputOpen] = useState(false);
  const [noteText, setNoteText] = useState("");

  // Bookmarks state
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);

  const isComic =
    book.file_path.toLowerCase().endsWith(".cbz") ||
    book.file_path.toLowerCase().endsWith(".zip") ||
    book.file_path.toLowerCase().endsWith(".cbr") ||
    book.author === "Comic / Manga";

  const contentRef = useRef<HTMLDivElement>(null);
  const pendingScrollRef = useRef<number | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Load user settings from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("papyrbound_reader_settings");
      if (saved) {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
      }
    } catch {
      // ignore
    }
  }, []);

  const updateSetting = <K extends keyof ReaderSettings>(key: K, value: ReaderSettings[K]) => {
    setSettings((prev) => {
      const updated = { ...prev, [key]: value };
      try {
        localStorage.setItem("papyrbound_reader_settings", JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  };

  // 2. Load highlights and bookmarks for the book
  const loadHighlights = useCallback(async () => {
    try {
      const items = await getBookHighlights(book.id);
      setHighlights(items);
    } catch (err) {
      console.warn("Failed to load highlights:", err);
    }
  }, [book.id]);

  const loadBookmarks = useCallback(async () => {
    try {
      const items = await getBookBookmarks(book.id);
      setBookmarks(items);
    } catch (err) {
      console.warn("Failed to load bookmarks:", err);
    }
  }, [book.id]);

  useEffect(() => {
    loadHighlights();
    loadBookmarks();
  }, [loadHighlights, loadBookmarks]);

  // 3. Restore reading progress from SQLite on mount
  useEffect(() => {
    let isMounted = true;
    getReadingProgress(book.id)
      .then((progress) => {
        if (isMounted && progress && progress.chapter_index < book.total_chapters) {
          pendingScrollRef.current = progress.scroll_position;
          setCurrentChapter(progress.chapter_index);
        }
      })
      .catch((err) => {
        console.warn("Could not retrieve initial progress:", err);
      });

    return () => {
      isMounted = false;
    };
  }, [book.id, book.total_chapters]);

  // 4. Load chapter content when currentChapter changes & inject highlights
  const loadChapter = useCallback(
    async (chapterIdx: number) => {
      setIsLoading(true);
      setSelectionPopup(null);
      setNoteInputOpen(false);
      try {
        const content = await getChapterContent(book.id, chapterIdx);
        setChapterContent(content);

        // Process images inside HTML: replace relative src with base64 data URLs
        const parser = new DOMParser();
        const doc = parser.parseFromString(content.html_content, "text/html");
        const images = doc.querySelectorAll("img");

        for (const img of Array.from(images)) {
          const rawSrc = img.getAttribute("src");
          if (rawSrc && !rawSrc.startsWith("data:") && !rawSrc.startsWith("http")) {
            try {
              const res = await getBookResource(book.id, rawSrc);
              img.setAttribute("src", `data:${res.mime_type};base64,${res.data_base64}`);
            } catch (err) {
              console.warn(`Failed to resolve resource ${rawSrc}:`, err);
            }
          }
        }

        let bodyContent = doc.body ? doc.body.innerHTML : doc.documentElement.innerHTML;

        // Apply highlights for current chapter
        const chapterHighlights = highlights.filter((h) => h.chapter_index === chapterIdx);
        for (const hl of chapterHighlights) {
          if (hl.selected_text && hl.selected_text.length > 2) {
            const colorDef = HIGHLIGHT_COLORS.find((c) => c.id === hl.color) || HIGHLIGHT_COLORS[0];
            const regex = new RegExp(`(${escapeRegex(hl.selected_text)})`, "gi");
            bodyContent = bodyContent.replace(
              regex,
              `<mark class="${colorDef.bgClass} text-inherit rounded px-0.5 transition-colors cursor-pointer" data-highlight-id="${hl.id}" title="${hl.note || ''}">$1</mark>`
            );
          }
        }

        setProcessedHtml(bodyContent);

        // Schedule restoring precise scroll position or reset to top
        requestAnimationFrame(() => {
          if (contentRef.current) {
            if (pendingScrollRef.current !== null) {
              contentRef.current.scrollTop = pendingScrollRef.current;
              pendingScrollRef.current = null;
            } else {
              contentRef.current.scrollTop = 0;
            }
          }
        });
      } catch (err) {
        console.error("Failed to load chapter:", err);
        setProcessedHtml(`<div class="p-8 text-center text-destructive">Failed to load chapter: ${err}</div>`);
      } finally {
        setIsLoading(false);
      }
    },
    [book.id, highlights]
  );

  useEffect(() => {
    loadChapter(currentChapter);
  }, [currentChapter, loadChapter]);

  // 5. Debounced scroll handler to track exact viewport position
  const handleScroll = useCallback(() => {
    if (!contentRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
    const maxScroll = scrollHeight - clientHeight;
    const chapterScrollRatio = maxScroll > 0 ? scrollTop / maxScroll : 0;

    const bookProgress = Math.min(
      100,
      Math.max(
        0,
        Math.round(((currentChapter + chapterScrollRatio) / book.total_chapters) * 100)
      )
    );
    setScrollPercentage(bookProgress);

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveReadingProgress(book.id, currentChapter, scrollTop, bookProgress).catch(console.error);
    }, 400);
  }, [book.id, currentChapter, book.total_chapters]);

  // 6. Text Selection Listener for Highlighting
  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      if (!noteInputOpen) setSelectionPopup(null);
      return;
    }

    const text = selection.toString().trim();
    if (text.length === 0) {
      setSelectionPopup(null);
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    setSelectionPopup({
      x: Math.max(10, rect.left + rect.width / 2 - 120),
      y: Math.max(10, rect.top - 48),
      text,
    });
  };

  const handleApplyHighlight = async (color: HighlightColor) => {
    if (!selectionPopup) return;
    try {
      const created = await createHighlight(
        book.id,
        currentChapter,
        selectionPopup.text,
        color,
        noteText.trim() || undefined
      );
      setHighlights((prev) => [...prev, created]);
      setSelectionPopup(null);
      setNoteInputOpen(false);
      setNoteText("");
      window.getSelection()?.removeAllRanges();
    } catch (err) {
      console.error("Failed to create highlight:", err);
    }
  };

  const handleDeleteHighlight = async (highlightId: string) => {
    try {
      await deleteHighlight(highlightId);
      setHighlights((prev) => prev.filter((h) => h.id !== highlightId));
    } catch (err) {
      console.error("Failed to delete highlight:", err);
    }
  };

  // 7. Bookmark Toggle
  const isCurrentChapterBookmarked = bookmarks.some((b) => b.chapter_index === currentChapter);

  const handleToggleBookmark = async () => {
    try {
      const scrollTop = contentRef.current ? contentRef.current.scrollTop : 0;
      await toggleBookmark(
        book.id,
        currentChapter,
        chapterContent?.title || `Chapter ${currentChapter + 1}`,
        scrollTop
      );
      await loadBookmarks();
    } catch (err) {
      console.error("Failed to toggle bookmark:", err);
    }
  };

  const handleDeleteBookmark = async (bookmarkId: string) => {
    try {
      await deleteBookmark(bookmarkId);
      setBookmarks((prev) => prev.filter((b) => b.id !== bookmarkId));
    } catch (err) {
      console.error("Failed to delete bookmark:", err);
    }
  };

  // 8. Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        if (currentChapter < book.total_chapters - 1) {
          pendingScrollRef.current = null;
          setCurrentChapter((prev) => prev + 1);
        }
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        if (currentChapter > 0) {
          pendingScrollRef.current = null;
          setCurrentChapter((prev) => prev - 1);
        }
      } else if (e.key === "Escape") {
        if (drawerOpen) setDrawerOpen(false);
        else if (settingsOpen) setSettingsOpen(false);
        else if (selectionPopup) setSelectionPopup(null);
        else onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentChapter, book.total_chapters, drawerOpen, settingsOpen, selectionPopup, onClose]);

  // Theme Styles
  const themeClasses: Record<ReadingTheme, string> = {
    paper: "bg-[#fcfbf9] text-[#1f1e1d] selection:bg-amber-200/50",
    sepia: "bg-[#f4ecd8] text-[#5b4636] selection:bg-amber-300/40",
    dark: "bg-[#141414] text-[#d4d4d4] selection:bg-neutral-700/60",
  };

  const headerThemeClasses: Record<ReadingTheme, string> = {
    paper: "bg-[#fcfbf9]/95 border-[#e8e5de] text-[#1f1e1d]",
    sepia: "bg-[#f4ecd8]/95 border-[#e3d8be] text-[#5b4636]",
    dark: "bg-[#141414]/95 border-[#262626] text-[#d4d4d4]",
  };

  const drawerThemeClasses: Record<ReadingTheme, string> = {
    paper: "bg-[#fcfbf9] border-[#e8e5de] text-[#1f1e1d] shadow-2xl",
    sepia: "bg-[#f4ecd8] border-[#e3d8be] text-[#5b4636] shadow-2xl",
    dark: "bg-[#181818] border-[#2e2e2e] text-[#d4d4d4] shadow-2xl",
  };

  const fontFamilyClasses: Record<FontFamily, string> = {
    serif: "font-serif",
    sans: "font-sans",
    mono: "font-mono",
  };

  const lineHeightClasses: Record<LineHeight, string> = {
    compact: "leading-normal [&>p]:leading-normal",
    relaxed: "leading-relaxed [&>p]:leading-relaxed",
    spacious: "leading-loose [&>p]:leading-loose",
  };

  const textAlignClasses: Record<TextAlign, string> = {
    left: "text-left [&>p]:text-left",
    justify: "text-justify [&>p]:text-justify hyphens-auto",
  };

  const columnWidthClasses: Record<ColumnWidth, string> = {
    narrow: "max-w-xl",
    normal: "max-w-2xl",
    wide: "max-w-4xl",
  };

  return (
    <div className={`fixed inset-0 z-50 flex flex-col ${themeClasses[settings.theme]} transition-colors duration-200`}>
      {/* Floating Selection Tooltip for Highlighting */}
      {selectionPopup && (
        <div
          style={{ top: `${selectionPopup.y}px`, left: `${selectionPopup.x}px` }}
          className="fixed z-50 flex flex-col items-center gap-2 p-1.5 rounded-xl bg-card border border-border shadow-lg text-foreground animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex items-center gap-1.5">
            {HIGHLIGHT_COLORS.map((color) => (
              <button
                key={color.id}
                onClick={() => handleApplyHighlight(color.id)}
                className={`size-6 rounded-full ${color.dotClass} hover:scale-110 active:scale-95 transition-transform shadow-xs cursor-pointer border border-black/10`}
                title={`Highlight in ${color.name}`}
              />
            ))}

            <div className="h-4 w-px bg-border mx-1" />

            <button
              onClick={() => setNoteInputOpen(!noteInputOpen)}
              className="px-2 py-1 rounded-md text-xs font-medium hover:bg-secondary transition-colors cursor-pointer flex items-center gap-1"
            >
              <svg className="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Note
            </button>

            <button
              onClick={() => {
                navigator.clipboard.writeText(selectionPopup.text);
                setSelectionPopup(null);
              }}
              className="px-2 py-1 rounded-md text-xs font-medium hover:bg-secondary transition-colors cursor-pointer"
              title="Copy selection"
            >
              Copy
            </button>
          </div>

          {noteInputOpen && (
            <div className="w-64 pt-2 border-t border-border flex flex-col gap-2">
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Add your note..."
                rows={2}
                className="w-full text-xs p-2 rounded-md bg-secondary/80 border border-border focus:outline-none focus:ring-1 focus:ring-ring text-foreground resize-none"
                autoFocus
              />
              <div className="flex items-center justify-end gap-1.5">
                <button
                  onClick={() => setNoteInputOpen(false)}
                  className="px-2 py-1 text-[11px] text-muted-foreground hover:bg-secondary rounded cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleApplyHighlight("yellow")}
                  className="px-2.5 py-1 text-[11px] font-medium bg-primary text-primary-foreground rounded shadow-xs cursor-pointer"
                >
                  Save Note
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Top Reader Navigation Bar */}
      <header
        className={`h-14 shrink-0 flex items-center justify-between px-4 sm:px-6 border-b backdrop-blur-md ${headerThemeClasses[settings.theme]} z-20`}
      >
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
            title="Back to Library (Esc)"
          >
            <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="hidden sm:inline">Library</span>
          </button>

          {/* Drawer Tab Selectors */}
          <div className="flex items-center rounded-lg border border-current/10 bg-black/5 dark:bg-white/5 p-0.5">
            <button
              onClick={() => {
                setActiveTab("contents");
                setDrawerOpen(drawerOpen && activeTab === "contents" ? false : true);
                setSettingsOpen(false);
              }}
              className={`px-2 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                drawerOpen && activeTab === "contents"
                  ? "bg-black/15 dark:bg-white/20 font-bold"
                  : "hover:bg-black/5 dark:hover:bg-white/10 opacity-80"
              }`}
              title="Table of Contents"
            >
              <svg className="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7" />
              </svg>
              <span className="hidden md:inline">Contents</span>
            </button>

            <button
              onClick={() => {
                setActiveTab("notes");
                setDrawerOpen(drawerOpen && activeTab === "notes" ? false : true);
                setSettingsOpen(false);
              }}
              className={`px-2 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                drawerOpen && activeTab === "notes"
                  ? "bg-black/15 dark:bg-white/20 font-bold"
                  : "hover:bg-black/5 dark:hover:bg-white/10 opacity-80"
              }`}
              title="Highlights & Notes"
            >
              <svg className="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
              <span className="hidden md:inline">Notes</span>
              {highlights.length > 0 && (
                <span className="rounded-full bg-current/15 px-1.5 py-0.2 font-mono text-[10px]">
                  {highlights.length}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                setActiveTab("bookmarks");
                setDrawerOpen(drawerOpen && activeTab === "bookmarks" ? false : true);
                setSettingsOpen(false);
              }}
              className={`px-2 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                drawerOpen && activeTab === "bookmarks"
                  ? "bg-black/15 dark:bg-white/20 font-bold"
                  : "hover:bg-black/5 dark:hover:bg-white/10 opacity-80"
              }`}
              title="Bookmarks"
            >
              <svg className="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              <span className="hidden md:inline">Bookmarks</span>
              {bookmarks.length > 0 && (
                <span className="rounded-full bg-current/15 px-1.5 py-0.2 font-mono text-[10px]">
                  {bookmarks.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Center Title & Progress */}
        <div className="text-center truncate max-w-xs sm:max-w-sm px-2">
          <h2 className="text-xs font-semibold truncate">{book.title}</h2>
          <p className="text-[10px] opacity-70 font-mono">
            {isComic
              ? `Page ${currentChapter + 1} of ${book.total_chapters}`
              : `Chapter ${currentChapter + 1} of ${book.total_chapters} • ${scrollPercentage}%`}
          </p>
        </div>

        {/* Reader Preferences & Tools */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Bookmark Active Chapter Button */}
          <button
            onClick={handleToggleBookmark}
            className={`size-8 rounded-lg grid place-items-center text-xs transition-all cursor-pointer ${
              isCurrentChapterBookmarked
                ? "bg-amber-400 text-black shadow-xs font-bold"
                : "hover:bg-black/5 dark:hover:bg-white/10 opacity-70"
            }`}
            title={isCurrentChapterBookmarked ? "Remove Bookmark" : "Bookmark this Chapter"}
          >
            <svg
              className="size-4"
              fill={isCurrentChapterBookmarked ? "currentColor" : "none"}
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </button>

          {/* Dual-Page Spread Toggle */}
          <button
            onClick={() =>
              updateSetting("layoutMode", settings.layoutMode === "single" ? "dual" : "single")
            }
            className={`size-8 rounded-lg grid place-items-center text-xs transition-colors cursor-pointer ${
              settings.layoutMode === "dual"
                ? "bg-black/15 dark:bg-white/20 font-bold"
                : "hover:bg-black/5 dark:hover:bg-white/10 opacity-70"
            }`}
            title={settings.layoutMode === "dual" ? "Switch to Single Column" : "Switch to Dual-Page Spread"}
          >
            <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </button>

          {/* Quick Theme Switcher */}
          <div className="hidden sm:flex items-center rounded-lg border border-current/10 bg-black/5 dark:bg-white/5 p-0.5">
            <button
              onClick={() => updateSetting("theme", "paper")}
              className={`size-6 rounded-md text-[10px] font-medium transition-all cursor-pointer ${
                settings.theme === "paper" ? "bg-[#fcfbf9] text-[#1f1e1d] shadow-xs" : "opacity-60 hover:opacity-100"
              }`}
              title="Paper theme"
            >
              P
            </button>
            <button
              onClick={() => updateSetting("theme", "sepia")}
              className={`size-6 rounded-md text-[10px] font-medium transition-all cursor-pointer ${
                settings.theme === "sepia" ? "bg-[#f4ecd8] text-[#5b4636] shadow-xs" : "opacity-60 hover:opacity-100"
              }`}
              title="Sepia theme"
            >
              S
            </button>
            <button
              onClick={() => updateSetting("theme", "dark")}
              className={`size-6 rounded-md text-[10px] font-medium transition-all cursor-pointer ${
                settings.theme === "dark" ? "bg-[#141414] text-[#d4d4d4] shadow-xs" : "opacity-60 hover:opacity-100"
              }`}
              title="Dark theme"
            >
              D
            </button>
          </div>

          {/* Typography & Spacing Settings Drawer Toggle */}
          <button
            onClick={() => {
              setSettingsOpen(!settingsOpen);
              setDrawerOpen(false);
            }}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
              settingsOpen ? "bg-black/10 dark:bg-white/15" : "hover:bg-black/5 dark:hover:bg-white/10"
            }`}
            title="Appearance & Typography Settings"
          >
            <span className="font-mono text-xs font-semibold">Aa</span>
          </button>
        </div>
      </header>

      {/* Reading Progress Indicator Bar */}
      <div className="w-full bg-current/10 h-0.5 z-20">
        <div
          className="bg-current h-full transition-all duration-150"
          style={{ width: `${scrollPercentage}%` }}
        />
      </div>

      {/* Reader Layout Workspace */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Unified Left Sidebar Drawer with SOLID opaque background */}
        {drawerOpen && (
          <aside className={`absolute inset-y-0 left-0 w-80 max-w-full z-30 border-r flex flex-col animate-in slide-in-from-left duration-200 ${drawerThemeClasses[settings.theme]}`}>
            {/* Drawer Header with Tabs */}
            <div className="p-3 border-b border-current/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab("contents")}
                  className={`text-xs font-mono uppercase tracking-wider px-2 py-1 rounded-md transition-colors cursor-pointer ${
                    activeTab === "contents" ? "font-bold bg-black/10 dark:bg-white/15" : "opacity-60 hover:opacity-100"
                  }`}
                >
                  TOC
                </button>
                <button
                  onClick={() => setActiveTab("notes")}
                  className={`text-xs font-mono uppercase tracking-wider px-2 py-1 rounded-md transition-colors cursor-pointer ${
                    activeTab === "notes" ? "font-bold bg-black/10 dark:bg-white/15" : "opacity-60 hover:opacity-100"
                  }`}
                >
                  Notes ({highlights.length})
                </button>
                <button
                  onClick={() => setActiveTab("bookmarks")}
                  className={`text-xs font-mono uppercase tracking-wider px-2 py-1 rounded-md transition-colors cursor-pointer ${
                    activeTab === "bookmarks" ? "font-bold bg-black/10 dark:bg-white/15" : "opacity-60 hover:opacity-100"
                  }`}
                >
                  Marks ({bookmarks.length})
                </button>
              </div>

              <button
                onClick={() => setDrawerOpen(false)}
                className="size-7 rounded-lg grid place-items-center hover:bg-black/5 dark:hover:bg-white/10 text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Tab: Table of Contents */}
            {activeTab === "contents" && (
              <nav className="flex-1 overflow-y-auto p-3 space-y-1">
                {book.toc.length === 0 ? (
                  Array.from({ length: book.total_chapters }).map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        pendingScrollRef.current = null;
                        setCurrentChapter(idx);
                        setDrawerOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors flex items-center justify-between cursor-pointer ${
                        currentChapter === idx
                          ? "bg-black/10 dark:bg-white/15 font-semibold"
                          : "hover:bg-black/5 dark:hover:bg-white/5 opacity-80"
                      }`}
                    >
                      <span>Chapter {idx + 1}</span>
                      <span className="font-mono text-[10px] opacity-60">#{idx + 1}</span>
                    </button>
                  ))
                ) : (
                  <TocTree
                    items={book.toc}
                    currentChapter={currentChapter}
                    onSelect={(playOrder) => {
                      const targetIdx = Math.min(book.total_chapters - 1, Math.max(0, playOrder - 1));
                      pendingScrollRef.current = null;
                      setCurrentChapter(targetIdx);
                      setDrawerOpen(false);
                    }}
                  />
                )}
              </nav>
            )}

            {/* Tab: Notes & Highlights */}
            {activeTab === "notes" && (
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {highlights.length === 0 ? (
                  <div className="p-6 text-center text-xs opacity-60 space-y-2">
                    <p>No highlights yet.</p>
                    <p className="text-[11px] leading-normal">
                      Select text in any chapter to highlight phrases or add personal notes.
                    </p>
                  </div>
                ) : (
                  highlights.map((h) => {
                    const colorDef = HIGHLIGHT_COLORS.find((c) => c.id === h.color) || HIGHLIGHT_COLORS[0];
                    return (
                      <div
                        key={h.id}
                        className="p-3 rounded-xl border border-current/10 bg-black/5 dark:bg-white/5 space-y-2 group transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className={`size-2 rounded-full ${colorDef.dotClass}`} />
                            <span className="font-mono text-[10px] opacity-60">
                              Chapter {h.chapter_index + 1}
                            </span>
                          </div>
                          <button
                            onClick={() => handleDeleteHighlight(h.id)}
                            className="opacity-0 group-hover:opacity-100 text-destructive text-[11px] hover:underline transition-opacity cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>

                        <p
                          onClick={() => {
                            if (currentChapter !== h.chapter_index) {
                              setCurrentChapter(h.chapter_index);
                            }
                            setDrawerOpen(false);
                          }}
                          className="text-xs leading-relaxed italic border-l-2 border-current/30 pl-2 cursor-pointer hover:opacity-80"
                        >
                          "{h.selected_text}"
                        </p>

                        {h.note && (
                          <div className="text-[11px] font-sans opacity-85 pt-1 border-t border-current/10">
                            {h.note}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Tab: Bookmarks */}
            {activeTab === "bookmarks" && (
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {bookmarks.length === 0 ? (
                  <div className="p-6 text-center text-xs opacity-60 space-y-2">
                    <p>No bookmarks saved.</p>
                    <p className="text-[11px] leading-normal">
                      Click the bookmark ribbon icon in the top toolbar to mark chapters for quick access.
                    </p>
                  </div>
                ) : (
                  bookmarks.map((b) => (
                    <div
                      key={b.id}
                      className="p-2.5 rounded-xl border border-current/10 bg-black/5 dark:bg-white/5 flex items-center justify-between group hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                    >
                      <button
                        onClick={() => {
                          pendingScrollRef.current = b.scroll_position;
                          setCurrentChapter(b.chapter_index);
                          setDrawerOpen(false);
                        }}
                        className="flex-1 text-left min-w-0 pr-2 cursor-pointer"
                      >
                        <div className="flex items-center gap-1.5">
                          <svg className="size-3 text-amber-400 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                          </svg>
                          <span className="truncate text-xs font-semibold">
                            {b.chapter_title || `Chapter ${b.chapter_index + 1}`}
                          </span>
                        </div>
                        <span className="font-mono text-[10px] opacity-60 block mt-0.5 ml-4.5">
                          Chapter {b.chapter_index + 1}
                        </span>
                      </button>

                      <button
                        onClick={() => handleDeleteBookmark(b.id)}
                        className="opacity-0 group-hover:opacity-100 text-destructive text-[11px] hover:underline transition-opacity px-1 cursor-pointer"
                        title="Delete Bookmark"
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </aside>
        )}

        {/* Typography & Spacing Customization Settings Panel with SOLID opaque background */}
        {settingsOpen && (
          <aside className={`absolute inset-y-0 right-0 w-80 max-w-full z-30 border-l flex flex-col animate-in slide-in-from-right duration-200 p-5 space-y-6 overflow-y-auto ${drawerThemeClasses[settings.theme]}`}>
            <div className="flex items-center justify-between border-b border-current/10 pb-3">
              <span className="font-semibold text-xs uppercase tracking-wider font-mono">
                Reader Appearance
              </span>
              <button
                onClick={() => setSettingsOpen(false)}
                className="size-7 rounded-lg grid place-items-center hover:bg-black/5 dark:hover:bg-white/10 text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Font Size Adjuster */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">Font Size</span>
                <span className="font-mono text-[11px] opacity-75">{settings.fontSize}px</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => updateSetting("fontSize", Math.max(14, settings.fontSize - 2))}
                  className="flex-1 py-1.5 rounded-lg border border-current/15 text-xs font-bold hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
                >
                  A-
                </button>
                <input
                  type="range"
                  min="14"
                  max="32"
                  step="1"
                  value={settings.fontSize}
                  onChange={(e) => updateSetting("fontSize", Number(e.target.value))}
                  className="flex-1 accent-current cursor-pointer"
                />
                <button
                  onClick={() => updateSetting("fontSize", Math.min(32, settings.fontSize + 2))}
                  className="flex-1 py-1.5 rounded-lg border border-current/15 text-xs font-bold hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
                >
                  A+
                </button>
              </div>
            </div>

            {/* Font Family */}
            <div className="space-y-2">
              <span className="text-xs font-medium block">Typeface</span>
              <div className="grid grid-cols-3 gap-1.5">
                {(["serif", "sans", "mono"] as FontFamily[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => updateSetting("fontFamily", f)}
                    className={`py-2 rounded-lg text-xs capitalize transition-all cursor-pointer ${
                      settings.fontFamily === f
                        ? "bg-black/15 dark:bg-white/20 font-bold shadow-xs"
                        : "border border-current/10 hover:bg-black/5 dark:hover:bg-white/5 opacity-80"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Line Height Spacing */}
            <div className="space-y-2">
              <span className="text-xs font-medium block">Line Spacing</span>
              <div className="grid grid-cols-3 gap-1.5">
                {(["compact", "relaxed", "spacious"] as LineHeight[]).map((lh) => (
                  <button
                    key={lh}
                    onClick={() => updateSetting("lineHeight", lh)}
                    className={`py-2 rounded-lg text-xs capitalize transition-all cursor-pointer ${
                      settings.lineHeight === lh
                        ? "bg-black/15 dark:bg-white/20 font-bold shadow-xs"
                        : "border border-current/10 hover:bg-black/5 dark:hover:bg-white/5 opacity-80"
                    }`}
                  >
                    {lh}
                  </button>
                ))}
              </div>
            </div>

            {/* Text Alignment */}
            <div className="space-y-2">
              <span className="text-xs font-medium block">Alignment</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => updateSetting("textAlign", "left")}
                  className={`py-2 rounded-lg text-xs transition-all cursor-pointer ${
                    settings.textAlign === "left"
                      ? "bg-black/15 dark:bg-white/20 font-bold"
                      : "border border-current/10 hover:bg-black/5 dark:hover:bg-white/5 opacity-80"
                  }`}
                >
                  Left Align
                </button>
                <button
                  onClick={() => updateSetting("textAlign", "justify")}
                  className={`py-2 rounded-lg text-xs transition-all cursor-pointer ${
                    settings.textAlign === "justify"
                      ? "bg-black/15 dark:bg-white/20 font-bold"
                      : "border border-current/10 hover:bg-black/5 dark:hover:bg-white/5 opacity-80"
                  }`}
                >
                  Justified
                </button>
              </div>
            </div>

            {/* Reading Column Width */}
            <div className="space-y-2">
              <span className="text-xs font-medium block">Reading Width</span>
              <div className="grid grid-cols-3 gap-1.5">
                {(["narrow", "normal", "wide"] as ColumnWidth[]).map((w) => (
                  <button
                    key={w}
                    onClick={() => updateSetting("columnWidth", w)}
                    className={`py-2 rounded-lg text-xs capitalize transition-all cursor-pointer ${
                      settings.columnWidth === w
                        ? "bg-black/15 dark:bg-white/20 font-bold shadow-xs"
                        : "border border-current/10 hover:bg-black/5 dark:hover:bg-white/5 opacity-80"
                    }`}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>

            {/* Layout Spread Mode */}
            <div className="space-y-2">
              <span className="text-xs font-medium block">Page Spread</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => updateSetting("layoutMode", "single")}
                  className={`py-2 rounded-lg text-xs transition-all cursor-pointer ${
                    settings.layoutMode === "single"
                      ? "bg-black/15 dark:bg-white/20 font-bold"
                      : "border border-current/10 hover:bg-black/5 dark:hover:bg-white/5 opacity-80"
                  }`}
                >
                  Single Column
                </button>
                <button
                  onClick={() => updateSetting("layoutMode", "dual")}
                  className={`py-2 rounded-lg text-xs transition-all cursor-pointer ${
                    settings.layoutMode === "dual"
                      ? "bg-black/15 dark:bg-white/20 font-bold"
                      : "border border-current/10 hover:bg-black/5 dark:hover:bg-white/5 opacity-80"
                  }`}
                >
                  Dual Spread
                </button>
              </div>
            </div>
          </aside>
        )}

        {/* Main Reading Canvas */}
        <main
          ref={contentRef}
          onScroll={handleScroll}
          onMouseUp={handleMouseUp}
          className="flex-1 overflow-y-auto px-4 sm:px-12 py-10 flex flex-col items-center"
        >
          {isLoading ? (
            <div className="flex flex-col items-center justify-center my-auto space-y-4">
              <svg className="size-8 animate-spin opacity-50" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span className="font-mono text-xs opacity-60">
                Loading {isComic ? "Page" : "Chapter"} {currentChapter + 1}...
              </span>
            </div>
          ) : (
            <article
              style={{ fontSize: `${settings.fontSize}px` }}
              className={`w-full transition-all duration-150 ${
                isComic
                  ? "max-w-4xl"
                  : settings.layoutMode === "dual"
                  ? "max-w-6xl md:columns-2 gap-14 md:[column-rule:1px_solid_currentColor] md:[column-rule-color:oklch(from_currentColor_l_c_h_/_15%)]"
                  : columnWidthClasses[settings.columnWidth]
              } ${fontFamilyClasses[settings.fontFamily]} ${lineHeightClasses[settings.lineHeight]} ${
                textAlignClasses[settings.textAlign]
              }`}
            >
              {chapterContent?.title && !isComic && (
                <div className="font-mono text-xs uppercase tracking-widest opacity-60 pb-3 border-b border-current/10 mb-8 [break-after:avoid]">
                  {chapterContent.title}
                </div>
              )}

              {/* Render Inlined EPUB XHTML Content or Comic Page Container */}
              <div
                className={`epub-reader-content space-y-5 ${
                  isComic
                    ? "flex justify-center items-center py-2"
                    : "[&>p]:mb-5 [&>h1]:text-2xl [&>h1]:font-bold [&>h1]:mb-4 [&>h2]:text-xl [&>h2]:font-semibold [&>h2]:mb-3 [&>h3]:text-lg [&>h3]:font-medium [&>img]:max-w-full [&>img]:h-auto [&>img]:rounded-lg [&>img]:mx-auto [&>img]:my-6 [&>blockquote]:border-l-2 [&>blockquote]:border-current/30 [&>blockquote]:pl-4 [&>blockquote]:italic [&_table]:w-full [&_table]:border-collapse [&_th]:border-b [&_td]:border-b [&_td]:py-2"
                }`}
                dangerouslySetInnerHTML={{ __html: processedHtml }}
              />

              {/* End of Chapter Navigation Banner */}
              <div className="pt-10 pb-8 border-t border-current/10 flex items-center justify-between gap-4 font-sans [break-before:avoid] [column-span:all]">
                <button
                  disabled={currentChapter === 0}
                  onClick={() => {
                    pendingScrollRef.current = null;
                    setCurrentChapter((prev) => Math.max(0, prev - 1));
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-current/15 text-xs font-medium transition-all hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30 cursor-pointer"
                >
                  {isComic ? "← Previous Page" : "← Previous Chapter"}
                </button>

                <span className="font-mono text-[11px] opacity-60">
                  {isComic
                    ? `Page ${currentChapter + 1} of ${book.total_chapters}`
                    : `Chapter ${currentChapter + 1} of ${book.total_chapters}`}
                </span>

                <button
                  disabled={currentChapter >= book.total_chapters - 1}
                  onClick={() => {
                    pendingScrollRef.current = null;
                    setCurrentChapter((prev) => Math.min(book.total_chapters - 1, prev + 1));
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-current/15 text-xs font-medium transition-all hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30 cursor-pointer"
                >
                  {isComic ? "Next Page →" : "Next Chapter →"}
                </button>
              </div>
            </article>
          )}
        </main>
      </div>
    </div>
  );
}

function escapeRegex(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function TocTree({
  items,
  currentChapter,
  onSelect,
}: {
  items: TocItem[];
  currentChapter: number;
  onSelect: (playOrder: number) => void;
}) {
  return (
    <ul className="space-y-1">
      {items.map((item, idx) => (
        <li key={idx} className="space-y-1">
          <button
            onClick={() => onSelect(item.play_order)}
            className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors flex items-center justify-between hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
          >
            <span className="truncate">{item.title}</span>
            <span className="font-mono text-[10px] opacity-50 ml-2">#{item.play_order}</span>
          </button>
          {item.children && item.children.length > 0 && (
            <div className="pl-3 border-l border-current/10 ml-2">
              <TocTree items={item.children} currentChapter={currentChapter} onSelect={onSelect} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
