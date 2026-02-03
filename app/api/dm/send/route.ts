import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function sanitize(s: string) {
  return s.trim().slice(0, 400);
}

export async function POST(req: Request) {
  const { conversationId, participantId, body } = await req.json();
  const text = sanitize(String(body || ""));

  if (!conversationId || !participantId || !text) {
    return NextResponse.json({ error: "Dati mancanti" }, { status: 400 });
  }

  // verifica che il mittente sia membro della conversazione
  const { data: mem } = await supabase
    .from("dm_members")
    .select("conversation_id")
    .eq("conversation_id", conversationId)
    .eq("participant_id", participantId)
    .maybeSingle();

  if (!mem) return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });

  await supabase.from("dm_messages").insert({
    conversation_id: conversationId,
    sender_id: participantId,
    body: text,
  });

  return NextResponse.json({ ok: true });
}