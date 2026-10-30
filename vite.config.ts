import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const root = fileURLToPath(new URL(".", import.meta.url));
const configPath = existsSync(`${root}wrangler.toml`) ? `${root}wrangler.toml` : `${root}wrangler.toml.example`;

export default defineConfig({
  root: "apps/web",
  envDir: root,
  resolve: {
    alias: { "@pmw/engine": fileURLToPath(new URL("./packages/engine/src/index.ts", import.meta.url)) },
  },
  plugins: [react(), cloudflare({ configPath, persistState: { path: `${root}.wrangler/state` } })],
  // PORT picks another port when 5173 is taken by a different project. strictPort fails loudly instead of
  // quietly sharing a port, which sends the browser to the wrong app.
  server: { port: Number(process.env.PORT ?? 5173), strictPort: true },
});
