import { useEffect, type ReactNode } from 'react';
import { MapIcon, MaximizeIcon, PenIcon, RouteIcon } from '../../../components/ui/Icons';
import { cn } from '../../../lib/cn';
import type { EditorMode } from './editorConstants';

/**
 * Draw / Nodes / Floor mode switch.
 *
 * A segmented control rather than checkboxes: the modes are peers and
 * mutually exclusive, and the user needs to see which one they are in
 * without reading a label.
 */
const MODE_ORDER: { mode: EditorMode; labelKey: string; Icon: typeof MapIcon }[] = [
  { mode: 'draw', labelKey: 'mapEditor.modeDraw', Icon: PenIcon },
  { mode: 'nodes', labelKey: 'mapEditor.modeNodes', Icon: RouteIcon },
  { mode: 'floor', labelKey: 'mapEditor.modeFloor', Icon: MaximizeIcon },
];

export const ModeSwitch = ({
  mode,
  onChange,
  t,
}: {
  mode: EditorMode;
  onChange: (mode: EditorMode) => void;
  t: (key: string) => string;
}) => (
  <div
    role="radiogroup"
    aria-label={t('mapEditor.mode')}
    className="inline-flex rounded-full border border-line bg-surface-2 p-0.5"
  >
    {MODE_ORDER.map(({ mode: value, labelKey, Icon }) => {
      const active = mode === value;
      return (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={active}
          onClick={() => onChange(value)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium',
            'transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
            active
              ? 'bg-surface text-ink shadow-sm'
              : 'text-ink-muted hover:text-ink',
          )}
        >
          <Icon size={15} />
          {t(labelKey)}
        </button>
      );
    })}
  </div>
);

/** Compact floor picker for fullscreen, where the floors panel is not on screen. */
export const FloorSwitcherStrip = ({
  floors,
  activeFloorId,
  onSelect,
  t,
}: {
  floors: { id: string; name: string | null; floorNumber: number }[];
  activeFloorId: string | null;
  onSelect: (floorId: string) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) => {
  if (floors.length === 0) return null;
  return (
    <div
      role="radiogroup"
      aria-label={t('mapEditor.floors')}
      className="flex flex-wrap items-center gap-1.5"
    >
      {floors.map((floor) => {
        const active = floor.id === activeFloorId;
        return (
          <button
            key={floor.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onSelect(floor.id)}
            className={cn(
              'rounded-lg border px-2.5 py-1.5 text-xs font-medium',
              'transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              active
                ? 'border-line-strong bg-surface-2 text-ink'
                : 'border-line text-ink-muted hover:bg-surface-hover hover:text-ink',
            )}
          >
            {floor.name || t('wayfinding.floorShort', { number: floor.floorNumber })}
          </button>
        );
      })}
    </div>
  );
};

/**
 * Fullscreen workspace: the canvas fills the viewport, and the toolbar floats
 * over it as a bar rather than pushing it down. Body scroll is locked, because
 * a page that scrolls behind a fixed overlay is how you lose your place.
 */
export const FullscreenEditor = ({
  toolbar,
  canvas,
  inspector,
  floors,
  title,
}: {
  toolbar: ReactNode;
  canvas: ReactNode;
  inspector: ReactNode;
  floors: ReactNode;
  title: string;
}) => {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-canvas" role="region" aria-label={title}>
      <div className="flex flex-col gap-2 border-b border-line bg-surface px-4 py-3">
        {toolbar}
      </div>

      <div className="relative min-h-0 flex-1 p-3">
        <div className="h-full [&>*]:h-full">{canvas}</div>

        {/* Floor picker floats bottom-left; the inspector floats right. Both
            sit over the canvas so it keeps the full width underneath. */}
        <div className="pointer-events-none absolute inset-x-3 bottom-3 flex justify-start sm:inset-x-6 sm:bottom-6">
          <div className="pointer-events-auto rounded-xl border border-line bg-surface/95 p-2 shadow-lg backdrop-blur">
            {floors}
          </div>
        </div>

        {inspector && (
          <aside className="absolute right-3 top-3 max-h-[calc(100%-1.5rem)] w-[min(20rem,calc(100vw-1.5rem))] overflow-y-auto rounded-2xl border border-line bg-surface/95 p-4 shadow-xl backdrop-blur sm:right-6 sm:top-6 sm:max-h-[calc(100%-3rem)]">
            {inspector}
          </aside>
        )}
      </div>
    </div>
  );
};
