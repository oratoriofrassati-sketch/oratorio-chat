"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Msg = {
  id: string;
  body: string;
  created_at: string;
  sender_id: string;
  participants?: { display_name: string } | null;
};

export default function ChatPage() {
  const router = useRouter();

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [partnerName, setPartnerName] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(true);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [closed, setClosed] = useState(false);

  const roomId =
    typeof window !== "undefined" ? sessionStorage.getItem("roomId") : null;
  const participantId =
    typeof window !== "undefined"
      ? sessionStorage.getItem("participantId")
      : null;
  const displayName =
    typeof window !== "undefined" ? sessionStorage.getItem("displayName") : null;

  // 1) Matchmaking 1:1
  useEffect(() => {
    if (!roomId || !participantId) return;

    let alive = true;

    const runMatch = async () => {
      if (!alive) return;

      try {
        const res = await fetch("/api/match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId, participantId }),
        });

        const data = await res.json();

        if (!res.ok) {
          // Se qualcosa va storto, torna a join
          router.push("/join");
          return;
        }

        if (data.waiting) {
          setWaiting(true);
          setTimeout(runMatch, 1500);
          return;
        }

        setWaiting(false);
        setConversationId(data.conversationId);
        setPartnerName(data.partnerName ?? "Anonimo");
      } catch {
        setTimeout(runMatch, 1500);
      }
    };

    runMatch();

    return () => {
      alive = false;
    };
  }, [roomId, participantId, router]);

  // 2) Polling messaggi + controllo chiusura chat
  useEffect(() => {
    if (!conversationId || !participantId) return;
    if (closed) return;

    let alive = true;

    const poll = async () => {
      if (!alive) return;

      try {
        const last = messages.length
          ? messages[messages.length - 1].created_at
          : null;

        const url =
          `/api/dm/messages?conversationId=${encodeURIComponent(
            conversationId
          )}` +
          `&participantId=${encodeURIComponent(participantId)}` +
          (last ? `&since=${encodeURIComponent(last)}` : "");

        const res = await fetch(url);
        const data = await res.json();

        if (!res.ok) {
          // sessione non valida o altro: torna a join
          router.push("/join");
          return;
        }

        if (data?.closed) {
          setClosed(true);
          return; // stop polling
        }

        if (data?.messages?.length) {
          setMessages((prev) => [...prev, ...data.messages]);
        }
      } catch {
        // ignora e riprova
      }

      setTimeout(poll, 1200);
    };

    poll();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, participantId, router, closed, messages.length]);

  async function send() {
    if (!text.trim() || !conversationId || !participantId || closed) return;

    const payload = {
      conversationId,
      participantId,
      body: text,
    };

    setText("");

    await fetch("/api/dm/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  async function leave() {
    if (!conversationId || !participantId) {
      router.push("/join");
      return;
    }

    await fetch("/api/dm/leave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId, participantId }),
    });

    // pulizia e ritorno a join
    setConversationId(null);
    setPartnerName(null);
    setMessages([]);
    setClosed(false);
    setWaiting(true);

    router.push("/join");
  }

  // Sessione mancante
  if (!roomId || !participantId) {
    return (
      <div className="max-w-md mx-auto mt-10 px-4">
        <p className="mb-4">Sessione mancante. Torna a Join.</p>
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded"
          onClick={() => router.push("/join")}
        >
          Vai a Join
        </button>
      </div>
    );
  }

  // In attesa partner
  if (waiting) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center px-4">
        <h1 className="text-2xl font-bold">In attesa di un partner…</h1>
        <p className="mt-2 text-gray-600">Resta su questa schermata.</p>
        <button
          className="mt-6 border px-4 py-2 rounded"
          onClick={() => router.push("/join")}
        >
          Torna indietro
        </button>
      </div>
    );
  }

  // Chat chiusa
  if (closed) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center px-4">
        <h1 className="text-2xl font-bold">Chat terminata</h1>
        <p className="mt-2 text-gray-600">
          Il tuo partner è uscito o la chat è stata chiusa.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded"
            onClick={() => router.push("/join")}
          >
            Torna a Join
          </button>
        </div>
      </div>
    );
  }

  // UI chat
  return (
    <div className="max-w-md mx-auto mt-6 px-4">
      {/* Header con ESCI */}
<div className="mb-3 p-3 border rounded flex items-center justify-between gap-3 bg-gray-900 text-white">        <div>
          <div className="text-sm text-gray-600">Tu: {displayName}</div>
          <div className="font-semibold">Chat con: {partnerName}</div>
        </div>

<button
  onClick={leave}
  className="px-3 py-2 rounded bg-red-600 text-white hover:bg-red-700 transition"
  title="Esci e chiudi la chat"
>
  ESCI
</button>
      </div>

      {/* Messaggi */}
      <div className="border rounded p-3 h-[60vh] overflow-y-auto bg-gray-50">
        {messages.map((m) => {
          const mine = m.sender_id === participantId;
          const name = mine ? "Tu" : m.participants?.display_name ?? "Partner";

          return (
            <div
              key={m.id}
              className={`mb-3 flex ${mine ? "justify-end" : "justify-start"}`}
            >
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
                    mine ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-900"
                  }`}
                >
                  {m.body}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input */}
      <div className="mt-3 flex gap-2">
<input
  className="border flex-1 p-2 rounded bg-white text-black placeholder-gray-400"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Scrivi…"
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
        />
        <button
          className="bg-blue-600 text-white px-4 rounded"
          onClick={send}
        >
          Invia
        </button>
      </div>
    </div>
  );
}