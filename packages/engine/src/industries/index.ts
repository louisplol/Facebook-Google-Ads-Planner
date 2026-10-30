import type { IndustryPack } from "./types.ts";
import { coaching } from "./coaching.ts";
import { trades } from "./trades.ts";
import { health } from "./health.ts";
import { professional } from "./professional.ts";
import { beauty } from "./beauty.ts";
import { hospitality } from "./hospitality.ts";
import { education } from "./education.ts";
import { software } from "./software.ts";
import { other } from "./other.ts";

export const INDUSTRY_PACKS: IndustryPack[] = [coaching, trades, health, professional, beauty, hospitality, education, software, other];

export const packByKey = (key: string | null | undefined): IndustryPack => INDUSTRY_PACKS.find((p) => p.key === key) ?? other;

export type { IndustryPack, ExampleSet, ComplianceFlag } from "./types.ts";

/** Example text for a field id, from the pack (rows fields take the nth item). */
export function exampleFor(pack: IndustryPack, fieldId: string, exampleKey?: string): string | undefined {
  const m = /^(.*)_(\d+)$/.exec(fieldId);
  const key = (exampleKey ?? (m && (pack.examples as unknown as Record<string, unknown>)[m[1]] !== undefined ? m[1] : fieldId)) as keyof typeof pack.examples;
  const v = (pack.examples as unknown as Record<string, unknown>)[key];
  if (Array.isArray(v)) {
    const idx = m ? Number(m[2]) - 1 : 0;
    return v[idx % v.length] as string;
  }
  return typeof v === "string" ? v : undefined;
}
