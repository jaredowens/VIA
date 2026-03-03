import Link from "next/link";
import OwnerGate from "@/components/OwnerGate";

export default async function SettingsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ cardId: string }>;
}) {
  const { cardId } = await params;

  return (
    <OwnerGate cardId={cardId}>
      <div className="min-h-screen bg-[#0A0A0B] text-white">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-[240px_1fr]">
            {/* Sidebar */}
           <aside className="rounded-2xl border border-white/10 bg-[#121214]/70 p-4 backdrop-blur-xl">
  <div className="mb-4 text-xs tracking-[0.35em] text-white/45">OWNER MENU</div>

  <nav className="space-y-2">
    <Link
      href={`/c/${cardId}`}
      className="block rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/85 hover:bg-white/10"
    >
      ← Return to Card
    </Link>

    <div className="my-3 h-px bg-white/10" />

    <Link
      href={`/c/${cardId}/settings/profile`}
      className="block rounded-xl px-3 py-2 text-sm text-white/80 hover:bg-white/5"
    >
      Profile Settings
    </Link>

    <Link
      href={`/c/${cardId}/customize`}
      className="block rounded-xl px-3 py-2 text-sm text-white/80 hover:bg-white/5"
    >
      Customize
    </Link>

    <Link
      href={`/c/${cardId}/analytics`}
      className="block rounded-xl px-3 py-2 text-sm text-white/80 hover:bg-white/5"
    >
      Analytics
    </Link>

    <Link
      href={`/c/${cardId}/settings/security`}
      className="block rounded-xl px-3 py-2 text-sm text-white/80 hover:bg-white/5"
    >
      Security
    </Link>
  </nav>
</aside>

            {/* Content */}
            <main className="rounded-2xl border border-white/10 bg-[#121214]/70 p-6 backdrop-blur-xl">
              {children}
            </main>
          </div>
        </div>
      </div>
    </OwnerGate>
  );
}