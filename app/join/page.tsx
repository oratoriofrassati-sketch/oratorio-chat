"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

function getClientToken() {
  const key = "oratorio_client_token";
  let t = localStorage.getItem(key);
  if (!t) {
    t = crypto.randomUUID();
    localStorage.setItem(key, t);
  }
  return t;
}

export default function JoinPage() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  // Prefill da QR: /join?room=ORATORIO1
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const r = params.get("room");
    if (r) setCode(r.trim().toUpperCase());
  }, []);

  async function join() {
    setError("");
    const clientToken = getClientToken();

    const res = await fetch("/api/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomCode: code.trim().toUpperCase(),
        clientToken,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Errore");
      return;
    }

    sessionStorage.setItem("roomId", data.roomId);
    sessionStorage.setItem("participantId", data.participantId);
    sessionStorage.setItem("displayName", data.displayName);

    router.push("/chat");
  }

  return (
    <div className="max-w-sm mx-auto mt-16 text-center">
      <h1 className="text-2xl font-bold mb-4">Entra nella chat</h1>

      <input
        className="border w-full p-2 text-center"
        placeholder="Codice stanza"
        value={code}
        onChange={(e) => setCode(e.target.value)}
      />

      <button onClick={join} className="mt-4 w-full bg-blue-600 text-white py-2">
        Entra
      </button>

      {error && <p className="text-red-600 mt-3">{error}</p>}
    </div>
  );
}