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
  // The spec and every real reader tolerate the %PDF- header appearing
  // anywhere in the first 1024 bytes (BOMs, HTTP preambles, some export
  // pipelines put bytes in front of it), so requiring offset 0 rejected
  // legitimate exports with no diagnostic — and on this path a false
  // rejection loses the user's notebook.
  //
  // This is a cheap header check, NOT validation: it says nothing about the
  // remaining bytes. The real defence is that nothing parses a shared PDF
  // until an authenticated approval.
  const window = bytes.subarray(0, 1024);
  const needle = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
  outer: for (let i = 0; i + needle.length <= window.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (window[i + j] !== needle[j]) continue outer;
    }
    return true;
  }
  return false;
}
