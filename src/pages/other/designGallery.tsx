import { useState, type ReactNode } from "react";
import {
  Button,
  TextField,
  SearchField,
  Chip,
  Alert,
  StatRow,
  ScoreBar,
  DonutRing,
  FloorSwitcher,
  RouteStepList,
  IconTiles,
  badgeStyles,
  cardStyles,
  type BadgeTone,
} from "../../components/ui";
import {
  EvacuateIcon,
  WarningIcon,
  EmergencyExitIcon,
  AssemblyPointIcon,
  MandatoryIcon,
  FireExtinguisherIcon,
} from "../../components/ui/safetyIcons";
import {
  ScanIcon,
  RouteIcon,
  MapPinIcon,
  QrCodeIcon,
  ExitDoorIcon,
  LayersIcon,
  SearchIcon,
  BuildingIcon,
} from "../../components/ui/icons";

/* ============================================================================
   /_design — the design system, rendered.
   ----------------------------------------------------------------------------
   Not linked from the app, not in the sitemap. It exists so a change to a token
   can be judged against every component at once, instead of being noticed three
   pages later. Unlisted, not secret: nothing here touches data.
   ========================================================================= */

const GallerySection = ({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ReactNode;
}) => (
  <section className="border-t border-line py-10">
    <h2 className="text-2xl text-ink">{title}</h2>
    {note ? (
      <p className="mt-1 max-w-[--measure-text] text-sm text-ink-muted">{note}</p>
    ) : null}
    <div className="mt-6">{children}</div>
  </section>
);

const Swatch = ({ token, label }: { token: string; label: string }) => (
  <div className="flex flex-col gap-1.5">
    <div
      className="h-14 w-full rounded-md border border-line"
      style={{ background: `var(${token})` }}
    />
    <code className="text-xs text-ink-muted">{label}</code>
  </div>
);

const SLATE = [
  "--slate-0", "--slate-50", "--slate-100", "--slate-200", "--slate-300",
  "--slate-400", "--slate-500", "--slate-600", "--slate-700", "--slate-800",
  "--slate-900", "--slate-950",
];
const BRAND = [
  "--brand-50", "--brand-100", "--brand-200", "--brand-300", "--brand-400",
  "--brand-500", "--brand-600", "--brand-700", "--brand-800", "--brand-900",
];
const TONES: BadgeTone[] = ["neutral", "brand", "safe", "alarm", "destructive"];

const VENUES = ["Malls", "Hospitals", "Airports", "Campuses", "Offices", "Stadiums"];

const STEPS = [
  { id: "1", instruction: "Walk to the end of the corridor", icon: <RouteIcon size={18} />, distance: "20 m", floor: "2" },
  { id: "2", instruction: "Take the lift to floor 3", icon: <LayersIcon size={18} />, floor: "3" },
  { id: "3", instruction: "Turn right — the pharmacy is on your left", icon: <MapPinIcon size={18} />, distance: "8 m", floor: "3" },
];

const TILES = [
  { id: "shops", label: "Find a shop", icon: <SearchIcon size={24} /> },
  { id: "exits", label: "Exits", icon: <ExitDoorIcon size={24} /> },
  { id: "lifts", label: "Lifts", icon: <LayersIcon size={24} /> },
  { id: "rooms", label: "Toilets", icon: <BuildingIcon size={24} /> },
  { id: "step", label: "Step-free route", icon: <RouteIcon size={24} /> },
  { id: "ai", label: "Ask Wayfinder", icon: <ScanIcon size={24} /> },
];

