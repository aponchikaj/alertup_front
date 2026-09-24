import { useState, type ReactNode } from 'react';
import { Alert, Badge } from '../../../components/ui/feedback';
import { Button } from '../../../components/ui/button';
import { ConfirmDialog } from '../../../components/ui/confirmDialog';
import { TextField } from '../../../components/ui/field';
import { Select } from '../../../components/ui/select';
import { PlusIcon, TrashIcon } from '../../../components/ui/icons';
import { useI18n } from '../../../i18n/LanguageProvider';
import type { Closure } from '../../../apis/mapEditorApi';

/* ============================================================================
   ClosuresPanel — "this corridor is shut" without a command line.
   ----------------------------------------------------------------------------
   Two decisions here are load-bearing rather than cosmetic:

   * `costMultiplier: null` is the wire's BLOCKED sentinel. A form that
     defaulted to it would publish hard blocks for people who never looked at
     the control, so the effect radiogroup starts with NOTHING chosen and save
     stays disabled until someone picks. "Slow down" is the same choice said
     out loud, with the penalty attached.
   * The API client has no `updateClosure`, so a closure is create-or-delete.
     The list therefore offers no edit affordance at all — better than an edit
     button that cannot work.

   Picking which connections a closure covers is a map gesture, owned by the
   page: this panel only reports the running count (in a live region, because
   the change happens somewhere else on screen) and hands back the rest.
   ========================================================================= */

/** Preset closure lengths, in hours. `custom` opens a datetime-local instead. */
const HOUR_PRESETS = [1, 2, 4] as const;

const HOUR_MS = 60 * 60 * 1000;

/** Slow-down penalties offered for a non-blocking closure. All >= 1, which is
 *  what the backend requires of a non-null `costMultiplier`. */
const SLOW_FACTORS = ['1.5', '2', '3', '4'] as const;

/** `datetime-local` wants a LOCAL wall-clock string, not an ISO instant. */
const toDateTimeLocal = (ms: number): string => {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
};

type DurationChoice = '1' | '2' | '4' | 'custom';
type EffectChoice = 'blocked' | 'slowed';

export interface ClosureDraftInput {
  reason: string;
  /** ISO 8601, or null for open-ended. */
  endsAt: string | null;
  /** `null` = blocked outright; a number >= 1 = a routing penalty. */
  costMultiplier: number | null;
}

export interface ClosuresPanelProps {
  closures: Closure[];
  /** Suppresses the empty state until the first fetch settles. */
  loading?: boolean;
  /** The edges picked so far, or null when no draft is open. */
  draftEdgeIds: readonly string[] | null;
  onStartDraft: () => void;
  onCancelDraft: () => void;
  /**
   * Resolves true when the closure was actually created. A false (or a
   * rejection) leaves the form exactly as the operator left it — the picked
   * edges survive upstream, so clearing the reason here would produce a
   * half-filled draft that looks empty.
   */
  onCreate: (input: ClosureDraftInput) => Promise<boolean>;
  onDelete: (closureId: string) => Promise<void>;
}

/** One native radio wearing the panel's skin — native so it keeps arrow-key
 *  navigation and the radiogroup semantics for free. */
const Radio = ({
  name,
  label,
  checked,
  onSelect,
}: {
  name: string;
  label: string;
  checked: boolean;
  onSelect: () => void;
}) => (
  <label className="inline-flex items-center gap-2 text-sm text-ink">
    <input
      type="radio"
      name={name}
      checked={checked}
      onChange={onSelect}
      className="h-4 w-4 border-line accent-[var(--brand)]"
    />
    {label}
  </label>
);

const RadioGroup = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => (
  <div className="flex flex-col gap-1.5">
    <span className="text-sm font-medium text-ink">{label}</span>
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-x-4 gap-y-2">
      {children}
    </div>
  </div>
);

