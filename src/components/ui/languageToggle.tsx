import { cn } from "../../lib/cn";
import { useI18n } from "../../i18n/LanguageProvider";

/**
 * Compact EN ⇄ ქა switch for the header. Shows the language you'll switch TO,
 * mirroring the theme toggle's "label states the outcome" pattern.
 */
export const LanguageToggle = ({ className }: { className?: string }) => {
  const { lang, setLang, t } = useI18n();
  const next = lang === "en" ? "ka" : "en";

  return (
    <button
      type="button"
      onClick={() => setLang(next)}
      aria-label={t("nav.switchLanguage")}
      title={t("nav.switchLanguage")}
      className={cn(
        "grid h-10 w-10 place-items-center rounded-full",
        "border border-line bg-surface text-xs font-bold uppercase text-ink-muted",
        "transition-colors duration-200 ease-out",
        "hover:bg-surface-hover hover:text-ink",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        className,
      )}
    >
      {next === "ka" ? "ქა" : "EN"}
    </button>
  );
};

export default LanguageToggle;