const DesignGallery = () => {
  const [showError, setShowError] = useState(true);
  const [query, setQuery] = useState("");
  const [venue, setVenue] = useState<string | null>("Malls");
  const [floor, setFloor] = useState("g");

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <header>
        <h1 className="text-4xl text-ink">AlertUp design system</h1>
        <p className="mt-3 max-w-[--measure-text] text-ink-muted">
          Two registers. Deep Slate Navy and Signal Cyan carry everyday
          wayfinding; High-Vis Safety Red carries the emergency override and
          appears nowhere else — so its arrival on screen is itself the alarm.
          Toggle the theme to check both.
        </p>
      </header>

      <GallerySection
        title="Chassis"
        note="Deep Slate Navy through Clean Off-White. Carries roughly every pixel of the everyday product."
      >
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
          {SLATE.map((t) => (
            <Swatch key={t} token={t} label={t.replace("--", "")} />
          ))}
        </div>
      </GallerySection>

      <GallerySection
        title="Signal Cyan — the everyday accent"
        note="Store routes, search, turn-by-turn paths, links and focus rings. brand-600 (#0284C7) is the identity hex; brand-700 is the text/fill cut, because white on brand-600 is 4.10:1 and fails AA."
      >
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">
          {BRAND.map((t) => (
            <Swatch key={t} token={t} label={t.replace("--", "")} />
          ))}
        </div>
      </GallerySection>

      <GallerySection
        title="Emergency register"
        note="ISO 3864 meanings, so the phone matches the signage on the wall. These appear nowhere in the everyday product. Note warning takes a black label — white on safety yellow is 1.98:1."
      >
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-md bg-danger p-4 text-sm font-semibold text-danger-ink">
            Critical · evacuate
          </div>
          <div className="rounded-md bg-success p-4 text-sm font-semibold text-success-ink">
            Safe · route · exit
          </div>
          <div className="rounded-md bg-warning p-4 text-sm font-semibold text-warning-ink">
            Warning · prepare
          </div>
          <div className="rounded-md bg-info p-4 text-sm font-semibold text-info-ink">
            Mandatory · instruction
          </div>
        </div>
      </GallerySection>

      <GallerySection
        title="Type scale"
        note="Three weights only: 400 body, 500 UI, 600 headings. An audit found 121 uses of semibold against 64 of medium — when everything is emphasised, nothing is."
      >
        <div className="flex flex-col gap-4">
          <p className="text-5xl text-ink" style={{ fontWeight: "var(--weight-heading)" }}>
            Navigate everyday
          </p>
          <p className="text-3xl text-ink" style={{ fontWeight: "var(--weight-heading)" }}>
            Evacuate instantly
          </p>
          <p className="text-xl text-ink">Smart wayfinding for safer spaces</p>
          <p className="max-w-[--measure-prose] text-base text-ink-muted">
            Body copy sits at 16px with 1.55 leading and is capped at 68
            characters. The single most common responsive failure is scaling
            images and navigation carefully while letting body text run edge to
            edge — so the measure is capped in ch, not px, and scales with the
            font size instead of fighting it.
          </p>
          <p className="text-sm text-ink-muted">Secondary text at 14px.</p>
          <p className="text-xs text-ink-subtle">Labels and captions at 12px — the floor.</p>
          <p className="max-w-[--measure-prose] text-base text-ink-muted" lang="ka">
            ქართული ტექსტი — ნოტო სანს ჯორჯიან, ნამდვილი მსუქანი შრიფტით.
            <strong> ეს მსუქანია.</strong>
          </p>
        </div>
      </GallerySection>

      <GallerySection
        title="Buttons"
        note="Pill on primary and mobile CTAs; the tighter radius on secondary controls inside forms and tables. Emergency is amber and always full width."
      >
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="subtle">Subtle</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="safe">Start evacuation route</Button>
          <Button variant="destructive">Delete building</Button>
          <Button variant="link">Link</Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
          <Button variant="primary" loading>
            Loading
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button size="sm">Small 36px</Button>
          <Button size="md">Medium 44px</Button>
          <Button size="lg">Large 52px</Button>
          <Button size="icon" aria-label="Scan">
            <ScanIcon size={18} />
          </Button>
        </div>
        <div className="mt-6 max-w-md">
          <Button variant="emergency" size="lg">
            <EvacuateIcon title="" size={20} />
            Evacuate now
          </Button>
        </div>
      </GallerySection>

      <GallerySection
        title="Inputs"
        note="Label always visible, never a placeholder standing in for one. Errors sit next to the field and carry an icon, because a red message with no shape does not read as an error to a lot of people."
      >
        <div className="grid max-w-xl gap-5">
          <TextField label="Building name" name="g-name" placeholder="e.g. Tbilisi Mall" />
          <TextField
            label="Email"
            name="g-email"
            hint="Hint text sits under the label, above the control."
            error={showError ? "Enter a valid email address" : undefined}
          />
          <TextField label="Read only" name="g-ro" readOnly value="Cannot be edited" />
          <TextField label="Disabled" name="g-dis" disabled placeholder="Unavailable" />
          <Button variant="secondary" size="sm" onClick={() => setShowError((v) => !v)}>
            Toggle error state
          </Button>
        </div>
      </GallerySection>

      <GallerySection title="Alerts">
        <div className="grid gap-3">
          <Alert tone="info">Informational message.</Alert>
          <Alert tone="success">Something completed.</Alert>
          <Alert tone="warning">Something needs attention.</Alert>
          <Alert tone="danger">Something failed.</Alert>
        </div>
      </GallerySection>

      <GallerySection title="Badges">
        <div className="flex flex-wrap gap-2">
          {TONES.map((tone) => (
            <span key={tone} className={badgeStyles({ tone })}>
              {tone}
            </span>
          ))}
        </div>
      </GallerySection>

      <GallerySection title="Cards">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className={cardStyles({ className: "p-6" })}>
            <h3 className="text-ink">Static card</h3>
            <p className="mt-1 text-sm text-ink-muted">
              A hairline border carries the structure; the shadow only whispers.
            </p>
          </div>
          <div className={cardStyles({ interactive: true, className: "p-6" })}>
            <h3 className="text-ink">Interactive card</h3>
            <p className="mt-1 text-sm text-ink-muted">
              Lifts on hover and on focus-within, so keyboard users get it too.
            </p>
          </div>
        </div>
      </GallerySection>

      <GallerySection
        title="Search field"
        note="The single most important control in the product. 56px, 18px text, pill. Keyboard-navigable suggestions — arrow keys and Enter, Escape to dismiss."
      >
        <div className="max-w-xl">
          <SearchField
            label="Search this building"
            placeholder="Shop, service, or room…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onClear={() => setQuery("")}
            suggestions={
              query
                ? [
                    { id: "1", label: "Pharmacy", detail: "Floor 2 · Health" },
                    { id: "2", label: "Parking — Level B1", detail: "Basement" },
                  ]
                : []
            }
          />
        </div>
      </GallerySection>

      <GallerySection title="Chips" note="Selectable pills. Real buttons with aria-pressed, not divs with onClick.">
        <div className="flex flex-wrap gap-2">
          {VENUES.map((v) => (
            <Chip
              key={v}
              selected={venue === v}
              onClick={() => setVenue(venue === v ? null : v)}
            >
              {v}
            </Chip>
          ))}
        </div>
      </GallerySection>

      <GallerySection title="Stats and data" note="Numbers in the display serif with tabular figures, so a count-up cannot change the element width mid-count.">
        <StatRow
          stats={[
            { value: "< 10s", caption: "To first route" },
            { value: "[[SCANS]]", caption: "Scans per month" },
            { value: "100%", caption: "Works without an app" },
          ]}
        />
        <div className="mt-10 grid gap-10 sm:grid-cols-2">
          <ScoreBar grade="B" label="Routable coverage" />
          <DonutRing value={72} label="Routes completed" caption="Routes completed" delta="+6 this week" />
        </div>
      </GallerySection>

      <GallerySection title="Wayfinding" note="Floor switcher is vertical because floors are — the control is a small picture of the building.">
        <div className="flex flex-wrap items-start gap-10">
          <FloorSwitcher
            floors={[
              { id: "b1", label: "B1" },
              { id: "g", label: "G" },
              { id: "1", label: "1" },
              { id: "2", label: "2" },
            ]}
            current={floor}
            onChange={setFloor}
          />
          <div className="min-w-[280px] flex-1">
            <RouteStepList steps={STEPS} currentIndex={1} />
          </div>
        </div>
      </GallerySection>

      <GallerySection title="Icon tiles" note="The visitor home. 88px targets, because this is the second of the two taps between scanning a code and seeing an exit.">
        <div className="max-w-sm">
          <IconTiles tiles={TILES} />
        </div>
      </GallerySection>

      <GallerySection
        title="Icon registers"
        note="These two sets never appear in the same component. An ISO 7010 running-man in a settings menu dilutes the signal; a generic triangle in an evacuation banner fails ISO 23601."
      >
        <div className="grid gap-8 sm:grid-cols-2">
          <div>
            <h3 className="text-sm font-medium text-ink">EMERGENCY — ISO 7010</h3>
            <p className="mt-1 text-xs text-ink-subtle">
              Geometry carries severity: octagon critical, triangle warning,
              rectangle safe, circle mandatory.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-5">
              <span className="text-danger">
                <EvacuateIcon title="Evacuate" size={36} />
              </span>
              <span className="text-warning">
                <WarningIcon title="Warning" size={36} />
              </span>
              <span className="text-success">
                <EmergencyExitIcon title="Emergency exit" size={36} />
              </span>
              <span className="text-success">
                <AssemblyPointIcon title="Assembly point" size={36} />
              </span>
              <span className="text-info">
                <MandatoryIcon title="Mandatory" size={36} />
              </span>
              <span className="text-danger">
                <FireExtinguisherIcon title="Fire extinguisher" size={36} />
              </span>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-medium text-ink">EVERYDAY — product UI</h3>
            <p className="mt-1 text-xs text-ink-subtle">
              57 icons in components/ui/icons.tsx — 24px grid, 1.75 stroke,
              currentColor.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-5 text-ink">
              <ScanIcon size={32} />
              <RouteIcon size={32} />
              <MapPinIcon size={32} />
              <QrCodeIcon size={32} />
            </div>
          </div>
        </div>
      </GallerySection>
    </main>
  );
};

export default DesignGallery;
