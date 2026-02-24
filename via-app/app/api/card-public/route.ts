import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type LinkItem = {
  id: string;
  type: "venmo" | "cashapp" | "paypal" | "custom";
  label: string;
  value: string; // username/handle/link text
  url?: string | null; // optional direct URL override
};

function prettyLabel(key: string) {
  const map: Record<string, string> = {
    venmo: "Venmo",
    cashapp: "Cash App",
    paypal: "PayPal",
  };
  const k = (key ?? "").toLowerCase();
  return (
    map[k] ??
    String(key ?? "Link")
      .replace(/[_-]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function coerceType(raw: any): LinkItem["type"] {
  const t = String(raw ?? "").toLowerCase();
  if (t.includes("venmo")) return "venmo";
  if (t.includes("cash")) return "cashapp";
  if (t.includes("paypal")) return "paypal";
  return "custom";
}

function normalizePayments(paymentsJson: any) {
  // Target shape returned to /c:
  // { phone: string|null, email: string|null, links: LinkItem[] }

  const safeEmpty = {
    phone: null as string | null,
    email: null as string | null,
    links: [] as LinkItem[],
  };

  if (!paymentsJson || typeof paymentsJson !== "object") return safeEmpty;

  // ✅ New shape: { phone, email, links: [...] }
  if ("links" in paymentsJson && Array.isArray((paymentsJson as any).links)) {
    const links = (paymentsJson as any).links
      .filter((x: any) => x && typeof x === "object")
      .map((x: any) => {
        const id = typeof x.id === "string" ? x.id : crypto.randomUUID();
        const type = coerceType(x.type ?? x.kind ?? x.label);
        const label =
          typeof x.label === "string" && x.label.trim()
            ? x.label.trim()
            : prettyLabel(type);

        // IMPORTANT: setup saves "value" (not "url")
        const value =
          typeof x.value === "string"
            ? x.value.trim()
            : typeof x.url === "string"
            ? x.url.trim()
            : "";

        const url = typeof x.url === "string" ? x.url.trim() : null;

        return { id, type, label, value, url };
      })
      .filter((x: LinkItem) => !!x.value || !!x.url);

    return {
      phone:
        typeof (paymentsJson as any).phone === "string"
          ? (paymentsJson as any).phone
          : null,
      email:
        typeof (paymentsJson as any).email === "string"
          ? (paymentsJson as any).email
          : null,
      links,
    };
  }

  // ✅ Array shape: [{ type, label, value }] (older ordered list)
  if (Array.isArray(paymentsJson)) {
    const links = paymentsJson
      .filter((x: any) => x && typeof x === "object")
      .map((x: any) => {
        const id = typeof x.id === "string" ? x.id : crypto.randomUUID();
        const type = coerceType(x.type ?? x.kind ?? x.label);
        const label =
          typeof x.label === "string" && x.label.trim()
            ? x.label.trim()
            : prettyLabel(type);
        const value =
          typeof x.value === "string"
            ? x.value.trim()
            : typeof x.url === "string"
            ? x.url.trim()
            : "";
        const url = typeof x.url === "string" ? x.url.trim() : null;
        return { id, type, label, value, url };
      })
      .filter((x: LinkItem) => !!x.value || !!x.url);

    return { phone: null, email: null, links };
  }

  // ✅ Legacy object: { venmo, cashapp, paypal, phone, email }
  const links: LinkItem[] = [];
  for (const [key, value] of Object.entries(paymentsJson)) {
    if (key === "phone" || key === "email") continue;

    if (typeof value === "string" && value.trim()) {
      const type = coerceType(key);
      links.push({
        id: crypto.randomUUID(),
        type,
        label: prettyLabel(key),
        value: value.trim(),
        url: null,
      });
    }
  }

  return {
    phone:
      typeof (paymentsJson as any).phone === "string"
        ? (paymentsJson as any).phone
        : null,
    email:
      typeof (paymentsJson as any).email === "string"
        ? (paymentsJson as any).email
        : null,
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