export const ClosuresPanel = ({
  closures,
  loading = false,
  draftEdgeIds,
  onStartDraft,
  onCancelDraft,
  onCreate,
  onDelete,
}: ClosuresPanelProps) => {
  const { t } = useI18n();

  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState<DurationChoice>('1');
  const [customEndsAt, setCustomEndsAt] = useState('');
  // No default: blocking a corridor must be something the operator chose.
  const [effect, setEffect] = useState<EffectChoice | null>(null);
  const [slowFactor, setSlowFactor] = useState<string>('2');
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const drafting = draftEdgeIds !== null;
  const selectedCount = draftEdgeIds?.length ?? 0;

  /**
   * The draft's end instant, resolved at the moment it is asked for.
   *
   * Deliberately a function rather than a render-time constant: a "1 h"
   * closure has to end an hour after the operator pressed Save, not an hour
   * after whatever keystroke happened to cause the last render.
   */
  const endsAt = (at: number): Date | null => {
    const parsed =
      duration === 'custom'
        ? new Date(customEndsAt)
        : new Date(at + Number(duration) * HOUR_MS);
    // A closure that has already expired is not a closure. The custom field
    // also carries a `min`, but that is advisory in a lot of browsers.
    if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= at) return null;
    return parsed;
  };

  const canSave =
    reason.trim() !== '' &&
    selectedCount > 0 &&
    effect !== null &&
    endsAt(Date.now()) !== null &&
    !saving;

  const resetDraft = () => {
    setReason('');
    setDuration('1');
    setCustomEndsAt('');
    setEffect(null);
    setSlowFactor('2');
  };

  const submit = async () => {
    if (!canSave || effect === null) return;
    const ends = endsAt(Date.now());
    if (ends === null) return;

    setSaving(true);
    let created = false;
    try {
      created = await onCreate({
        reason: reason.trim(),
        endsAt: ends.toISOString(),
        costMultiplier: effect === 'blocked' ? null : Number(slowFactor),
      });
    } catch {
      // Reported upstream (the page toasts it); here it just means "not saved".
      created = false;
    } finally {
      setSaving(false);
    }
    if (created) resetDraft();
  };

  const countLabel = (count: number) =>
    t('mapEditor.closureSelectedCount', { count });

  return (
    <section
      aria-labelledby="map-editor-closures-heading"
      className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h2
          id="map-editor-closures-heading"
          className="text-sm font-semibold uppercase tracking-wide text-ink-muted"
        >
          {t('mapEditor.closures')}
        </h2>
        {!drafting && (
          <Button variant="ghost" size="sm" onClick={onStartDraft}>
            <PlusIcon size={16} />
            {t('mapEditor.closureAdd')}
          </Button>
        )}
      </div>

      {!drafting && !loading && closures.length === 0 && (
        <p className="text-sm text-ink-muted">{t('mapEditor.closuresEmpty')}</p>
      )}

      {closures.length > 0 && (
        <ul className="flex flex-col gap-2">
          {closures.map((closure) => (
            <li
              key={closure.id}
              className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-line bg-surface-2 p-3"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={closure.blocked ? 'danger' : 'warning'}>
                    {closure.blocked
                      ? t('mapEditor.closureBlocked')
                      : t('mapEditor.closureSlowed')}
                  </Badge>
                  {closure.reason && (
                    <span className="break-words text-sm text-ink">
                      {closure.reason}
                    </span>
                  )}
                </div>
                <span className="text-xs text-ink-subtle">
                  {countLabel(closure.edgeIds.length + closure.nodeIds.length)}
                </span>
                {closure.endsAt && (
                  <span className="text-xs text-ink-subtle">
                    {t('mapEditor.closureEndsIn', {
                      time: new Date(closure.endsAt).toLocaleString(),
                    })}
                  </span>
                )}
              </div>
              <Button
                variant="danger"
                size="sm"
                onClick={() => setPendingDelete(closure.id)}
              >
                <TrashIcon size={16} />
                {t('mapEditor.closureDelete')}
              </Button>
            </li>
          ))}
        </ul>
      )}

      {drafting && (
        <div className="flex flex-col gap-3 border-t border-line pt-3">
          <Alert tone="info">{t('mapEditor.closurePickEdges')}</Alert>

          {/* The count changes when the user taps the canvas, far from this
              panel — so it is announced rather than merely redrawn. */}
          <p aria-live="polite" className="text-sm font-medium text-ink">
            {countLabel(selectedCount)}
          </p>

          <TextField
            label={t('mapEditor.closureReason')}
            value={reason}
            maxLength={200}
            onChange={(e) => setReason(e.target.value)}
          />

          <RadioGroup label={t('mapEditor.closureDuration')}>
            {HOUR_PRESETS.map((hours) => (
              <Radio
                key={hours}
                name="closure-duration"
                label={t('mapEditor.closureHours', { hours })}
                checked={duration === String(hours)}
                onSelect={() => setDuration(String(hours) as DurationChoice)}
              />
            ))}
            <Radio
              name="closure-duration"
              label={t('mapEditor.closureCustom')}
              checked={duration === 'custom'}
              onSelect={() => setDuration('custom')}
            />
          </RadioGroup>

          {duration === 'custom' && (
            <TextField
              label={t('mapEditor.closureCustom')}
              type="datetime-local"
              min={toDateTimeLocal(Date.now())}
              value={customEndsAt}
              onChange={(e) => setCustomEndsAt(e.target.value)}
            />
          )}

          <RadioGroup label={t('mapEditor.closureEffect')}>
            <Radio
              name="closure-effect"
              label={t('mapEditor.closureBlocked')}
              checked={effect === 'blocked'}
              onSelect={() => setEffect('blocked')}
            />
            <Radio
              name="closure-effect"
              label={t('mapEditor.closureSlowed')}
              checked={effect === 'slowed'}
              onSelect={() => setEffect('slowed')}
            />
          </RadioGroup>

          {effect === 'slowed' && (
            <Select
              label={t('mapEditor.closureSlowFactor')}
              value={slowFactor}
              onChange={(e) => setSlowFactor(e.target.value)}
              options={SLOW_FACTORS.map((value) => ({ value, label: `${value}×` }))}
            />
          )}

          <div className="flex flex-wrap gap-2">
            <Button size="sm" loading={saving} disabled={!canSave} onClick={submit}>
              {t('common.save')}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                resetDraft();
                onCancelDraft();
              }}
            >
              {t('common.cancel')}
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (pendingDelete) await onDelete(pendingDelete);
        }}
        title={t('mapEditor.closureDelete')}
        body={t('mapEditor.closureDeleteConfirm')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        tone="danger"
      />
    </section>
  );
};

export default ClosuresPanel;
