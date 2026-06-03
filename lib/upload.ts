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
