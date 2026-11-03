import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  DrawingLayer,
  EdgeLayer,
  FloorImageLayer,
  MapCanvas,
  NodeLayer,
  PoiLayer,
  defaultOutlinePoints,
  outlineOf,
  type FloorDrawing,
  type FloorSpace,
  type MapNode,
  type MapPoint,
  type UseMapCameraResult,
} from '../../../components/map';
import type { EditorGraph, EditorNode } from '../../../apis/mapEditorApi';
import type { EditorState } from './editorReducer';
import { PeerCursorsLayer } from './CollabUi';
import { DraftLayer, FloorResizeLayer } from './EditorOverlays';
import { TOOL_CURSORS } from './editorConstants';
import type { UseEditorCollabResult } from './useEditorCollab';
import type { useEditorPointer } from './useEditorPointer';
import type { useEditorActions } from './useEditorActions';
import type { useEditorDrawing } from './useEditorDrawing';
import type { BoxDraft, EdgeDrag, Translate } from './editorTypes';

type PointerApi = ReturnType<typeof useEditorPointer>;
type ActionsApi = ReturnType<typeof useEditorActions>;
type DrawingApi = ReturnType<typeof useEditorDrawing>;

export interface EditorCanvasProps {
  className: string;
  t: Translate;
  editor: EditorState;
  graph: EditorGraph;
  collab: UseEditorCollabResult;
  space: FloorSpace;
  camera: UseMapCameraResult['camera'];
  svgRef: UseMapCameraResult['svgRef'];
  svgHandlers: PointerApi['svgHandlers'];
  isDragging: boolean;
  activeFloor: EditorGraph['floors'][number] | null;
  activeDrawing: FloorDrawing;
  nodesMode: boolean;
  floorMode: boolean;
  boxDraft: BoxDraft | null;
  wallCursor: MapPoint | null;
  edgeDrag: EdgeDrag | null;
  nodesById: Map<string, MapNode>;
  visibleNodes: EditorNode[];
  visiblePois: EditorGraph['pois'];
  selectedPoi: EditorGraph['pois'][number] | null;
  closureDraft: string[] | null;
  closureDraftSet: Set<string> | undefined;
  handleShapeClick: ActionsApi['handleShapeClick'];
  handleEdgeClick: ActionsApi['handleEdgeClick'];
  handleShapePointerDown: PointerApi['handleShapePointerDown'];
  handleResizePointerDown: PointerApi['handleResizePointerDown'];
  handleWallVertexPointerDown: PointerApi['handleWallVertexPointerDown'];
  handleNodeClick: PointerApi['handleNodeClick'];
  handleNodePointerDown: PointerApi['handleNodePointerDown'];
  beginOutlineVertexDrag: DrawingApi['beginOutlineVertexDrag'];
  beginOutlineMidpointDrag: DrawingApi['beginOutlineMidpointDrag'];
  removeOutlineVertex: DrawingApi['removeOutlineVertex'];
  beginCanvasResize: (axis: 'x' | 'y' | 'both', e: ReactPointerEvent<SVGElement>) => void;
}

/** The map itself, with every editor layer. `className` sizes it, which is the
 *  only thing the page's two layouts disagree about. */
