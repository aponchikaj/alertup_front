import type { Dispatch, SetStateAction } from 'react';
import type { MapPoint } from '../../../components/map';
import type { ToastContextValue } from '../../../components/ui/toastContext';
import type { useI18n } from '../../../i18n/LanguageProvider';
import type { FloorInput } from '../../../apis/mapEditorApi';

/* Shared shapes for the map editor page and the hooks it is split into. */

export type Setter<T> = Dispatch<SetStateAction<T>>;
export type Translate = ReturnType<typeof useI18n>['t'];
export type ToastFn = ToastContextValue['toast'];

/** The page's mutation wrapper (see useGraphMutations). */
export type Mutate = <T>(run: () => Promise<T>) => Promise<T | null>;

export type CanvasSize = { width: number; height: number };
export type EdgeDraft = {
  kind: 'edge' | 'transit';
  sourceNodeId: string;
  targetNodeId: string;
};
export type BoxDraft = { start: MapPoint; current: MapPoint };
export type EdgeDrag = { sourceNodeId: string; current: MapPoint };
export type UpdateFloorFn = (floorId: string, input: FloorInput) => Promise<boolean>;
