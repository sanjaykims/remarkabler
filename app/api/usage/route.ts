import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { monthlyUsage, dailyUsage, totalUsage } from "@/lib/usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Locked" }, { status: 401 });
  }
  const sp = req.nextUrl.searchParams;
  const tz = Number(sp.get("tz") || "0");
  const date = sp.get("date");
  const month = sp.get("month");

  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(dailyUsage(date, tz));
  }
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ ...monthlyUsage(month, tz), allTime: totalUsage() });
  }
  return NextResponse.json({ error: "Specify month=YYYY-MM or date=YYYY-MM-DD" }, { status: 400 });
}
