import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { setSetting, clearSetting } from "@/lib/db";
import {
  exchangeCodeForTokens,
  fetchAccountDisplayName,
  resolveAppBaseUrl,
} from "@/lib/dropbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATE_COOKIE = "dropbox_oauth_state";
const REDIRECT_COOKIE = "dropbox_oauth_redirect";

// GET /api/dropbox/callback
// Dropbox redirects here after the user taps Allow. We verify the CSRF
// state stashed in the connect step's httpOnly cookie, exchange the
// one-time `code` for a refresh_token using the same redirect URI we
// pinned at connect time, and bounce the user back to /memory.
export async function GET(req: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "Locked" }, { status: 401 });
  }

  const base = resolveAppBaseUrl(req.headers);
  // Even if APP_BASE_URL isn't configured, we still need a place to redirect
  // the user — fall back to a relative URL in that case rather than 500ing.
  const memoryUrl = base.ok ? `${base.baseUrl}/memory` : `/memory`;

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const clearCookies = (res: NextResponse) => {
    res.cookies.delete(STATE_COOKIE);
    res.cookies.delete(REDIRECT_COOKIE);
    return res;
  };

  if (error) {
    setSetting("dropbox_last_error", `OAuth denied: ${error.slice(0, 100)}`);
    return clearCookies(NextResponse.redirect(`${memoryUrl}?dropbox=denied`));
  }
  if (!code || !state) {
    return clearCookies(
      NextResponse.redirect(`${memoryUrl}?dropbox=missing-code`)
    );
  }

  const expectedState = req.cookies.get(STATE_COOKIE)?.value;
  if (!expectedState || expectedState !== state) {
    return clearCookies(
      NextResponse.redirect(`${memoryUrl}?dropbox=bad-state`)
    );
  }
  const redirectUri = req.cookies.get(REDIRECT_COOKIE)?.value;
  if (!redirectUri) {
    return clearCookies(
      NextResponse.redirect(`${memoryUrl}?dropbox=missing-redirect`)
    );
  }
  try {
    const tokens = await exchangeCodeForTokens(code, redirectUri);
    setSetting("dropbox_refresh_token", tokens.refresh_token);
    clearSetting("dropbox_last_error");
    clearSetting("dropbox_last_revoke_warning");
    // Fetch the account display name so the UI can confirm WHICH Dropbox
    // got connected — important if the user has multiple accounts.
    const account = await fetchAccountDisplayName();
    if (account) setSetting("dropbox_account_name", account);
    return clearCookies(
      NextResponse.redirect(`${memoryUrl}?dropbox=connected`)
    );
  } catch (e) {
    setSetting("dropbox_last_error", (e as Error).message.slice(0, 500));
    return clearCookies(
      NextResponse.redirect(`${memoryUrl}?dropbox=exchange-failed`)
    );
  }
}
