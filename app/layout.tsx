import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Feed Claude — reMarkable",
  description: "OCR your reMarkable notebooks with Claude and chat over your notes.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="border-b border-stone-200 dark:border-stone-800">
          <nav className="mx-auto max-w-5xl px-6 py-3 flex items-center gap-6 text-sm">
            <Link href="/" className="font-semibold">Feed Claude</Link>
            <Link href="/notebooks" className="opacity-70 hover:opacity-100">Notebooks</Link>
            <Link href="/chat" className="opacity-70 hover:opacity-100">Chat</Link>
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
