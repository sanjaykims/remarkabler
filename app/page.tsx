import Link from "next/link";
import { db } from "@/lib/db";
import { formatLocalTime } from "@/lib/format";
import { runMaintenanceSweep } from "@/lib/notes";
import { Card } from "@/components/Card";
import { LinkButton } from "@/components/Button";
import { Stat } from "@/components/Stat";

export const dynamic = "force-dynamic";

type RecentNotebook = {
  id: string;
  name: string;
  status: string;
  synced_at: string | null;
  page_count: number;
};

type LatestInsight = {
  title: string | null;
  content: string;
  created_at: string;
};

export default function Home() {
  // One throttled background sweep — same gate the chat path uses, shared
  // 5-minute window, so dashboard loads and chat sends don't double up.
  runMaintenanceSweep();

  const stats = db()
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM notebooks) AS notebooks,
         (SELECT COUNT(*) FROM pages WHERE ocr_text IS NOT NULL AND ocr_text != '') AS ocr_pages,
         (SELECT COUNT(*) FROM insights) AS insights,
         (SELECT COUNT(*) FROM notebooks WHERE status = 'processing') AS processing`
    )
    .get() as {
    notebooks: number;
    ocr_pages: number;
    insights: number;
    processing: number;
  };

  const recent = db()
    .prepare(
      `SELECT n.id, n.name, COALESCE(n.status, 'done') AS status, n.synced_at,
              COUNT(p.id) AS page_count
       FROM notebooks n
       LEFT JOIN pages p ON p.notebook_id = n.id
       GROUP BY n.id
       ORDER BY n.synced_at DESC NULLS LAST, n.name
       LIMIT 4`
    )
    .all() as RecentNotebook[];

  const latestInsight = db()
    .prepare(
      `SELECT title, content, created_at FROM insights ORDER BY id DESC LIMIT 1`
    )
    .get() as LatestInsight | undefined;

  return (
    <div className="space-y-6">
      <section className="space-y-1">
        <h1 className="text-2xl font-semibold">Remarkabler</h1>
        <p className="opacity-70 text-sm">
          Your reMarkable notebooks, transcribed and understood by Claude.
        </p>
      </section>

      <section className="grid grid-cols-3 gap-3">
        <Stat label="Notebooks" value={stats.notebooks} />
        <Stat label="Pages read" value={stats.ocr_pages} />
        <Stat label="Insights" value={stats.insights} />
      </section>

      {stats.processing > 0 && (
        <p className="text-sm opacity-70">
          {stats.processing} notebook{stats.processing === 1 ? "" : "s"}{" "}
          transcribing right now…
        </p>
      )}

      <section className="grid grid-cols-2 gap-3">
        <LinkButton href="/notebooks" variant="primary">
          Add a notebook
        </LinkButton>
        <LinkButton href="/chat" variant="secondary">
          Chat with your notes
        </LinkButton>
      </section>

      {stats.notebooks === 0 ? (
        <Card as="section" className="space-y-2">
          <h2 className="font-medium">Getting started</h2>
          <ol className="text-sm opacity-80 space-y-1 list-decimal list-inside leading-relaxed">
            <li>
              On your reMarkable, open a notebook → menu →{" "}
              <em>Export</em> / <em>Save as PDF</em>.
            </li>
            <li>
              <Link className="underline" href="/notebooks">
                Upload that PDF →
              </Link>{" "}
              Claude transcribes each page.
            </li>
            <li>
              <Link className="underline" href="/chat">
                Chat with your notes →
              </Link>
            </li>
          </ol>
        </Card>
      ) : (
        <>
          {latestInsight ? (
            <Card as="section" className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-medium">Latest insight</h2>
                <Link
                  href="/insights"
                  className="text-xs underline opacity-70"
                >
                  Open
                </Link>
              </div>
              {latestInsight.title && (
                <div className="text-sm font-medium">
                  {latestInsight.title}
                </div>
              )}
              <p className="text-sm opacity-75 leading-relaxed">
                {preview(latestInsight.content)}
              </p>
              <div className="text-xs opacity-50">
                {formatLocalTime(latestInsight.created_at)}
              </div>
            </Card>
          ) : (
            <Card as="section" className="space-y-1.5">
              <h2 className="font-medium">No insights yet</h2>
              <p className="text-sm opacity-75 leading-relaxed">
                An insight is a reflection Claude writes about you from
                everything you&rsquo;ve fed in. A fresh one is written automatically
                each week — or tap below to make one now.
              </p>
              <Link
                href="/insights"
                className="inline-block text-sm underline opacity-90"
              >
                Open Insights →
              </Link>
            </Card>
          )}

          <Card as="section" className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-medium">Recent notebooks</h2>
              <Link
                href="/notebooks"
                className="text-xs underline opacity-70"
              >
                See all
              </Link>
            </div>
            <ul className="space-y-1.5">
              {recent.map((n) => (
                <li
                  key={n.id}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate">{n.name}</span>
                  <span className="shrink-0 text-xs opacity-60">
                    {statusLabel(n)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}

function statusLabel(n: RecentNotebook): string {
  if (n.status === "processing") return "Transcribing…";
  if (n.status === "error") return "Failed";
  return `${n.page_count} page${n.page_count === 1 ? "" : "s"}`;
}

function preview(content: string): string {
  const text = content.replace(/[#*_`>]/g, "").replace(/\s+/g, " ").trim();
  return text.length > 180 ? text.slice(0, 180).trimEnd() + "…" : text;
}
