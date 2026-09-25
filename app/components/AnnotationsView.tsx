"use client";

import React, { useState } from "react";
import type { Bookmark, BookSummary, Highlight } from "../types/epub";

interface AnnotationsViewProps {
  highlights: Highlight[];
  bookmarks: Bookmark[];
  books: BookSummary[];
  onOpenBookToChapter: (bookId: string, chapterIndex: number) => void;
  onDeleteHighlight: (id: string) => void;
  onDeleteBookmark: (id: string) => void;
}

const COLOR_MAP: Record<string, { name: string; bg: string; dot: string }> = {
  yellow: { name: "Yellow", bg: "bg-amber-400/20 text-amber-900 dark:text-amber-300", dot: "bg-amber-400" },
  green: { name: "Green", bg: "bg-emerald-400/20 text-emerald-900 dark:text-emerald-300", dot: "bg-emerald-400" },
  blue: { name: "Blue", bg: "bg-sky-400/20 text-sky-900 dark:text-sky-300", dot: "bg-sky-400" },
  pink: { name: "Pink", bg: "bg-pink-400/20 text-pink-900 dark:text-pink-300", dot: "bg-pink-400" },
  purple: { name: "Purple", bg: "bg-purple-400/20 text-purple-900 dark:text-purple-300", dot: "bg-purple-400" },
};

