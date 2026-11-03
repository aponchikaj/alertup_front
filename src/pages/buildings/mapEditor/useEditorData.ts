import { useCallback, useEffect } from 'react';
import { errorMessage } from '../../../apis/http';
import { getBuilding } from '../../../apis/building';
import {
  getBuildingGraph,
  listClosures,
  validateBuilding,
  type Closure,
  type EditorGraph,
  type ValidationReport,
} from '../../../apis/mapEditorApi';
import type { EditorAction } from './editorReducer';
import { byFloorNumber } from './editorHelpers';
import type { Setter, ToastFn } from './editorTypes';

interface UseEditorDataOptions {
  buildingId: string;
  toast: ToastFn;
  dispatch: (action: EditorAction) => void;
  setGraph: Setter<EditorGraph>;
  setLoading: Setter<boolean>;
  setLoadError: Setter<string | null>;
  setBuildingName: Setter<string>;
  setClosures: Setter<Closure[]>;
  setClosuresLoading: Setter<boolean>;
  setReport: Setter<ValidationReport | null>;
  setValidating: Setter<boolean>;
}

/** Initial loads (graph, building name, closures) and the validation run. */
export const useEditorData = ({
  buildingId,
  toast,
  dispatch,
  setGraph,
  setLoading,
  setLoadError,
  setBuildingName,
  setClosures,
  setClosuresLoading,
  setReport,
  setValidating,
}: UseEditorDataOptions) => {
  /* --- load -------------------------------------------------------------- */

  useEffect(() => {
    if (!buildingId) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    getBuildingGraph(buildingId)
      .then((next) => {
        if (cancelled) return;
        const floors = byFloorNumber(next.floors);
        setGraph({ ...next, floors });
        dispatch({ type: 'SET_FLOOR', floorId: floors[0]?.id ?? null });
      })
      .catch((err) => {
        if (!cancelled) setLoadError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [buildingId, dispatch, setGraph, setLoadError, setLoading]);

  useEffect(() => {
    if (!buildingId) return;
    let cancelled = false;
    getBuilding({ buildingID: buildingId })
      .then((res) => {
        if (cancelled || !res?.success) return;
        const name = res.data?.buildingName;
        if (typeof name === 'string' && name) setBuildingName(name);
      })
      .catch(() => {
        /* the header falls back to the generic title */
      });
    return () => {
      cancelled = true;
    };
  }, [buildingId, setBuildingName]);

  // Closures are advisory rather than structural: a failure here must not stop
  // the editor loading, so the error is swallowed and the panel simply shows an
  // empty list.
  useEffect(() => {
    if (!buildingId) return;
    let cancelled = false;
    setClosuresLoading(true);
    listClosures(buildingId)
      .then((rows) => {
        if (!cancelled) setClosures(rows);
      })
      .catch(() => {
        /* the panel falls back to "no active closures" */
      })
      .finally(() => {
        if (!cancelled) setClosuresLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [buildingId, setClosures, setClosuresLoading]);

  const runValidation = useCallback(async () => {
    if (!buildingId) return;
    setValidating(true);
    try {
      setReport(await validateBuilding(buildingId));
    } catch (err) {
      toast({ title: errorMessage(err), tone: 'danger' });
    } finally {
      setValidating(false);
    }
  }, [buildingId, setReport, setValidating, toast]);

  useEffect(() => {
    void runValidation();
  }, [runValidation]);

  return { runValidation };
};
