"use client";

import React, { useState } from "react";
import type { BookDetails, BookSummary } from "../types/epub";

interface LibraryViewProps {
  books: BookSummary[];
  selectedBookId: string | null;
  selectedBookDetails: BookDetails | null;
  onSelectBook: (bookId: string) => void;
  onOpenBook: (bookId: string) => void;
  onDeleteBook: (bookId: string) => void;
  onImport: () => void;
  isImporting: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

type FilterType = "all" | "epub" | "comic" | "reading" | "completed";
type SortType = "recent" | "title" | "author" | "progress";

export default function LibraryView({
  books,
  selectedBookId,
  selectedBookDetails,
  onSelectBook,
  onOpenBook,
  onDeleteBook,
  onImport,
  isImporting,
  searchQuery,
  onSearchChange,
}: LibraryViewProps) {
  const [filter, setFilter] = useState<FilterType>("all");
  const [sort, setSort] = useState<SortType>("recent");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const isComicBook = (b: BookSummary) =>
    b.file_path.toLowerCase().endsWith(".cbz") ||
    b.file_path.toLowerCase().endsWith(".zip") ||
    b.file_path.toLowerCase().endsWith(".cbr") ||
    b.author === "Comic / Manga";

  // Filter
  const filtered = books.filter((b) => {
    const isComic = isComicBook(b);
    if (filter === "epub" && isComic) return false;
    if (filter === "comic" && !isComic) return false;
    if (filter === "reading" && (b.progress_percent <= 0 || b.progress_percent >= 100)) return false;
    if (filter === "completed" && b.progress_percent < 100) return false;

    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return b.title.toLowerCase().includes(q) || (b.author && b.author.toLowerCase().includes(q));
  });

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    if (sort === "recent") {
      const timeA = a.last_read_at || a.created_at;
      const timeB = b.last_read_at || b.created_at;
      return new Date(timeB).getTime() - new Date(timeA).getTime();
    }
    if (sort === "title") return a.title.localeCompare(b.title);
    if (sort === "author") return (a.author || "").localeCompare(b.author || "");
    if (sort === "progress") return b.progress_percent - a.progress_percent;
    return 0;
  });

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Main Grid Shelf Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-background">
        {/* Controls Toolbar */}
        <div className="p-4 sm:px-8 sm:py-5 border-b border-border/60 flex flex-wrap items-center justify-between gap-4">
          {/* Search Input */}
          <div className="relative flex-1 max-w-sm">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search by title or author..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full h-8 pl-8 pr-3 text-xs rounded-lg bg-secondary border border-border focus:outline-none focus:ring-1 focus:ring-ring text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div className="flex items-center gap-2">
            {/* Filter Pills */}
            <div className="hidden md:flex items-center rounded-lg border border-border bg-secondary/50 p-0.5 text-xs">
              {(
                [
                  { id: "all", label: "All" },
                  { id: "epub", label: "EPUBs" },
                  { id: "comic", label: "Comics" },
                  { id: "reading", label: "Reading" },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    filter === f.id
                      ? "bg-card text-foreground font-semibold shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* View Mode Switcher */}
            <div className="flex items-center rounded-lg border border-border bg-secondary/50 p-0.5">
              <button
                onClick={() => setViewMode("grid")}
                className={`size-7 rounded-md grid place-items-center transition-all cursor-pointer ${
                  viewMode === "grid" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                }`}
                title="Grid view"
              >
                <svg className="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`size-7 rounded-md grid place-items-center transition-all cursor-pointer ${
                  viewMode === "list" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                }`}
                title="List view"
              >
                <svg className="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>

            {/* Import Button */}
            <button
              onClick={onImport}
              disabled={isImporting}
              className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-semibold shadow-xs hover:opacity-90 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <svg className="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              Import
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8">
          {sorted.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center space-y-2">
              <p className="text-xs text-muted-foreground">No books matching your filter or query.</p>
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
              {sorted.map((b) => {
                const isSelected = selectedBookId === b.id;
                const isComic = isComicBook(b);
                return (
                  <div
                    key={b.id}
                    onClick={() => onSelectBook(b.id)}
                    onDoubleClick={() => onOpenBook(b.id)}
                    className={`group flex flex-col space-y-2 cursor-pointer transition-all ${
                      isSelected ? "scale-[1.02]" : "hover:scale-[1.01]"
                    }`}
                  >
                    <div
                      className={`relative aspect-[2/3] rounded-xl overflow-hidden bg-muted border shadow-sm transition-all ${
                        isSelected
                          ? "border-primary ring-2 ring-primary/30 shadow-md"
                          : "border-border group-hover:border-border/80 group-hover:shadow-md"
                      }`}
                    >
                      {b.cover_image ? (
                        <img
                          src={b.cover_image}
                          alt={b.title}
                          className="size-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="size-full flex flex-col items-center justify-center p-3 text-center bg-secondary">
                          <span className="font-mono text-xs font-bold text-muted-foreground">
                            {b.title}
                          </span>
                        </div>
                      )}

                      {/* Format Badge */}
                      <span className="absolute top-2 left-2 bg-black/75 text-white backdrop-blur-xs font-mono text-[9px] font-bold px-1.5 py-0.5 rounded uppercase">
                        {isComic ? "Comic" : "EPUB"}
                      </span>

                      {/* Progress bar */}
                      {b.progress_percent > 0 && (
                        <div className="absolute bottom-0 inset-x-0 bg-black/60 backdrop-blur-xs h-1">
                          <div
                            className="bg-amber-400 h-full"
                            style={{ width: `${b.progress_percent}%` }}
                          />
                        </div>
                      )}
                    </div>

                    <div className="space-y-0.5">
                      <h3 className="text-xs font-semibold text-foreground truncate">{b.title}</h3>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {b.author || "Unknown Author"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="divide-y divide-border/60 border border-border/60 rounded-xl overflow-hidden bg-card">
              {sorted.map((b) => {
                const isSelected = selectedBookId === b.id;
                const isComic = isComicBook(b);
                return (
                  <div
                    key={b.id}
                    onClick={() => onSelectBook(b.id)}
                    onDoubleClick={() => onOpenBook(b.id)}
                    className={`p-3 flex items-center justify-between gap-4 cursor-pointer transition-colors ${
                      isSelected ? "bg-secondary font-medium" : "hover:bg-secondary/40"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="size-9 rounded overflow-hidden bg-muted shrink-0 border border-border">
                        {b.cover_image ? (
                          <img src={b.cover_image} alt="" className="size-full object-cover" />
                        ) : (
                          <span className="grid place-items-center size-full text-[10px] font-mono font-bold">
                            {b.title.slice(0, 2)}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-semibold text-foreground truncate block">
                          {b.title}
                        </span>
                        <span className="text-[11px] text-muted-foreground truncate block">
                          {b.author || "Unknown"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0 font-mono text-[11px] text-muted-foreground">
                      <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px]">
                        {isComic ? "Comic" : "EPUB"}
                      </span>
                      <span>{b.progress_percent}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Selected Book Quick Preview Inspector Drawer */}
      {selectedBookDetails && (
        <aside className="w-80 shrink-0 border-l border-border bg-card/40 flex flex-col justify-between p-6 overflow-y-auto space-y-6">
          <div className="space-y-5">
            {/* Book Cover */}
            <div className="w-36 aspect-[2/3] mx-auto rounded-xl overflow-hidden shadow-lg border border-border bg-muted">
              {selectedBookDetails.cover_image ? (
                <img
                  src={selectedBookDetails.cover_image}
                  alt={selectedBookDetails.title}
                  className="size-full object-cover"
                />
              ) : (
                <div className="size-full grid place-items-center text-center p-3 font-mono text-xs font-bold text-muted-foreground">
                  {selectedBookDetails.title}
                </div>
              )}
            </div>

            {/* Title & Author */}
            <div className="text-center space-y-1">
              <h2 className="text-sm font-bold text-foreground line-clamp-2">
                {selectedBookDetails.title}
              </h2>
              <p className="text-xs text-muted-foreground">
                {selectedBookDetails.author || "Unknown Author"}
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => onOpenBook(selectedBookDetails.id)}
                className="flex-1 h-9 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-xs hover:opacity-90 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                Read Now
              </button>
              <button
                onClick={() => onDeleteBook(selectedBookDetails.id)}
                className="size-9 rounded-xl border border-destructive/30 text-destructive hover:bg-destructive/10 grid place-items-center transition-colors cursor-pointer"
                title="Delete from library"
              >
                <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>

            {/* Description */}
            {selectedBookDetails.description && (
              <div className="text-[11px] leading-relaxed text-muted-foreground line-clamp-5 bg-secondary/50 p-3 rounded-xl border border-border/60">
                {selectedBookDetails.description}
              </div>
            )}

            {/* Quick Metadata */}
            <div className="border-t border-border/60 pt-4 space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Chapters/Pages:</span>
                <span className="font-semibold">{selectedBookDetails.total_chapters}</span>
              </div>
              <div className="flex justify-between truncate">
                <span className="text-muted-foreground">Format:</span>
                <span className="font-semibold">
                  {selectedBookDetails.file_path.endsWith(".cbz") || selectedBookDetails.file_path.endsWith(".zip") ? "Comic (CBZ)" : "EPUB"}
                </span>
              </div>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
