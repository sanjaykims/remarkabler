// Shared client-side flag so the auto-lock-on-background logic does not fire
// a spurious re-lock while a biometric prompt is open — the system passkey UI
// can briefly mark the page as hidden.
let unlocking = false;

export function setUnlocking(v: boolean) {
  unlocking = v;
}

export function isUnlocking(): boolean {
  return unlocking;
}

// Likewise, opening the file picker backgrounds the app on Android; that is
// not a real "left the app" event, so it must not trigger the lock.
let pickingFile = false;

export function setPickingFile(v: boolean) {
  pickingFile = v;
}

export function isPickingFile(): boolean {
  return pickingFile;
}
