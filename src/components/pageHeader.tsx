import { Link } from "react-router-dom";
import { ArrowLeftIcon } from "./ui/icons";

/**
 * Legacy centered page header, restyled on the token system. New screens
 * should prefer PageHeader from ui/layout; this stays for pages that need the
 * centered title + back-arrow arrangement.
 */
const PageHeader = ({ title = "", backIcon = true }) => (
  <header className="relative flex w-full items-center justify-center px-14 py-3">
    {backIcon && (
      <Link
        to="/"
        aria-label="Back to home"
        className="absolute left-2 grid h-11 w-11 place-items-center rounded-full text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <ArrowLeftIcon size={22} />
      </Link>
    )}
    <h1 className="text-center text-2xl font-semibold text-ink md:text-3xl">
      {title}
    </h1>
  </header>
);

export default PageHeader;
