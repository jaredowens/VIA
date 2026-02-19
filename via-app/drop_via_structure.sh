#!/usr/bin/env bash
set -e

write_if_missing () {
  if [ ! -f "$1" ]; then
    mkdir -p "$(dirname "$1")"
    cat > "$1" <<EOF
$2
EOF
    echo "Created $1"
  else
    echo "Skipped $1 (already exists)"
  fi
}

mkdir -p \
  src/app/'(public)'/c/'[cardId]' \
  src/app/'(public)'/claim/'[cardId]' \
  src/app/'(public)' \
  src/app/'(auth)'/login \
  src/app/'(auth)'/auth/callback \
  src/app/'(auth)'/logout \
  src/app/'(owner)'/dashboard \
  src/app/'(owner)'/settings \
  src/app/api/claim \
  src/app/api/profile \
  src/app/api/payment-links \
  src/app/api/card/deactivate \
  src/app/api/admin/seed-cards \
  src/lib/supabase \
  src/lib \
  supabase/migrations \
  supabase/seed

write_if_missing src/lib/supabase/client.ts \
'import { createBrowserClient } from "@supabase/ssr";
export function createSupabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}'

write_if_missing src/lib/supabase/server.ts \
'import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
export async function createSupabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
          catch {}
        }
      }
    }
  );
}'

write_if_missing src/lib/supabase/middleware.ts \
'import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) { cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options)); }
      }
    }
  );
  await supabase.auth.getUser();
  return response;
}'

write_if_missing src/lib/validators.ts \
'import { z } from "zod";
export const CardIdSchema = z.string().min(2).max(32).regex(/^[A-Za-z0-9_-]+$/, "Invalid card id");
export const UpdateProfileSchema = z.object({ display_name: z.string().min(1).max(40) });
export const ProviderSchema = z.enum(["venmo","cashapp","zelle","paypal","custom"]);
export const PaymentLinkUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  provider: ProviderSchema,
  label: z.string().max(30).optional().default(""),
  value: z.string().min(1).max(120),
  sort_order: z.number().int().min(0).max(999).default(0),
  is_enabled: z.boolean().default(true)
});
export const PaymentLinksBulkSchema = z.object({ links: z.array(PaymentLinkUpsertSchema).max(20) });'

write_if_missing src/lib/providers.ts \
'export type Provider = "venmo" | "cashapp" | "zelle" | "paypal" | "custom";
export function normalizeHandle(provider: Provider, value: string) {
  const v = value.trim();
  switch (provider) {
    case "venmo": return v.replace(/^@/, "").replace(/\\s/g, "");
    case "cashapp": return v.replace(/^\\$/, "").replace(/\\s/g, "");
    case "paypal": return v.replace(/^@/, "").replace(/\\s/g, "");
    case "zelle": return v;
    case "custom": return v;
  }
}
export function buildUrl(provider: Provider, valueRaw: string) {
  const value = normalizeHandle(provider, valueRaw);
  switch (provider) {
    case "venmo": return `https://venmo.com/${encodeURIComponent(value)}`;
    case "cashapp": return `https://cash.app/$${encodeURIComponent(value)}`;
    case "paypal": return `https://paypal.me/${encodeURIComponent(value)}`;
    case "zelle": return "copy-only";
    case "custom": return value;
  }
}'

echo "✅ Dropped VIA folders/files into this Next app."
