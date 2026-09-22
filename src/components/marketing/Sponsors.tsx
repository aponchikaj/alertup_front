import { cn } from "../../lib/cn";
import { useI18n } from "../../i18n/LanguageProvider";
import IllusionImage from "../../assets/images/sponsors/illusion.png";

const SPONSORS = [
  {
    to: "https://iluzia.vercel.app/",
    image: IllusionImage,
    name: "Illusion",
  },
];

/** `align="center"` for centered marketing sections; default start for the footer. */
const Sponsors = ({ align = "start" }: { align?: "start" | "center" }) => {
  const { t } = useI18n();

  return (
  <section
    className={cn(
      "flex flex-col gap-2.5",
      align === "center" && "items-center text-center",
    )}
  >
    <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-subtle">
      {t("sponsors.trustedBy")}
    </h2>
    <ul className="flex flex-wrap items-center justify-center gap-3">
      {SPONSORS.map((sponsor) => (
        <li key={sponsor.name}>
          <a
            href={sponsor.to}
            target="_blank"
            rel="noopener noreferrer"
            title={sponsor.name}
            className="grid h-12 w-12 place-items-center rounded-xl border border-line bg-surface p-2 transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-brand-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <img
              src={sponsor.image}
              alt={sponsor.name}
              width={32}
              height={32}
              loading="lazy"
              decoding="async"
              className="h-8 w-8 object-contain"
            />
          </a>
        </li>
      ))}
    </ul>
  </section>
  );
};

export default Sponsors;
