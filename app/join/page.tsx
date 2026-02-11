"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function JoinPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Prefill da QR: /join?room=ORATORIO1
  useEffect(() => {
    const r = searchParams.get("room");
    if (r) setCode(r.toUpperCase().trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function enter() {
    setErr(null);

    const roomCode = code.trim().toUpperCase();
    if (!roomCode) {
      setErr("Inserisci il codice stanza.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomCode }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErr(data?.error ?? "Errore durante l’accesso.");
        setLoading(false);
        return;
      }

      // Salva sessione (per questa tab)
      sessionStorage.setItem("roomId", data.roomId);
      sessionStorage.setItem("participantId", data.participantId);
      sessionStorage.setItem("displayName", data.displayName);

      router.push("/chat");
    } catch {
      setErr("Errore di rete. Riprova.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-black">
      <div className="w-full max-w-md border rounded-lg p-6 bg-white">
        <h1 className="text-2xl font-bold text-gray-900">Entra nella chat</h1>
        <p className="mt-2 text-gray-600">
          Inserisci il codice stanza (es. <b>ORATORIO1</b>).
        </p>

        <div className="mt-5">
          <label className="block text-sm font-medium text-gray-700">
            Codice stanza
          </label>
          <input
            className="mt-2 w-full border p-3 rounded text-black placeholder-gray-400"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="ORATORIO1"
            autoCapitalize="characters"
            autoCorrect="off"
            onKeyDown={(e) => {
              if (e.key === "Enter") enter();
            }}
          />
        </div>

        {err && (
          <div className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 p-3 rounded">
            {err}
          </div>
        )}

        <button
          onClick={enter}
          disabled={loading}
          className={`mt-5 w-full px-4 py-3 rounded text-white transition ${
            loading ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {loading ? "Accesso..." : "Entra"}
        </button>

        <div className="mt-4 text-xs text-gray-500">
          Nota: per uscire dalla chat usa il pulsante <b>ESCI</b>.
        </div>
      </div>
    </div>
  );
}