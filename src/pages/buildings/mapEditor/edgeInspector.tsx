import { useEffect, useState, type KeyboardEvent } from 'react';
import { Button } from '../../../components/ui/button';
import { ConfirmDialog } from '../../../components/ui/confirmDialog';
import { TextField } from '../../../components/ui/field';
import { Select } from '../../../components/ui/select';
import { Badge } from '../../../components/ui/feedback';
import { CloseIcon, PlusIcon, TrashIcon } from '../../../components/ui/icons';
import { useI18n } from '../../../i18n/LanguageProvider';
import { endpointLabel } from './edgeLabels';
import type { TransitType } from '../../../components/map';
import type { EdgeDirection } from '../../../components/map/types';
import type { EditorEdge, EditorNode, UpdateEdgeInput } from '../../../apis/mapEditorApi';

/* ============================================================================
   EdgeInspector — everything you can do to one connection.
   ----------------------------------------------------------------------------
   Connections are now created instantly with defaults (drag or click-click),
   so this panel is where the details live: what kind of link it is, whether a
   wheelchair can use it, and the optional cost override the router uses
   instead of raw distance. Same shape rules as the other inspectors: no
   layout of its own, works in the side column and the mobile Sheet alike.
   ========================================================================= */

// Reuses the wayfinding vocabulary — a stairlink must be called the same
// thing in the editor and in a visitor's route steps.
const TRANSIT_KEYS: Record<TransitType, string> = {
  WALKWAY: 'wayfinding.transitWalkway',
  STAIRS: 'wayfinding.transitStairs',
  ESCALATOR: 'wayfinding.transitEscalator',
  ELEVATOR: 'wayfinding.transitElevator',
};

export interface EdgeInspectorProps {
  edge: EditorEdge;
  /** Endpoint rows, when they are loaded — labels beat raw ids. */
  source: EditorNode | null;
  target: EditorNode | null;
  onSave: (patch: Omit<UpdateEdgeInput, 'buildingId'>) => Promise<void>;
  onDelete: () => Promise<void>;
  /** True while a closure draft is collecting edges. */
  closureDraftActive?: boolean;
  /** Whether this edge is already in that draft. */
  inClosureDraft?: boolean;
  /**
   * Adds the edge the inspector is pointed at to the open closure draft.
   *
   * A pointer shortcut, not the keyboard path: it only renders for a SELECTED
   * edge, and the only way to select one is clicking a bare <line> in
   * EdgeLayer, which has neither tabIndex nor a role. The keyboard path is the
   * connection list in ClosuresPanel (F13), which writes to the same draft;
   * this button just saves a second trip to the canvas once an edge is already
   * selected.
   */
  onAddToClosure?: () => void;
}