export const EditorCanvas = ({
  className,
  t,
  editor,
  graph,
  collab,
  space,
  camera,
  svgRef,
  svgHandlers,
  isDragging,
  activeFloor,
  activeDrawing,
  nodesMode,
  floorMode,
  boxDraft,
  wallCursor,
  edgeDrag,
  nodesById,
  visibleNodes,
  visiblePois,
  selectedPoi,
  closureDraft,
  closureDraftSet,
  handleShapeClick,
  handleEdgeClick,
  handleShapePointerDown,
  handleResizePointerDown,
  handleWallVertexPointerDown,
  handleNodeClick,
  handleNodePointerDown,
  beginOutlineVertexDrag,
  beginOutlineMidpointDrag,
  removeOutlineVertex,
  beginCanvasResize,
}: EditorCanvasProps) => (
    <MapCanvas
      space={space}
      camera={camera}
      handlers={svgHandlers}
      svgRef={svgRef}
      interactive
      isDragging={isDragging}
      cursor={TOOL_CURSORS[editor.tool]}
      ariaLabel={t('mapEditor.title')}
      className={className}
    >
      <FloorImageLayer
        floor={activeFloor}
        space={space}
        // The empty grid is the canvas the user asked for, not a missing
        // asset — so it carries no caption.
        placeholderLabel={null}
      />
      <DrawingLayer
        drawing={activeDrawing}
        scale={camera.scale}
        selectedShapeId={editor.selectedShapeId}
        onShapeClick={floorMode ? undefined : handleShapeClick}
        onShapePointerDown={floorMode ? undefined : handleShapePointerDown}
        onResizePointerDown={floorMode ? undefined : handleResizePointerDown}
        onWallVertexPointerDown={floorMode ? undefined : handleWallVertexPointerDown}
        shapeCursor={TOOL_CURSORS[editor.tool] ?? 'pointer'}
      />
      <DraftLayer
        boxDraft={boxDraft}
        wallPoints={editor.wallPoints}
        wallCursor={wallCursor}
        edgeGhost={
          edgeDrag
            ? {
                from:
                  nodesById.get(edgeDrag.sourceNodeId) ?? edgeDrag.current,
                to: edgeDrag.current,
              }
            : null
        }
      />
      {/* The routing graph renders only in Nodes mode. While drawing, the
          wires and markers are someone else's layer of the problem — hiding
          them keeps the plan readable and makes the mode split legible. */}
      {nodesMode && (
        <EdgeLayer
          edges={graph.edges}
          nodesById={nodesById}
          inaccessibleLabel={t('mapEditor.edgeAccessible')}
          selectedEdgeId={editor.selectedEdgeId}
          highlightedEdgeIds={closureDraftSet}
          highlightedLabel={t('mapEditor.closureEdgeHighlighted')}
          // While a closure draft is open every tool defers to edge picking —
          // otherwise the operator would have to arm Select first.
          onEdgeClick={
            editor.tool === 'select' || closureDraft !== null
              ? handleEdgeClick
              : undefined
          }
        />
      )}
      {nodesMode && (
        <PoiLayer
          pois={visiblePois}
          nodesById={nodesById}
          scale={camera.scale}
          selectedPoiId={selectedPoi?.id ?? null}
          onPoiClick={(_, node) => handleNodeClick(node)}
        />
      )}
      {nodesMode && (
        <NodeLayer
          nodes={visibleNodes}
          selectedId={editor.selectedNodeId}
          hoveredId={
            editor.pendingEdgeSourceId ??
            editor.transitLinkSourceId ??
            editor.hoveredNodeId
          }
          scale={camera.scale}
          onNodeClick={handleNodeClick}
          onNodePointerDown={handleNodePointerDown}
        />
      )}
      <PeerCursorsLayer
        cursors={collab.cursors}
        floorId={editor.activeFloorId}
        scale={camera.scale}
      />
      {floorMode && (
        <FloorResizeLayer
          space={space}
          scale={camera.scale}
          outlinePoints={
            outlineOf(activeDrawing)?.points ?? defaultOutlinePoints(space)
          }
          onVertexDown={beginOutlineVertexDrag}
          onMidpointDown={beginOutlineMidpointDrag}
          onVertexDoubleClick={removeOutlineVertex}
          metersLabel={
            activeFloor?.scalePixelsPerMeter
              ? `${Math.round((space.width / activeFloor.scalePixelsPerMeter) * 10) / 10} × ${
                  Math.round((space.height / activeFloor.scalePixelsPerMeter) * 10) / 10
                } m`
              : `${space.width} × ${space.height}`
          }
          onBegin={beginCanvasResize}
        />
      )}
    </MapCanvas>
);
