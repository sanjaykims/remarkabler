import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { isAuthenticated } from "@/lib/auth";
import {
  buildAuthUrl,
  dropboxConfigured,
  resolveAppBaseUrl,
} from "@/lib/dropbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Short-lived cookie names for the OAuth dance. httpOnly + SameSite=Lax +
// Secure-in-prod. 10-min max age — well under the manual time a Dropbox
// authorise page can sit open, well over any reasonable round-trip.
const STATE_COOKIE = "dropbox_oauth_state";
const REDIRECT_COOKIE = "dropbox_oauth_redirect";
const COOKIE_MAX_AGE_SECONDS = 10 * 60;

// GET /api/dropbox/connect
// Kicks off Dropbox's OAuth dance: generates a random CSRF state, stashes
// it in an httpOnly cookie scoped to this browser, then redirects to
// Dropbox's authorise page. The callback verifies the state from the
// cookie before exchanging the code.
//
// Redirect URI resolution: in production we REQUIRE APP_BASE_URL to be set
// in the environment — we don't fall back to forwarded headers there. In
// dev we honour forwarded headers for localhost/preview convenience. This
// makes the OAuth origin a canonical configured value in prod rather than
// "whatever the proxy said," which is the posture the review pushed for.
export async function GET(req: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "Locked" }, { status: 401 });
  }
  if (!dropboxConfigured()) {
    return NextResponse.json(
      {
        error:
          "Dropbox not configured. Set DROPBOX_APP_KEY and DROPBOX_APP_SECRET in Railway.",
      },
      { status: 400 }
    );
  }
  const base = resolveAppBaseUrl(req.headers);
  if (!base.ok) {
    return NextResponse.json({ error: base.error }, { status: 500 });
  }
  const redirectUri = `${base.baseUrl}/api/dropbox/callback`;
  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(buildAuthUrl(redirectUri, state));
  const isProd = process.env.NODE_ENV === "production";
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
  // The redirect URI is part of the security check — must be identical
  // between the connect step and the token exchange. Pin it via cookie
  // rather than re-deriving in the callback to defend against header
  // variation between requests.
  res.cookies.set(REDIRECT_COOKIE, redirectUri, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
  return res;
}
