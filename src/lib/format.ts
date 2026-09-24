/* ============================================================================
   Duration & distance formatting — pure module, no React.
   ----------------------------------------------------------------------------
   Fills i18n templates straight from the message dictionaries (not through
   useI18n) so the numbers shown in the route stepper, the QR scan route, and
   anywhere else that needs "3 min" or "120 m · 3 min" agree with the same
   rounding rules everywhere, including places without a LanguageProvider.
   ========================================================================= */

import { en } from '../i18n/messages/en';
import { ka } from '../i18n/messages/ka';
import type { Language } from '../i18n/LanguageProvider';

const DICTIONARIES: Record<Language, typeof en> = { en, ka };

const interpolate = (template: string, vars: Record<string, string | number>): string =>
  template.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match));

/**
 * Minutes shown to the visitor for an ETA given in seconds.
 * Anything under a minute still reads as "1 min" — "0 min" would look broken
 * on a route that is nearly finished.
 */
export const durationMinutes = (sec: number): number => {
  if (sec < 60) return 1;
  return Math.max(1, Math.round(sec / 60));
};

export const formatDuration = (sec: number, locale: Language = 'en'): string =>
  interpolate(DICTIONARIES[locale].wayfinding.eta, { minutes: durationMinutes(sec) });

export const formatDistance = (m: number, locale: Language = 'en'): string =>
  interpolate(DICTIONARIES[locale].wayfinding.distanceMeters, { meters: Math.round(m) });

export const formatDistanceAndEta = (m: number, sec: number, locale: Language = 'en'): string =>
  interpolate(DICTIONARIES[locale].wayfinding.distanceAndEta, {
    meters: Math.round(m),
    minutes: durationMinutes(sec),
  });
