"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type ActionType =
  | "phone"
  | "email"
  | "venmo"
  | "cashapp"
  | "paypal"
  | "instagram"
  | "tiktok"
  | "youtube"
  | "x"
  | "website"
  | "other";

type ActionItem = {
  id: string;
  type: ActionType;
  label?: string; // only for "other"
  value: string;
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

function typeLabel(t: ActionType, label?: string) {
  if (t === "venmo") return "Venmo";
  if (t === "cashapp") return "Cash App";
  if (t === "paypal") return "PayPal";
  if (t === "phone") return "Phone";
  if (t === "email") return "Email";
  if (t === "instagram") return "Instagram";
  if (t === "tiktok") return "TikTok";
  if (t === "youtube") return "YouTube";
  if (t === "x") return "X";
  if (t === "website") return "Website";
  return label?.trim() || "Other";
}

function placeholderFor(t: ActionType) {
  if (t === "venmo") return "Username (no @)";
  if (t === "cashapp") return "Cashtag (no $)";
  if (t === "paypal") return "Link";
  if (t === "phone") return "Phone Number";
  if (t === "email") return "Email";
  if (t === "website") return "example.com";
  if (t === "other") return "Handle or URL";
  return "@handle";
}

function coerceToActions(p: any): ActionItem[] {
  const base: ActionItem[] = [
    { id: uid(), type: "venmo", value: "" },
    { id: uid(), type: "cashapp", value: "" },
    { id: uid(), type: "paypal", value: "" },
    { id: uid(), type: "phone", value: "" },
    { id: uid(), type: "email", value: "" },
  ];

  if (!p || typeof p !== "object") return base;

  if (Array.isArray(p.links)) {
    const actions = (p.links as any[]).map((x: any): ActionItem => ({
      id: String(x?.id ?? uid()),
      type: (String(x?.type ?? "other") as ActionType) || "other",
      label: x?.label ? String(x.label) : undefined,
      value: String(x?.value ?? ""),
    }));

    const ensure = (t: ActionType) => {
      if (!actions.some((a) => a.type === t)) actions.push({ id: uid(), type: t, value: "" });
    };
    ensure("venmo");
    ensure("cashapp");
    ensure("paypal");
    ensure("phone");
    ensure("email");

    // sync legacy keys -> core items if needed
    if (typeof p.venmo === "string") {
      const a = actions.find((x) => x.type === "venmo");
      if (a && !a.value.trim()) a.value = p.venmo;
    }
    if (typeof p.cashapp === "string") {
      const a = actions.find((x) => x.type === "cashapp");
      if (a && !a.value.trim()) a.value = p.cashapp;
    }
    if (typeof p.paypal === "string") {
      const a = actions.find((x) => x.type === "paypal");
      if (a && !a.value.trim()) a.value = p.paypal;
    }
    if (typeof p.phone === "string") {
      const a = actions.find((x) => x.type === "phone");
      if (a && !a.value.trim()) a.value = p.phone;
    }
    if (typeof p.email === "string") {
      const a = actions.find((x) => x.type === "email");
      if (a && !a.value.trim()) a.value = p.email;
    }

    return actions;
  }

  // legacy object
  const actions = [...base];
  const setCore = (t: ActionType, v: string) => {
    const a = actions.find((x) => x.type === t);
    if (a) a.value = v;
  };

  if (typeof p.venmo === "string") setCore("venmo", p.venmo);
  if (typeof p.cashapp === "string") setCore("cashapp", p.cashapp);
  if (typeof p.paypal === "string") setCore("paypal", p.paypal);
  if (typeof p.phone === "string") setCore("phone", p.phone);
  if (typeof p.email === "string") setCore("email", p.email);

  return actions;
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

  const [actions, setActions] = useState<ActionItem[]>([]);

  const [showPhone, setShowPhone] = useState(true);
  const [showEmail, setShowEmail] = useState(true);
  const [showSaveContact, setShowSaveContact] = useState(true);

  const [showAddLink, setShowAddLink] = useState(false);
  const [newType, setNewType] = useState<ActionType>("instagram");
  const [newLabel, setNewLabel] = useState("");
  const [newValue, setNewValue] = useState("");

  const returnToCard = useMemo(() => `/c/${cardId}`, [cardId]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setMsg("");

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        window.location.href = `/login?returnTo=${encodeURIComponent(`/setup/${cardId}`)}`;
        return;
      }

      const { data, error } = await supabase
        .from("cards")
        .select("id, owner_user_id, display_name, bio, photo_url, pay_label, payments_json, show_phone, show_email, show_save_contact")
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

      setActions(coerceToActions(row.payments_json));

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

  function moveAction(id: string, dir: -1 | 1) {
    setActions((prev) => {
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

  function updateAction(id: string, patch: Partial<ActionItem>) {
    setActions((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function removeAction(id: string) {
    setActions((prev) => prev.filter((p) => p.id !== id));
  }

  function addLink() {
    const v = newValue.trim();
    if (!v) return;

    if (newType === "other") {
      const l = newLabel.trim();
      if (!l) return;
      setActions((prev) => [...prev, { id: uid(), type: "other", label: l, value: v }]);
      setNewLabel("");
      setNewValue("");
      setNewType("instagram");
      setShowAddLink(false);
      return;
    }

    setActions((prev) => [...prev, { id: uid(), type: newType, value: v }]);
    setNewValue("");
    setNewType("instagram");
    setShowAddLink(false);
  }

  async function save() {
    const fn = firstName.trim();
    const ln = lastName.trim();
    const computedDisplay = `${fn} ${ln}`.trim();

    if (!fn) {
      setMsg("Preferred first name is required.");
      return;
    }

    const phoneItem = actions.find((a) => a.type === "phone");
    const phoneNorm = normalizePhone(phoneItem?.value ?? "");
    if (!phoneNorm) {
      setMsg("Phone number is required.");
      return;
    }

    setSaving(true);
    setMsg("");

    try {
      const cleaned = actions.map((a) => {
        let v = (a.value ?? "").trim();

        if (a.type === "venmo") v = normalizeVenmoHandle(v);
        if (a.type === "cashapp") v = normalizeCashAppTag(v);
        if (a.type === "paypal") v = normalizePaypal(v);

        if (a.type === "instagram" || a.type === "tiktok" || a.type === "x") v = normalizeHandle(v);

        if (a.type === "email") v = normalizeEmail(v);
        if (a.type === "phone") v = normalizePhone(v);

        return {
          id: a.id,
          type: a.type,
          label: a.type === "other" ? (a.label?.trim() || "Link") : undefined,
          value: v,
        };
      });

      const venmo = cleaned.find((x) => x.type === "venmo")?.value ?? "";
      const cashapp = cleaned.find((x) => x.type === "cashapp")?.value ?? "";
      const paypal = cleaned.find((x) => x.type === "paypal")?.value ?? "";
      const email = cleaned.find((x) => x.type === "email")?.value ?? "";

      const payments_json: any = {
        venmo,
        cashapp,
        paypal,
        phone: phoneNorm,
        email,
        links: cleaned,
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

  const paymentTypes: ActionType[] = ["venmo", "cashapp", "paypal", "phone", "email"];
  const payments = actions.filter((a) => paymentTypes.includes(a.type));
  const external = actions.filter((a) => !paymentTypes.includes(a.type));

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
            <h1 className="text-lg font-medium tracking-wide text-white/90">Setup Your Card</h1>
            <p className="mt-3 text-[12px] tracking-[0.35em] text-white/45">{cardId}</p>
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
                <div className="text-xs tracking-[0.35em] text-white/45">BASICS</div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs tracking-wider text-white/60 mb-2">PREFERRED FIRST NAME</label>
                    <input
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-4 text-white/90 outline-none focus:border-white/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs tracking-wider text-white/60 mb-2">PREFERRED LAST NAME</label>
                    <input
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-4 text-white/90 outline-none focus:border-white/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs tracking-wider text-white/60 mb-2">NOTE (OPTIONAL)</label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="w-full resize-none rounded-2xl border border-white/12 bg-white/5 px-4 py-4 text-white/90 outline-none focus:border-white/20"
                  />
                </div>

                <div>
                  <label className="block text-xs tracking-wider text-white/60 mb-2">PAY LABEL (OPTIONAL)</label>
                  <input
                    value={payLabel}
                    onChange={(e) => setPayLabel(e.target.value)}
                    className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-4 text-white/90 outline-none focus:border-white/20"
                  />
                </div>
              </div>

              {/* PAYMENTS */}
              <div className="space-y-4">
                <div className="text-xs tracking-[0.35em] text-white/45">PAYMENTS (ORDERED)</div>

                <div className="space-y-3">
                  {payments.map((a, idx) => (
                    <div key={a.id} className="rounded-2xl border border-white/12 bg-white/5 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-medium text-white/90">{typeLabel(a.type, a.label)}</div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => moveAction(a.id, -1)}
                            disabled={actions.findIndex((x) => x.id === a.id) === 0}
                            className="rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-xs text-white/75 disabled:opacity-50"
                          >
                            Up
                          </button>
                          <button
                            type="button"
                            onClick={() => moveAction(a.id, 1)}
                            disabled={actions.findIndex((x) => x.id === a.id) === actions.length - 1}
                            className="rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-xs text-white/75 disabled:opacity-50"
                          >
                            Down
                          </button>
                        </div>
                      </div>

                      <div className="mt-3">
                        <label className="block text-xs tracking-wider text-white/55 mb-2">
                          {a.type === "paypal" ? "LINK" : a.type === "phone" ? "PHONE NUMBER" : a.type === "email" ? "EMAIL" : "VALUE"}
                        </label>
                        <input
                          value={a.value}
                          onChange={(e) => updateAction(a.id, { value: e.target.value })}
                          placeholder={placeholderFor(a.type)}
                          className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-white/90 outline-none focus:border-white/20"
                        />
                      </div>

                      {a.type === "phone" && (
                        <p className="mt-2 text-xs text-white/40 tracking-wide">
                          Required. On card: tap to message, hold to copy.
                        </p>
                      )}
                      {a.type === "email" && (
                        <p className="mt-2 text-xs text-white/40 tracking-wide">
                          Optional. On card: tap copies it.
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* EXTERNAL LINKS */}
              <div className="space-y-4">
                <div className="text-xs tracking-[0.35em] text-white/45">EXTERNAL LINKS (ORDERED)</div>

                {external.length > 0 && (
                  <div className="space-y-3">
                    {external.map((a) => {
                      const idxGlobal = actions.findIndex((x) => x.id === a.id);
                      return (
                        <div key={a.id} className="rounded-2xl border border-white/12 bg-white/5 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm font-medium text-white/90">{typeLabel(a.type, a.label)}</div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => moveAction(a.id, -1)}
                                disabled={idxGlobal === 0}
                                className="rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-xs text-white/75 disabled:opacity-50"
                              >
                                Up
                              </button>
                              <button
                                type="button"
                                onClick={() => moveAction(a.id, 1)}
                                disabled={idxGlobal === actions.length - 1}
                                className="rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-xs text-white/75 disabled:opacity-50"
                              >
                                Down
                              </button>
                              <button
                                type="button"
                                onClick={() => removeAction(a.id)}
                                className="rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-xs text-red-300 hover:bg-white/10"
                              >
                                Remove
                              </button>
                            </div>
                          </div>

                          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                            {a.type === "other" ? (
                              <div>
                                <label className="block text-xs tracking-wider text-white/55 mb-2">LABEL</label>
                                <input
                                  value={a.label ?? ""}
                                  onChange={(e) => updateAction(a.id, { label: e.target.value })}
                                  className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-white/90 outline-none focus:border-white/20"
                                />
                              </div>
                            ) : (
                              <div className="hidden sm:block" />
                            )}

                            <div className={a.type === "other" ? "" : "sm:col-span-2"}>
                              <label className="block text-xs tracking-wider text-white/55 mb-2">HANDLE OR URL</label>
                              <input
                                value={a.value}
                                onChange={(e) => updateAction(a.id, { value: e.target.value })}
                                placeholder={placeholderFor(a.type)}
                                className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-white/90 outline-none focus:border-white/20"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {!showAddLink ? (
                  <button
                    type="button"
                    onClick={() => setShowAddLink(true)}
                    className="rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-xs text-white/80 hover:bg-white/10"
                  >
                    + Add Link
                  </button>
                ) : (
                  <div className="rounded-2xl border border-white/12 bg-white/5 p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium text-white/90">Add Link</div>
                      <button
                        type="button"
                        onClick={() => setShowAddLink(false)}
                        className="text-xs text-white/60 hover:text-white/80"
                      >
                        Close
                      </button>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div>
                        <label className="block text-xs tracking-wider text-white/55 mb-2">TYPE</label>
                        <select
                          value={newType}
                          onChange={(e) => setNewType(e.target.value as ActionType)}
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

                      {newType === "other" ? (
                        <div>
                          <label className="block text-xs tracking-wider text-white/55 mb-2">LABEL</label>
                          <input
                            value={newLabel}
                            onChange={(e) => setNewLabel(e.target.value)}
                            placeholder="e.g., Portfolio"
                            className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-white/90 outline-none focus:border-white/20"
                          />
                        </div>
                      ) : (
                        <div className="hidden sm:block" />
                      )}

                      <div className={newType === "other" ? "" : "sm:col-span-2"}>
                        <label className="block text-xs tracking-wider text-white/55 mb-2">HANDLE OR URL</label>
                        <input
                          value={newValue}
                          onChange={(e) => setNewValue(e.target.value)}
                          placeholder={placeholderFor(newType)}
                          className="w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-white/90 outline-none focus:border-white/20"
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
                )}
              </div>

              {/* PRIVACY */}
              <div className="space-y-4">
                <div className="text-xs tracking-[0.35em] text-white/45">PRIVACY</div>

                <label className="flex items-center gap-3 text-sm text-white/80">
                  <input type="checkbox" checked={showPhone} onChange={(e) => setShowPhone(e.target.checked)} />
                  Show phone on my card
                </label>

                <label className="flex items-center gap-3 text-sm text-white/80">
                  <input type="checkbox" checked={showEmail} onChange={(e) => setShowEmail(e.target.checked)} />
                  Show email on my card
                </label>

                <label className="flex items-center gap-3 text-sm text-white/80">
                  <input type="checkbox" checked={showSaveContact} onChange={(e) => setShowSaveContact(e.target.checked)} />
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