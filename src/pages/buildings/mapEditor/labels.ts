import type { DrawingShape, IconKind } from '../../../components/map';

/* ============================================================================
   Translation keys for editor vocabulary.
   ----------------------------------------------------------------------------
   Kept out of the components that use them so both the inspector and the page
   read from one table — a marker named "Lift" in the toolbar and "Elevator" in
   the inspector is the kind of drift that makes a tool feel unfinished.
   ========================================================================= */

export const SHAPE_KIND_KEYS: Record<DrawingShape['kind'], string> = {
  wall: 'mapEditor.shapeWall',
  room: 'mapEditor.shapeRoom',
  shop: 'mapEditor.shapeShop',
  icon: 'mapEditor.shapeIcon',
  text: 'mapEditor.shapeText',
};

export const ICON_KIND_KEYS: Record<IconKind, string> = {
  ELEVATOR: 'mapEditor.iconElevator',
  ESCALATOR: 'mapEditor.iconEscalator',
  STAIRS: 'mapEditor.iconStairs',
  DOOR: 'mapEditor.iconDoor',
  ENTRANCE: 'mapEditor.iconEntrance',
  EXIT: 'mapEditor.iconExit',
  WC: 'mapEditor.iconWc',
  INFO: 'mapEditor.iconInfo',
};
