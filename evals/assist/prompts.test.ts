import { describe, it, expect } from "vitest";
import { ACTION_SPEC } from "@pmw/engine";
import { CASES } from "./prompts.ts";
import { actionAllowed } from "../../worker/src/assist/route.ts";

describe("assist eval set", () => {
  it("has 40 fixed prompts across 3 industries", () => {
    expect(CASES).toHaveLength(40);
    expect(new Set(CASES.map((c) => c.industry))).toEqual(new Set(["coaching", "trades", "professional"]));
    expect(new Set(CASES.map((c) => c.id)).size).toBe(40);
  });
  it("every case is an allowed field and action", () => {
    for (const c of CASES) {
      expect(ACTION_SPEC[c.action], c.id).toBeTruthy();
      expect(actionAllowed(c.fieldId, c.action), c.id).toBe(true);
    }
  });
  it("includes a prompt injection case", () => {
    expect(CASES.some((c) => c.id.startsWith("injection"))).toBe(true);
  });
});
