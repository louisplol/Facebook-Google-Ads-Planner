// Display rounding, matching the reference workbook:
// counts one decimal monthly (impressions whole), whole numbers annually,
// spend and revenue whole dollars, cost each two decimals, ROAS one decimal.

export function formatMoney(v: number | null | undefined, currency = "AUD", decimals = 0): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "";
  const symbol = currency === "AUD" || currency === "USD" || currency === "NZD" || currency === "CAD" ? "$" : currency === "GBP" ? "£" : currency === "EUR" ? "€" : "";
  const neg = v < 0;
  const s = Math.abs(v).toLocaleString("en-AU", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return `${neg ? "-" : ""}${symbol}${s}${symbol ? "" : ` ${currency}`}`;
}

export function formatCount(v: number | null | undefined, decimals: number): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "";
  return v.toLocaleString("en-AU", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function formatPercent(v: number | null | undefined, decimals = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "";
  // Trim trailing zeros: 1% not 1.0%, 2.5% stays 2.5%.
  return `${Number((v * 100).toFixed(decimals))}%`;
}

export function formatRoas(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "";
  return `${v.toFixed(1)}x`;
}

export function formatForecastCell(key: string, kind: "currency" | "count" | "ratio", period: "monthly" | "annual", v: number | null | undefined, currency = "AUD"): string {
  if (v === null || v === undefined) return "";
  if (kind === "ratio") return formatRoas(v);
  if (kind === "currency") return formatMoney(v, currency, 0);
  if (period === "annual") return formatCount(v, 0);
  return formatCount(v, key === "impressions" ? 0 : 1);
}

export function formatCostEach(v: number | "none_yet" | null | undefined, currency = "AUD"): string {
  if (v === "none_yet") return "none yet";
  if (v === null || v === undefined) return "";
  return formatMoney(v, currency, 2);
}
