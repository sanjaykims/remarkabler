import { NextRequest, NextResponse } from "next/server";
import { createPinGate } from "./pinGate";

// The Notebooks tab's own 4-digit PIN (separate from the Map PIN, on top of
// the app lock). Guards every route the Notebooks page reads or writes:
// /api/notebooks*, /api/shares*. Separate settings keys, cookie and token
// domain from the Map gate, so one PIN never opens the other.

export const NOTEBOOKS_UNLOCK_COOKIE = "fc_nb_unlock";

const gate = createPinGate({
  hashKey: "notebooks_pin_hash",
  failKey: "notebooks_pin_fail",
  tokenDomain: "notebooks-unlock|",
  cookieName: NOTEBOOKS_UNLOCK_COOKIE,
  // Wide enough to cover /api/notebooks and /api/shares (and the PDF links).
  cookiePath: "/api",
});

export const notebooksPinConfigured = gate.configured;
export const setNotebooksPin = gate.setPin;
export const notebooksPinLockRemainingMs = gate.lockRemainingMs;
export const notebooksAttemptsLeft = gate.attemptsLeft;
export const tryUnlockNotebooks = gate.tryUnlock;
export const makeNotebooksUnlockToken = gate.makeUnlockToken;
export const verifyNotebooksUnlockToken = gate.verifyUnlockToken;
export const notebooksUnlockCookieOptions = gate.cookieOptions;

/**
 * Route guard, call AFTER the app-lock check. Returns a 403 response when the
 * Notebooks PIN hasn't been entered (or the unlock expired), else null.
 * Fails closed: if no PIN has been created yet, the tab stays locked until the
 * owner sets one on the Notebooks page.
 */
export function notebooksPinDenied(req: NextRequest): NextResponse | null {
  if (verifyNotebooksUnlockToken(req.cookies.get(NOTEBOOKS_UNLOCK_COOKIE)?.value)) {
    return null;
  }
  return NextResponse.json({ error: "Notebooks PIN required" }, { status: 403 });
}
