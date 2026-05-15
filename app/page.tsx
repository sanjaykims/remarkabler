import Link from "next/link";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function Home() {
  const stats = db()
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM notebooks) AS notebooks,
         (SELECT COUNT(*) FROM pages) AS pages,
         (SELECT COUNT(*) FROM pages WHERE ocr_text IS NOT NULL AND ocr_text != '') AS ocr_pages`
    )
    .get() as { notebooks: number; pages: number; ocr_pages: number };

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold">Your reMarkable, in Claude.</h1>
        <p className="opacity-70">
          Export a notebook as PDF on your reMarkable, upload it here, and Claude
          transcribes every handwritten page. Then chat with Claude about
          everything you&apos;ve written.
        </p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Stat label="Notebooks" value={stats.notebooks} />
        <Stat label="Pages" value={stats.pages} />
        <Stat label="OCR'd pages" value={stats.ocr_pages} />
      </section>

      <section className="rounded border border-stone-200 dark:border-stone-800 p-4 space-y-2">
        <h2 className="font-medium">Getting started</h2>
        <ol className="text-sm opacity-80 space-y-1 list-decimal list-inside">
          <li>On your reMarkable, open a notebook → menu → <em>Export</em> / <em>Save as PDF</em>.</li>
          <li>
            <Link className="underline" href="/notebooks">Upload that PDF →</Link>{" "}
            Claude transcribes each page.
          </li>
          <li>
            <Link className="underline" href="/chat">Chat with your notes →</Link>
          </li>
        </ol>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-stone-200 dark:border-stone-800 p-4">
      <div className="text-3xl font-semibold">{value}</div>
      <div className="text-sm opacity-70">{label}</div>
    </div>
  );
}
