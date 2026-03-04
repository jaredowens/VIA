import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const ALLOWED = new Set(["view", "link_click", "pay_click", "save_contact"]);

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);

    const cardId = String(body?.cardId ?? "").trim().toUpperCase();
    const eventType = String(body?.eventType ?? "").trim();
    const meta = typeof body?.meta === "object" && body?.meta ? body.meta : {};

    if (!cardId) return NextResponse.json({ error: "Missing cardId" }, { status: 400 });
    if (!ALLOWED.has(eventType)) return NextResponse.json({ error: "Invalid eventType" }, { status: 400 });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { error } = await supabase.from("card_events").insert({
      card_id: cardId,
      event_type: eventType,
      meta,
    });

    if (error) {
      return NextResponse.json({ error: "Supabase error", details: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}