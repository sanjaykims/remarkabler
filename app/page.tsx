import Link from "next/link";
import { isConnected } from "@/lib/remarkable";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function Home() {
  const connected = isConnected();
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
          Sync notebooks from your reMarkable Paper Pro Move, OCR handwritten pages
          with Claude vision, then chat with Claude about everything you&apos;ve written.
        </p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Stat label="Notebooks" value={stats.notebooks} />
        <Stat label="Pages" value={stats.pages} />
        <Stat label="OCR'd pages" value={stats.ocr_pages} />
      </section>

      <section className="rounded border border-stone-200 dark:border-stone-800 p-4">
        <h2 className="font-medium mb-2">Status</h2>
        {connected ? (
          <p className="text-sm">
            ✓ Connected to reMarkable. <Link className="underline" href="/notebooks">Sync notebooks →</Link>
          </p>
        ) : (
          <p className="text-sm">
            Not connected.{" "}
            <Link className="underline" href="/connect">Connect your reMarkable →</Link>
          </p>
        )}
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
