import { useStore } from "../lib/store.tsx";
import { CONSENT_TEXT } from "./Onboarding.tsx";

// Naming Anthropic and Ahrefs here replaces the "no tech talk" rule for this page only (Decision 11, pending review).
export function Privacy() {
  const { config } = useStore();
  return (
    <main className="page">
      <h1>Privacy</h1>
      <p>{CONSENT_TEXT}</p>
      <h2>Who receives what</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Provider</th>
              <th>What for</th>
              <th>What they receive</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Cloudflare</td>
              <td>Hosting, storage, website scans</td>
              <td>Everything you enter, and the public pages of the website you give us</td>
            </tr>
            <tr>
              <td>Anthropic</td>
              <td>Writing help and research</td>
              <td>Only the workbook answers needed for the button you tap, research text, and any ad screenshots you upload</td>
            </tr>
            <tr>
              <td>Ahrefs</td>
              <td>Search data</td>
              <td>Keywords, your website's domain and your country</td>
            </tr>
            <tr>
              <td>Resend</td>
              <td>Sending your sign-in link</td>
              <td>Your email address only</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>We never send your email address, account details or session data to Anthropic or Ahrefs.</p>
      <p>Anthropic and Ahrefs may process data outside Australia.</p>
      <h2>What we keep</h2>
      <ul>
        <li>Your answers, until you delete them.</li>
        <li>A record of each writing help request, for up to 12 months, so we can see what's useful.</li>
        <li>Uploaded screenshots and files, for up to 7 days.</li>
        <li>Search data and public page lookups, shared across users, for 30 days. These hold no personal details.</li>
      </ul>
      <h2>Deleting your data</h2>
      <p>Go to Settings and choose "Delete my data". It removes your answers, workspaces, website scans, uploads and writing help history straight away.</p>
      <p className="tiny muted">{config?.brandName}. This page is being reviewed and may change.</p>
    </main>
  );
}
