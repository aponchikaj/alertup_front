import { useMemo } from 'react';
import { LayersIcon } from '../../../components/ui/icons';
import { useI18n } from '../../../i18n/LanguageProvider';
import type { EditorFloor, EditorNode } from '../../../apis/mapEditorApi';

/* ============================================================================
   TransitLinkHelper — finish a cross-floor link without leaving the floor.
   ----------------------------------------------------------------------------
   The old flow: pick the lift on floor 1, manually switch to floor 2, then
   hunt for its twin by eye. This panel appears the moment the first endpoint
   is picked and lists every candidate on the other floors — click one and the
   link is done. Floor-switch hunting still works; it is just no longer the
   only way.
   ========================================================================= */

export interface TransitLinkHelperProps {
  nodes: EditorNode[];
  floors: EditorFloor[];
  sourceNodeId: string;
  onPick: (node: EditorNode) => void;
}

/** More candidates than this is noise — the list is for grabbing the twin of
 *  a lift, not for browsing the whole building. */
const MAX_CANDIDATES = 24;

export const TransitLinkHelper = ({
  nodes,
  floors,
  sourceNodeId,
  onPick,
}: TransitLinkHelperProps) => {
  const { t } = useI18n();

  const source = nodes.find((node) => node.id === sourceNodeId) ?? null;

  const floorsById = useMemo(
    () => new Map(floors.map((floor) => [floor.id, floor])),
    [floors],
  );

  const candidates = useMemo(() => {
    if (!source) return [];
    return nodes
      .filter((node) => node.floorId !== source.floorId)
      .sort((a, b) => {
        // Transit nodes first — the twin of a lift is almost always another
        // lift — then floor order, then label.
        if ((a.type === 'TRANSIT') !== (b.type === 'TRANSIT')) {
          return a.type === 'TRANSIT' ? -1 : 1;
        }
        const floorA = floorsById.get(a.floorId)?.floorNumber ?? 0;
        const floorB = floorsById.get(b.floorId)?.floorNumber ?? 0;
        if (floorA !== floorB) return floorA - floorB;
        return (a.label ?? '').localeCompare(b.label ?? '');
      })
      .slice(0, MAX_CANDIDATES);
  }, [nodes, source, floorsById]);

  if (!source) return null;

  const floorName = (floorId: string): string => {
    const floor = floorsById.get(floorId);
    if (!floor) return '';
    return floor.name || t('wayfinding.floorShort', { number: floor.floorNumber });
  };

  return (
    <section
      aria-label={t('mapEditor.transitHelperTitle')}
      className="flex flex-col gap-2 rounded-xl border border-line bg-surface-2 p-3"
    >
      <p className="flex items-center gap-2 text-sm font-medium text-ink">
        <LayersIcon size={16} />
        {t('mapEditor.transitHelperTitle')}
      </p>

      {candidates.length === 0 ? (
        <p className="text-xs text-ink-muted">{t('mapEditor.transitHelperEmpty')}</p>
      ) : (
        <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto">
          {candidates.map((node) => (
            <li key={node.id}>
              <button
                type="button"
                onClick={() => onPick(node)}
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-line bg-surface px-3 py-1.5 text-left text-sm text-ink transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <span className="truncate">
                  {node.label || t(`mapEditor.type${pascal(node.type)}`)}
                </span>
                <span className="flex-none text-xs text-ink-subtle">
                  {floorName(node.floorId)}
                  {node.type === 'TRANSIT' ? ' · ⇅' : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

/** NODE_TYPE -> NodeType i18n suffix ("EMERGENCY_EXIT" -> "EmergencyExit"). */
const pascal = (value: string): string =>
  value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

export default TransitLinkHelper;
