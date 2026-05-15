"use client";

import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

export default function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    fetch("/api/chat?conversationId=default")
      .then((r) => r.json())
      .then((d) => setMessages(d.messages || []));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
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
    // Pick the voice language from the reply's script.
    u.lang = /[가-힯]/.test(text) ? "ko-KR" : "en-US";
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

  async function sendMessage(text: string, speakReply: boolean) {
    const t = text.trim();
    if (!t || busy) return;
    stopSpeaking();
    setBusy(true);
    setInput("");
    setMessages((m) => [...m, { role: "user", content: t }]);
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: t, conversationId: "default" }),
      });
      const d = await r.json();
      const reply = d.reply || d.error || "";
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
      if (speakReply && d.reply) speak(d.reply);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Something went wrong. Please try again." },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function send(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input, false);
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
    recognition.lang = "ko-KR";
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
      setInput((finalText + interim).trim());
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
    recognition.start();
  }

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      <h1 className="text-2xl font-semibold mb-4">Chat with your notes</h1>

      <div className="flex-1 overflow-auto space-y-4 pb-4">
        {messages.length === 0 && (
          <p className="opacity-60 text-sm">
            Ask anything about your uploaded notebooks. Try: <em>What did I write
            about the Q2 roadmap?</em>
            {voiceSupported && (
              <> Or tap <strong>Speak</strong> to ask out loud and hear the answer.</>
            )}
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
        className="border-t border-stone-200 dark:border-stone-800 pt-3 flex gap-2 items-end"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            busy
              ? "Thinking…"
              : listening
                ? "Listening…"
                : "Ask about your notes…  (Enter for a new line)"
          }
          disabled={busy}
          rows={2}
          className="flex-1 rounded border border-stone-300 dark:border-stone-700 px-3 py-2 bg-transparent resize-y"
        />
        {voiceSupported && (
          <button
            type="button"
            onClick={toggleMic}
            disabled={busy}
            className={
              listening
                ? "rounded bg-red-600 text-white px-3 py-2 text-sm"
                : "rounded border border-stone-300 dark:border-stone-700 px-3 py-2 text-sm disabled:opacity-50"
            }
          >
            {listening ? "Listening…" : "Speak"}
          </button>
        )}
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
