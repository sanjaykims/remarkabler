"use client";

import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

export default function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/chat?conversationId=default")
      .then((r) => r.json())
      .then((d) => setMessages(d.messages || []));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setBusy(true);
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    const r = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, conversationId: "default" }),
    });
    const d = await r.json();
    setMessages((m) => [...m, { role: "assistant", content: d.reply || d.error || "" }]);
    setBusy(false);
  }

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      <h1 className="text-2xl font-semibold mb-4">Chat with your notes</h1>

      <div className="flex-1 overflow-auto space-y-4 pb-4">
        {messages.length === 0 && (
          <p className="opacity-60 text-sm">
            Ask anything about your uploaded notebooks. Try: <em>What did I write
            about the Q2 roadmap?</em>
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === "user"
                ? "ml-auto max-w-[80%] rounded-2xl bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900 px-4 py-2 whitespace-pre-wrap"
                : "mr-auto max-w-[80%] rounded-2xl bg-stone-100 dark:bg-stone-900 px-4 py-2 whitespace-pre-wrap"
            }
          >
            {m.content}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} className="border-t border-stone-200 dark:border-stone-800 pt-3 flex gap-2 items-end">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={busy ? "Thinking…" : "Ask about your notes…  (Enter for a new line)"}
          disabled={busy}
          rows={2}
          className="flex-1 rounded border border-stone-300 dark:border-stone-700 px-3 py-2 bg-transparent resize-y"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="rounded bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900 px-4 py-2 text-sm disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