export const EdgeInspector = ({
  edge,
  source,
  target,
  onSave,
  onDelete,
  closureDraftActive = false,
  inClosureDraft = false,
  onAddToClosure,
}: EdgeInspectorProps) => {
  const { t } = useI18n();
  const [transitType, setTransitType] = useState<TransitType>(edge.transitType);
  const [accessible, setAccessible] = useState(edge.accessible);
  const [weight, setWeight] = useState(edge.weight === undefined ? '' : String(edge.weight));
  const [direction, setDirection] = useState<EdgeDirection>(edge.direction);
  const [tags, setTags] = useState<string[]>(edge.tags);
  const [tagDraft, setTagDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Re-seed when pointed at a different edge — otherwise the previous edge's
  // settings are one click from being saved onto this one.
  useEffect(() => {
    setTransitType(edge.transitType);
    setAccessible(edge.accessible);
    setWeight(edge.weight === undefined ? '' : String(edge.weight));
    setDirection(edge.direction);
    setTags(edge.tags);
    setTagDraft('');
    setConfirmDelete(false);
  }, [
    edge.id,
    edge.transitType,
    edge.accessible,
    edge.weight,
    edge.direction,
    edge.tags,
  ]);

  const fromLabel = endpointLabel(source, edge.sourceNodeId);
  const toLabel = endpointLabel(target, edge.targetNodeId);

  // Direction is stored relative to the edge's own sourceNodeId → targetNodeId,
  // which is not necessarily the order the two nodes were clicked in. Spelling
  // the options with the endpoint names is the only way an operator can tell
  // which way "forward" actually points.
  const directionOptions: { value: EdgeDirection; label: string }[] = [
    { value: 'BOTH', label: t('mapEditor.edgeDirectionBoth') },
    {
      value: 'FORWARD',
      label: t('mapEditor.edgeDirectionForward', { from: fromLabel, to: toLabel }),
    },
    {
      value: 'REVERSE',
      label: t('mapEditor.edgeDirectionForward', { from: toLabel, to: fromLabel }),
    },
  ];

  const addTag = (raw: string) => {
    const value = raw.trim();
    if (!value) return;
    setTags((current) => (current.includes(value) ? current : [...current, value]));
    setTagDraft('');
  };

  const handleTagKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      // Enter inside the inspector must not bubble up and submit the floors
      // form sitting in the same column.
      e.preventDefault();
      addTag(tagDraft);
      return;
    }
    if (e.key === 'Backspace' && tagDraft === '') {
      setTags((current) => (current.length === 0 ? current : current.slice(0, -1)));
    }
  };

  const weightValue = weight.trim();
  const weightNumber = Number(weightValue);
  const weightInvalid =
    weightValue !== '' && (!Number.isFinite(weightNumber) || weightNumber <= 0);

  return (
    <div className="flex flex-col gap-5" data-testid="edge-inspector">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{t('mapEditor.edgeTitle')}</Badge>
        {edge.distance !== undefined && (
          <span className="font-mono text-xs text-ink-subtle">
            {Math.round(edge.distance)} px
          </span>
        )}
      </div>

      {/* "Lobby ↔ Corridor" reads to a screen reader as two names with either
          "left right arrow" or nothing at all between them. The sentence is
          the real content; the glyph is the sighted shorthand for it. */}
      <p className="text-sm text-ink-muted" data-testid="edge-endpoints">
        <span className="sr-only">
          {t('mapEditor.edgeEndpoints', { from: fromLabel, to: toLabel })}
        </span>
        <span aria-hidden="true">
          {fromLabel}
          <span className="px-1.5 text-ink-subtle">↔</span>
          {toLabel}
        </span>
      </p>

      {closureDraftActive && onAddToClosure && (
        <Button
          size="sm"
          variant="secondary"
          disabled={inClosureDraft}
          onClick={onAddToClosure}
        >
          <PlusIcon size={16} />
          {t('mapEditor.closureAddEdge')}
        </Button>
      )}

      <Select
        label={t('mapEditor.edgeTransitType')}
        value={transitType}
        onChange={(e) => setTransitType(e.target.value as TransitType)}
        options={(Object.keys(TRANSIT_KEYS) as TransitType[]).map((value) => ({
          value,
          label: t(TRANSIT_KEYS[value]),
        }))}
      />

      <Select
        label={t('mapEditor.edgeDirection')}
        value={direction}
        onChange={(e) => setDirection(e.target.value as EdgeDirection)}
        options={directionOptions}
      />

      <label className="flex items-center gap-2.5 text-sm text-ink">
        <input
          type="checkbox"
          checked={accessible}
          onChange={(e) => setAccessible(e.target.checked)}
          className="h-4 w-4 rounded border-line accent-[var(--brand)]"
        />
        {t('mapEditor.edgeAccessible')}
      </label>

      <TextField
        label={t('mapEditor.edgeWeight')}
        hint={t('mapEditor.edgeWeightHint')}
        type="number"
        inputMode="decimal"
        min={0}
        step="any"
        value={weight}
        error={weightInvalid ? t('mapEditor.edgeWeightInvalid') : undefined}
        onChange={(e) => setWeight(e.target.value)}
      />

      {/* Same chip pattern as the POI keywords field — one vocabulary for
          "type a word, press Enter, get a removable token". */}
      <div className="flex flex-col gap-2">
        <TextField
          label={t('mapEditor.edgeTags')}
          hint={t('mapEditor.edgeTagsHint')}
          value={tagDraft}
          onChange={(e) => setTagDraft(e.target.value)}
          onKeyDown={handleTagKeyDown}
          onBlur={() => addTag(tagDraft)}
        />
        {tags.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <li key={tag}>
                <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-2 py-1 pl-3 pr-1 text-xs text-ink">
                  {tag}
                  <button
                    type="button"
                    aria-label={`${t('common.delete')} ${tag}`}
                    onClick={() => setTags((current) => current.filter((x) => x !== tag))}
                    className="grid h-5 w-5 place-items-center rounded-full text-ink-subtle hover:bg-surface-hover hover:text-ink"
                  >
                    <CloseIcon size={12} />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          loading={saving}
          disabled={weightInvalid}
          onClick={async () => {
            setSaving(true);
            try {
              await onSave({
                transitType,
                accessible,
                // Empty clears the override; the router falls back to distance.
                weight: weightValue === '' ? null : weightNumber,
                direction,
                tags,
              });
            } finally {
              setSaving(false);
            }
          }}
        >
          {t('common.save')}
        </Button>
        <Button size="sm" variant="danger" onClick={() => setConfirmDelete(true)}>
          <TrashIcon size={16} />
          {t('mapEditor.deleteEdge')}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={onDelete}
        title={t('mapEditor.deleteEdge')}
        body={t('mapEditor.deleteEdgeConfirm')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        tone="danger"
      />
    </div>
  );
};

export default EdgeInspector;
