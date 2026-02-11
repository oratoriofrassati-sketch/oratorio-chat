import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const conversationId = searchParams.get("conversationId");
  const participantId = searchParams.get("participantId");
  const since = searchParams.get("since"); // ISO o null

  if (!conversationId || !participantId) {
    return NextResponse.json({ error: "Dati mancanti" }, { status: 400 });
  }

  // verifica membership
  const { data: mem } = await supabase
    .from("dm_members")
    .select("conversation_id")
    .eq("conversation_id", conversationId)
    .eq("participant_id", participantId)
    .maybeSingle();

  if (!mem) return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });

  // stato conversazione
  const { data: conv } = await supabase
    .from("dm_conversations")
    .select("is_open")
    .eq("id", conversationId)
    .maybeSingle();

  const closed = conv ? !conv.is_open : true;

  let q = supabase
    .from("dm_messages")
    .select("id, body, created_at, sender_id, participants(display_name)")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(100);

  if (since) q = q.gt("created_at", since);

  const { data } = await q;

  return NextResponse.json({ messages: data ?? [], closed });
}