import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import Sidebar from "./components/sidebar/sidebar";

const haffer = localFont({
  src: "./fonts/Haffer-Medium.otf",
  variable: "--font-haffer",
  weight: "500",
  style: "normal",
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: "500",
});

export const metadata: Metadata = {
  title: "Papyrbound — Your graphic library",
  description:
    "A modern desktop library for comics, manga, and illustrated books.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${haffer.variable} ${geistMono.variable}`}>
      <body className="grid min-h-dvh grid-cols-[288px_minmax(0,1fr)] bg-mono-100">
        <div className="pl-1">
          <Sidebar />
        </div>
        <div className="min-w-0 pl-0">
          {children}
        </div>
      </body>
    </html>
  );
}
