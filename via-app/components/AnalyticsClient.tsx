"use client";

import { useEffect, useMemo, useState } from "react";

type AnalyticsPayload = {
  cardId: string;
  totals: { views: number; linkClicks: number; payClicks: number; saveContacts: number };
  last7: { views: number; linkClicks: number; payClicks: number; saveContacts: number };
  viewsByDay: Array<{ day: string; views: number }>;
  recentEvents: Array<{ event_type: string; created_at: string; meta?: any }>;
};

function labelType(t: string) {
  if (t === "view") return "View";
  if (t === "link_click") return "Link Click";
  if (t === "pay_click") return "Pay Click";
  if (t === "save_contact") return "Save Contact";
  return t;
}

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-xs tracking-[0.35em] text-white/45">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-white/90 tabular-nums">{value}</div>
    </div>
  );
}

export default function AnalyticsClient({ cardId }: { cardId: string }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<AnalyticsPayload | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setErr(null);

        const res = await fetch(`/api/card-analytics?cardId=${encodeURIComponent(cardId)}`, {
          cache: "no-store",
        });

        if (!res.ok) {
          if (res.status === 401) throw new Error("Please sign in to view analytics.");
          if (res.status === 402) throw new Error("Premium required to view analytics.");
          if (res.status === 403) throw new Error("Owner-only analytics.");
          const j = await res.json().catch(() => null);
          throw new Error(j?.error || "Could not load analytics.");
        }

        const payload = (await res.json()) as AnalyticsPayload;
        if (cancelled) return;
        setData(payload);
      } catch (e: any) {
        if (!cancelled) setErr(String(e?.message ?? "Error"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [cardId]);

  const maxViews = useMemo(() => {
    const arr = data?.viewsByDay ?? [];
    return Math.max(1, ...arr.map((x) => x.views));
  }, [data?.viewsByDay]);

  if (loading) {
    return (
      <div>
        <h1 className="text-xl font-semibold">Analytics</h1>
        <p className="mt-2 text-sm text-white/60">Loading…</p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="h-[88px] rounded-2xl border border-white/10 bg-white/5" />
          <div className="h-[88px] rounded-2xl border border-white/10 bg-white/5" />
          <div className="h-[88px] rounded-2xl border border-white/10 bg-white/5" />
          <div className="h-[88px] rounded-2xl border border-white/10 bg-white/5" />
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div>
        <h1 className="text-xl font-semibold">Analytics</h1>
        <p className="mt-2 text-sm text-white/60">{err}</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div>
      <h1 className="text-xl font-semibold">Analytics</h1>
      <p className="mt-2 text-sm text-white/60">Owner-only stats for your VIA card.</p>

      {/* Last 7 days */}
      <div className="mt-6">
        <div className="mb-3 text-xs tracking-[0.35em] text-white/45">LAST 7 DAYS</div>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="VIEWS" value={data.last7.views} />
          <StatCard label="LINK CLICKS" value={data.last7.linkClicks} />
          <StatCard label="PAY CLICKS" value={data.last7.payClicks} />
          <StatCard label="SAVE CONTACT" value={data.last7.saveContacts} />
        </div>
      </div>

      {/* All time */}
      <div className="mt-6">
        <div className="mb-3 text-xs tracking-[0.35em] text-white/45">ALL TIME</div>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="VIEWS" value={data.totals.views} />
          <StatCard label="LINK CLICKS" value={data.totals.linkClicks} />
          <StatCard label="PAY CLICKS" value={data.totals.payClicks} />
          <StatCard label="SAVE CONTACT" value={data.totals.saveContacts} />
        </div>
      </div>

      {/* Views chart */}
      <div className="mt-6">
        <div className="mb-3 text-xs tracking-[0.35em] text-white/45">VIEWS BY DAY</div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-end gap-2">
            {data.viewsByDay.map((d) => {
              const h = Math.round((d.views / maxViews) * 80); // px
              return (
                <div key={d.day} className="flex-1">
                  <div className="rounded-lg border border-white/10 bg-white/10" style={{ height: `${h}px` }} />
                  <div className="mt-2 text-center text-[10px] text-white/45">
                    {d.day.slice(5)}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 text-xs text-white/45">Last 7 days (MM-DD)</div>
        </div>
      </div>

      {/* Recent activity */}
      <div className="mt-6">
        <div className="mb-3 text-xs tracking-[0.35em] text-white/45">RECENT ACTIVITY</div>
        <div className="rounded-2xl border border-white/10 bg-white/5 divide-y divide-white/10">
          {data.recentEvents.length === 0 ? (
            <div className="p-4 text-sm text-white/60">No activity yet.</div>
          ) : (
            data.recentEvents.map((e, idx) => (
              <div key={idx} className="p-4 flex items-center justify-between gap-3">
                <div className="text-sm text-white/85">
                  {labelType(e.event_type)}
                  {e.event_type === "link_click" && e.meta?.type ? (
                    <span className="text-white/50"> · {String(e.meta.type)}</span>
                  ) : null}
                </div>
                <div className="text-xs text-white/45">{timeAgo(e.created_at)}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}