export type Provider = "venmo" | "cashapp" | "zelle" | "paypal" | "custom";
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
}
