import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getSetting, setSetting, clearSetting } from "@/lib/db";
import { exchangeCodeForTokens, fetchAccountDisplayName } from "@/lib/dropbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/dropbox/callback
// Dropbox redirects here after the user taps Allow. We verify the CSRF
// state, exchange the one-time `code` for a refresh_token, persist the
// refresh_token, and bounce the user back to /memory.
export async function GET(req: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "Locked" }, { status: 401 });
  }
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const memoryUrl = (() => {
    const proto = req.headers.get("x-forwarded-proto") || "https";
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
    return `${proto}://${host}/memory`;
  })();

  if (error) {
    setSetting("dropbox_last_error", `OAuth denied: ${error}`);
    return NextResponse.redirect(`${memoryUrl}?dropbox=denied`);
  }
  if (!code || !state) {
    return NextResponse.redirect(`${memoryUrl}?dropbox=missing-code`);
  }
  const expectedState = getSetting("dropbox_oauth_state");
  if (!expectedState || expectedState !== state) {
    return NextResponse.redirect(`${memoryUrl}?dropbox=bad-state`);
  }
  const redirectUri = getSetting("dropbox_oauth_redirect");
  if (!redirectUri) {
    return NextResponse.redirect(`${memoryUrl}?dropbox=missing-redirect`);
  }
  try {
    const tokens = await exchangeCodeForTokens(code, redirectUri);
    setSetting("dropbox_refresh_token", tokens.refresh_token);
    clearSetting("dropbox_oauth_state");
    clearSetting("dropbox_oauth_redirect");
    clearSetting("dropbox_last_error");
    // Fetch the account display name so the UI can confirm WHICH Dropbox
    // got connected — important if the user has multiple accounts.
    const account = await fetchAccountDisplayName();
    if (account) setSetting("dropbox_account_name", account);
    return NextResponse.redirect(`${memoryUrl}?dropbox=connected`);
  } catch (e) {
    setSetting("dropbox_last_error", (e as Error).message.slice(0, 500));
    return NextResponse.redirect(`${memoryUrl}?dropbox=exchange-failed`);
  }
}
