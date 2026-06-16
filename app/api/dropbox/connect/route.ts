import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { isAuthenticated } from "@/lib/auth";
import { setSetting } from "@/lib/db";
import { buildAuthUrl, dropboxConfigured } from "@/lib/dropbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/dropbox/connect
// Kicks off Dropbox's OAuth dance: generates a random state, stashes it for
// the callback to verify (CSRF protection — Dropbox echoes the state back
// after the user authorises, and we refuse to exchange a code that wasn't
// part of a session we started), then redirects to Dropbox's authorise page.
//
// We construct the redirect URI from the inbound request's host instead of
// hard-coding it, so the same code works in dev, staging, and prod without
// per-env config.
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
  // The proxy-aware origin: prefer the forwarded host (set by Railway's
  // ingress), fall back to whatever the request reports. Never trust
  // req.url's host directly behind a proxy — it'll say localhost:8080.
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (!host) {
    return NextResponse.json(
      { error: "Could not determine app host." },
      { status: 500 }
    );
  }
  const redirectUri = `${proto}://${host}/api/dropbox/callback`;
  const state = randomBytes(16).toString("hex");
  setSetting("dropbox_oauth_state", state);
  setSetting("dropbox_oauth_redirect", redirectUri);
  return NextResponse.redirect(buildAuthUrl(redirectUri, state));
}
