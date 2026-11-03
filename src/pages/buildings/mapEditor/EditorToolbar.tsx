import type { Dispatch, SetStateAction } from 'react';
import { ICON_KINDS, type IconKind, type MapCameraControls, type NodeType } from '../../../components/map';
import { Alert, Badge } from '../../../components/ui/Feedback';
import { Button } from '../../../components/ui/Button';
import { Select } from '../../../components/ui/Select';
import {
  MaximizeIcon,
  MinimizeIcon,
  RedoIcon,
  RouteIcon,
  UndoIcon,
  ZapIcon,
} from '../../../components/ui/Icons';
import type { EditorGraph } from '../../../apis/mapEditorApi';
import type { EditorAction, EditorState } from './editorReducer';
import { ICON_KIND_KEYS } from './labels';
import { PresenceAvatars } from './CollabUi';
import { ToolMenu } from './ToolMenu';
import { TransitLinkHelper } from './TransitLinkHelper';
import { ModeSwitch } from './EditorChrome';
import {
  DRAW_TOOL_HINTS,
  DRAW_TOOLS,
  GRAPH_TOOLS,
  NODE_TYPE_KEYS,
  type EditorMode,
} from './editorConstants';
import type { UseEditorCollabResult } from './useEditorCollab';
import type { Setter, Translate } from './editorTypes';

export interface EditorToolbarProps {
  t: Translate;
  editor: EditorState;
  graph: EditorGraph;
  collab: UseEditorCollabResult;
  controls: MapCameraControls;
  dispatch: (action: EditorAction) => void;
  editorMode: EditorMode;
  setEditorMode: Dispatch<SetStateAction<EditorMode>>;
  nodesMode: boolean;
  floorMode: boolean;
  drawing: boolean;
  pendingGesture: boolean;
  placeType: NodeType;
  setPlaceType: Setter<NodeType>;
  autoConnect: boolean;
  setAutoConnect: Setter<boolean>;
  autoConnecting: boolean;
  runAutoConnect: () => Promise<void>;
  setLinkDialogOpen: Setter<boolean>;
  setWallCursor: Setter<{ x: number; y: number } | null>;
  setAiOpen: Setter<boolean>;
  setAuditOpen: Setter<boolean>;
  canUndo: boolean;
  canRedo: boolean;
  applyHistory: (direction: 'undo' | 'redo') => void;
  saveLabel: string | null;
  pending: number;
  fullscreen: boolean;
  setFullscreen: Setter<boolean>;
}

  /* Toolbar. Drawing the plan and wiring the routing graph are two different
     jobs, so each gets its own menu rather than one long strip the user has to
     re-read every time. Built once and placed by both layouts — in the page
     flow normally, floating over the canvas in fullscreen. */
