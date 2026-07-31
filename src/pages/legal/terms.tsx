import { Link } from "react-router-dom";
import { Seo } from "../../seo";
import { LegalList, LegalPage, Term, type LegalSection } from "./legalLayout";

const UPDATED = "2026-07-31";

const SECTIONS: LegalSection[] = [
  {
    id: "agreement",
    heading: "Agreement",
    body: (
      <p>
        These terms govern your use of AlertUp. By creating an account, uploading
        a building plan, generating a QR code or scanning one, you agree to them.
        If you are accepting on behalf of an organisation, you confirm you are
        authorised to do so.
      </p>
    ),
  },
  {
    id: "what-alertup-is",
    heading: "What AlertUp is — and what it is not",
    body: (
      <>
        <p>
          AlertUp is an <Term>informational aid</Term>. It displays evacuation
          routes and safety guidance that a building owner has uploaded, and makes
          them reachable from a QR code.
        </p>
        <p>
          AlertUp is <Term>not</Term> a life safety system, a fire alarm, an
          emergency notification service, or a substitute for any of them. It does
          not detect emergencies, does not contact emergency services, and does
          not replace:
        </p>
        <LegalList
          items={[
            "The fire safety signage, emergency lighting and exit marking your local regulations require.",
            "Physical evacuation plans posted in the building.",
            "Trained fire wardens, drills and evacuation procedures.",
            "Any instruction given by emergency services or building staff during an actual incident.",
          ]}
        />
        <p>
          <Term>In an emergency, follow the instructions of emergency services
          and the building's own procedures.</Term> Never delay evacuating in
          order to consult a phone.
        </p>
      </>
    ),
  },
  {
    id: "accounts",
    heading: "Your account",
    body: (
      <>
        <p>
          You are responsible for the accuracy of the information on your account
          and for everything done through it. Keep your password confidential, and
          enable two-factor authentication if your building data matters to you.
        </p>
        <p>
          Tell us promptly if you believe your account has been accessed by
          someone else.
        </p>
      </>
    ),
  },
  {
    id: "your-content",
    heading: "The content you upload",
    body: (
      <>
        <p>
          You keep ownership of every floor plan, evacuation map and description
          you upload. You grant us the limited licence needed to host that
          content, process it into routes, and display it to anyone who scans one
          of your codes.
        </p>
        <p>By uploading, you confirm that:</p>
        <LegalList
          items={[
            "You have the right to publish the plans, and doing so does not breach anyone else's rights.",
            "You are authorised by the building's owner or operator to publish evacuation information for it.",
            "The plans reflect the building as it actually is, and you will update them when it changes.",
          ]}
        />
        <p>
          <Term>Accuracy is your responsibility.</Term> We display the routes your
          data produces; we cannot verify that they match the physical building.
          An out-of-date plan is worse than no plan, so review your buildings
          after any renovation, layout change or exit closure.
        </p>
      </>
    ),
  },
  {
    id: "acceptable-use",
    heading: "Acceptable use",
    body: (
      <>
        <p>You must not:</p>
        <LegalList
          items={[
            "Upload plans for a building you have no authority over, or publish deliberately misleading routes.",
            "Use AlertUp to distribute malware, phishing pages or content unrelated to building safety.",
            "Attempt to access other accounts, probe the service for vulnerabilities without permission, or bypass rate limits.",
            "Scrape, resell or redistribute the service or other users' building data.",
          ]}
        />
        <p>
          Publishing a deliberately false evacuation route is the most serious
          misuse of this service, and we will remove it and terminate the account
          without notice.
        </p>
      </>
    ),
  },
  {
    id: "availability",
    heading: "Availability",
    body: (
      <p>
        We work to keep AlertUp available, but we provide it "as is" and do not
        guarantee uninterrupted service. Hosting outages, maintenance and network
        failures happen. Because of that, keep printed evacuation plans posted
        alongside your QR codes so the information survives an outage.
      </p>
    ),
  },
  {
    id: "fees",
    heading: "Fees",
    body: (
      <p>
        Creating an account, adding a building and generating QR codes are
        currently free. If we introduce paid plans we will state the price and
        terms before you are charged, and existing free functionality will not be
        withdrawn without notice.
      </p>
    ),
  },
  {
    id: "liability",
    heading: "Liability",
    body: (
      <>
        <p>
          To the fullest extent the law allows, AlertUp is not liable for indirect
          or consequential loss, nor for loss arising from your reliance on
          information that you or another user uploaded.
        </p>
        <p>
          Nothing in these terms excludes liability that cannot lawfully be
          excluded — including liability for death or personal injury caused by
          negligence, or for fraud.
        </p>
      </>
    ),
  },
  {
    id: "termination",
    heading: "Termination",
    body: (
      <p>
        You may delete your account at any time from Settings. We may suspend or
        terminate an account that breaches these terms, or where required by law.
        On termination we delete your buildings, plans and codes as described in
        the{" "}
        <Link
          to="/privacy"
          className="font-semibold text-brand-text underline underline-offset-4"
        >
          Privacy Policy
        </Link>
        . Any QR codes already printed will stop resolving.
      </p>
    ),
  },
  {
    id: "changes",
    heading: "Changes",
    body: (
      <p>
        We may update these terms. The date at the top of this page shows the
        current version, and we will notify account holders by email before a
        material change takes effect. Continuing to use AlertUp after that means
        you accept the updated terms.
      </p>
    ),
  },
];

const Terms = () => (
  <>
    <Seo
      title="Terms of Service"
      description="The terms governing use of AlertUp, including what the service is, what it is not, and who is responsible for the accuracy of evacuation plans."
    />
    <LegalPage
      title="Terms of Service"
      summary="AlertUp helps people find the way out. It does not replace fire safety equipment, signage or procedures — and the accuracy of your building's plans is yours to maintain."
      updated={UPDATED}
      sections={SECTIONS}
      notice={
        <>
          These terms are a starting point written in plain English. Have a
          qualified lawyer review them against the safety and liability
          regulations of your jurisdiction before relying on them commercially.
        </>
      }
    />
  </>
);

export default Terms;
