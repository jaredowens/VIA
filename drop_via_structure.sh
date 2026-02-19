#!/usr/bin/env bash
set -e

echo "Creating VIA structure..."

# Helper: write file only if it doesn't exist
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

# ---------- FOLDERS ----------
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

# ---------- layout ----------
write_if_missing src/app/layout.tsx \
'import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-neutral-950 text-neutral-100">{children}</body>
    </html>
  );
}'

# ---------- globals ----------
write_if_missing src/app/globals.css \
'@tailwind base;
@tailwind components;
@tailwind utilities;'

# ---------- landing ----------
write_if_missing src/app/'(public)'/page.tsx \
'export default function Home() {
  return (
    <main className="min-h-screen p-6 max-w-2xl mx-auto">
      <h1 className="text-3xl font-semibold">VIA</h1>
      <p className="mt-3 text-neutral-400">
        Tap a card to pay. Owners can log in to set it up.
      </p>
      <div className="mt-6">
        <a className="rounded-xl bg-white text-black px-4 py-2 font-medium" href="/login">
          Owner Login
        </a>
      </div>
    </main>
  );
}'

# ---------- Supabase helpers ----------
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
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {}
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
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        }
      }
    }
  );

  await supabase.auth.getUser();
  return response;
}'

# ---------- validators ----------
write_if_missing src/lib/validators.ts \
'import { z } from "zod";

export const CardIdSchema = z
  .string()
  .min(2)
  .max(32)
  .regex(/^[A-Za-z0-9_-]+$/, "Invalid card id");

export const UpdateProfileSchema = z.object({
  display_name: z.string().min(1).max(40)
});

export const ProviderSchema = z.enum(["venmo", "cashapp", "zelle", "paypal", "custom"]);

export const PaymentLinkUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  provider: ProviderSchema,
  label: z.string().max(30).optional().default(""),
  value: z.string().min(1).max(120),
  sort_order: z.number().int().min(0).max(999).default(0),
  is_enabled: z.boolean().default(true)
});

export const PaymentLinksBulkSchema = z.object({
  links: z.array(PaymentLinkUpsertSchema).max(20)
});'

# ---------- providers ----------
write_if_missing src/lib/providers.ts \
'export type Provider = "venmo" | "cashapp" | "zelle" | "paypal" | "custom";

export function normalizeHandle(provider: Provider, value: string) {
  const v = value.trim();
  switch (provider) {
    case "venmo":
      return v.replace(/^@/, "").replace(/\s/g, "");
    case "cashapp":
      return v.replace(/^\$/, "").replace(/\s/g, "");
    case "paypal":
      return v.replace(/^@/, "").replace(/\s/g, "");
    case "zelle":
      return v;
    case "custom":
      return v;
  }
}

export function buildUrl(provider: Provider, valueRaw: string) {
  const value = normalizeHandle(provider, valueRaw);
  switch (provider) {
    case "venmo":
      return `https://venmo.com/${encodeURIComponent(value)}`;
    case "cashapp":
      return `https://cash.app/$${encodeURIComponent(value)}`;
    case "paypal":
      return `https://paypal.me/${encodeURIComponent(value)}`;
    case "zelle":
      return "copy-only";
    case "custom":
      return value;
  }
}'

echo ""
echo "✅ VIA structure created safely."
echo "Now run: npm install"
echo ""

