import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  REG_CHALLENGE_COOKIE,
  AUTH_CHALLENGE_COOKIE,
  createSessionToken,
  checkPasscode,
  isLockEnabled,
  sessionCookieOptions,
  challengeCookieOptions,
  passcodeLockRemainingMs,
  recordFailedPasscodeAttempt,
  recordSuccessfulAuth,
  rememberChallenge,
  consumeChallenge,
} from "@/lib/auth";
import {
  hasCredentials,
  buildRegistrationOptions,
  verifyRegistration,
  buildAuthenticationOptions,
  verifyAuthentication,
} from "@/lib/webauthn";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// WebAuthn needs the real public domain. Behind Railway's proxy this comes
// from the forwarded host headers, never from req.url (which is internal).
function relyingParty(req: NextRequest) {
  const host =
    req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  const proto = req.headers.get("x-forwarded-proto") || "https";
  return { rpID: host.split(":")[0], origin: `${proto}://${host}` };
}

export async function GET() {
  return NextResponse.json({
    enabled: isLockEnabled(),
    registered: hasCredentials(),
  });
}

export async function POST(req: NextRequest) {
  if (!isLockEnabled()) {
    return NextResponse.json({ error: "Lock is not enabled." }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");
  const { rpID, origin } = relyingParty(req);

  // The passcode is the one credential here that's actually guessable (a
  // WebAuthn assertion isn't practically forgeable, so login-verify isn't
  // gated). Block repeated guesses before touching checkPasscode at all.
  if (action === "register-options" || action === "passcode") {
    const lockedMs = passcodeLockRemainingMs();
    if (lockedMs !== null) {
      return NextResponse.json(
        { error: "Too many wrong passcodes. Try again in a few minutes." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(lockedMs / 1000)) } }
      );
    }
  }

  if (action === "register-options") {
    if (!checkPasscode(String(body.passcode || ""))) {
      recordFailedPasscodeAttempt();
      return NextResponse.json({ error: "Wrong passcode." }, { status: 401 });
    }
    recordSuccessfulAuth();
    const options = await buildRegistrationOptions(rpID);
    rememberChallenge(options.challenge, "register");
    const res = NextResponse.json(options);
    res.cookies.set(
      REG_CHALLENGE_COOKIE,
      options.challenge,
      challengeCookieOptions
    );
    return res;
  }

  if (action === "register-verify") {
    // The cookie only CARRIES the challenge; consumeChallenge decides whether
    // it is acceptable. It is client-supplied, so a direct attacker can send
    // any value — separating the cookie names is not enough on its own. Only a
    // challenge THIS server issued for the "register" ceremony, unexpired and
    // unused, gets past here, so an unauthenticated caller cannot enroll a
    // passkey without first passing the passcode gate on register-options.
    const challenge = req.cookies.get(REG_CHALLENGE_COOKIE)?.value;
    if (!challenge || !consumeChallenge(challenge, "register")) {
      return NextResponse.json(
        { error: "Setup timed out. Please try again." },
        { status: 400 }
      );
    }
    let ok = false;
    try {
      ok = await verifyRegistration({
        response: body.response,
        expectedChallenge: challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
      });
    } catch {
      ok = false;
    }
    if (!ok) {
      return NextResponse.json(
        { error: "Couldn't register this device." },
        { status: 400 }
      );
    }
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, createSessionToken(), sessionCookieOptions);
    res.cookies.set(REG_CHALLENGE_COOKIE, "", {
      ...challengeCookieOptions,
      maxAge: 0,
    });
    return res;
  }

  if (action === "login-options") {
    const options = await buildAuthenticationOptions(rpID);
    rememberChallenge(options.challenge, "login");
    const res = NextResponse.json(options);
    res.cookies.set(
      AUTH_CHALLENGE_COOKIE,
      options.challenge,
      challengeCookieOptions
    );
    return res;
  }

  if (action === "login-verify") {
    const challenge = req.cookies.get(AUTH_CHALLENGE_COOKIE)?.value;
    if (!challenge || !consumeChallenge(challenge, "login")) {
      return NextResponse.json(
        { error: "Unlock timed out. Please try again." },
        { status: 400 }
      );
    }
    let ok = false;
    try {
      ok = await verifyAuthentication({
        response: body.response,
        expectedChallenge: challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
      });
    } catch {
      ok = false;
    }
    if (!ok) {
      return NextResponse.json(
        { error: "Couldn't verify. Please try again." },
        { status: 401 }
      );
    }
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, createSessionToken(), sessionCookieOptions);
    res.cookies.set(AUTH_CHALLENGE_COOKIE, "", {
      ...challengeCookieOptions,
      maxAge: 0,
    });
    return res;
  }

  if (action === "passcode") {
    if (!checkPasscode(String(body.passcode || ""))) {
      recordFailedPasscodeAttempt();
      return NextResponse.json({ error: "Wrong passcode." }, { status: 401 });
    }
    recordSuccessfulAuth();
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, createSessionToken(), sessionCookieOptions);
    return res;
  }

  if (action === "logout") {
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions, maxAge: 0 });
    return res;
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
