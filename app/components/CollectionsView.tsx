"use client";

import React, { useState } from "react";
import type { BookSummary } from "../types/epub";

interface CollectionsViewProps {
  books: BookSummary[];
  onOpenBook: (bookId: string) => void;
}

export default function CollectionsView({ books, onOpenBook }: CollectionsViewProps) {
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);

  const isComic = (b: BookSummary) =>
    b.file_path.toLowerCase().endsWith(".cbz") ||
    b.file_path.toLowerCase().endsWith(".zip") ||
    b.file_path.toLowerCase().endsWith(".cbr") ||
    b.author === "Comic / Manga";

  const collections = [
    {
      id: "comics",
      title: "Comics & Manga",
      description: "Graphic novels, manga archives, and illustrated series",
      filter: (b: BookSummary) => isComic(b),
      icon: "🎨",
    },
    {
      id: "reading",
      title: "Currently Reading",
      description: "Books and comics currently in progress",
      filter: (b: BookSummary) => b.progress_percent > 0 && b.progress_percent < 100,
      icon: "📖",
    },
    {
      id: "completed",
      title: "Completed Books",
      description: "Fully read titles in your personal archive",
      filter: (b: BookSummary) => b.progress_percent >= 100,
      icon: "🏆",
    },
    {
      id: "epubs",
      title: "EPUB eBooks",
      description: "Standard text books, literature, and novels",
      filter: (b: BookSummary) => !isComic(b),
      icon: "📚",
    },
    {
      id: "favorites",
      title: "Personal Favorites",
      description: "Highlighted and frequently revisited titles",
      filter: (b: BookSummary) => b.progress_percent > 30,
      icon: "⭐",
    },
  ];

  const activeCollection = collections.find((c) => c.id === selectedCollectionId);
  const activeBooks = activeCollection ? books.filter(activeCollection.filter) : [];

  return (
    <div className="flex-1 overflow-y-auto p-6 sm:p-10 space-y-8 bg-background">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Collections</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Organized shelves and reading categories
          </p>
        </div>

        {selectedCollectionId && (
          <button
            onClick={() => setSelectedCollectionId(null)}
            className="text-xs font-semibold text-primary hover:underline cursor-pointer flex items-center gap-1"
          >
            ← Back to all collections
          </button>
        )}
      </div>

      {!selectedCollectionId ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {collections.map((col) => {
            const matchingBooks = books.filter(col.filter);
            const previewCovers = matchingBooks.slice(0, 3);

            return (
              <div
                key={col.id}
                onClick={() => setSelectedCollectionId(col.id)}
                className="group p-5 rounded-2xl bg-card border border-border/80 shadow-sm hover:shadow-md hover:border-border transition-all cursor-pointer space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">{col.icon}</span>
                    <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-secondary text-muted-foreground font-semibold">
                      {matchingBooks.length} {matchingBooks.length === 1 ? "item" : "items"}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                    {col.title}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {col.description}
                  </p>
                </div>

                {/* Overlapping Cover Stack Preview */}
                <div className="pt-2 flex items-center -space-x-4 h-20">
                  {previewCovers.length === 0 ? (
                    <div className="text-[11px] text-muted-foreground/60 italic">
                      Empty collection
                    </div>
                  ) : (
                    previewCovers.map((b, idx) => (
                      <div
                        key={b.id}
                        style={{ zIndex: 10 - idx }}
                        className="w-14 aspect-[2/3] rounded-lg overflow-hidden border-2 border-card bg-muted shadow-md shrink-0"
                      >
                        {b.cover_image ? (
                          <img src={b.cover_image} alt="" className="size-full object-cover" />
                        ) : (
                          <div className="size-full bg-secondary grid place-items-center text-[8px] font-mono">
                            {b.title.slice(0, 2)}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Selected Collection Books Grid */
        <div className="space-y-6">
          <div className="p-4 rounded-xl bg-secondary/50 border border-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{activeCollection?.icon}</span>
              <div>
                <h3 className="text-sm font-bold text-foreground">{activeCollection?.title}</h3>
                <span className="text-xs text-muted-foreground">
                  {activeBooks.length} titles in this shelf
                </span>
              </div>
            </div>
          </div>

          {activeBooks.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-xs text-muted-foreground">
              No books found in this collection.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
              {activeBooks.map((b) => (
                <div
                  key={b.id}
                  onClick={() => onOpenBook(b.id)}
                  className="group flex flex-col space-y-2 cursor-pointer transition-all hover:scale-[1.02]"
                >
                  <div className="aspect-[2/3] rounded-xl overflow-hidden bg-muted border border-border shadow-sm group-hover:shadow-md group-hover:border-primary/50 transition-all">
                    {b.cover_image ? (
                      <img src={b.cover_image} alt={b.title} className="size-full object-cover" />
                    ) : (
                      <div className="size-full grid place-items-center bg-secondary font-mono text-xs font-bold text-muted-foreground">
                        {b.title.slice(0, 2)}
                      </div>
                    )}
                  </div>
                  <h4 className="text-xs font-semibold text-foreground truncate">{b.title}</h4>
                  <p className="text-[10px] text-muted-foreground truncate">{b.author || "Unknown"}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
