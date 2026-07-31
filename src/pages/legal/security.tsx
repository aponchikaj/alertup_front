import { Link } from "react-router-dom";
import { Seo } from "../../seo";
import { LegalList, LegalPage, Term, type LegalSection } from "./legalLayout";

const UPDATED = "2026-07-31";

const SECTIONS: LegalSection[] = [
  {
    id: "accounts",
    heading: "Protecting your account",
    body: (
      <>
        <LegalList
          items={[
            <>
              <Term>Passwords are hashed.</Term> We store a salted hash, never the
              password. Nobody at AlertUp can read or recover it — a reset is the
              only route back in.
            </>,
            <>
              <Term>Two-factor authentication.</Term> You can require a
              single-use code sent to your email on top of your password. If you
              manage a real building, turn this on.
            </>,
            <>
              <Term>Rate limiting.</Term> Repeated failed sign-ins and abusive
              request patterns are throttled server-side.
            </>,
            <>
              <Term>Scoped authorisation.</Term> Editing a building, its floors,
              nodes and codes is checked against the owning account on the server
              — not merely hidden in the interface.
            </>,
          ]}
        />
      </>
    ),
  },
  {
    id: "transport",
    heading: "Data in transit",
    body: (
      <p>
        All traffic between your browser and AlertUp is served over HTTPS. Session
        tokens are transmitted only over that encrypted connection, and the API
        accepts requests only from our own origins.
      </p>
    ),
  },
  {
    id: "storage",
    heading: "Data at rest",
    body: (
      <>
        <p>
          Account records and building data live in a managed database with
          access restricted to the application. Uploaded floor plan images are
          stored with Cloudinary.
        </p>
        <p>
          Payment details, if you ever purchase a paid plan, go directly to the
          payment processor. Card numbers never reach our servers and we never
          store them.
        </p>
      </>
    ),
  },
  {
    id: "what-is-public",
    heading: "What is deliberately public",
    body: (
      <>
        <p>
          Evacuation routes are published on purpose. Anyone who scans one of your
          QR codes — or who has the link — can view the route for that location
          without signing in. That is what makes the product work for visitors.
        </p>
        <p>
          Treat a floor plan as a public document. Do not include resident names,
          door codes, alarm panel locations, server room contents or anything else
          you would not post on the wall next to the code.
        </p>
      </>
    ),
  },
  {
    id: "your-part",
    heading: "Your part",
    body: (
      <LegalList
        items={[
          "Use a password you do not use anywhere else, and enable two-factor authentication.",
          "Remove access promptly when someone leaves your organisation.",
          "Re-check your routes after any renovation, exit closure or layout change.",
          "Keep printed evacuation plans posted next to your codes, so an outage never leaves people with nothing.",
        ]}
      />
    ),
  },
  {
    id: "reporting",
    heading: "Reporting a vulnerability",
    body: (
      <>
        <p>
          If you find a security issue, tell us before telling anyone else. Send
          the details through the{" "}
          <Link
            to="/contact"
            className="font-semibold text-brand-text underline underline-offset-4"
          >
            contact form
          </Link>{" "}
          with "Security" as the reason, and include enough detail to reproduce
          it.
        </p>
        <p>We ask that you:</p>
        <LegalList
          items={[
            "Give us a reasonable window to fix the issue before disclosing it publicly.",
            "Do not access, modify or delete data belonging to other users.",
            "Do not run denial-of-service tests or automated scans against production.",
          ]}
        />
        <p>
          We will acknowledge your report, keep you updated, and credit you if you
          would like us to.
        </p>
      </>
    ),
  },
  {
    id: "limitations",
    heading: "Honest limitations",
    body: (
      <>
        <p>
          AlertUp is a small, independently built project, not an enterprise
          security product. We do not currently hold a formal certification such
          as ISO 27001 or SOC 2, and we have not undergone an independent
          penetration test.
        </p>
        <p>
          We would rather say that plainly than imply assurances we cannot back
          up. If your organisation requires a specific compliance posture, talk to
          us before rolling AlertUp out across a site.
        </p>
      </>
    ),
  },
];

const Security = () => (
  <>
    <Seo
      title="Security"
      description="How AlertUp protects accounts and building data, what is deliberately public, how to report a vulnerability, and the limitations we're upfront about."
    />
    <LegalPage
      title="Security"
      summary="How accounts and building data are protected, what is public by design, and how to report a problem."
      updated={UPDATED}
      sections={SECTIONS}
    />
  </>
);

export default Security;
