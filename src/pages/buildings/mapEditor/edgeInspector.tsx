import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/button';
import { ConfirmDialog } from '../../../components/ui/confirmDialog';
import { TextField } from '../../../components/ui/field';
import { Select } from '../../../components/ui/select';
import { Badge } from '../../../components/ui/feedback';
import { TrashIcon } from '../../../components/ui/icons';
import { useI18n } from '../../../i18n/LanguageProvider';
import type { TransitType } from '../../../components/map';
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
}

export const EdgeInspector = ({
  edge,
  source,
  target,
  onSave,
  onDelete,
}: EdgeInspectorProps) => {
  const { t } = useI18n();
  const [transitType, setTransitType] = useState<TransitType>(edge.transitType);
  const [accessible, setAccessible] = useState(edge.accessible);
  const [weight, setWeight] = useState(edge.weight === undefined ? '' : String(edge.weight));
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Re-seed when pointed at a different edge — otherwise the previous edge's
  // settings are one click from being saved onto this one.
  useEffect(() => {
    setTransitType(edge.transitType);
    setAccessible(edge.accessible);
    setWeight(edge.weight === undefined ? '' : String(edge.weight));
    setConfirmDelete(false);
  }, [edge.id, edge.transitType, edge.accessible, edge.weight]);

  const endpointLabel = (node: EditorNode | null, fallbackId: string): string =>
    node?.label || node?.type || fallbackId.slice(0, 8);

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

      <p className="text-sm text-ink-muted">
        {endpointLabel(source, edge.sourceNodeId)}
        <span className="px-1.5 text-ink-subtle">↔</span>
        {endpointLabel(target, edge.targetNodeId)}
      </p>

      <Select
        label={t('mapEditor.edgeTransitType')}
        value={transitType}
        onChange={(e) => setTransitType(e.target.value as TransitType)}
        options={(Object.keys(TRANSIT_KEYS) as TransitType[]).map((value) => ({
          value,
          label: t(TRANSIT_KEYS[value]),
        }))}
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
