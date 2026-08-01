import { useMemo, useState } from 'react';
import { Button } from '../../../components/ui/button';
import { Modal } from '../../../components/ui/modal';
import { Select } from '../../../components/ui/select';
import { Alert } from '../../../components/ui/feedback';
import { LayersIcon } from '../../../components/ui/icons';
import { useI18n } from '../../../i18n/LanguageProvider';
import type { TransitType } from '../../../components/map';
import type { EditorFloor, EditorNode } from '../../../apis/mapEditorApi';

/* ============================================================================
   LinkFloorsDialog — connect two floors without the scavenger hunt.
   ----------------------------------------------------------------------------
   The old flow: arm the tool, find and tap the lift on this floor, switch
   floors, find and tap its twin. Workable with two nodes, miserable with
   forty. This dialog fronts the same operation as two dropdowns and a type:
   pick here, pick there, done. The map-tap flow still works underneath for
   people who prefer pointing.
   ========================================================================= */

const VERTICAL_TRANSITS: TransitType[] = ['ELEVATOR', 'ESCALATOR', 'STAIRS'];

const TRANSIT_KEYS: Record<TransitType, string> = {
  WALKWAY: 'wayfinding.transitWalkway',
  STAIRS: 'wayfinding.transitStairs',
  ESCALATOR: 'wayfinding.transitEscalator',
  ELEVATOR: 'wayfinding.transitElevator',
};

export interface LinkFloorsDialogProps {
  open: boolean;
  onClose: () => void;
  nodes: EditorNode[];
  floors: EditorFloor[];
  activeFloorId: string | null;
  submitting: boolean;
  onCreate: (input: {
    sourceNodeId: string;
    targetNodeId: string;
    transitType: TransitType;
  }) => Promise<void>;
}

export const LinkFloorsDialog = ({
  open,
  onClose,
  nodes,
  floors,
  activeFloorId,
  submitting,
  onCreate,
}: LinkFloorsDialogProps) => {
  const { t } = useI18n();
  const [sourceId, setSourceId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [transitType, setTransitType] = useState<TransitType>('ELEVATOR');

  const floorsById = useMemo(
    () => new Map(floors.map((floor) => [floor.id, floor])),
    [floors],
  );

  const floorName = (floorId: string): string => {
    const floor = floorsById.get(floorId);
    if (!floor) return '';
    return floor.name || t('wayfinding.floorShort', { number: floor.floorNumber });
  };

  const describe = (node: EditorNode): string => {
    const name =
      node.label || t(`mapEditor.type${pascal(node.type)}`) || node.type;
    return `${name} — ${floorName(node.floorId)}`;
  };

  // Transit nodes first (the twin of a lift is almost always another lift),
  // then everything else by floor and label.
  const sortForLinking = (list: EditorNode[]): EditorNode[] =>
    [...list].sort((a, b) => {
      if ((a.type === 'TRANSIT') !== (b.type === 'TRANSIT')) {
        return a.type === 'TRANSIT' ? -1 : 1;
      }
      const fa = floorsById.get(a.floorId)?.floorNumber ?? 0;
      const fb = floorsById.get(b.floorId)?.floorNumber ?? 0;
      if (fa !== fb) return fa - fb;
      return (a.label ?? '').localeCompare(b.label ?? '');
    });

  const sources = useMemo(
    () => sortForLinking(nodes.filter((n) => n.floorId === activeFloorId)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodes, activeFloorId, floorsById],
  );
  const targets = useMemo(
    () => sortForLinking(nodes.filter((n) => n.floorId !== activeFloorId)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodes, activeFloorId, floorsById],
  );

  const canSubmit = Boolean(sourceId && targetId) && !submitting;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('mapEditor.linkFloorsTitle')}
      closeLabel={t('common.cancel')}
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!canSubmit) return;
          void onCreate({ sourceNodeId: sourceId, targetNodeId: targetId, transitType });
        }}
      >
        <p className="flex items-start gap-2 text-sm text-ink-muted">
          <LayersIcon size={16} className="mt-0.5 flex-none" />
          {t('mapEditor.linkFloorsLead')}
        </p>

        {targets.length === 0 ? (
          <Alert tone="info">{t('mapEditor.transitHelperEmpty')}</Alert>
        ) : (
          <>
            <Select
              label={t('mapEditor.linkFrom')}
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
              placeholder={t('mapEditor.linkPick')}
              options={sources.map((node) => ({
                value: node.id,
                label: describe(node),
              }))}
            />
            <Select
              label={t('mapEditor.linkTo')}
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              placeholder={t('mapEditor.linkPick')}
              options={targets.map((node) => ({
                value: node.id,
                label: describe(node),
              }))}
            />
            <Select
              label={t('mapEditor.edgeTransitType')}
              value={transitType}
              onChange={(e) => setTransitType(e.target.value as TransitType)}
              options={VERTICAL_TRANSITS.map((value) => ({
                value,
                label: t(TRANSIT_KEYS[value]),
              }))}
            />
          </>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={!canSubmit} loading={submitting}>
            {t('mapEditor.linkCreate')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

/** NODE_TYPE -> i18n suffix ("EMERGENCY_EXIT" -> "EmergencyExit"). */
const pascal = (value: string): string =>
  value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

export default LinkFloorsDialog;
