import { cn } from '../../lib/cn';
import { useI18n } from '../../i18n/LanguageProvider';
import type { MapViewMode } from './viewPreference';

/* ============================================================================
   MapViewToggle — the 2D/3D pill, identical on every map surface.
   ----------------------------------------------------------------------------
   Mirrors the scan page's list|map radiogroup pattern. Render it only when
   WebGL support was probed true — an option that can't work is not an option.
   ========================================================================= */

export interface MapViewToggleProps {
  mode: MapViewMode;
  onChange: (mode: MapViewMode) => void;
  className?: string;
}

export const MapViewToggle = ({ mode, onChange, className }: MapViewToggleProps) => {
  const { t } = useI18n();
  const options: Array<{ id: MapViewMode; label: string }> = [
    { id: '2d', label: t('map.view2d') },
    { id: '3d', label: t('map.view3d') },
  ];
  return (
    <div
      role="radiogroup"
      aria-label={t('map.viewToggle')}
      className={cn(
        'inline-flex rounded-full border border-line bg-surface p-0.5 shadow-sm',
        className,
      )}
    >
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={mode === option.id}
          onClick={() => onChange(option.id)}
          className={cn(
            'min-w-11 rounded-full px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
            mode === option.id
              ? 'bg-brand text-brand-ink'
              : 'text-ink-muted hover:text-ink',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};

export default MapViewToggle;
