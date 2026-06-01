import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { db, DATA_DIR } from "@/lib/db";
import {
  ensureProfileSeed,
  maybeDistillLocation,
  maybeGenerateWeeklyInsight,
  maybeBackfillEmbeddings,
  maybeBackfillEntryDates,
  maybeGenerateDailySummaries,
} from "@/lib/notes";
import { getCurrentProfile } from "@/lib/profile";
import { recentLocationsContext, isLocationEnabled } from "@/lib/location";
import { recentRouteContext } from "@/lib/timeline";
import { owntracksRouteContext } from "@/lib/owntracks";
import { chatOverNotes } from "@/lib/claude";
import { isAuthenticated } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const LOCKED = () => NextResponse.json({ error: "Locked" }, { status: 401 });

const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const ATTACHMENT_DIR = path.join(DATA_DIR, "chat-attachments");

const EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
};

// Some Android file managers hand us a File with an empty MIME, so we
// derive one from the extension as a fallback.
const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  pdf: "application/pdf",
};

function ext(name: string): string {
  const i = name.toLowerCase().lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

export async function POST(req: NextRequest) {
  if (!isAuthenticated()) return LOCKED();

  // JSON, not multipart — Samsung Internet's multipart serialisation was
  // silently dropping the file part, so chat sends the attachment as
  // base64 in a JSON body. PWA share-target stays multipart (the spec
  // requires it).
  const body = (await req.json().catch(() => null)) as
    | {
        conversationId?: unknown;
        message?: unknown;
        attachment?: {
          filename?: unknown;
          mediaType?: unknown;
          dataBase64?: unknown;
        };
      }
    | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const conversationId = String(body.conversationId || "default");
  const userMessage = String(body.message || "").trim();
  const att = body.attachment;

  // Validate and read an optional attachment.
  let attachment:
    | { kind: "image" | "document"; mediaType: string; dataBase64: string }
    | undefined;
  let saved: { kind: "image" | "document"; filename: string; mime: string; stored: string }
    | undefined;

  if (att && typeof att === "object" && typeof att.dataBase64 === "string") {
    const mime = String(att.mediaType || "");
    const filename = String(att.filename || "attachment");
    const extension = ext(filename);
    const effectiveMime = mime || EXT_TO_MIME[extension] || "";
    const isImage =
      IMAGE_TYPES.includes(effectiveMime) ||
      (effectiveMime.startsWith("image/") &&
        ["jpg", "jpeg", "png", "gif", "webp"].includes(extension));
    const isPdf =
      effectiveMime === "application/pdf" || extension === "pdf";
    if (mime.startsWith("video/")) {
      return NextResponse.json(
        { error: "Claude can't read video. Attach a photo or a PDF instead." },
        { status: 400 }
      );
    }
    if (!isImage && !isPdf) {
      return NextResponse.json(
        {
          error:
            "Only photos (JPG, PNG, GIF, WebP) and PDF files can be attached. Please pick one of those.",
        },
        { status: 400 }
      );
    }
    const bytes = Buffer.from(att.dataBase64, "base64");
    if (bytes.length === 0) {
      return NextResponse.json(
        {
          error:
            "Your attachment came through empty. Try picking the photo again.",
        },
        { status: 400 }
      );
    }
    if (bytes.length > MAX_ATTACHMENT_BYTES) {
      return NextResponse.json(
        { error: "That file is too large (max 20 MB)." },
        { status: 400 }
      );
    }
    const kind: "image" | "document" = isImage ? "image" : "document";
    const mediaType = isImage
      ? IMAGE_TYPES.includes(effectiveMime)
        ? effectiveMime
        : EXT_TO_MIME[extension] || "image/jpeg"
      : "application/pdf";
    fs.mkdirSync(ATTACHMENT_DIR, { recursive: true });
    const stored = `${randomUUID()}${EXT[mediaType] || ""}`;
    fs.writeFileSync(path.join(ATTACHMENT_DIR, stored), bytes);
    attachment = { kind, mediaType, dataBase64: att.dataBase64 };
    saved = { kind, filename, mime: mediaType, stored };
  }

  if (!userMessage && !attachment) {
    return NextResponse.json(
      { error: "Please type a message or attach a photo/PDF." },
      { status: 400 }
    );
  }

  const history = (
    db()
      .prepare(
        `SELECT role, content FROM chat_messages
         WHERE conversation_id = ? ORDER BY id DESC LIMIT 12`
      )
      .all(conversationId) as Array<{ role: "user" | "assistant"; content: string }>
  ).reverse();

  // Reason over the accumulated profile and let the chat model call tools
  // (search_diary / get_entries_by_date / list_notebooks / get_notebook /
  // get_recent_entries) to fetch specific entries on demand. Seed the
  // profile in the background if it hasn't been built yet.
  ensureProfileSeed();
  // Once a week, quietly fold the recent location route into the profile.
  maybeDistillLocation();
  // Once a week, quietly write a fresh reflection (Opus).
  maybeGenerateWeeklyInsight();
  // Bring older pages' semantic embeddings online (no-op once everything
  // has an embedding, or when VOYAGE_API_KEY isn't set).
  maybeBackfillEmbeddings();
  // Multi-level memory (Phase 2): tag pages with the diary's own date,
  // then generate daily summaries for any day that doesn't have one yet.
  // Both run in the background and cap their work per tick.
  maybeBackfillEntryDates();
  maybeGenerateDailySummaries();
  const profile = getCurrentProfile() || "";

  // Prefer the Google Timeline import, then the automatic OwnTracks route,
  // then the one-tap location log. Suppressed entirely if the user has turned
  // off the in-app "Share location with Remarkabler" switch.
  const recentLocations = isLocationEnabled()
    ? recentRouteContext() ||
      (await owntracksRouteContext()) ||
      recentLocationsContext()
    : "";

  let reply: string;
  let replyModel: string;
  try {
    const result = await chatOverNotes({ profile, recentLocations, history, userMessage, attachment });
    reply = result.reply;
    replyModel = result.model;
  } catch (err) {
    const status = (err as { status?: number }).status;
    let message = "Chat hit a snag. Please try again.";
    if (status === 529 || status === 503) {
      message = "Claude is temporarily busy. Please try again in a moment.";
    } else if (status === 429) {
      message = "A lot of requests just now — wait a few seconds and try again.";
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // The stored content stays non-empty even for an attachment-only message,
  // so it remains valid history for later turns.
  const storedContent =
    userMessage ||
    (saved
      ? saved.kind === "image"
        ? "[Photo]"
        : `[PDF: ${saved.filename}]`
      : "");

  const insertMsg = db().prepare(
    `INSERT INTO chat_messages(conversation_id, role, content) VALUES(?,?,?)`
  );
  const userRow = insertMsg.run(conversationId, "user", storedContent);
  if (saved) {
    db()
      .prepare(
        `INSERT INTO chat_attachments(message_id, kind, filename, mime, path)
         VALUES(?,?,?,?,?)`
      )
      .run(userRow.lastInsertRowid, saved.kind, saved.filename, saved.mime, saved.stored);
  }
  db()
    .prepare(
      `INSERT INTO chat_messages(conversation_id, role, content, model) VALUES(?,?,?,?)`
    )
    .run(conversationId, "assistant", reply, replyModel);

  return NextResponse.json({ reply, model: replyModel });
}

export async function GET(req: NextRequest) {
  if (!isAuthenticated()) return LOCKED();
  const conversationId =
    req.nextUrl.searchParams.get("conversationId") || "default";

  const rows = db()
    .prepare(
      `SELECT id, role, content, created_at, model FROM chat_messages
       WHERE conversation_id = ? AND archived_at IS NULL ORDER BY id ASC`
    )
    .all(conversationId) as Array<{
    id: number;
    role: string;
    content: string;
    created_at: string;
    model: string | null;
  }>;

  const attachments = db()
    .prepare(
      `SELECT a.id, a.message_id, a.kind, a.filename
       FROM chat_attachments a
       JOIN chat_messages m ON m.id = a.message_id
       WHERE m.conversation_id = ? AND m.archived_at IS NULL`
    )
    .all(conversationId) as Array<{
    id: number;
    message_id: number;
    kind: string;
    filename: string;
  }>;

  const messages = rows.map((r) => ({
    role: r.role,
    content: r.content,
    created_at: r.created_at,
    model: r.model,
    attachments: attachments
      .filter((a) => a.message_id === r.id)
      .map((a) => ({ id: a.id, kind: a.kind, filename: a.filename })),
  }));

  return NextResponse.json({ messages });
}

// "Clear" the chat: archive every visible message. They stay in the database
// and still feed Claude (the POST history query is unfiltered), so the
// conversation continues — they are only removed from the chat view.
export async function DELETE(req: NextRequest) {
  if (!isAuthenticated()) return LOCKED();
  const conversationId =
    req.nextUrl.searchParams.get("conversationId") || "default";
  db()
    .prepare(
      `UPDATE chat_messages SET archived_at = CURRENT_TIMESTAMP
       WHERE conversation_id = ? AND archived_at IS NULL`
    )
    .run(conversationId);
  return NextResponse.json({ ok: true });
}