export const EditorToolbar = ({
  t,
  editor,
  graph,
  collab,
  controls,
  dispatch,
  editorMode,
  setEditorMode,
  nodesMode,
  floorMode,
  drawing,
  pendingGesture,
  placeType,
  setPlaceType,
  autoConnect,
  setAutoConnect,
  autoConnecting,
  runAutoConnect,
  setLinkDialogOpen,
  setWallCursor,
  setAiOpen,
  setAuditOpen,
  canUndo,
  canRedo,
  applyHistory,
  saveLabel,
  pending,
  fullscreen,
  setFullscreen,
}: EditorToolbarProps) => (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <ModeSwitch
          mode={editorMode}
          onChange={(next) => {
            setEditorMode(next);
            // Leaving a mode disarms its tool, so the first click in the new
            // mode cannot complete a gesture belonging to the old one.
            dispatch({ type: 'SET_TOOL', tool: next === 'floor' ? 'pan' : 'select' });
          }}
          t={t}
        />

        {!floorMode && (
          <ToolMenu
            label={nodesMode ? t('mapEditor.tools') : t('mapEditor.drawTools')}
            items={nodesMode ? GRAPH_TOOLS : DRAW_TOOLS}
            activeTool={editor.tool}
            onSelect={(tool) => {
              dispatch({ type: 'SET_TOOL', tool });
              // Linking floors is a pick-two-lists job, not a hunt across
              // floor switches — the dialog fronts it the moment the tool
              // is armed.
              if (tool === 'link-transit') setLinkDialogOpen(true);
            }}
            t={t}
          />
        )}

        {editor.tool === 'place-node' && (
          <>
            <Select
              aria-label={t('mapEditor.nodeType')}
              className="w-48"
              value={placeType}
              onChange={(e) => setPlaceType(e.target.value as NodeType)}
              options={(Object.keys(NODE_TYPE_KEYS) as NodeType[]).map((value) => ({
                value,
                label: t(NODE_TYPE_KEYS[value]),
              }))}
            />
            <label className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-2 text-sm text-ink-muted">
              <input
                type="checkbox"
                checked={autoConnect}
                onChange={(e) => setAutoConnect(e.target.checked)}
                className="h-4 w-4 rounded border-line accent-[var(--brand)]"
              />
              {t('mapEditor.autoConnect')}
            </label>
          </>
        )}
        {editor.tool === 'stamp-icon' && (
          <Select
            aria-label={t('mapEditor.iconKind')}
            className="w-48"
            value={editor.stampIcon}
            onChange={(e) =>
              dispatch({ type: 'SET_STAMP_ICON', icon: e.target.value as IconKind })
            }
            options={ICON_KINDS.map((icon) => ({
              value: icon,
              label: t(ICON_KIND_KEYS[icon]),
            }))}
          />
        )}
        {nodesMode && (
          <Button
            variant="secondary"
            size="sm"
            loading={autoConnecting}
            onClick={() => void runAutoConnect()}
            title={t('mapEditor.autoConnectFloorHint')}
          >
            <RouteIcon size={16} />
            {t('mapEditor.autoConnectFloor')}
          </Button>
        )}
        {editor.tool === 'draw-wall' && editor.wallPoints.length >= 4 && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              dispatch({ type: 'FINISH_WALL' });
              setWallCursor(null);
            }}
          >
            {t('mapEditor.finishWall')}
          </Button>
        )}

        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setAiOpen(true)}
            title={t('editorAi.title')}
          >
            <ZapIcon size={16} />
            {t('editorAi.launcher')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setAuditOpen(true)}
            title={t('auditAi.title')}
          >
            <ZapIcon size={16} />
            {t('auditAi.launcher')}
          </Button>
          <PresenceAvatars peers={collab.peers} label={t('mapEditor.peersEditing')} />
          <Button
            variant="secondary"
            size="sm"
            disabled={!canUndo}
            onClick={() => applyHistory('undo')}
            aria-label={t('mapEditor.undo')}
            title={`${t('mapEditor.undo')} (Ctrl+Z)`}
          >
            <UndoIcon size={16} />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={!canRedo}
            onClick={() => applyHistory('redo')}
            aria-label={t('mapEditor.redo')}
            title={`${t('mapEditor.redo')} (Ctrl+Shift+Z)`}
          >
            <RedoIcon size={16} />
          </Button>
          {saveLabel && (
            <Badge tone={pending > 0 ? 'info' : 'success'} aria-live="polite">
              {saveLabel}
            </Badge>
          )}
          <Button variant="secondary" size="sm" onClick={controls.zoomIn}>
            {t('mapEditor.zoomIn')}
          </Button>
          <Button variant="secondary" size="sm" onClick={controls.zoomOut}>
            {t('mapEditor.zoomOut')}
          </Button>
          <Button variant="secondary" size="sm" onClick={controls.reset}>
            {t('mapEditor.resetView')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setFullscreen((value) => !value)}
          >
            {fullscreen ? <MinimizeIcon size={16} /> : <MaximizeIcon size={16} />}
            {fullscreen ? t('mapEditor.exitFullscreen') : t('mapEditor.fullscreen')}
          </Button>
        </div>
      </div>

      {floorMode && <Alert tone="info">{t('mapEditor.hintFloorMode')}</Alert>}

      {drawing && !pendingGesture && !floorMode && (
        <Alert tone="info">{t(DRAW_TOOL_HINTS[editor.tool] ?? '')}</Alert>
      )}

      {pendingGesture && (
        <Alert tone="info">
          {editor.transitLinkSourceId
            ? `${t('mapEditor.pickTransitTarget')} ${t('mapEditor.cancelHint')}`
            : editor.wallPoints.length > 0
              ? `${t('mapEditor.wallInProgress')} ${t('mapEditor.cancelHint')}`
              : t('mapEditor.cancelHint')}
        </Alert>
      )}

      {/* Cross-floor linking, without the floor-switch scavenger hunt: the
          moment one endpoint is picked, every candidate on the other floors
          is one click away. */}
      {editor.transitLinkSourceId && (
        <TransitLinkHelper
          nodes={graph.nodes}
          floors={graph.floors}
          sourceNodeId={editor.transitLinkSourceId}
          onPick={(node) =>
            dispatch({ type: 'NODE_CLICKED', nodeId: node.id, floorId: node.floorId })
          }
        />
      )}
    </>
);
