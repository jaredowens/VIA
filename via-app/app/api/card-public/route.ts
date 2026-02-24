import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type LinkItem = {
  id: string;
  label: string;
  url: string;
  kind?: string | null; // optional for later (venmo/cashapp/etc)
};

function normalizePayments(paymentsJson: any) {
  // New target shape:
  // { phone: string|null, email: string|null, links: LinkItem[] }

  const safeEmpty = { phone: null, email: null, links: [] as LinkItem[] };

  if (!paymentsJson || typeof paymentsJson !== "object") return safeEmpty;

  // If already in new shape, just sanitize
  if ("links" in paymentsJson && Array.isArray(paymentsJson.links)) {
    return {
      phone: typeof paymentsJson.phone === "string" ? paymentsJson.phone : null,
      email: typeof paymentsJson.email === "string" ? paymentsJson.email : null,
      links: paymentsJson.links
        .filter((x: any) => x && typeof x === "object")
        .map((x: any) => ({
          id: typeof x.id === "string" ? x.id : crypto.randomUUID(),
          label: typeof x.label === "string" ? x.label : "Link",
          url: typeof x.url === "string" ? x.url : "",
          kind: typeof x.kind === "string" ? x.kind : null,
        }))
        .filter((x: any) => x.url),
    };
  }

  // If you had older shape like { venmo: "...", cashapp: "...", paypal: "..." }
  // convert keys into links
  const links: LinkItem[] = [];
  for (const [key, value] of Object.entries(paymentsJson)) {
    if (key === "phone" || key === "email") continue;
    if (typeof value === "string" && value.trim().length) {
      links.push({
        id: crypto.randomUUID(),
        label: key, // you can prettify later
        url: value.trim(),
        kind: key,
      });
    }
  }

  return {
    phone: typeof (paymentsJson as any).phone === "string" ? (paymentsJson as any).phone : null,
    email: typeof (paymentsJson as any).email === "string" ? (paymentsJson as any).email : null,
    links,
  };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const cardId = searchParams.get("cardId");

    if (!cardId) {
      return NextResponse.json({ error: "Missing cardId" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data, error } = await supabase
      .from("cards")
      .select(
        `
          id,
          owner_user_id,
          display_name,
          bio,
          photo_url,
          pay_label,
          payments_json,
          show_phone,
          show_email,
          show_save_contact
        `
      )
      .eq("id", cardId)
      .maybeSingle();

    if (error) {
      console.error("card-public supabase error:", error);
      return NextResponse.json(
        {
          error: "Supabase error",
          details: error.message,
          hint: (error as any).hint ?? null,
          code: (error as any).code ?? null,
        },
        { status: 400 }
      );
    }

    if (!data) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    if (!data.owner_user_id) {
      return NextResponse.json({ error: "Card is unclaimed" }, { status: 403 });
    }

    const normalized = normalizePayments((data as any).payments_json);

    return NextResponse.json({
      cardId: data.id,
      displayName: (data as any).display_name ?? null,
      bio: (data as any).bio ?? null,
      photoUrl: (data as any).photo_url ?? null,
      payLabel: (data as any).pay_label ?? null,

      // NEW TOGGLES
      showPhone: (data as any).show_phone ?? true,
      showEmail: (data as any).show_email ?? true,
      showSaveContact: (data as any).show_save_contact ?? true,

      // NEW SHAPE
      payments: normalized,
    });
  } catch (err) {
    console.error("Card public route crash:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}