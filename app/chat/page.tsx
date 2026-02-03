"use client";

import { useEffect, useState } from "react";

type Msg = {
  id: string;
  body: string;
  created_at: string;
  sender_id: string;
  participants?: { display_name: string } | null;
};

export default function ChatPage() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [partnerName, setPartnerName] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(true);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");

  const roomId = typeof window !== "undefined" ? sessionStorage.getItem("roomId") : null;
  const participantId = typeof window !== "undefined" ? sessionStorage.getItem("participantId") : null;
  const displayName = typeof window !== "undefined" ? sessionStorage.getItem("displayName") : null;

  useEffect(() => {
    if (!roomId || !participantId) return;

    // 1) matchmaking
    const runMatch = async () => {
      const res = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, participantId }),
      });
      const data = await res.json();
      if (data.waiting) {
        setWaiting(true);
        setTimeout(runMatch, 1500); // riprova
        return;
      }
      setWaiting(false);
      setConversationId(data.conversationId);
      setPartnerName(data.partnerName ?? "Anonimo");
    };

    runMatch();
  }, [roomId, participantId]);

  // 2) polling messaggi
  useEffect(() => {
    if (!conversationId || !participantId) return;
    let alive = true;

    const poll = async () => {
      if (!alive) return;
      const last = messages.length ? messages[messages.length - 1].created_at : null;

      const url =
        `/api/dm/messages?conversationId=${encodeURIComponent(conversationId)}` +
        `&participantId=${encodeURIComponent(participantId)}` +
        (last ? `&since=${encodeURIComponent(last)}` : "");

      const res = await fetch(url);
      const data = await res.json();

      if (data?.messages?.length) {
        setMessages((prev) => [...prev, ...data.messages]);
      }

      setTimeout(poll, 1200);
    };

    poll();
    return () => {
      alive = false;
    };
  }, [conversationId, participantId, messages.length]);

  async function send() {
    if (!text.trim() || !conversationId || !participantId) return;

    await fetch("/api/dm/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationId,
        participantId,
        body: text,
      }),
    });

    setText("");
  }

  if (!roomId || !participantId) {
    return (
      <div className="max-w-md mx-auto mt-10">
        <p>Sessione mancante. Torna a /join.</p>
      </div>
    );
  }

  if (waiting) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center">
        <h1 className="text-2xl font-bold">In attesa di un partner…</h1>
        <p className="mt-2 text-gray-600">Resta su questa schermata.</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-6">
      <div className="mb-3 p-3 border rounded">
        <div className="text-sm text-gray-600">Tu: {displayName}</div>
        <div className="font-semibold">Chat con: {partnerName}</div>
      </div>

      <div className="border rounded p-3 h-[60vh] overflow-y-auto bg-white">
        {messages.map((m) => {
          const mine = m.sender_id === participantId;
          const name = mine ? "Tu" : (m.participants?.display_name ?? "Partner");
          return (
<div key={m.id} className={`mb-3 flex ${mine ? "justify-end" : "justify-start"}`}>
  <div className="max-w-[75%]">
    <div
      className={`text-xs mb-1 ${
        mine ? "text-right text-gray-500" : "text-left text-gray-600"
      }`}
    >
      {name}
    </div>

    <div
      className={`px-3 py-2 rounded-lg text-sm leading-relaxed ${
        mine
          ? "bg-blue-600 text-white"
          : "bg-gray-200 text-gray-900"
      }`}
    >
      {m.body}
    </div>
  </div>
</div>
          );
        })}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          className="border flex-1 p-2"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Scrivi…"
        />
        <button className="bg-blue-600 text-white px-4" onClick={send}>
          Invia
        </button>
      </div>
    </div>
  );
}