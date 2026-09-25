"use client";

import React from "react";

interface SettingsViewProps {
  booksCount: number;
  highlightsCount: number;
  bookmarksCount: number;
}

export default function SettingsView({
  booksCount,
  highlightsCount,
  bookmarksCount,
}: SettingsViewProps) {
  return (
    <div className="flex-1 overflow-y-auto p-6 sm:p-10 space-y-8 bg-background max-w-4xl">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">Settings</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Desktop preferences, reading configurations, and database diagnostics
        </p>
      </div>

      <div className="space-y-6">
        {/* Reading Preferences Section */}
        <section className="p-6 rounded-2xl bg-card border border-border space-y-4">
          <h3 className="text-sm font-bold text-foreground">Reading Experience Defaults</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-secondary/40 border border-border/60 space-y-1">
              <span className="font-semibold text-foreground block">Default Layout Mode</span>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                Choose between classic Single Page column and modern Dual-Page book spread.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-secondary/40 border border-border/60 space-y-1">
              <span className="font-semibold text-foreground block">Manga RTL Direction</span>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                Right-to-Left page progression for Japanese manga tankōbon archives.
              </p>
            </div>
          </div>
        </section>

        {/* Database & Diagnostics */}
        <section className="p-6 rounded-2xl bg-card border border-border space-y-4">
          <h3 className="text-sm font-bold text-foreground">Library Engine & Diagnostics</h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-secondary/40 border border-border/60 text-center space-y-1">
              <span className="text-2xl font-extrabold font-mono text-primary">{booksCount}</span>
              <span className="block text-xs font-medium text-muted-foreground">Imported Books</span>
            </div>

            <div className="p-4 rounded-xl bg-secondary/40 border border-border/60 text-center space-y-1">
              <span className="text-2xl font-extrabold font-mono text-amber-500">{highlightsCount}</span>
              <span className="block text-xs font-medium text-muted-foreground">Saved Highlights</span>
            </div>

            <div className="p-4 rounded-xl bg-secondary/40 border border-border/60 text-center space-y-1">
              <span className="text-2xl font-extrabold font-mono text-sky-500">{bookmarksCount}</span>
              <span className="block text-xs font-medium text-muted-foreground">Active Bookmarks</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-secondary/30 border border-border/60 space-y-2 text-xs font-mono">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Storage Engine:</span>
              <span className="font-semibold text-foreground">SQLite (rusqlite v0.32)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Supported Formats:</span>
              <span className="font-semibold text-foreground">EPUB 2/3, CBZ, ZIP, CBR</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Architecture:</span>
              <span className="font-semibold text-foreground">Tauri v2 Desktop Shell</span>
            </div>
          </div>
        </section>

        {/* About */}
        <section className="p-6 rounded-2xl bg-card border border-border flex items-center justify-between">
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-foreground">Papyrbound Desktop</h4>
            <p className="text-xs text-muted-foreground">
              A tactile, distraction-free desktop reader for books, comics, and manga.
            </p>
          </div>
          <span className="font-mono text-xs px-3 py-1 rounded-full bg-secondary text-muted-foreground font-semibold">
            v0.2.0
          </span>
        </section>
      </div>
    </div>
  );
}
