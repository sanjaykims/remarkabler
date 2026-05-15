import { NextRequest, NextResponse } from "next/server";
import { connectWithCode, isConnected, disconnect } from "@/lib/remarkable";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ connected: isConnected() });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const code = String(body.code || "");
  try {
    await connectWithCode(code);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 400 }
    );
  }
}

export async function DELETE() {
  disconnect();
  return NextResponse.json({ ok: true });
}
