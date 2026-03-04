import OwnerGate from "@/components/OwnerGate";
import AnalyticsClient from "@/components/AnalyticsClient";

export default function AnalyticsPage({ params }: { params: { cardId: string } }) {
  const cardId = (params.cardId ?? "").trim().toUpperCase();

  return (
    <OwnerGate cardId={cardId}>
      <div className="min-h-screen bg-[#0A0A0B] text-white p-8">
        <div className="mx-auto max-w-2xl rounded-2xl border border-white/10 bg-[#121214]/70 p-6 backdrop-blur-xl">
          <a
            href={`/c/${cardId}`}
            className="mb-4 inline-block rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-xs text-white/75 hover:bg-white/10"
          >
            Return to Card
          </a>

          <AnalyticsClient cardId={cardId} />
        </div>
      </div>
    </OwnerGate>
  );
}