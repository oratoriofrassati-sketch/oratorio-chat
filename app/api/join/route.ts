import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function genNickname() {
  const base = [
    "Corallo",
    "Nebbia",
    "Quercia",
    "Gabbiano",
    "Sorgente",
    "Falco",
    "Luce",
    "Roccia",
    "Vento",
    "Fiume",
  ];
  const n = Math.floor(10 + Math.random() * 90); // 10..99
  return base[Math.floor(Math.random() * base.length)] + n;
}

export async function POST(req: Request) {
  try {
    const { roomCode, clientToken } = await req.json();

    const code = String(roomCode || "").trim().toUpperCase();
    const token = String(clientToken || "").trim();

    if (!code || !token) {
      return NextResponse.json(
        { error: "Codice stanza o token mancanti" },
        { status: 400 }
      );
    }

    // 1) Trova la stanza
    const { data: room, error: roomErr } = await supabase
      .from("rooms")
      .select("*")
      .eq("code", code)
      .maybeSingle();

    if (roomErr) {
      return NextResponse.json({ error: "Errore stanza" }, { status: 500 });
    }
    if (!room) {
      return NextResponse.json({ error: "Stanza non trovata" }, { status: 404 });
    }
    if (!room.is_open) {
      return NextResponse.json({ error: "Stanza chiusa" }, { status: 403 });
    }
    if (room.closes_at && new Date(room.closes_at) < new Date()) {
      return NextResponse.json({ error: "Stanza scaduta" }, { status: 403 });
    }

    // 2) Se il partecipante esiste già (stesso device nella stessa stanza), riusalo
    const { data: existing, error: exErr } = await supabase
      .from("participants")
      .select("*")
      .eq("room_id", room.id)
      .eq("client_token", token)
      .maybeSingle();

    if (exErr) {
      return NextResponse.json({ error: "Errore partecipante" }, { status: 500 });
    }

    if (existing) {
      if (existing.is_banned) {
        return NextResponse.json({ error: "Accesso negato" }, { status: 403 });
      }
      return NextResponse.json({
        roomId: room.id,
        participantId: existing.id,
        displayName: existing.display_name,
      });
    }

    // 3) Crea un nuovo partecipante con nickname automatico
    const displayName = genNickname();
    const { data: created, error: crErr } = await supabase
      .from("participants")
      .insert({
        room_id: room.id,
        client_token: token,
        display_name: displayName,
      })
      .select()
      .single();

    if (crErr) {
      return NextResponse.json({ error: "Errore creazione" }, { status: 500 });
    }

    return NextResponse.json({
      roomId: room.id,
      participantId: created.id,
      displayName: created.display_name,
    });
  } catch {
    return NextResponse.json({ error: "Richiesta non valida" }, { status: 400 });
  }
}