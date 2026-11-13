import { NextRequest, NextResponse } from "next/server";
import {
  checkPasscode,
  isLockEnabled,
  passcodeLockRemainingMs,
  recordFailedPasscodeAttempt,
  recordSuccessfulAuth,
  requireAuth,
} from "@/lib/auth";
import { clientIp } from "@/lib/clientIp";
import {
  MAP_UNLOCK_COOKIE,
  attemptsLeft,
  isValidPin,
  makeUnlockToken,
  mapPinConfigured,
  mapPinLockRemainingMs,
  mapUnlockCookieOptions,
  setMapPin,
  tryUnlock,
  verifyUnlockToken,
} from "@/lib/mapPin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unlocked(res: NextResponse): NextResponse {
  res.cookies.set(MAP_UNLOCK_COOKIE, makeUnlockToken(), mapUnlockCookieOptions);
  return res;
}

// GET: where does the PIN screen stand? (app lock still applies)
export async function GET(req: NextRequest) {
  const denied = await requireAuth();
  if (denied) return denied;
  return NextResponse.json({
    configured: mapPinConfigured(),
    unlocked: verifyUnlockToken(req.cookies.get(MAP_UNLOCK_COOKIE)?.value),
    lockedMs: mapPinLockRemainingMs(),
    attemptsLeft: attemptsLeft(),
  });
}

// POST {action: "setup" | "unlock" | "lock" | "reset", pin, passcode?}
export async function POST(req: NextRequest) {
  const denied = await requireAuth();
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");

  if (action === "lock") {
    const res = NextResponse.json({ ok: true });
    res.cookies.set(MAP_UNLOCK_COOKIE, "", { ...mapUnlockCookieOptions, maxAge: 0 });
    return res;
  }

  if (action === "setup") {
    if (mapPinConfigured()) {
      return NextResponse.json({ error: "A map PIN already exists." }, { status: 409 });
    }
    if (!isValidPin(body.pin)) {
      return NextResponse.json({ error: "PIN must be exactly 4 digits." }, { status: 400 });
    }
    setMapPin(body.pin);
    return unlocked(NextResponse.json({ ok: true }));
  }

  if (action === "unlock") {
    if (!mapPinConfigured()) {
      return NextResponse.json({ error: "No map PIN set yet." }, { status: 409 });
    }
    const r = tryUnlock(String(body.pin || ""));
    if (r.ok) return unlocked(NextResponse.json({ ok: true }));
    return NextResponse.json(
      {
        error: r.lockedMs > 0 ? "Too many wrong PINs." : "Wrong PIN.",
        lockedMs: r.lockedMs,
        attemptsLeft: r.attemptsLeft,
      },
      { status: r.lockedMs > 0 ? 429 : 401 }
    );
  }

  // Forgot the PIN: proving you know the APP passcode lets you set a new one.
  // (An app session alone is deliberately not enough — that is the layer this
  // PIN exists to add.) Shares the passcode brute-force limiter.
  if (action === "reset") {
    if (!isLockEnabled()) {
      return NextResponse.json(
        { error: "Set APP_PASSCODE first; the PIN is reset with it." },
        { status: 403 }
      );
    }
    if (!isValidPin(body.pin)) {
      return NextResponse.json({ error: "PIN must be exactly 4 digits." }, { status: 400 });
    }
    const source = clientIp(req.headers);
    const lockedMs = passcodeLockRemainingMs(source);
    if (lockedMs !== null) {
      return NextResponse.json(
        { error: "Too many wrong passcodes. Try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(lockedMs / 1000)) } }
      );
    }
    if (!checkPasscode(String(body.passcode || ""))) {
      recordFailedPasscodeAttempt(source);
      return NextResponse.json({ error: "Wrong passcode." }, { status: 401 });
    }
    recordSuccessfulAuth(source);
    setMapPin(body.pin);
    return unlocked(NextResponse.json({ ok: true }));
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
