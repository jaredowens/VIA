"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type LinkType =
  | "instagram"
  | "tiktok"
  | "youtube"
  | "x"
  | "website"
  | "other";

type LinkItem = {
  id: string;
  type: LinkType;
  label?: string; // only for "other"
  value: string;  // handle or url
};

type CardsRow = {
  id: string;
  owner_user_id: string | null;
  display_name: string | null;
  bio: string | null;
  photo_url: string | null;
  pay_label: string | null;
  payments_json: any | null;

  show_phone?: boolean | null;
  show_email?: boolean | null;
  show_save_contact?: boolean | null;
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function normalizeVenmoHandle(input: string) {
  return input.trim().replace(/^@/, "");
}
function normalizeCashAppTag(input: string) {
  return input.trim().replace(/^\$/, "");
}
function normalizePaypal(input: string) {
  return input.trim().replace(/^@/, "");
}
function normalizePhone(input: string) {
  return input.trim();
}
function normalizeEmail(input: string) {
  return input.trim();
}

function normalizeHandle(input: string) {
  return input.trim().replace(/^@/, "");
}

function coerceToState(p: any): {
  phone: string;
  email: string;
  venmo: string;
  cashapp: string;
  paypal: string;
  links: LinkItem[];
} {
  const base = {
    phone: "",
    email: "",
    venmo: "",
    cashapp: "",
    paypal: "",
    links: [] as LinkItem[],
  };

  if (!p) return base;

  // preferred: object with phone/email + venmo/cashapp/paypal + links[]
  if (p && typeof p === "object" && !Array.isArray(p)) {
    const phone = typeof p.phone === "string" ? p.phone : "";
    const email = typeof p.email === "string" ? p.email : "";

    const venmo = typeof p.venmo === "string" ? p.venmo : "";
    const cashapp = typeof p.cashapp === "string" ? p.cashapp : "";
    const paypal = typeof p.paypal === "string" ? p.paypal : "";

  const links: LinkItem[] = Array.isArray(p.links)
  ? (p.links as any[])
      .map((x: any): LinkItem => ({
        id: String(x?.id ?? uid()),
        type: (String(x?.type ?? "other") as LinkType) || "other",
        label: x?.label ? String(x.label) : undefined,
        value: String(x?.value ?? ""), // ✅ always a string
      }))
      .filter((x: LinkItem) => x.value.trim().length > 0) // ✅ x is typed
  : [];

    // If older data shoved payment items into links, ignore those and only keep socials
    const socialOnly = links.filter(
      (x) => !["venmo", "cashapp", "paypal"].includes(String(x.type))
    );

    return {
      phone,
      email,
      venmo,
      cashapp,
      paypal,
      links: socialOnly,
    };
  }

  // array format: treat as links only
  if (Array.isArray(p)) {
    return {
      ...base,
      links: p
        .map((x: any) => ({
          id: String(x?.id ?? uid()),
          type: (String(x?.type ?? "other") as LinkType) || "other",
          label: x?.label ? String(x.label) : undefined,
          value: String(x?.value ?? ""),
        }))
        .filter((x) => x.value.trim()),
    };
  }

  return base;
}

function linkTypeLabel(t: LinkType) {
  const map: Record<LinkType, string> = {
    instagram: "Instagram",
    tiktok: "TikTok",
    youtube: "YouTube",
    x: "X",
    website: "Website",
    other: "Other",
  };
  return map[t];
}

export default function SetupPage() {
  const { cardId } = useParams<{ cardId: string }>();
  if (!cardId) return null;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const [bio, setBio] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [payLabel, setPayLabel] = useState("");

  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  // core payment methods
  const [venmo, setVenmo] = useState("");
  const [cashapp, setCashapp] = useState("");
  const [paypal, setPaypal] = useState("");

  // social/personal links (ordered)
  const [links, setLinks] = useState<LinkItem[]>([]);

  const [showPhone, setShowPhone] = useState(true);
  const [showEmail, setShowEmail] = useState(true);
  const [showSaveContact, setShowSaveContact] = useState(true);

  // add-link controls
  const [newLinkType, setNewLinkType] = useState<LinkType>("instagram");
  const [newLinkLabel, setNewLinkLabel] = useState("");
  const [newLinkValue, setNewLinkValue] = useState("");

  const returnToCard = useMemo(() => `/c/${cardId}`, [cardId]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setMsg("");

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        window.location.href = `/login?returnTo=${encodeURIComponent(
          `/setup/${cardId}`
        )}`;
        return;
      }

      const { data, error } = await supabase
        .from("cards")
        .select(
          "id, owner_user_id, display_name, bio, photo_url, pay_label, payments_json, show_phone, show_email, show_save_contact"
        )
        .eq("id", cardId)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        setMsg(error.message);
        setLoading(false);
        return;
      }

      if (!data) {
        setMsg("Card not found.");
        setLoading(false);
        return;
      }

      if (!data.owner_user_id) {
        window.location.href = `/claim/${cardId}`;
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      const currentUid = userData.user?.id;

      if (!currentUid || data.owner_user_id !== currentUid) {
        window.location.href = returnToCard;
        return;
      }

      const row = data as CardsRow;

      const dn = (row.display_name ?? "").trim();
      if (dn) {
        const parts = dn.split(/\s+/);
        setFirstName(parts[0] ?? "");
        setLastName(parts.slice(1).join(" "));
      } else {
        setFirstName("");
        setLastName("");
      }

      setBio(row.bio ?? "");
      setPhotoUrl(row.photo_url ?? "");
      setPayLabel(row.pay_label ?? "");

      const parsed = coerceToState(row.payments_json);
      setPhone(parsed.phone ?? "");
      setEmail(parsed.email ?? "");
      setVenmo(parsed.venmo ?? "");
      setCashapp(parsed.cashapp ?? "");
      setPaypal(parsed.paypal ?? "");
      setLinks(parsed.links ?? []);

      setShowPhone(row.show_phone ?? true);
      setShowEmail(row.show_email ?? true);
      setShowSaveContact(row.show_save_contact ?? true);

      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [cardId, returnToCard]);

  function moveLink(id: string, dir: -1 | 1) {
    setLinks((prev) => {
      const i = prev.findIndex((p) => p.id === id);
      if (i < 0) return prev;
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      const tmp = next[i];
      next[i] = next[j];
      next[j] = tmp;
      return next;
    });
  }

  function updateLink(id: string, patch: Partial<LinkItem>) {
    setLinks((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function removeLink(id: string) {
    setLinks((prev) => prev.filter((p) => p.id !== id));
  }

  function addLink() {
    const v = newLinkValue.trim();
    if (!v) return;

    if (newLinkType === "other") {
      const l = newLinkLabel.trim();
      if (!l) return;
      setLinks((prev) => [
        ...prev,
        { id: uid(), type: "other", label: l, value: v },
      ]);
      setNewLinkLabel("");
      setNewLinkValue("");
      setNewLinkType("instagram");
      return;
    }

    setLinks((prev) => [
      ...prev,
      { id: uid(), type: newLinkType, value: v },
    ]);

    setNewLinkValue("");
    setNewLinkType("instagram");
  }

  async function save() {
    const fn = firstName.trim();
    const ln = lastName.trim();
    const computedDisplay = `${fn} ${ln}`.trim();

    if (!fn) {
      setMsg("Preferred first name is required.");
      return;
    }

    const phoneNorm = normalizePhone(phone);
    if (!phoneNorm) {
      setMsg("Direct phone number is required.");
      return;
    }

    setSaving(true);
    setMsg("");

    try {
      const venmoClean = normalizeVenmoHandle(venmo || "");
      const cashappClean = normalizeCashAppTag(cashapp || "");
      const paypalClean = normalizePaypal(paypal || "");

      const cleanedLinks = links
        .map((l) => {
          const value = l.value.trim();
          const type = l.type;

          // normalize handles for socials
          const normalizedValue =
            type === "instagram" || type === "tiktok" || type === "x"
              ? normalizeHandle(value)
              : value;

          return {
            id: l.id,
            type: l.type,
            label: l.type === "other" ? (l.label?.trim() || "Link") : undefined,
            value: normalizedValue,
          };
        })
        .filter((l) => l.value);

      const payments_json: any = {
        venmo: venmoClean,
        cashapp: cashappClean,
        paypal: paypalClean,
        phone: phoneNorm,
        email: normalizeEmail(email) || "",
        links: cleanedLinks,
      };

      const { error } = await supabase
        .from("cards")
        .update({
          display_name: computedDisplay,
          bio: bio.trim() || null,
          photo_url: photoUrl.trim() || null,
          pay_label: payLabel.trim() || null,
          payments_json,
          show_phone: showPhone,
          show_email: showEmail,
          show_save_contact: showSaveContact,
        })
        .eq("id", cardId);

      if (error) {
        console.error("SAVE ERROR:", error);
        setMsg(error.message);
        return;
      }

      window.location.href = returnToCard;
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0A0A0B] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-white/10 blur-[90px]" />
        <div className="absolute top-1/3 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-white/6 blur-[110px]" />
        <div className="absolute inset-0 shadow-[inset_0_0_140px_rgba(0,0,0,0.85)]" />
        <div className="grain absolute inset-0 opacity-[0.10]" />
      </div>

      <div className="relative flex min-h-screen items-center justify-center px-6 py-10">
        <div className="w-full max-w-[560px] rounded-[28px] border border-white/10 bg-[#121214]/80 p-10 shadow-[0_30px_120px_rgba(0,0,0,0.75)] backdrop-blur-xl">
          <div className="mb-10 flex justify-center">
            <div className="select-none text-[38px] font-light tracking-[0.55em] text-transparent bg-clip-text bg-gradient-to-b from-white to-white/55">
              VIA
            </div>
          </div>

          <div className="text-center">
            <h1 className="text-lg font-medium tracking-wide text-white/90">
              Setup Your Card
            </h1>
            <p className="mt-3 text-[12px] tracking-[0.35em] text-white/45">
              {cardId}
            </p>
          </div>

          {loading ? (
            <div className="mt-10 flex items-center justify-center gap-3 text-white/50">
              <span className="loader h-4 w-4 rounded-full border border-white/20 border-t-white/70" />
              <p className="text-sm">Loading setup…</p>
            </div>
          ) : (
            <div className="mt-10 space-y-8">
              {!!msg && <p className="text-center text-sm text-red-400">{msg}</p>}

              {/* BASICS */}
              <div className="space-y-4">
                <div className="text-xs tracking-[0.35em] text-white/45">
                  BASICS
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs tracking-wider text-white/60 mb-2">
                      PREFERRED FIRST NAME
                    </label>
                    <input
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-4 text-white/90 outline-none placeholder:text-white/35 focus:border-white/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs tracking-wider text-white/60 mb-2">
                      PREFERRED LAST NAME
                    </label>
                    <input
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-4 text-white/90 outline-none placeholder:text-white/35 focus:border-white/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs tracking-wider text-white/60 mb-2">
                    NOTE (OPTIONAL)
                  </label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="w-full resize-none rounded-2xl border border-white/12 bg-white/5 px-4 py-4 text-white/90 outline-none placeholder:text-white/35 focus:border-white/20"
                  />
                </div>

                <div>
                  <label className="block text-xs tracking-wider text-white/60 mb-2">
                    PAY LABEL (OPTIONAL)
                  </label>
                  <input
                    value={payLabel}
                    onChange={(e) => setPayLabel(e.target.value)}
                    className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-4 text-white/90 outline-none placeholder:text-white/35 focus:border-white/20"
                  />
                </div>
              </div>

              {/* PAYMENTS */}
              <div className="space-y-4">
                <div className="text-xs tracking-[0.35em] text-white/45">
                  PAYMENTS
                </div>

                <div>
                  <label className="block text-xs tracking-wider text-white/60 mb-2">
                    DIRECT PHONE (REQUIRED)
                  </label>
                  <p className="mb-2 text-xs text-white/40 tracking-wide">
                    Used for direct transfers. On your card: tap to message, hold
                    to copy.
                  </p>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-4 text-white/90 outline-none placeholder:text-white/35 focus:border-white/20"
                  />
                </div>

                <div>
                  <label className="block text-xs tracking-wider text-white/60 mb-2">
                    EMAIL (OPTIONAL)
                  </label>
                  <p className="mb-2 text-xs text-white/40 tracking-wide">
                    On your card: tap/hold copies it.
                  </p>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-4 text-white/90 outline-none placeholder:text-white/35 focus:border-white/20"
                  />
                </div>

                {/* Core payment methods (fixed fields) */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 pt-2">
                  <div>
                    <label className="block text-xs tracking-wider text-white/60 mb-2">
                      VENMO (OPTIONAL)
                    </label>
                    <input
                      value={venmo}
                      onChange={(e) => setVenmo(e.target.value)}
                      placeholder="@username"
                      className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-4 text-white/90 outline-none placeholder:text-white/35 focus:border-white/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs tracking-wider text-white/60 mb-2">
                      CASH APP (OPTIONAL)
                    </label>
                    <input
                      value={cashapp}
                      onChange={(e) => setCashapp(e.target.value)}
                      placeholder="$cashtag"
                      className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-4 text-white/90 outline-none placeholder:text-white/35 focus:border-white/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs tracking-wider text-white/60 mb-2">
                      PAYPAL (OPTIONAL)
                    </label>
                    <input
                      value={paypal}
                      onChange={(e) => setPaypal(e.target.value)}
                      placeholder="paypal.me/..."
                      className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-4 text-white/90 outline-none placeholder:text-white/35 focus:border-white/20"
                    />
                  </div>
                </div>
              </div>

              {/* LINKS */}
              <div className="space-y-4">
                <div className="text-xs tracking-[0.35em] text-white/45">
                  LINKS (SOCIAL / PERSONAL)
                </div>

                <div className="rounded-2xl border border-white/12 bg-white/5 p-4">
                  <div className="text-sm font-medium text-white/90">
                    Add Link
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label className="block text-xs tracking-wider text-white/55 mb-2">
                        TYPE
                      </label>
                      <select
                        value={newLinkType}
                        onChange={(e) => setNewLinkType(e.target.value as LinkType)}
                        className="w-full rounded-2xl border border-white/12 bg-[#121214] px-4 py-3 text-white/90 outline-none focus:border-white/20"
                      >
                        <option value="instagram">Instagram</option>
                        <option value="tiktok">TikTok</option>
                        <option value="youtube">YouTube</option>
                        <option value="x">X</option>
                        <option value="website">Website</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    {newLinkType === "other" ? (
                      <div>
                        <label className="block text-xs tracking-wider text-white/55 mb-2">
                          LABEL
                        </label>
                        <input
                          value={newLinkLabel}
                          onChange={(e) => setNewLinkLabel(e.target.value)}
                          placeholder="e.g., Portfolio"
                          className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-white/90 outline-none placeholder:text-white/35 focus:border-white/20"
                        />
                      </div>
                    ) : (
                      <div className="hidden sm:block" />
                    )}

                    <div className={newLinkType === "other" ? "" : "sm:col-span-2"}>
                      <label className="block text-xs tracking-wider text-white/55 mb-2">
                        HANDLE OR URL
                      </label>
                      <input
                        value={newLinkValue}
                        onChange={(e) => setNewLinkValue(e.target.value)}
                        placeholder={
                          newLinkType === "website"
                            ? "example.com"
                            : newLinkType === "youtube"
                            ? "@channel or URL"
                            : "@handle"
                        }
                        className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-white/90 outline-none placeholder:text-white/35 focus:border-white/20"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={addLink}
                    className="mt-3 w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-sm text-white/80 hover:bg-white/10"
                  >
                    Add
                  </button>
                </div>

                {links.length > 0 && (
                  <div className="space-y-3">
                    {links.map((l, idx) => (
                      <div
                        key={l.id}
                        className="rounded-2xl border border-white/12 bg-white/5 p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-medium text-white/90">
                            {l.type === "other"
                              ? (l.label?.trim() || "Other")
                              : linkTypeLabel(l.type)}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => moveLink(l.id, -1)}
                              disabled={idx === 0}
                              className="rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-xs text-white/75 disabled:opacity-50"
                            >
                              Up
                            </button>
                            <button
                              type="button"
                              onClick={() => moveLink(l.id, 1)}
                              disabled={idx === links.length - 1}
                              className="rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-xs text-white/75 disabled:opacity-50"
                            >
                              Down
                            </button>
                            <button
                              type="button"
                              onClick={() => removeLink(l.id)}
                              className="rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-xs text-red-300 hover:bg-white/10"
                            >
                              Remove
                            </button>
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                          {l.type === "other" ? (
                            <div>
                              <label className="block text-xs tracking-wider text-white/55 mb-2">
                                LABEL
                              </label>
                              <input
                                value={l.label ?? ""}
                                onChange={(e) =>
                                  updateLink(l.id, { label: e.target.value })
                                }
                                className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-white/90 outline-none placeholder:text-white/35 focus:border-white/20"
                              />
                            </div>
                          ) : (
                            <div>
                              <label className="block text-xs tracking-wider text-white/55 mb-2">
                                TYPE
                              </label>
                              <div className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-white/70">
                                {linkTypeLabel(l.type)}
                              </div>
                            </div>
                          )}

                          <div>
                            <label className="block text-xs tracking-wider text-white/55 mb-2">
                              HANDLE OR URL
                            </label>
                            <input
                              value={l.value}
                              onChange={(e) =>
                                updateLink(l.id, { value: e.target.value })
                              }
                              className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-white/90 outline-none placeholder:text-white/35 focus:border-white/20"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <p className="text-xs text-white/40 tracking-wide">
                  Tip: reorder with Up/Down. The top link shows first on your card.
                </p>
              </div>

              {/* PRIVACY */}
              <div className="space-y-4">
                <div className="text-xs tracking-[0.35em] text-white/45">
                  PRIVACY
                </div>

                <label className="flex items-center gap-3 text-sm text-white/80">
                  <input
                    type="checkbox"
                    checked={showPhone}
                    onChange={(e) => setShowPhone(e.target.checked)}
                  />
                  Show phone on my card
                </label>

                <label className="flex items-center gap-3 text-sm text-white/80">
                  <input
                    type="checkbox"
                    checked={showEmail}
                    onChange={(e) => setShowEmail(e.target.checked)}
                  />
                  Show email on my card
                </label>

                <label className="flex items-center gap-3 text-sm text-white/80">
                  <input
                    type="checkbox"
                    checked={showSaveContact}
                    onChange={(e) => setShowSaveContact(e.target.checked)}
                  />
                  Allow “Save Contact”
                </label>
              </div>

              {/* ACTIONS */}
              <div className="space-y-3">
                <button
                  onClick={save}
                  disabled={saving}
                  className="group relative w-full overflow-hidden rounded-2xl border border-white/12 bg-white/5 px-4 py-4 font-medium tracking-wide text-white/90 transition-all duration-200 hover:-translate-y-[1px] hover:border-white/20 hover:bg-white/7 disabled:opacity-60 disabled:hover:translate-y-0"
                >
                  <span className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                    <span className="absolute -left-1/2 top-0 h-full w-1/2 skew-x-[-18deg] bg-gradient-to-r from-transparent via-white/10 to-transparent animate-sheen" />
                  </span>
                  {saving ? "Saving…" : "Save & Continue"}
                </button>

                <button
                  onClick={() => (window.location.href = returnToCard)}
                  className="w-full rounded-2xl border border-white/10 bg-transparent px-4 py-4 text-sm tracking-wide text-white/60 hover:bg-white/5"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .grain {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='.35'/%3E%3C/svg%3E");
          mix-blend-mode: overlay;
        }
        .loader {
          animation: spin 900ms linear infinite;
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
        .animate-sheen {
          animation: sheen 900ms ease-out infinite;
        }
        @keyframes sheen {
          0% {
            transform: translateX(-60%) skewX(-18deg);
            opacity: 0;
          }
          25% {
            opacity: 1;
          }
          60% {
            transform: translateX(260%) skewX(-18deg);
            opacity: 0;
          }
          100% {
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}