import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "../../lib/cn";
import { Container } from "../../components/ui/layout";
import { Alert } from "../../components/ui/feedback";
import { ArrowLeftIcon, FileTextIcon } from "../../components/ui/icons";

export interface LegalSection {
  id: string;
  heading: string;
  body: ReactNode;
}

interface LegalPageProps {
  title: string;
  /** One sentence a reader can stop at if they read nothing else. */
  summary: string;
  updated: string;
  sections: LegalSection[];
  /** Rendered above the first section — used for the "not legal advice" note. */
  notice?: ReactNode;
}

/**
 * Shared chrome for the policy pages: measure-limited prose, a sticky table of
 * contents that tracks the reader's position, and consistent section anchors so
 * a specific clause can be linked to directly.
 */
export const LegalPage = ({
  title,
  summary,
  updated,
  sections,
  notice,
}: LegalPageProps) => {
  const [activeId, setActiveId] = useState(sections[0]?.id ?? "");

  useEffect(() => {
    const headings = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => Boolean(el));

    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActiveId(visible.target.id);
      },
      // Top band only: a heading counts as "current" once it reaches the
      // upper third, which matches where a reader's eye actually is.
      { rootMargin: "-88px 0px -66% 0px", threshold: 0 },
    );

    headings.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sections]);

  return (
    <main id="main" className="bg-canvas pb-24 pt-28 sm:pt-32">
      <Container width="wide">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-ink-muted transition-colors hover:text-brand-text"
        >
          <ArrowLeftIcon size={16} />
          Back to home
        </Link>

        <header className="mt-6 flex flex-col gap-4 border-b border-line pb-10">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-brand-border bg-brand-subtle px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-brand-text">
            <FileTextIcon size={14} />
            Legal
          </span>
          <h1 className="text-4xl font-semibold text-ink sm:text-5xl">{title}</h1>
          <p className="max-w-2xl text-lg leading-relaxed text-ink-muted">{summary}</p>
          <p className="text-sm text-ink-subtle">
            Last updated{" "}
            <time dateTime={updated}>
              {new Date(updated).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </time>
          </p>
        </header>

        <div className="mt-12 grid gap-12 lg:grid-cols-[16rem_1fr] lg:gap-16">
          {/* Table of contents */}
          <nav aria-label="On this page" className="lg:sticky lg:top-28 lg:self-start">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-ink-subtle">
              On this page
            </h2>
            <ul className="flex flex-col gap-0.5 border-l border-line">
              {sections.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    aria-current={activeId === section.id ? "true" : undefined}
                    className={cn(
                      "-ml-px block border-l-2 py-2 pl-4 text-sm transition-colors",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                      activeId === section.id
                        ? "border-brand font-semibold text-brand-text"
                        : "border-transparent text-ink-muted hover:border-line-strong hover:text-ink",
                    )}
                  >
                    {section.heading}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* Body */}
          <div className="min-w-0 max-w-2xl">
            {notice && (
              <Alert tone="info" className="mb-10">
                {notice}
              </Alert>
            )}

            <div className="flex flex-col gap-12">
              {sections.map((section, i) => (
                <section
                  key={section.id}
                  aria-labelledby={section.id}
                  className="scroll-mt-28"
                >
                  <h2
                    id={section.id}
                    className="scroll-mt-28 text-xl font-semibold text-ink sm:text-2xl"
                  >
                    <span className="mr-2 text-ink-subtle tabular-nums">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {section.heading}
                  </h2>
                  <div className="legal-prose mt-4 flex flex-col gap-4 text-[0.9375rem] leading-relaxed text-ink-muted">
                    {section.body}
                  </div>
                </section>
              ))}
            </div>

            <footer className="mt-16 rounded-2xl border border-line bg-surface-2 p-6">
              <h2 className="text-base font-semibold text-ink">
                Questions about this policy?
              </h2>
              <p className="mt-1.5 text-sm text-ink-muted">
                Send us a message and we'll answer by email.
              </p>
              <Link
                to="/contact"
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brand-text underline underline-offset-4 hover:decoration-2"
              >
                Contact us
              </Link>
            </footer>
          </div>
        </div>
      </Container>
    </main>
  );
};

/* --- Small prose helpers, so the policy files stay readable ---------------- */

export const LegalList = ({ items }: { items: ReactNode[] }) => (
  <ul className="flex list-disc flex-col gap-2 pl-5 marker:text-brand">
    {items.map((item, i) => (
      <li key={i} className="pl-1">
        {item}
      </li>
    ))}
  </ul>
);

export const Term = ({ children }: { children: ReactNode }) => (
  <strong className="font-semibold text-ink">{children}</strong>
);

export default LegalPage;
