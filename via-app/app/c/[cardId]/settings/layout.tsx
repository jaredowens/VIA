import Link from "next/link";
import OwnerGate from "@/components/OwnerGate";

export default function SettingsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { cardId: string };
}) {
  const { cardId } = params;

  return (
    <OwnerGate cardId={cardId}>
      <div className="min-h-screen bg-[#0A0A0B] text-white">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-[240px_1fr]">
            {/* Sidebar */}
            <aside className="rounded-2xl border border-white/10 bg-[#121214]/70 p-4 backdrop-blur-xl">
              Sidebar content...
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