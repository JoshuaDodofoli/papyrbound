"use client";

import { useEffect, useState, useTransition } from "react";
import {
  getLibrary,
  importBook,
  openBookFileDialog,
  deleteBook,
  getBookDetails,
} from "./lib/api";
import type { BookDetails, BookSummary } from "./types/epub";
import Reader from "./components/Reader";

export default function Home() {
  const [books, setBooks] = useState<BookSummary[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [selectedBookDetails, setSelectedBookDetails] = useState<BookDetails | null>(null);
  const [activeReadingBook, setActiveReadingBook] = useState<BookDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [, startTransition] = useTransition();

  // Load library on mount
  useEffect(() => {
    loadLibrary();
  }, []);

  // Fetch book details when selected
  useEffect(() => {
    if (!selectedBookId) {
      setSelectedBookDetails(null);
      return;
    }

    let isMounted = true;
    getBookDetails(selectedBookId)
      .then((details) => {
        if (isMounted) setSelectedBookDetails(details);
      })
      .catch((err) => {
        console.error("Failed to load book details:", err);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedBookId]);

  async function loadLibrary() {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await getLibrary();
      setBooks(data);
      if (data.length > 0 && !selectedBookId) {
        setSelectedBookId(data[0].id);
      }
    } catch (err) {
      console.warn("Tauri getLibrary not available or error:", err);
      setBooks([]);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleImport() {
    setErrorMessage(null);
    try {
      const filePath = await openBookFileDialog();
      if (!filePath) return;

      setIsImporting(true);
      const newBook = await importBook(filePath);
      
      startTransition(() => {
        setBooks((prev) => {
          const exists = prev.some((b) => b.id === newBook.id);
          if (exists) return prev;
          return [
            {
              id: newBook.id,
              title: newBook.title,
              author: newBook.author,
              cover_image: newBook.cover_image,
              total_chapters: newBook.total_chapters,
              current_chapter: 0,
              progress_percent: 0,
              last_read_at: null,
              created_at: newBook.created_at,
              file_path: newBook.file_path,
            },
            ...prev,
          ];
        });
        setSelectedBookId(newBook.id);
        setSelectedBookDetails(newBook);
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(`Failed to import file: ${msg}`);
    } finally {
      setIsImporting(false);
    }
  }

  async function handleDelete(bookId: string) {
    if (!confirm("Are you sure you want to remove this book from your library?")) {
      return;
    }
    try {
      await deleteBook(bookId);
      setBooks((prev) => prev.filter((b) => b.id !== bookId));
      if (selectedBookId === bookId) {
        const remaining = books.filter((b) => b.id !== bookId);
        setSelectedBookId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (err) {
      setErrorMessage(`Failed to delete book: ${err}`);
    }
  }

  const filteredBooks = books.filter((book) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      book.title.toLowerCase().includes(query) ||
      (book.author && book.author.toLowerCase().includes(query))
    );
  });

  return (
    <main className="flex h-screen w-full flex-col bg-background text-foreground overflow-hidden">
      {/* Active Reader Overlay View (Track 3) */}
      {activeReadingBook && (
        <Reader
          book={activeReadingBook}
          onClose={() => {
            setActiveReadingBook(null);
            loadLibrary(); // refresh progress indicators
          }}
        />
      )}

      {/* Top Application Bar */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4 sm:px-6 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="grid size-8 place-items-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground shadow-xs">
            P
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight">Papyrbound</h1>
            <p className="text-[10px] text-muted-foreground">Tactile Desktop Library</p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="hidden sm:flex items-center max-w-xs w-full">
          <div className="relative w-full">
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
              placeholder="Search library..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-8 pl-8 pr-3 text-xs rounded-md bg-secondary/80 border border-border focus:outline-none focus:ring-1 focus:ring-ring text-foreground placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleImport}
            disabled={isImporting}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground shadow-xs transition-all hover:opacity-90 disabled:opacity-50 cursor-pointer"
          >
            {isImporting ? (
              <>
                <svg className="size-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Importing...
              </>
            ) : (
              <>
                <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Import Book / Comic
              </>
            )}
          </button>
        </div>
      </header>

      {/* Error alert if present */}
      {errorMessage && (
        <div className="flex items-center justify-between bg-destructive/10 border-b border-destructive/20 px-4 py-2 text-xs text-destructive">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="font-semibold underline ml-4 cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Content Workspace */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar: Library Shelves & Books List */}
        <aside className="w-80 shrink-0 border-r border-border bg-card/60 flex flex-col justify-between">
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="p-3 border-b border-border/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  Library
                </span>
                <span className="rounded-full bg-secondary px-2 py-0.5 font-mono text-[10px] text-muted-foreground font-semibold">
                  {books.length}
                </span>
              </div>
            </div>

            {/* Book Item List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {isLoading ? (
                <div className="space-y-2 p-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 rounded-lg bg-secondary/50 animate-pulse" />
                  ))}
                </div>
              ) : filteredBooks.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-6 text-center space-y-3 mt-8">
                  <div className="size-10 rounded-full bg-secondary grid place-items-center text-muted-foreground">
                    <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {searchQuery ? "No matching titles found" : "No books or comics in library yet"}
                  </p>
                  {!searchQuery && (
                    <button
                      onClick={handleImport}
                      className="text-xs text-primary font-medium hover:underline cursor-pointer"
                    >
                      Import an EPUB or Comic (.cbz)
                    </button>
                  )}
                </div>
              ) : (
                filteredBooks.map((book) => {
                  const isSelected = selectedBookId === book.id;
                  const isComic =
                    book.file_path.toLowerCase().endsWith(".cbz") ||
                    book.file_path.toLowerCase().endsWith(".zip") ||
                    book.file_path.toLowerCase().endsWith(".cbr") ||
                    book.author === "Comic / Manga";

                  return (
                    <button
                      key={book.id}
                      onClick={() => setSelectedBookId(book.id)}
                      onDoubleClick={() => {
                        if (selectedBookDetails) {
                          setActiveReadingBook(selectedBookDetails);
                        }
                      }}
                      className={`w-full text-left p-2.5 rounded-lg transition-all flex gap-3 cursor-pointer ${
                        isSelected
                          ? "bg-secondary text-foreground shadow-xs ring-1 ring-border"
                          : "hover:bg-secondary/40 text-muted-foreground"
                      }`}
                    >
                      {/* Thumbnail or Fallback */}
                      <div className="size-11 shrink-0 rounded overflow-hidden bg-muted border border-border flex items-center justify-center relative">
                        {book.cover_image ? (
                          <img
                            src={book.cover_image}
                            alt={book.title}
                            className="size-full object-cover"
                          />
                        ) : (
                          <span className="font-mono text-xs uppercase font-bold text-muted-foreground">
                            {book.title.slice(0, 2)}
                          </span>
                        )}
                        {isComic && (
                          <span className="absolute bottom-0 inset-x-0 bg-black/75 text-amber-300 font-mono text-[8px] font-bold text-center uppercase tracking-tighter py-0.5 leading-none">
                            Comic
                          </span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <span className="truncate text-xs font-semibold text-foreground block">
                          {book.title}
                        </span>
                        <span className="truncate text-[11px] text-muted-foreground block mt-0.5">
                          {book.author || "Unknown Author"}
                        </span>
                        {book.progress_percent > 0 && (
                          <div className="mt-1.5 w-full bg-border h-1 rounded-full overflow-hidden">
                            <div
                              className="bg-primary h-full"
                              style={{ width: `${book.progress_percent}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Sidebar Footer */}
          <div className="p-3 border-t border-border/80 bg-secondary/30 text-[11px] text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Papyrbound v0.1</span>
              <span>EPUB & CBZ Engine</span>
            </div>
          </div>
        </aside>

        {/* Right Area: Selected Book Details & Shelf Overview */}
        <section className="flex-1 flex flex-col bg-background overflow-y-auto">
          {selectedBookDetails ? (
            <div className="max-w-4xl w-full mx-auto p-6 sm:p-10 space-y-8">
              {/* Hero Banner */}
              <div className="flex flex-col sm:flex-row gap-6 items-start">
                {/* Book Cover Presentation */}
                <div className="w-36 sm:w-48 aspect-[2/3] shrink-0 rounded-xl overflow-hidden shadow-md border border-border bg-card relative">
                  {selectedBookDetails.cover_image ? (
                    <img
                      src={selectedBookDetails.cover_image}
                      alt={selectedBookDetails.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-secondary/50">
                      <span className="font-mono text-sm font-bold text-muted-foreground">
                        {selectedBookDetails.title}
                      </span>
                    </div>
                  )}
                </div>

                {/* Metadata & Actions */}
                <div className="flex-1 space-y-4">
                  <div className="space-y-1">
                    {(() => {
                      const isComic =
                        selectedBookDetails.file_path.toLowerCase().endsWith(".cbz") ||
                        selectedBookDetails.file_path.toLowerCase().endsWith(".zip") ||
                        selectedBookDetails.file_path.toLowerCase().endsWith(".cbr") ||
                        selectedBookDetails.author === "Comic / Manga";
                      return (
                        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                          {isComic ? "Comic Archive (CBZ)" : "EPUB Book"} • {selectedBookDetails.total_chapters}{" "}
                          {isComic ? "Pages" : "Chapters"}
                        </span>
                      );
                    })()}
                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                      {selectedBookDetails.title}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {selectedBookDetails.author || "Unknown Author"}
                    </p>
                  </div>

                  {selectedBookDetails.description && (
                    <div className="text-xs leading-relaxed text-muted-foreground line-clamp-4 bg-secondary/40 p-3.5 rounded-lg border border-border/60">
                      {selectedBookDetails.description}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={() => setActiveReadingBook(selectedBookDetails)}
                      className="h-9 px-5 rounded-lg bg-primary text-primary-foreground text-xs font-medium shadow-xs hover:opacity-90 transition-all cursor-pointer flex items-center gap-2"
                    >
                      <svg className="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                      Open Reader
                    </button>
                    <button
                      onClick={() => handleDelete(selectedBookDetails.id)}
                      className="h-9 px-3.5 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 text-xs font-medium transition-all cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>

              {/* Table of Contents Preview */}
              <div className="border-t border-border pt-6 space-y-4">
                <h3 className="text-sm font-semibold tracking-tight">Table of Contents</h3>
                {selectedBookDetails.toc.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No Table of Contents provided in this EPUB.
                  </p>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-2">
                    {selectedBookDetails.toc.slice(0, 10).map((item, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-lg bg-secondary/40 border border-border/60 text-xs flex items-center justify-between"
                      >
                        <span className="truncate font-medium">{item.title}</span>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          #{item.play_order}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
              <div className="size-14 rounded-2xl bg-secondary/70 grid place-items-center text-muted-foreground">
                <svg className="size-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div className="space-y-1 max-w-sm">
                <h3 className="text-sm font-semibold">Your Library is Empty</h3>
                <p className="text-xs text-muted-foreground leading-normal">
                  Import your first EPUB book using the button above to start reading.
                </p>
              </div>
              <button
                onClick={handleImport}
                disabled={isImporting}
                className="h-8 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-medium shadow-xs hover:opacity-90 transition-all cursor-pointer"
              >
                Import EPUB
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
