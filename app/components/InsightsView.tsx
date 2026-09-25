"use client";

import { useEffect, useState, useTransition } from "react";
import { getReadingInsights, getBookDetails } from "../lib/api";
import type { BookDetails, ReadingInsights } from "../types/epub";

interface InsightsViewProps {
  onOpenBook: (book: BookDetails) => void;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  if (hours === 0) return `${mins}m`;
  return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
}

function formatHourLabel(hour: number): string {
  if (hour === 0) return "12 AM";
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return "12 PM";
  return `${hour - 12} PM`;
}

export default function InsightsView({ onOpenBook }: InsightsViewProps) {
  const [insights, setInsights] = useState<ReadingInsights | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const fetchInsights = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getReadingInsights();
      setInsights(data);
    } catch (err) {
      console.error("Failed to load reading insights:", err);
      setError("Unable to load insights from database");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, []);

  const handleResumeBook = async (bookId: string) => {
    try {
      const details = await getBookDetails(bookId);
      onOpenBook(details);
    } catch (err) {
      console.error("Failed to load book details:", err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[500px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-stone-800 dark:border-stone-200 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-stone-500 dark:text-stone-400">
            Calculating reading telemetry...
          </p>
        </div>
      </div>
    );
  }

  const maxHourlySeconds = insights?.hourly_distribution
    ? Math.max(...insights.hourly_distribution.map((h) => h.total_seconds), 1)
    : 1;

  return (
    <div className="flex-1 overflow-y-auto px-6 lg:px-10 py-8 bg-[#faf9f6] dark:bg-[#121212] text-stone-900 dark:text-stone-100 min-h-full">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200/80 dark:border-zinc-800 pb-6">
          <div>
            <h1 className="text-2xl lg:text-3xl font-serif font-bold tracking-tight text-stone-900 dark:text-stone-50">
              Reading Insights
            </h1>
            <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
              Deep telemetry into reading velocity, volume completion rates, and habit patterns.
            </p>
          </div>
          <button
            onClick={() => startTransition(() => fetchInsights())}
            disabled={isPending}
            className="self-start sm:self-auto inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium border border-stone-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-stone-50 dark:hover:bg-zinc-800 text-stone-700 dark:text-stone-300 shadow-sm transition-colors cursor-pointer"
          >
            <svg
              className={`w-3.5 h-3.5 ${isPending ? "animate-spin" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Refresh Telemetry
          </button>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Top Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Reading Time */}
          <div className="bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-stone-500 dark:text-stone-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Total Time Logged</span>
              <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="text-2xl lg:text-3xl font-bold font-serif text-stone-900 dark:text-stone-50">
              {formatDuration(insights?.total_reading_seconds ?? 0)}
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Across {insights?.total_sessions ?? 0} reading sessions
            </p>
          </div>

          {/* Reading Streak */}
          <div className="bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-stone-500 dark:text-stone-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Reading Streak</span>
              <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
                </svg>
              </div>
            </div>
            <div className="text-2xl lg:text-3xl font-bold font-serif text-stone-900 dark:text-stone-50">
              {insights?.current_streak_days ?? 0} <span className="text-lg font-sans font-normal text-stone-500">Days</span>
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              {insights?.current_streak_days && insights.current_streak_days > 0
                ? "Active daily streak maintained!"
                : "Open any book today to start your streak"}
            </p>
          </div>

          {/* Completed Volumes */}
          <div className="bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-stone-500 dark:text-stone-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Books Completed</span>
              <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="text-2xl lg:text-3xl font-bold font-serif text-stone-900 dark:text-stone-50">
              {insights?.completed_books_count ?? 0}
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              {insights?.in_progress_books_count ?? 0} currently in progress
            </p>
          </div>

          {/* Today's Reading */}
          <div className="bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-stone-500 dark:text-stone-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Today&apos;s Focus</span>
              <div className="p-2 rounded-lg bg-sky-50 dark:bg-sky-950/30 text-sky-600 dark:text-sky-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
            <div className="text-2xl lg:text-3xl font-bold font-serif text-stone-900 dark:text-stone-50">
              {formatDuration(insights?.today_reading_seconds ?? 0)}
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Logged in current 24-hour cycle
            </p>
          </div>
        </div>

        {/* Hourly Distribution Activity Heatmap / Bar Visualizer */}
        <div className="bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 rounded-2xl p-6 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
                Hourly Reading Rhythm
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Distribution of reading duration across 24 hours of the day.
              </p>
            </div>
            <span className="text-xs text-stone-400 font-mono">
              Peak: {formatDuration(maxHourlySeconds === 1 ? 0 : maxHourlySeconds)}
            </span>
          </div>

          <div className="pt-4 pb-2">
            <div className="grid grid-cols-12 sm:grid-cols-24 gap-1.5 h-36 items-end">
              {insights?.hourly_distribution.map((item) => {
                const heightPercent =
                  item.total_seconds > 0
                    ? Math.max(8, Math.round((item.total_seconds / maxHourlySeconds) * 100))
                    : 4;

                const isHighest = item.total_seconds === maxHourlySeconds && maxHourlySeconds > 1;

                return (
                  <div
                    key={item.hour}
                    className="group relative flex flex-col items-center h-full justify-end"
                  >
                    {/* Tooltip */}
                    <div className="absolute -top-10 opacity-0 group-hover:opacity-100 pointer-events-none transition-all transform group-hover:-translate-y-1 z-20 whitespace-nowrap bg-stone-900 text-white text-[10px] py-1 px-2 rounded shadow-lg">
                      <span className="font-semibold">{formatHourLabel(item.hour)}</span>:{" "}
                      {formatDuration(item.total_seconds)}
                    </div>

                    {/* Bar */}
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className={`w-full rounded-t-md transition-all duration-300 ${
                        item.total_seconds > 0
                          ? isHighest
                            ? "bg-amber-500 dark:bg-amber-400 shadow-sm"
                            : "bg-stone-700 dark:bg-stone-300 hover:bg-amber-500 dark:hover:bg-amber-400"
                          : "bg-stone-100 dark:bg-zinc-800"
                      }`}
                    />

                    {/* Label (displayed on even hours) */}
                    <span className="text-[9px] text-stone-400 dark:text-stone-500 mt-2 select-none">
                      {item.hour % 4 === 0 ? formatHourLabel(item.hour) : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Book Competition & Progress Telemetry Table */}
        <div className="bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 rounded-2xl p-6 shadow-sm space-y-6">
          <div>
            <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
              Volume Completion &amp; Duration Tracker
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Individual reading velocity, chapter progress, and time spent per title.
            </p>
          </div>

          {insights?.book_stats.length === 0 ? (
            <div className="py-12 text-center text-stone-400 text-sm font-serif italic">
              No books imported yet. Import an EPUB or Comic archive to view progress telemetry.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {insights?.book_stats.map((book) => {
                const percent = Math.min(100, Math.max(0, Math.round(book.progress_percent)));
                return (
                  <div
                    key={book.book_id}
                    className="flex gap-4 p-4 rounded-xl border border-stone-200/70 dark:border-zinc-800/80 bg-[#fdfcfb] dark:bg-zinc-950 hover:border-stone-300 dark:hover:border-zinc-700 transition-all shadow-xs"
                  >
                    {/* Cover Thumbnail */}
                    <div className="w-16 h-22 shrink-0 rounded-lg overflow-hidden bg-stone-100 dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 relative flex items-center justify-center">
                      {book.cover_image ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={book.cover_image}
                          alt={book.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-[10px] font-serif font-bold text-stone-400 text-center px-1">
                          {book.title.slice(0, 8)}
                        </span>
                      )}
                    </div>

                    {/* Book Telemetry Details */}
                    <div className="flex-1 flex flex-col justify-between min-w-0">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-serif font-semibold text-sm text-stone-900 dark:text-stone-100 truncate">
                            {book.title}
                          </h3>
                          {book.is_completed && (
                            <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                              Completed
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-stone-500 dark:text-stone-400 truncate mt-0.5">
                          {book.author || "Unknown Author"}
                        </p>
                      </div>

                      {/* Progress Bar & Stats */}
                      <div className="space-y-1.5 mt-3">
                        <div className="flex items-center justify-between text-[11px] text-stone-600 dark:text-stone-400">
                          <span>
                            Chapter {book.current_chapter + 1} of {book.total_chapters || 1}
                          </span>
                          <span className="font-semibold font-mono text-stone-800 dark:text-stone-200">
                            {percent}%
                          </span>
                        </div>

                        {/* Progress track */}
                        <div className="w-full h-2 rounded-full bg-stone-200 dark:bg-zinc-800 overflow-hidden">
                          <div
                            style={{ width: `${percent}%` }}
                            className={`h-full rounded-full transition-all duration-500 ${
                              book.is_completed
                                ? "bg-emerald-500"
                                : "bg-amber-600 dark:bg-amber-500"
                            }`}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-stone-400 pt-1">
                          <span>Time Spent: {formatDuration(book.total_reading_seconds)}</span>
                          <button
                            onClick={() => handleResumeBook(book.book_id)}
                            className="font-medium text-amber-700 dark:text-amber-400 hover:underline cursor-pointer"
                          >
                            Read &rarr;
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
