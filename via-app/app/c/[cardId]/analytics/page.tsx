"use client";

import OwnerGate from "@/components/OwnerGate";

export default function AnalyticsPage({
  params,
}: {
  params: { cardId: string };
}) {
  const { cardId } = params;

  return (
    <OwnerGate cardId={cardId}>
      <div className="min-h-screen bg-[#0A0A0B] text-white p-8">
        <div className="mx-auto max-w-2xl rounded-2xl border border-white/10 bg-[#121214]/70 p-6 backdrop-blur-xl">
          <h1 className="text-xl font-semibold">Analytics</h1>
          <p className="mt-2 text-sm text-white/60">
            Analytics dashboard coming next.
          </p>
        </div>
      </div>
    </OwnerGate>
  );
}