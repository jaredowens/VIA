"use client";

import OwnerGate from "@/components/OwnerGate";
import AnalyticsClient from "@/components/AnalyticsClient";
import CardShell from "@/components/CardShell";
import { useParams } from "next/navigation";

export default function AnalyticsPage() {
  const { cardId } = useParams<{ cardId: string }>();
  const cid = (cardId ?? "").trim().toUpperCase();
  if (!cid) return null;

  return (
    <OwnerGate cardId={cid}>
      <CardShell cardId={cid}>
        <div className="p-8">
          <div className="mx-auto max-w-2xl rounded-2xl border border-white/10 bg-[#121214]/70 p-6 backdrop-blur-xl">
            <a
              href={`/c/${cid}`}
              className="mb-4 inline-block rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-xs text-white/75 hover:bg-white/10"
            >
              Return to Card
            </a>

            <AnalyticsClient cardId={cid} />
          </div>
        </div>
      </CardShell>
    </OwnerGate>
  );
}