import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type LinkType =
  | "phone"
  | "email"
  | "venmo"
  | "cashapp"
  | "paypal"
  | "instagram"
  | "tiktok"
  | "youtube"
  | "x"
  | "website"
  | "other"
  | "custom";

type LinkItem = {
  id: string;
  type: LinkType;
  label: string;
  value: string;
  url?: string | null;
};

function safeStr(v: any) {
  return typeof v === "string" ? v : "";
}

function prettyLabel(type: LinkType, fallback?: any) {
  if (typeof fallback === "string" && fallback.trim()) return fallback.trim();

  const map: Record<LinkType, string> = {
    phone: "Phone",
    email: "Email",
    venmo: "Venmo",
    cashapp: "Cash App",
    paypal: "PayPal",
    instagram: "Instagram",
    tiktok: "TikTok",
    youtube: "YouTube",
    x: "X",
    website: "Website",
    other: "Link",
    custom: "Link",
  };
  return map[type] ?? "Link";
}

function normalizeType(raw: any, label?: any, value?: any): LinkType {
  const t = String(raw ?? "").toLowerCase().trim();
  const l = String(label ?? "").toLowerCase().trim();
  const v = String(value ?? "").toLowerCase().trim();
  const s = `${t} ${l} ${v}`;

  // ✅ allow phone/email as ordered markers
  if (t === "phone" || s.includes("phone")) return "phone";
  if (t === "email" || s.includes("email")) return "email";

  // payments
  if (t.includes("venmo") || s.includes("venmo")) return "venmo";
  if (t.includes("cash") || s.includes("cashapp") || s.includes("cash app")) return "cashapp";
  if (t.includes("paypal") || s.includes("paypal")) return "paypal";

  // socials
  if (t.includes("instagram") || s.includes("instagram")) return "instagram";
  if (t.includes("tiktok") || s.includes("tiktok")) return "tiktok";
  if (t.includes("youtube") || s.includes("youtube") || s.includes("youtu.be")) return "youtube";
  if (t === "x" || t === "twitter" || s.includes("x.com") || s.includes("twitter.com")) return "x";

  // website
  if (t.includes("website")) return "website";
  if (v.startsWith("http://") || v.startsWith("https://")) return "website";
  if (v.includes(".") && !v.includes(" ")) return "website";

  // fallback
  if (t === "other") return "other";
  if (t === "custom") return "custom";
  return "other";
}

function normalizePayments(paymentsJson: any) {
  const safeEmpty = {
    phone: null as string | null,
    email: null as string | null,
    links: [] as LinkItem[],
  };

  if (!paymentsJson || typeof paymentsJson !== "object") return safeEmpty;

  const phone =
    typeof paymentsJson.phone === "string" ? paymentsJson.phone.trim() : null;
  const email =
    typeof paymentsJson.email === "string" ? paymentsJson.email.trim() : null;

  // ✅ New shape: { phone, email, links: [...] }
  if (Array.isArray(paymentsJson.links)) {
    const links = paymentsJson.links
      .filter((x: any) => x && typeof x === "object")
      .map((x: any) => {
        const id = typeof x.id === "string" ? x.id : crypto.randomUUID();

        const value = safeStr(x.value).trim() || safeStr(x.url).trim() || "";
        const url = typeof x.url === "string" ? x.url.trim() : null;

        const type = normalizeType(x.type ?? x.kind ?? x.label, x.label, value);

        const label =
          typeof x.label === "string" && x.label.trim()
            ? x.label.trim()
            : prettyLabel(type);

        return { id, type, label, value, url } as LinkItem;
      })
      .filter((x: LinkItem) => !!x.value || !!x.url || x.type === "phone" || x.type === "email");

    return { phone: phone || null, email: email || null, links };
  }

  // ✅ Array shape: [{ type, label, value }]
  if (Array.isArray(paymentsJson)) {
    const links = paymentsJson
      .filter((x: any) => x && typeof x === "object")
      .map((x: any) => {
        const id = typeof x.id === "string" ? x.id : crypto.randomUUID();
        const value = safeStr(x.value).trim() || safeStr(x.url).trim() || "";
        const url = typeof x.url === "string" ? x.url.trim() : null;

        const type = normalizeType(x.type ?? x.kind ?? x.label, x.label, value);
        const label =
          typeof x.label === "string" && x.label.trim()
            ? x.label.trim()
            : prettyLabel(type);

        return { id, type, label, value, url } as LinkItem;
      })
      .filter((x: LinkItem) => !!x.value || !!x.url || x.type === "phone" || x.type === "email");

    return { phone: null, email: null, links };
  }

  // ✅ Legacy object: { venmo, cashapp, paypal, phone, email }
  const links: LinkItem[] = [];
  for (const [key, value] of Object.entries(paymentsJson)) {
    if (key === "phone" || key === "email") continue;

    if (typeof value === "string" && value.trim()) {
      const type = normalizeType(key, key, value);
      links.push({
        id: crypto.randomUUID(),
        type,
        label: prettyLabel(type, key),
        value: value.trim(),
        url: null,
      });
    }
  }

  return { phone: phone || null, email: email || null, links };
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

    if (!data) return NextResponse.json({ error: "Card not found" }, { status: 404 });
    if (!data.owner_user_id) return NextResponse.json({ error: "Card is unclaimed" }, { status: 403 });

    const normalized = normalizePayments((data as any).payments_json);

    return NextResponse.json({
      cardId: data.id,
      displayName: (data as any).display_name ?? null,
      bio: (data as any).bio ?? null,
      photoUrl: (data as any).photo_url ?? null,
      payLabel: (data as any).pay_label ?? null,

      showPhone: (data as any).show_phone ?? true,
      showEmail: (data as any).show_email ?? true,
      showSaveContact: (data as any).show_save_contact ?? true,

      payments: normalized,
    });
  } catch (err) {
    console.error("Card public route crash:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}