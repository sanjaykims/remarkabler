import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { db, DATA_DIR } from "@/lib/db";
import { runMaintenanceSweep } from "@/lib/notes";
import { getCurrentProfile } from "@/lib/profile";
import { recentLocationsContext, isLocationEnabled } from "@/lib/location";
import { owntracksRouteContext, warmOwntracksGeocodes } from "@/lib/owntracks";
import { chatOverNotes } from "@/lib/claude";
import { isAuthenticated } from "@/lib/auth";
import { extractTextFromAttachment } from "@/lib/extractText";
import {
  recallChatMemories,
  formatRecalledMemoriesBlock,
} from "@/lib/chatMemory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

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
  // Set when we successfully convert a PDF/Word attachment to plain text on
  // the server (MarkItDown-style). The extracted text is appended to the
  // user message and the raw document block is dropped, cutting per-chat
  // token cost ~3-5x for text-based attachments.
  let extractedDocText: string | undefined;

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

    // If this is a text-bearing file (PDF / DOCX / .txt / .md), try to pull
    // the text out HERE on the server before sending to Claude. A 5-page
    // typed PDF costs ~7,500 input tokens as a document block but only
    // ~1,500 as extracted text — a 3-5x savings on every chat with an
    // attached document. Images skip extraction entirely (no text layer
    // to pull) and continue going through as vision blocks. Handwritten
    // reMarkable PDFs also skip — pdf-parse returns near-empty text on
    // image-based ink, the extractor signals "fallback", and we keep the
    // raw document block so the diary content isn't lost.
    if (kind === "document") {
      const result = await extractTextFromAttachment({
        mediaType,
        bytes,
        filename,
      });
      if (result.kind === "text") {
        // Replace the raw document with extracted text appended to the
        // user's message. Mark it so Claude knows it's the file contents,
        // not the user's words.
        const header = `[Extracted contents of ${filename}${
          result.numPages ? `, ${result.numPages} pages` : ""
        }]`;
        extractedDocText = `${header}\n\n${result.text}`;
        attachment = undefined;
      } else {
        console.warn(
          `[chat] attachment extraction fallback (${filename}): ${result.reason}`
        );
      }
    }
  }

  if (!userMessage && !attachment && !extractedDocText) {
    return NextResponse.json(
      { error: "Please type a message or attach a photo/PDF." },
      { status: 400 }
    );
  }

  // archived_at IS NULL — Clear is a real boundary. Cleared messages no
  // longer feed Claude as raw history; durable carry-forward lives in the
  // chat_memories block (recalled below) instead.
  const history = (
    db()
      .prepare(
        `SELECT role, content FROM chat_messages
         WHERE conversation_id = ? AND archived_at IS NULL
         ORDER BY id DESC LIMIT 12`
      )
      .all(conversationId) as Array<{ role: "user" | "assistant"; content: string }>
  ).reverse();

  // One throttled sweep covers profile seed, weekly insight, location
  // distill, embedding backfill, entry-date backfill, daily summaries, and
  // the GitHub backup. Re-runs at most every 5 minutes regardless of how
  // many chats fire in that window. Fire-and-forget.
  runMaintenanceSweep();
  const profile = getCurrentProfile() || "";

  // Prefer the automatic OwnTracks route, fall back to the one-tap log.
  // Suppressed entirely when the user has turned off the in-app "Share
  // location with Remarkabler" switch. owntracksRouteContext() uses
  // cached geocodes only — any uncached stays show as raw lat/lng for
  // this turn, and a background warmer (fired below) fills them in so
  // the next chat resolves to real place names.
  const recentLocations = isLocationEnabled()
    ? (await owntracksRouteContext()) || recentLocationsContext()
    : "";
  if (isLocationEnabled()) warmOwntracksGeocodes();

  // Compose the message sent to Claude: the user's typed message + (if we
  // pulled out a document) the extracted text. The stored chat row (below)
  // keeps just the user's typed message — the extracted text isn't shown
  // back in chat history because the user attached the file, they didn't
  // write that content themselves.
  const messageToClaude = extractedDocText
    ? userMessage
      ? `${userMessage}\n\n${extractedDocText}`
      : extractedDocText
    : userMessage;

  // Pull the top-K chat memories most relevant to this turn and render them
  // as an advisory block. Fail-open by design — chat must never 500 because
  // recall failed (no Voyage key, Voyage outage, decode glitch, etc).
  let recalledMemories = "";
  try {
    const { items } = await recallChatMemories(messageToClaude);
    recalledMemories = formatRecalledMemoriesBlock(items);
  } catch (e) {
    console.warn("[chat] recall failed:", (e as Error).message);
  }

  let reply: string;
  let replyModel: string;
  try {
    const result = await chatOverNotes({
      profile,
      recentLocations,
      recalledMemories,
      history,
      userMessage: messageToClaude,
      attachment,
    });
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

// "Clear" the chat: archive every visible message into a single batch and
// fire the chat-memory compressor. The archived messages no longer feed
// Claude as raw history (POST filters archived_at IS NULL); their durable
// substance is carried forward by the extracted chat_memories instead.
export async function DELETE(req: NextRequest) {
  if (!isAuthenticated()) return LOCKED();
  const conversationId =
    req.nextUrl.searchParams.get("conversationId") || "default";

  const batchId = db().transaction(() => {
    const ins = db()
      .prepare(`INSERT INTO chat_archive_batches(conversation_id) VALUES(?)`)
      .run(conversationId);
    const id = Number(ins.lastInsertRowid);
    // COALESCE preserves an existing archive_batch_id when a message has
    // already been batched by the backfill-all path. That keeps the
    // backfill batch (and any memories it produced) consistent even when
    // the user clicks Clear later; only never-batched messages get this
    // Clear's new id stamped on them.
    db()
      .prepare(
        `UPDATE chat_messages
           SET archived_at = datetime('now'),
               archive_batch_id = COALESCE(archive_batch_id, ?)
         WHERE conversation_id = ? AND archived_at IS NULL`
      )
      .run(id, conversationId);
    const stats = db()
      .prepare(
        `SELECT MIN(id) AS s, MAX(id) AS e, COUNT(*) AS c,
                COALESCE(SUM(CASE WHEN role='user' THEN LENGTH(content) ELSE 0 END), 0) AS uc
           FROM chat_messages WHERE archive_batch_id = ?`
      )
      .get(id) as {
      s: number | null;
      e: number | null;
      c: number;
      uc: number;
    };
    if (stats.c === 0) {
      db()
        .prepare(`DELETE FROM chat_archive_batches WHERE id = ?`)
        .run(id);
      return null;
    }
    db()
      .prepare(
        `UPDATE chat_archive_batches
           SET message_start_id = ?, message_end_id = ?,
               message_count = ?, user_char_count = ?
         WHERE id = ?`
      )
      .run(stats.s, stats.e, stats.c, stats.uc, id);
    return id;
  })();

  if (batchId !== null) {
    // Fire-and-forget extraction. The maintenance sweep will catch any batch
    // this misses (process restart, transient failure).
    try {
      void import("@/lib/chatMemory").then((m) =>
        m.maybeCompressChatSessions()
      );
    } catch {
      // best-effort
    }
  }
  return NextResponse.json({ ok: true, batchId });
}
