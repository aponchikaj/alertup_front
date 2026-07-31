import { Link } from "react-router-dom";
import { Seo } from "../../seo";
import { LegalList, LegalPage, Term, type LegalSection } from "./legalLayout";

const UPDATED = "2026-07-31";

const SECTIONS: LegalSection[] = [
  {
    id: "commitment",
    heading: "Our commitment",
    body: (
      <>
        <p>
          AlertUp exists to help people leave a building safely. If the interface
          excludes someone, it has failed at the only job it has. We aim to meet{" "}
          <Term>WCAG 2.1 Level AA</Term> across the site.
        </p>
        <p>
          This matters more here than on an ordinary website: the people least
          able to evacuate unaided are often the same people most affected by an
          inaccessible interface.
        </p>
      </>
    ),
  },
  {
    id: "what-we-do",
    heading: "What we've built in",
    body: (
      <LegalList
        items={[
          <>
            <Term>Contrast.</Term> Every text and background pairing in both the
            light and dark themes is checked to at least 4.5:1 for body text and
            3:1 for large text and interface glyphs.
          </>,
          <>
            <Term>Colour is never the only signal.</Term> Status messages carry an
            icon and wording as well as a colour, so they survive colour blindness
            and greyscale printing.
          </>,
          <>
            <Term>Keyboard access.</Term> Everything interactive is reachable and
            operable by keyboard, with a visible focus ring that is never removed.
            A "Skip to content" link lets you jump the navigation.
          </>,
          <>
            <Term>Touch targets.</Term> Interactive controls are at least 44×44
            pixels with spacing between them.
          </>,
          <>
            <Term>Screen readers.</Term> Form fields have real labels, errors are
            announced when they appear, icon-only buttons have accessible names,
            and headings follow a logical order.
          </>,
          <>
            <Term>Reduced motion.</Term> If your system asks for reduced motion,
            animations and smooth scrolling are switched off site-wide.
          </>,
          <>
            <Term>Text scaling.</Term> Layouts use relative units, so enlarging
            text in your browser or operating system reflows the page instead of
            clipping it.
          </>,
          <>
            <Term>Light and dark themes.</Term> Both are designed and tested
            separately rather than one being derived from the other.
          </>,
        ]}
      />
    ),
  },
  {
    id: "known-issues",
    heading: "Known limitations",
    body: (
      <>
        <p>We would rather list these than pretend they don't exist:</p>
        <LegalList
          items={[
            <>
              <Term>Floor plan maps.</Term> Evacuation routes are inherently
              visual. We provide text descriptions of the route steps alongside
              the map, but a complex floor plan is still difficult to convey
              without sight.
            </>,
            <>
              <Term>The QR scanner.</Term> Aiming a camera at a code requires
              vision and a steady hand. Anyone unable to use it can open the route
              link directly instead — the printed code's URL works as a plain
              link.
            </>,
            <>
              <Term>Uploaded content.</Term> We cannot control the legibility of
              plans that building owners upload. If a plan is unclear, tell us and
              we will contact the owner.
            </>,
          ]}
        />
      </>
    ),
  },
  {
    id: "if-you-cant-use-it",
    heading: "If you can't use part of the site",
    body: (
      <p>
        Contact us and we will help directly — including reading out or
        describing a specific building's evacuation route if you need it. We treat
        accessibility reports as bugs, not as feature requests.
      </p>
    ),
  },
  {
    id: "feedback",
    heading: "Feedback",
    body: (
      <>
        <p>
          Tell us what isn't working. Use the{" "}
          <Link
            to="/contact"
            className="font-semibold text-brand-text underline underline-offset-4"
          >
            contact form
          </Link>{" "}
          with "Accessibility" as the reason, and include the page, what you were
          trying to do, and the assistive technology you use if relevant.
        </p>
        <p>
          We aim to acknowledge accessibility reports within five working days.
        </p>
      </>
    ),
  },
];

const Accessibility = () => (
  <>
    <Seo
      title="Accessibility Statement"
      description="AlertUp's accessibility commitments, the WCAG 2.1 AA measures built into the interface, and the limitations we know about."
    />
    <LegalPage
      title="Accessibility"
      summary="The people least able to evacuate unaided are often the same people an inaccessible interface shuts out. Here's what we've done, and what still needs work."
      updated={UPDATED}
      sections={SECTIONS}
    />
  </>
);

export default Accessibility;
