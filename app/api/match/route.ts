import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { roomId, participantId } = await req.json();

    if (!roomId || !participantId) {
      return NextResponse.json({ error: "Dati mancanti" }, { status: 400 });
    }

    // 1) Cerca una conversazione già esistente (aperte) per questo participant
    const { data: memberships, error: memErr } = await supabase
      .from("dm_members")
      .select("conversation_id")
      .eq("participant_id", participantId);

    if (memErr) {
      return NextResponse.json({ error: "Errore membership" }, { status: 500 });
    }

    if (memberships && memberships.length > 0) {
      const convIds = memberships.map((m: any) => m.conversation_id);

      const { data: openConv, error: convErr } = await supabase
        .from("dm_conversations")
        .select("id")
        .eq("room_id", roomId)
        .eq("is_open", true)
        .in("id", convIds)
        .limit(1)
        .maybeSingle();

      if (convErr) {
        return NextResponse.json({ error: "Errore conversazione" }, { status: 500 });
      }

      if (openConv?.id) {
        const conversationId = openConv.id;

        // trova il partner
        const { data: members } = await supabase
          .from("dm_members")
          .select("participant_id")
          .eq("conversation_id", conversationId);

        const partnerId = (members || []).find((m: any) => m.participant_id !== participantId)?.participant_id;

        let partnerName: string | null = null;
        if (partnerId) {
          const { data: p } = await supabase
            .from("participants")
            .select("display_name")
            .eq("id", partnerId)
            .maybeSingle();
          partnerName = p?.display_name ?? null;
        }

        return NextResponse.json({ conversationId, partnerName, waiting: false });
      }
    }

    // 2) Non sei in nessuna conversazione: assicurati di essere in coda
    await supabase.from("dm_queue").upsert(
      { room_id: roomId, participant_id: participantId },
      { onConflict: "room_id,participant_id" }
    );

    // 3) Cerca un altro utente in coda (diverso da te)
    const { data: other } = await supabase
      .from("dm_queue")
      .select("participant_id")
      .eq("room_id", roomId)
      .neq("participant_id", participantId)
      .order("enqueued_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!other?.participant_id) {
      return NextResponse.json({ waiting: true });
    }

    const otherId = other.participant_id;

    // 4) Crea conversazione
    const { data: conv, error: createErr } = await supabase
      .from("dm_conversations")
      .insert({ room_id: roomId })
      .select()
      .single();

    if (createErr || !conv) {
      return NextResponse.json({ error: "Errore creazione conversazione" }, { status: 500 });
    }

    const conversationId = conv.id;

    // 5) Aggiungi membri
    const { error: addErr } = await supabase.from("dm_members").insert([
      { conversation_id: conversationId, participant_id: participantId },
      { conversation_id: conversationId, participant_id: otherId },
    ]);

    if (addErr) {
      return NextResponse.json({ error: "Errore creazione membri" }, { status: 500 });
    }

    // 6) Togli entrambi dalla coda
    await supabase
      .from("dm_queue")
      .delete()
      .eq("room_id", roomId)
      .in("participant_id", [participantId, otherId]);

    // 7) Nome partner
    const { data: otherP } = await supabase
      .from("participants")
      .select("display_name")
      .eq("id", otherId)
      .maybeSingle();

    return NextResponse.json({
      conversationId,
      partnerName: otherP?.display_name ?? null,
      waiting: false,
    });
  } catch {
    return NextResponse.json({ error: "Richiesta non valida" }, { status: 400 });
  }
}