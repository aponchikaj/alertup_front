import { Link } from "react-router-dom";
import { Seo } from "../../seo";
import { LegalList, LegalPage, Term, type LegalSection } from "./legalLayout";

const UPDATED = "2026-07-31";

const STORAGE_ITEMS = [
  {
    name: "Session token",
    kind: "Cookie / local storage",
    purpose:
      "Keeps you signed in between page loads. Without it you would have to log in on every screen.",
    duration: "Until you log out or it expires",
    category: "Strictly necessary",
  },
  {
    name: "alertup-theme",
    kind: "Local storage",
    purpose:
      "Remembers whether you chose the light theme, the dark theme, or to follow your system setting.",
    duration: "Until you clear it",
    category: "Preference",
  },
  {
    name: "Vercel Analytics",
    kind: "Anonymous request data",
    purpose:
      "Counts page views so we know which parts of the site are used. No cookie is set and no cross-site profile is built.",
    duration: "Not stored on your device",
    category: "Analytics",
  },
];

const SECTIONS: LegalSection[] = [
  {
    id: "summary",
    heading: "The short version",
    body: (
      <>
        <p>
          AlertUp uses the minimum browser storage needed to work. We set{" "}
          <Term>no advertising cookies</Term>, run no third-party trackers, and do
          not sell or share browsing data.
        </p>
        <p>
          Scanning a QR code sets nothing at all — a visitor who scans a code and
          reads a route leaves no cookie behind.
        </p>
      </>
    ),
  },
  {
    id: "what-we-store",
    heading: "What we store",
    body: (
      <div className="-mx-1 overflow-x-auto">
        <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
          <caption className="sr-only">
            Cookies and browser storage used by AlertUp
          </caption>
          <thead>
            <tr className="border-b border-line">
              {["Item", "Type", "Purpose", "Kept for"].map((header) => (
                <th
                  key={header}
                  scope="col"
                  className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {STORAGE_ITEMS.map((item) => (
              <tr key={item.name} className="border-b border-line align-top">
                <th
                  scope="row"
                  className="px-3 py-3 font-medium text-ink"
                >
                  {item.name}
                  <span className="mt-1 block text-xs font-normal text-ink-subtle">
                    {item.category}
                  </span>
                </th>
                <td className="px-3 py-3 text-ink-muted">{item.kind}</td>
                <td className="px-3 py-3 text-ink-muted">{item.purpose}</td>
                <td className="px-3 py-3 text-ink-muted">{item.duration}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ),
  },
  {
    id: "strictly-necessary",
    heading: "Strictly necessary storage",
    body: (
      <p>
        The session token is required for the service to function. It identifies
        your logged-in session so the server knows which buildings are yours.
        Because it is essential, it is not something you can switch off while
        staying signed in — but it is only set once you log in.
      </p>
    ),
  },
  {
    id: "preferences",
    heading: "Preference storage",
    body: (
      <p>
        Your theme choice is kept in your browser's local storage under{" "}
        <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[0.85em] text-ink">
          alertup-theme
        </code>
        . It never leaves your device and is not sent to our servers. Clearing it
        simply returns AlertUp to following your operating system's light or dark
        setting.
      </p>
    ),
  },
  {
    id: "analytics",
    heading: "Analytics",
    body: (
      <>
        <p>
          We use Vercel Analytics to count page views. It is cookieless: it
          records the page requested and coarse technical details, and does not
          assign you a persistent identifier or follow you to other sites.
        </p>
        <p>
          Separately, building owners see <Term>scan counts</Term> for their own
          QR codes. Those are aggregate totals per code — they do not identify the
          person who scanned.
        </p>
      </>
    ),
  },
  {
    id: "managing",
    heading: "Managing what's stored",
    body: (
      <>
        <p>You are in control of all of it:</p>
        <LegalList
          items={[
            "Every browser lets you view, block and delete cookies and local storage from its privacy settings.",
            "Clearing site data for alertup.world removes your theme preference and signs you out.",
            "Browser-level tracking protection and Do Not Track will not break AlertUp — nothing here depends on tracking.",
          ]}
        />
        <p>
          Blocking the session token will prevent you from staying signed in, but
          scanning codes and viewing routes will still work.
        </p>
      </>
    ),
  },
  {
    id: "more",
    heading: "Related policies",
    body: (
      <p>
        For the wider picture of what data we hold and why, see the{" "}
        <Link
          to="/privacy"
          className="font-semibold text-brand-text underline underline-offset-4"
        >
          Privacy Policy
        </Link>
        .
      </p>
    ),
  },
];

const Cookies = () => (
  <>
    <Seo
      title="Cookie Policy"
      description="Every cookie and browser storage item AlertUp uses, what each one is for, how long it lasts, and how to remove it."
    />
    <LegalPage
      title="Cookie Policy"
      summary="Three items, no advertising trackers, and nothing at all stored when you simply scan a code."
      updated={UPDATED}
      sections={SECTIONS}
    />
  </>
);

export default Cookies;
