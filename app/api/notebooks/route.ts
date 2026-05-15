import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const notebooks = db()
    .prepare(
      `SELECT n.id, n.name, n.parent, n.last_modified, n.synced_at,
              COUNT(p.id) AS page_count,
              SUM(CASE WHEN p.ocr_text IS NOT NULL AND p.ocr_text != '' THEN 1 ELSE 0 END) AS ocr_count
       FROM notebooks n
       LEFT JOIN pages p ON p.notebook_id = n.id
       GROUP BY n.id
       ORDER BY n.synced_at DESC NULLS LAST, n.name`
    )
    .all();
  return NextResponse.json({ notebooks });
}
