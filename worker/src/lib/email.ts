import type { Env } from "../env.ts";
import { isDev } from "../env.ts";

export interface SentEmail {
  delivered: boolean;
  devLink?: string;
}

/**
 * Sends an email through Resend. Only the email address leaves the app.
 * In development with no key, the message is logged so the link can be clicked locally.
 */
export async function sendEmail(env: Env, to: string, subject: string, text: string, link?: string): Promise<SentEmail> {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    if (isDev(env)) {
      console.log(`[dev email] to=${to} subject="${subject}" link=${link ?? ""}`);
      return { delivered: false, devLink: link };
    }
    throw new Error("Email is not configured");
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject, text }),
  });
  if (!res.ok) throw new Error(`Email failed: ${res.status}`);
  return { delivered: true };
}
