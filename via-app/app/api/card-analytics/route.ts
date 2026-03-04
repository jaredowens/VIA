import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const cardIdRaw = searchParams.get("cardId");
    if (!cardIdRaw) return NextResponse.json({ error: "Missing cardId" }, { status: 400 });

    const cardId = cardIdRaw.trim().toUpperCase();

    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set() {
            // not needed for reads
          },
          remove() {
            // not needed for reads
          },
        },
      }
    );

    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id ?? null;
    if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const { data: card, error: cardErr } = await supabase
      .from("cards")
      .select("id, owner_user_id, is_premium")
      .eq("id", cardId)
      .maybeSingle();

    if (cardErr) return NextResponse.json({ error: "Supabase error", details: cardErr.message }, { status: 400 });
    if (!card) return NextResponse.json({ error: "Card not found" }, { status: 404 });
    if (card.owner_user_id !== userId) return NextResponse.json({ error: "Not owner" }, { status: 403 });
    if (!card.is_premium) return NextResponse.json({ error: "Premium required" }, { status: 402 });

    const now = new Date();
    const start7 = new Date(now);
    start7.setDate(now.getDate() - 6);
    start7.setHours(0, 0, 0, 0);
    const start7Iso = start7.toISOString();

    const [{ data: ev7, error: ev7Err }, { data: recent, error: recentErr }] = await Promise.all([
      supabase
        .from("card_events")
        .select("event_type, created_at")
        .eq("card_id", cardId)
        .gte("created_at", start7Iso),
      supabase
        .from("card_events")
        .select("event_type, created_at, meta")
        .eq("card_id", cardId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    if (ev7Err) return NextResponse.json({ error: "Supabase error", details: ev7Err.message }, { status: 400 });
    if (recentErr) return NextResponse.json({ error: "Supabase error", details: recentErr.message }, { status: 400 });

    const events7 = ev7 ?? [];
    const recentEvents = recent ?? [];

    const [viewsAll, linkAll, payAll, saveAll] = await Promise.all([
      supabase.from("card_events").select("id", { count: "exact", head: true }).eq("card_id", cardId).eq("event_type", "view"),
      supabase.from("card_events").select("id", { count: "exact", head: true }).eq("card_id", cardId).eq("event_type", "link_click"),
      supabase.from("card_events").select("id", { count: "exact", head: true }).eq("card_id", cardId).eq("event_type", "pay_click"),
      supabase.from("card_events").select("id", { count: "exact", head: true }).eq("card_id", cardId).eq("event_type", "save_contact"),
    ]);

    const totals = {
      views: viewsAll.count ?? 0,
      linkClicks: linkAll.count ?? 0,
      payClicks: payAll.count ?? 0,
      saveContacts: saveAll.count ?? 0,
    };

    const last7 = {
      views: events7.filter((e) => e.event_type === "view").length,
      linkClicks: events7.filter((e) => e.event_type === "link_click").length,
      payClicks: events7.filter((e) => e.event_type === "pay_click").length,
      saveContacts: events7.filter((e) => e.event_type === "save_contact").length,
    };

    const days: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start7);
      d.setDate(start7.getDate() + i);
      days.push(isoDay(d));
    }

    const viewsByDay = days.map((day) => ({ day, views: 0 }));
    for (const e of events7) {
      if (e.event_type !== "view") continue;
      const day = String(e.created_at).slice(0, 10);
      const idx = viewsByDay.findIndex((x) => x.day === day);
      if (idx >= 0) viewsByDay[idx].views += 1;
    }

    return NextResponse.json({ cardId, totals, last7, viewsByDay, recentEvents });
  } catch (err: any) {
    return NextResponse.json({ error: "Server error", details: String(err?.message ?? err) }, { status: 500 });
  }
}