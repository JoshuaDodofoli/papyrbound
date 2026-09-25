"use client";

import React from "react";
import type { BookDetails, BookSummary } from "../types/epub";

interface HomeViewProps {
  books: BookSummary[];
  onOpenBook: (bookId: string) => void;
  onNavigateToLibrary: () => void;
  onImport: () => void;
  isImporting: boolean;
}

export default function HomeView({
  books,
  onOpenBook,
  onNavigateToLibrary,
  onImport,
  isImporting,
}: HomeViewProps) {
  // Recent reads: sorted by last_read_at or created_at
  const recentReads = [...books].sort((a, b) => {
    const timeA = a.last_read_at || a.created_at;
    const timeB = b.last_read_at || b.created_at;
    return new Date(timeB).getTime() - new Date(timeA).getTime();
  });

  const heroBook = recentReads[0] || null;
  const recentGridBooks = recentReads.slice(1, 5);
  const favouriteBooks = books.slice(0, 6);

  if (books.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-5">
        <div className="size-16 rounded-2xl bg-secondary/80 grid place-items-center text-muted-foreground shadow-xs">
          <svg className="size-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.5"
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
            />
          </svg>
        </div>
        <div className="space-y-1.5 max-w-sm">
          <h2 className="text-lg font-bold tracking-tight">Your Digital Library is Ready</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Import your favorite EPUB books or Comic Book archives (.cbz, .zip) to start reading.
          </p>
        </div>
        <button
          onClick={onImport}
          disabled={isImporting}
          className="h-9 px-5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-xs hover:opacity-90 transition-all cursor-pointer flex items-center gap-2"
        >
          <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          Import Book or Comic
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 sm:p-10 space-y-10">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        {/* Left Section: Recent Reads */}
        <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <h2 className="text-xl font-bold tracking-tight text-foreground font-sans">Recent Reads</h2>

            {heroBook && (
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-start">
                {/* Large Hero Book Card */}
                <div
                  onClick={() => onOpenBook(heroBook.id)}
                  className="sm:col-span-6 group relative aspect-[2/3] w-full rounded-2xl overflow-hidden bg-muted border border-border shadow-lg shadow-black/10 cursor-pointer transition-all hover:scale-[1.01] hover:shadow-xl"
                >
                  {heroBook.cover_image ? (
                    <img
                      src={heroBook.cover_image}
                      alt={heroBook.title}
                      className="size-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="size-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-secondary/80 to-secondary">
                      <span className="font-mono text-sm font-bold text-muted-foreground">
                        {heroBook.title}
                      </span>
                    </div>
                  )}

                  {/* Dark gradient overlay with title & progress */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-4 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-xs font-bold truncate">{heroBook.title}</span>
                    <span className="text-[10px] text-white/80 truncate">
                      {heroBook.author || "Unknown"}
                    </span>
                    {heroBook.progress_percent > 0 && (
                      <span className="text-[10px] font-mono mt-1 text-amber-300">
                        {heroBook.progress_percent}% completed
                      </span>
                    )}
                  </div>
                </div>

                {/* 2x2 Grid of Adjacent Recent Books */}
                <div className="sm:col-span-6 grid grid-cols-2 gap-3.5">
                  {recentGridBooks.map((b) => (
                    <div
                      key={b.id}
                      onClick={() => onOpenBook(b.id)}
                      className="group relative aspect-[2/3] rounded-xl overflow-hidden bg-muted border border-border shadow-md shadow-black/5 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg"
                    >
                      {b.cover_image ? (
                        <img
                          src={b.cover_image}
                          alt={b.title}
                          className="size-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="size-full flex flex-col items-center justify-center p-2 text-center bg-secondary">
                          <span className="font-mono text-[11px] font-bold text-muted-foreground truncate max-w-[80%]">
                            {b.title}
                          </span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-2.5 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-[11px] font-bold truncate">{b.title}</span>
                        <span className="text-[9px] text-white/80 truncate">{b.author || "Unknown"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <button
              onClick={onNavigateToLibrary}
              className="text-xs font-semibold text-foreground/80 hover:text-foreground flex items-center gap-1.5 transition-colors cursor-pointer group"
            >
              <span>Open Library</span>
              <span className="group-hover:translate-x-0.5 transition-transform">›</span>
            </button>
          </div>
        </div>

        {/* Right Section: Favourite Books */}
        <div className="lg:col-span-5 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <h2 className="text-xl font-bold tracking-tight text-foreground font-sans">
              Favourite Books
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-4">
              {favouriteBooks.slice(0, 4).map((b) => (
                <div
                  key={b.id}
                  onClick={() => onOpenBook(b.id)}
                  className="group relative aspect-[2/3] rounded-xl overflow-hidden bg-muted border border-border shadow-md shadow-black/5 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg"
                >
                  {b.cover_image ? (
                    <img
                      src={b.cover_image}
                      alt={b.title}
                      className="size-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="size-full flex flex-col items-center justify-center p-3 text-center bg-secondary">
                      <span className="font-mono text-xs font-bold text-muted-foreground truncate">
                        {b.title}
                      </span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-2.5 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[11px] font-bold truncate">{b.title}</span>
                    <span className="text-[9px] text-white/80 truncate">{b.author || "Unknown"}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <button
              onClick={onNavigateToLibrary}
              className="text-xs font-semibold text-foreground/80 hover:text-foreground flex items-center gap-1.5 transition-colors cursor-pointer group"
            >
              <span>See more</span>
              <span className="group-hover:translate-x-0.5 transition-transform">›</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
