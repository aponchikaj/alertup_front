import { Link } from "react-router-dom";
import { Seo } from "../../seo";
import { LegalList, LegalPage, Term, type LegalSection } from "./legalLayout";

const UPDATED = "2026-07-31";

const SECTIONS: LegalSection[] = [
  {
    id: "who-we-are",
    heading: "Who we are",
    body: (
      <>
        <p>
          AlertUp is a building safety service operated from Tbilisi, Georgia. It
          lets building owners publish evacuation routes, and lets anyone reach
          those routes by scanning a printed QR code.
        </p>
        <p>
          This policy explains what personal data we collect, why we collect it,
          and what you can do about it. It covers both groups of people who use
          AlertUp: <Term>account holders</Term> who manage buildings, and{" "}
          <Term>visitors</Term> who simply scan a code.
        </p>
      </>
    ),
  },
  {
    id: "what-we-collect",
    heading: "What we collect",
    body: (
      <>
        <p>
          <Term>If you scan a QR code</Term>, you do not need an account and we do
          not ask for your name, email or location. We record that a scan
          happened — which code, at what time — so building owners can see
          whether their codes are being used and where.
        </p>
        <p>
          <Term>If you create an account</Term>, we collect:
        </p>
        <LegalList
          items={[
            "Your email address, and a company or individual name.",
            "A password, which is stored only as a salted hash — we never see or store the password itself.",
            "Two-factor authentication settings and the verification codes we send you, if you enable it.",
            "The buildings, floors, evacuation maps, node layouts and QR codes you create.",
            "Support messages you send us through the contact form.",
            "Basic technical data every web server receives: IP address, browser type and the pages you requested.",
          ]}
        />
      </>
    ),
  },
  {
    id: "why-we-use-it",
    heading: "Why we use it",
    body: (
      <>
        <p>We use personal data only for these purposes:</p>
        <LegalList
          items={[
            <>
              <Term>To run the service</Term> — authenticate you, show your
              buildings, generate and resolve QR codes, and calculate routes.
            </>,
            <>
              <Term>To keep accounts secure</Term> — detect suspicious sign-ins,
              rate-limit abuse and deliver two-factor codes.
            </>,
            <>
              <Term>To give building owners scan analytics</Term> — aggregate
              counts of how often each code was used. These are not linked to an
              identified person.
            </>,
            <>
              <Term>To answer you</Term> — reply to contact form messages and
              support requests.
            </>,
          ]}
        />
        <p>
          We do not sell personal data, and we do not use it to build advertising
          profiles.
        </p>
      </>
    ),
  },
  {
    id: "building-content",
    heading: "Building plans and QR codes",
    body: (
      <>
        <p>
          Evacuation maps, floor plans and routes you upload are published
          deliberately: anyone who scans the corresponding QR code can view them,
          without signing in. That is the entire point of the product.
        </p>
        <p>
          Because of this, <Term>do not upload anything to a floor plan that you
          would not put on a public wall</Term> — for example resident names, room
          occupants, access codes, or the location of valuables or security
          equipment.
        </p>
        <p>
          Editing a building, its floors, its nodes and its codes remains
          restricted to the account that owns it.
        </p>
      </>
    ),
  },
  {
    id: "cookies",
    heading: "Cookies and local storage",
    body: (
      <>
        <p>
          We use a small number of strictly necessary cookies and browser storage
          entries — a session token to keep you signed in, and a stored
          preference for your light or dark theme choice.
        </p>
        <p>
          The full breakdown, including the analytics we run, is in our{" "}
          <Link
            to="/cookies"
            className="font-semibold text-brand-text underline underline-offset-4"
          >
            Cookie Policy
          </Link>
          .
        </p>
      </>
    ),
  },
  {
    id: "sharing",
    heading: "Who we share data with",
    body: (
      <>
        <p>
          We share data only with the service providers needed to operate
          AlertUp, and only as far as they need it:
        </p>
        <LegalList
          items={[
            "Our hosting and database providers, which store the application and its data.",
            "Cloudinary, which stores and serves uploaded floor plan images.",
            "Our email provider, which delivers verification, password reset and two-factor messages.",
            "Vercel Analytics, which reports aggregate, non-identifying page usage.",
            "Our payment processor, if you ever purchase a paid plan. Card details go to them directly and never reach our servers.",
          ]}
        />
        <p>
          We may also disclose data where we are legally required to, or where it
          is necessary to protect someone's safety.
        </p>
      </>
    ),
  },
  {
    id: "retention",
    heading: "How long we keep it",
    body: (
      <>
        <p>
          Account data and building content are kept for as long as your account
          exists. If you delete your account, we delete your account record,
          buildings, floors, uploaded plans and QR codes.
        </p>
        <p>
          Aggregate scan counts may be retained in a form that is no longer linked
          to an account, and backups may hold copies for a limited period before
          rotating out. Support correspondence is kept for up to two years.
        </p>
      </>
    ),
  },
  {
    id: "your-rights",
    heading: "Your rights",
    body: (
      <>
        <p>Depending on where you live, you may have the right to:</p>
        <LegalList
          items={[
            "Ask what personal data we hold about you, and get a copy.",
            "Have inaccurate data corrected.",
            "Have your data deleted.",
            "Object to or restrict certain processing.",
            "Withdraw consent where processing is based on consent.",
          ]}
        />
        <p>
          To exercise any of these, message us through the{" "}
          <Link
            to="/contact"
            className="font-semibold text-brand-text underline underline-offset-4"
          >
            contact form
          </Link>
          . We will respond within 30 days.
        </p>
      </>
    ),
  },
  {
    id: "children",
    heading: "Children",
    body: (
      <p>
        AlertUp accounts are intended for adults responsible for a building. We do
        not knowingly collect personal data from children under 16. Scanning a QR
        code requires no account and collects no personal data, so it is safe for
        anyone to use.
      </p>
    ),
  },
  {
    id: "changes",
    heading: "Changes to this policy",
    body: (
      <p>
        If we change this policy we will update the date at the top of this page.
        Where the change materially affects how we handle your data, we will also
        notify account holders by email before it takes effect.
      </p>
    ),
  },
];

const Privacy = () => (
  <>
    <Seo
      title="Privacy Policy"
      description="What personal data AlertUp collects, why we collect it, who we share it with, and the rights you have over it."
    />
    <LegalPage
      title="Privacy Policy"
      summary="Scanning a QR code needs no account and collects no personal data. If you hold an account, here is exactly what we store and why."
      updated={UPDATED}
      sections={SECTIONS}
      notice={
        <>
          This policy is written to be read and understood, not to be exhaustive
          legal cover. Have a qualified lawyer review it against the regulations
          that apply to your jurisdiction before relying on it commercially.
        </>
      }
    />
  </>
);

export default Privacy;
