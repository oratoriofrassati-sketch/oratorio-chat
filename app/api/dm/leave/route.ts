import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { conversationId, participantId } = await req.json();

    if (!conversationId || !participantId) {
      return NextResponse.json({ error: "missing conversationId/participantId" }, { status: 400 });
    }

    // 1) Se la conversazione non esiste -> ok (idempotente)
    const { data: conv, error: convErr } = await supabase
      .from("dm_conversations")
      .select("id,is_open")
      .eq("id", conversationId)
      .maybeSingle();

    if (convErr) {
      return NextResponse.json({ error: convErr.message }, { status: 500 });
    }
    if (!conv) {
      return NextResponse.json({ ok: true, already: "missing_conversation" });
    }

    // 2) Prova a verificare membership (solo informativa, NON blocca)
    // (se manca non vogliamo impedire l'uscita)
    await supabase
      .from("dm_members")
      .select("conversation_id")
      .eq("conversation_id", conversationId)
      .eq("participant_id", participantId)
      .maybeSingle();

    // 3) Chiudi (se già chiusa -> ok)
    if (!conv.is_open) {
      return NextResponse.json({ ok: true, already: "closed" });
    }

    const { error: updErr } = await supabase
      .from("dm_conversations")
      .update({ is_open: false, ended_at: new Date().toISOString() })
      .eq("id", conversationId);

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
}