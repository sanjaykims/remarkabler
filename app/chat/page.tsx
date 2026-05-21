"use client";

import { useEffect, useRef, useState } from "react";
import { setPickingFile } from "../lockState";
import { track } from "../analytics";

type Attachment = { id: number; kind: string; filename: string };
type Msg = {
  role: "user" | "assistant";
  content: string;
  attachments?: Attachment[];
};

const DRAFT_KEY = "feedclaude:chat-draft";

export default function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // True once the first scroll-to-bottom has happened, so loading the
  // existing history doesn't animate a noisy smooth scroll on every visit.
  const didInitialScroll = useRef(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    fetch("/api/chat?conversationId=default")
      .then((r) => r.json())
      .then((d) => setMessages(d.messages || []));
  }, []);

  // Restore an unsent draft saved from a previous visit.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) setInput(saved);
    } catch {
      // localStorage unavailable (e.g. private browsing)
    }
  }, []);

  useEffect(() => {
    if (messages.length === 0) return;
    if (didInitialScroll.current) {
      // A message was sent/received this session — animate to it.
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    } else {
      // First load of the saved history — jump instantly, no animation.
      didInitialScroll.current = true;
      bottomRef.current?.scrollIntoView();
    }
  }, [messages]);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    if (w.SpeechRecognition || w.webkitSpeechRecognition) setVoiceSupported(true);
  }, []);

  function speak(text: string) {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(u);
  }

  function stopSpeaking() {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
  }

  // Open the file picker. Opening it backgrounds the app on Android, so
  // suppress the auto-lock until the picker closes and the app regains focus
  // — otherwise the unlock reload would discard the file just picked.
  function openFilePicker() {
    setPickingFile(true);
    const done = () => {
      window.removeEventListener("focus", done);
      setTimeout(() => setPickingFile(false), 300);
    };
    window.addEventListener("focus", done);
    fileInputRef.current?.click();
  }

  // Validate a picked attachment before it is sent.
  function pickFile(f: File | null) {
    setError(null);
    if (!f) return;
    if (f.type.startsWith("video/")) {
      setError("Claude can't read video. Attach a photo or a PDF instead.");
      return;
    }
    const isImage = f.type.startsWith("image/");
    const isPdf =
      f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
    if (!isImage && !isPdf) {
      setError("Only photos and PDF files can be attached.");
      return;
    }
    setFile(f);
    track("chat_attachment_added", { kind: isImage ? "image" : "pdf" });
  }

  // Downscale a photo in the browser so the upload stays small and within
  // the image size Claude accepts.
  function resizeImage(f: File): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(f);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const max = 1568;
        let { width, height } = img;
        if (width > max || height > max) {
          const scale = Math.min(max / width, max / height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Couldn't process the image."));
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (b) =>
            b ? resolve(b) : reject(new Error("Couldn't process the image.")),
          "image/jpeg",
          0.85
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Couldn't read that image."));
      };
      img.src = url;
    });
  }

  async function sendMessage(text: string, speakReply: boolean) {
    const t = text.trim();
    const attached = file;
    if ((!t && !attached) || busy) return;
    stopSpeaking();
    setBusy(true);
    setError(null);
    updateInput("");
    setFile(null);
    setMessages((m) => [
      ...m,
      {
        role: "user",
        content:
          t ||
          (attached
            ? attached.type.startsWith("image/")
              ? "[Photo]"
              : "[PDF]"
            : ""),
      },
    ]);
    try {
      const fd = new FormData();
      fd.append("conversationId", "default");
      fd.append("message", t);
      if (attached) {
        const payload = attached.type.startsWith("image/")
          ? await resizeImage(attached)
          : attached;
        fd.append("file", payload, attached.name);
      }
      const r = await fetch("/api/chat", { method: "POST", body: fd });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(d.error || "Something went wrong. Please try again.");
      }
      track("chat_message_sent", { hadAttachment: !!attached });
      // Reload so a saved attachment shows on the message bubbles.
      const list = await fetch("/api/chat?conversationId=default").then((x) =>
        x.json()
      );
      setMessages(list.messages || []);
      if (speakReply && d.reply) speak(d.reply);
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content:
            (e as Error).message || "Something went wrong. Please try again.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  // Update the input and persist it, so typing survives a reload or the
  // app being backgrounded.
  function updateInput(value: string) {
    setInput(value);
    try {
      if (value) localStorage.setItem(DRAFT_KEY, value);
      else localStorage.removeItem(DRAFT_KEY);
    } catch {
      // localStorage unavailable
    }
  }

  function send(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input, false);
  }

  // Archive the visible chat: it is hidden here but kept in the database, and
  // Claude still continues the conversation from it.
  async function clearChat() {
    if (busy) return;
    const ok = window.confirm(
      "Hide this chat from the app? Your messages are kept and Claude still continues the conversation from them — they are only removed from view here, for privacy."
    );
    if (!ok) return;
    await fetch("/api/chat?conversationId=default", { method: "DELETE" });
    track("chat_cleared");
    setMessages([]);
  }

  function toggleMic() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) return;
    stopSpeaking();

    const recognition = new SR();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;

    let finalText = "";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (e: any) => {
      let interim = "";
      finalText = "";
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalText += res[0].transcript;
        else interim += res[0].transcript;
      }
      updateInput((finalText + interim).trim());
    };
    recognition.onerror = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
      const text = finalText.trim();
      if (text) sendMessage(text, true);
    };

    recognitionRef.current = recognition;
    setListening(true);
    track("chat_voice_started");
    recognition.start();
  }

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h1 className="text-2xl font-semibold">Chat with your notes</h1>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            disabled={busy}
            className="rounded border border-stone-300 dark:border-stone-700 px-3 py-1.5 text-sm disabled:opacity-50"
          >
            Clear
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto space-y-4 pb-4">
        {messages.length === 0 && (
          <p className="opacity-60 text-sm">
            Ask anything about your uploaded notebooks. Try: <em>What did I write
            about the Q2 roadmap?</em> You can also attach a photo or PDF for
            Claude to read.
            {voiceSupported && (
              <> Or tap <strong>Speak</strong> to ask out loud and hear the answer.</>
            )}
          </p>
        )}
        {messages.map((m, i) => {
          const placeholderOnly =
            !!m.attachments?.length && /^\[(Photo|PDF)/.test(m.content);
          return (
            <div
              key={i}
              className={
                m.role === "user"
                  ? "ml-auto max-w-[80%] rounded-2xl bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900 px-4 py-2 whitespace-pre-wrap"
                  : "mr-auto max-w-[80%] rounded-2xl bg-stone-100 dark:bg-stone-900 px-4 py-2 whitespace-pre-wrap"
              }
            >
              {m.attachments?.map((a) =>
                a.kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={a.id}
                    src={`/api/chat/attachment/${a.id}`}
                    alt={a.filename}
                    className="rounded-lg mb-2 max-h-64 w-auto"
                  />
                ) : (
                  <a
                    key={a.id}
                    href={`/api/chat/attachment/${a.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="block mb-2 text-sm underline break-all"
                  >
                    {a.filename}
                  </a>
                )
              )}
              {!placeholderOnly && m.content}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {speaking && (
        <button
          onClick={stopSpeaking}
          className="self-start mb-2 text-xs rounded border border-stone-300 dark:border-stone-700 px-2 py-1"
        >
          Stop voice
        </button>
      )}

      <form
        onSubmit={send}
        className="rounded-2xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2.5 space-y-2 focus-within:ring-1 focus-within:ring-stone-400 dark:focus-within:ring-stone-500"
      >
        {error && <p className="text-xs text-red-600 px-1">{error}</p>}
        {file && (
          <div className="flex items-center gap-2 text-xs px-1">
            <span className="truncate opacity-80">Attached: {file.name}</span>
            <button
              type="button"
              onClick={() => setFile(null)}
              className="shrink-0 opacity-60 hover:opacity-100 underline"
            >
              Remove
            </button>
          </div>
        )}
        <textarea
          value={input}
          onChange={(e) => updateInput(e.target.value)}
          placeholder={
            busy
              ? "Thinking…"
              : listening
                ? "Listening…"
                : "Ask anything about your notes…"
          }
          disabled={busy}
          rows={2}
          className="w-full bg-transparent resize-none outline-none px-1 text-sm placeholder:opacity-50"
        />
        <div className="flex items-center justify-between">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf,.pdf"
            className="hidden"
            onChange={(e) => {
              pickFile(e.target.files?.[0] || null);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={openFilePicker}
            disabled={busy}
            aria-label="Attach a photo or PDF"
            className="w-9 h-9 rounded-full border border-stone-300 dark:border-stone-700 flex items-center justify-center disabled:opacity-50"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            {voiceSupported && (
              <button
                type="button"
                onClick={toggleMic}
                disabled={busy}
                aria-label={listening ? "Stop listening" : "Speak"}
                className={
                  "w-9 h-9 rounded-full flex items-center justify-center " +
                  (listening
                    ? "bg-red-600 text-white"
                    : "border border-stone-300 dark:border-stone-700 disabled:opacity-50")
                }
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="3" width="6" height="11" rx="3" />
                  <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
                </svg>
              </button>
            )}
            <button
              type="submit"
              disabled={busy || (!input.trim() && !file)}
              aria-label="Send"
              className="w-9 h-9 rounded-full bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900 flex items-center justify-center disabled:opacity-40"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