export default function AnnotationsView({
  highlights,
  bookmarks,
  books,
  onOpenBookToChapter,
  onDeleteHighlight,
  onDeleteBookmark,
}: AnnotationsViewProps) {
  const [activeTab, setActiveTab] = useState<"all" | "highlights" | "bookmarks">("all");
  const [selectedBookFilter, setSelectedBookFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const getBookTitle = (bookId: string) => {
    const book = books.find((b) => b.id === bookId);
    return book ? book.title : "Unknown Title";
  };

  const filteredHighlights = highlights.filter((h) => {
    if (activeTab === "bookmarks") return false;
    if (selectedBookFilter !== "all" && h.book_id !== selectedBookFilter) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      h.selected_text.toLowerCase().includes(q) ||
      (h.note && h.note.toLowerCase().includes(q)) ||
      getBookTitle(h.book_id).toLowerCase().includes(q)
    );
  });

  const filteredBookmarks = bookmarks.filter((b) => {
    if (activeTab === "highlights") return false;
    if (selectedBookFilter !== "all" && b.book_id !== selectedBookFilter) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (b.chapter_title && b.chapter_title.toLowerCase().includes(q)) ||
      getBookTitle(b.book_id).toLowerCase().includes(q)
    );
  });

  const exportAnnotations = () => {
    const data = {
      highlights,
      bookmarks,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `papyrbound-annotations-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalCount = highlights.length + bookmarks.length;

  return (
    <div className="flex-1 overflow-y-auto p-6 sm:p-10 space-y-8 bg-background">
      {/* Header & Export Action */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Annotations & Notes</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {totalCount} saved highlights and chapter bookmarks across your library
          </p>
        </div>

        <button
          onClick={exportAnnotations}
          disabled={totalCount === 0}
          className="h-8 px-3 rounded-lg border border-border bg-card text-xs font-semibold hover:bg-secondary transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-40"
        >
          <svg className="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export JSON
        </button>
      </div>

      {/* Filter Bar */}
      <div className="p-3 rounded-xl bg-card border border-border flex flex-wrap items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search within annotations & notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-8 pl-8 pr-3 text-xs rounded-lg bg-secondary border border-border focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Tab Selector */}
          <div className="flex items-center rounded-lg border border-border bg-secondary/50 p-0.5 text-xs">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                activeTab === "all" ? "bg-card text-foreground font-semibold shadow-xs" : "text-muted-foreground"
              }`}
            >
              All ({totalCount})
            </button>
            <button
              onClick={() => setActiveTab("highlights")}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                activeTab === "highlights" ? "bg-card text-foreground font-semibold shadow-xs" : "text-muted-foreground"
              }`}
            >
              Highlights ({highlights.length})
            </button>
            <button
              onClick={() => setActiveTab("bookmarks")}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                activeTab === "bookmarks" ? "bg-card text-foreground font-semibold shadow-xs" : "text-muted-foreground"
              }`}
            >
              Bookmarks ({bookmarks.length})
            </button>
          </div>

          {/* Book Filter Dropdown */}
          <select
            value={selectedBookFilter}
            onChange={(e) => setSelectedBookFilter(e.target.value)}
            className="h-8 px-2 text-xs rounded-lg bg-secondary border border-border focus:outline-none text-foreground cursor-pointer"
          >
            <option value="all">All Books</option>
            {books.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Annotations Stream List */}
      {filteredHighlights.length === 0 && filteredBookmarks.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center text-center space-y-2 text-muted-foreground">
          <div className="size-12 rounded-full bg-secondary grid place-items-center">
            <svg className="size-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </div>
          <p className="text-xs">No annotations or bookmarks found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Highlight Cards */}
          {filteredHighlights.map((h) => {
            const color = COLOR_MAP[h.color] || COLOR_MAP.yellow;
            return (
              <div
                key={h.id}
                className="group p-4 rounded-xl bg-card border border-border shadow-xs hover:border-primary/40 transition-all space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`size-2 rounded-full ${color.dot}`} />
                      <span className="text-[11px] font-bold text-foreground truncate max-w-[200px]">
                        {getBookTitle(h.book_id)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-muted-foreground">
                        Chapter {h.chapter_index + 1}
                      </span>
                      <button
                        onClick={() => onDeleteHighlight(h.id)}
                        className="opacity-0 group-hover:opacity-100 text-destructive text-xs hover:underline cursor-pointer transition-opacity"
                        title="Delete highlight"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  <blockquote
                    onClick={() => onOpenBookToChapter(h.book_id, h.chapter_index)}
                    className="text-xs leading-relaxed italic border-l-2 border-primary/50 pl-3 text-foreground/90 cursor-pointer hover:text-primary transition-colors"
                  >
                    "{h.selected_text}"
                  </blockquote>

                  {h.note && (
                    <div className="text-[11px] bg-secondary/60 p-2.5 rounded-lg border border-border/60 text-foreground">
                      <span className="font-semibold block text-[10px] text-muted-foreground uppercase font-mono mb-0.5">
                        Note:
                      </span>
                      {h.note}
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                  <span>{new Date(h.created_at).toLocaleDateString()}</span>
                  <button
                    onClick={() => onOpenBookToChapter(h.book_id, h.chapter_index)}
                    className="text-primary hover:underline font-semibold cursor-pointer"
                  >
                    Jump to Chapter →
                  </button>
                </div>
              </div>
            );
          })}

          {/* Bookmark Cards */}
          {filteredBookmarks.map((b) => (
            <div
              key={b.id}
              className="group p-4 rounded-xl bg-card border border-border shadow-xs hover:border-amber-400/50 transition-all space-y-3 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <svg className="size-3.5 text-amber-400 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                    <span className="text-[11px] font-bold text-foreground truncate max-w-[200px]">
                      {getBookTitle(b.book_id)}
                    </span>
                  </div>

                  <button
                    onClick={() => onDeleteBookmark(b.id)}
                    className="opacity-0 group-hover:opacity-100 text-destructive text-xs hover:underline cursor-pointer transition-opacity"
                    title="Delete bookmark"
                  >
                    ✕
                  </button>
                </div>

                <h4
                  onClick={() => onOpenBookToChapter(b.book_id, b.chapter_index)}
                  className="text-xs font-semibold text-foreground cursor-pointer hover:text-primary transition-colors"
                >
                  {b.chapter_title || `Chapter ${b.chapter_index + 1}`}
                </h4>
              </div>

              <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                <span>{new Date(b.created_at).toLocaleDateString()}</span>
                <button
                  onClick={() => onOpenBookToChapter(b.book_id, b.chapter_index)}
                  className="text-amber-500 hover:underline font-semibold cursor-pointer"
                >
                  Open Bookmark →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
