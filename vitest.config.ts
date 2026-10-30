import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@pmw/engine": fileURLToPath(new URL("./packages/engine/src/index.ts", import.meta.url)),
      // Worker-only modules are stubbed for Node tests.
      "cloudflare:workers": fileURLToPath(new URL("./test/stubs/cloudflare-workers.ts", import.meta.url)),
    },
  },
  test: {
    include: ["packages/**/test/**/*.test.ts", "worker/test/**/*.test.ts", "evals/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["packages/engine/src/calc/**"],
      thresholds: { lines: 100, functions: 100, statements: 100, branches: 95 },
    },
  },
});
