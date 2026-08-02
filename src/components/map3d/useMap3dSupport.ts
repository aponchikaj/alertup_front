import { useMemo } from 'react';

/* ============================================================================
   Can this device do the 3D map at all?
   ----------------------------------------------------------------------------
   Probed once per session (context creation is not free) and cached. When
   false, consumers hide the 2D/3D toggle entirely — the 2D SVG map is always
   the fallback, so an unsupported device simply never sees the option.
   ========================================================================= */

let cachedSupport: boolean | null = null;

export function probeWebGlSupport(): boolean {
  if (cachedSupport !== null) return cachedSupport;
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl');
    cachedSupport = Boolean(gl);
    // Release the probe context immediately — some mobile browsers cap live contexts.
    if (gl && 'getExtension' in (gl as WebGLRenderingContext)) {
      (gl as WebGLRenderingContext).getExtension('WEBGL_lose_context')?.loseContext();
    }
  } catch {
    cachedSupport = false;
  }
  return cachedSupport;
}

/** For tests. */
export function resetSupportCache(): void {
  cachedSupport = null;
}

export function useMap3dSupport(): boolean {
  return useMemo(() => probeWebGlSupport(), []);
}
