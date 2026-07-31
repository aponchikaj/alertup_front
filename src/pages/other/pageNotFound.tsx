import { usePageAnimations } from "../../lib/animations";
import { ButtonLink } from "../../components/ui/button";
import { ArrowLeftIcon, MapPinIcon } from "../../components/ui/icons";
import { useI18n } from "../../i18n/LanguageProvider";

const PageNotFound = () => {
  const rootRef = usePageAnimations();
  const { t } = useI18n();

  return (
    <div ref={rootRef}>
      <section className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-canvas px-4 pb-16 pt-28 sm:pt-32">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/3 h-[24rem] w-[24rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/10 blur-3xl"
        />

        <div className="relative flex flex-col items-center gap-5 text-center">
          <span
            data-hero
            className="grid h-16 w-16 place-items-center rounded-2xl bg-brand-subtle text-brand-text"
          >
            <MapPinIcon size={32} />
          </span>

          <h1
            data-hero
            className="font-display text-7xl font-semibold leading-none tracking-tight sm:text-8xl"
          >
            <span className="text-gradient-brand">404</span>
          </h1>

          <div data-hero className="flex flex-col gap-2">
            <p className="text-2xl font-semibold text-ink sm:text-3xl">
              {t("notFound.title")}
            </p>
            <p className="max-w-md text-sm text-ink-muted sm:text-base">
              {t("notFound.lead")}
            </p>
          </div>

          <div data-hero className="mt-2">
            <ButtonLink to="/" size="lg">
              <ArrowLeftIcon size={18} />
              {t("notFound.goHome")}
            </ButtonLink>
          </div>
        </div>
      </section>
    </div>
  );
};

export default PageNotFound;
