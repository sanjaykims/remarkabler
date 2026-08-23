// Shared helpers for the multipart upload paths. Both `/share` (the PWA
// Web Share Target) and `/api/notebooks` need to duck-type "is this a
// File-shaped value in a FormData entry?" because Android Chrome's share
// intent and Samsung Internet's multipart parser sometimes hand us File
// objects from a *different* File constructor than the one this module
// sees, and `instanceof File` returns false. We test for the shape we
// actually use instead.

export type FileLike = {
  name?: string;
  type?: string;
  size: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

export function isFileLike(v: unknown): v is FileLike {
  if (v === null || typeof v !== "object") return false;
  const o = v as { size?: unknown; arrayBuffer?: unknown };
  return typeof o.size === "number" && typeof o.arrayBuffer === "function";
}

export function isPdfFile(file: { name?: string; type?: string }): boolean {
  if (file.type === "application/pdf") return true;
  return (file.name || "").toLowerCase().endsWith(".pdf");
}

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const MAX_UPLOAD_FILES = 3;
export const MAX_UPLOAD_TOTAL_BYTES = 40 * 1024 * 1024;

/** Cheap content check shared by every PDF ingestion path. */
export function looksLikePdf(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  );
}
