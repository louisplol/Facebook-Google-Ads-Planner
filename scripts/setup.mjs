// First-run helper: creates wrangler.toml and .dev.vars from their examples if missing.
// Generates a random SESSION_SECRET and ADMIN_DEV_TOKEN for local use.
import { existsSync, copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

if (!existsSync("wrangler.toml")) {
  copyFileSync("wrangler.toml.example", "wrangler.toml");
  // Local dev runs as development so the admin dev token works.
  writeFileSync(
    "wrangler.toml",
    readFileSync("wrangler.toml", "utf8").replace('ENVIRONMENT = "production"', 'ENVIRONMENT = "development"'),
  );
  console.log("Created wrangler.toml from wrangler.toml.example");
}

if (!existsSync(".dev.vars")) {
  let vars = readFileSync(".dev.vars.example", "utf8");
  vars = vars.replace("SESSION_SECRET=change-me-to-a-long-random-string", `SESSION_SECRET=${randomBytes(32).toString("hex")}`);
  const token = randomBytes(18).toString("base64url");
  vars = vars.replace("ADMIN_DEV_TOKEN=", `ADMIN_DEV_TOKEN=${token}`);
  writeFileSync(".dev.vars", vars);
  console.log("Created .dev.vars. Your local admin token is in .dev.vars (ADMIN_DEV_TOKEN).");
}
