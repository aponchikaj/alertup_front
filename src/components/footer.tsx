import { Link } from "react-router-dom";
import { Container } from "./ui/layout";
import { Logo } from "./ui/logo";
import Sponsors from "./sponsors";

const LINK_GROUPS: { heading: string; links: { to: string; label: string }[] }[] = [
  {
    heading: "Product",
    links: [
      { to: "/", label: "Home" },
      { to: "/scan", label: "Scan a code" },
      { to: "/new", label: "Add a building" },
      { to: "/mybuildings", label: "My buildings" },
    ],
  },
  {
    heading: "Support",
    links: [
      { to: "/contact", label: "Contact us" },
      { to: "/security", label: "Security" },
      { to: "/accessibility", label: "Accessibility" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { to: "/privacy", label: "Privacy Policy" },
      { to: "/terms", label: "Terms of Service" },
      { to: "/cookies", label: "Cookie Policy" },
    ],
  },
];

const footerLinkClass =
  "inline-block py-1.5 text-sm text-ink-muted transition-colors hover:text-brand-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring rounded-sm";

const Footer = () => (
  <footer className="border-t border-line bg-canvas-subtle">
    <Container className="py-14">
      <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="flex flex-col gap-4">
          <Logo size={34} />
          <p className="max-w-xs text-sm leading-relaxed text-ink-muted">
            AlertUp turns a printed QR code into a guided way out. Scan it and
            the safest route to the nearest exit is already on screen.
          </p>
          <Sponsors />
        </div>

        {LINK_GROUPS.map((group) => (
          <nav key={group.heading} aria-label={group.heading}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink">
              {group.heading}
            </h2>
            <ul>
              {group.links.map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className={footerLinkClass}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="mt-12 flex flex-col gap-4 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink-subtle">
          AlertUp © {new Date().getFullYear()}. Built in Tbilisi, Georgia.
        </p>
        <p className="max-w-md text-xs leading-relaxed text-ink-subtle">
          AlertUp supplements — it does not replace — the fire safety equipment,
          signage and procedures required at your location. In an emergency,
          always follow instructions from emergency services.
        </p>
      </div>
    </Container>
  </footer>
);

export default Footer;
