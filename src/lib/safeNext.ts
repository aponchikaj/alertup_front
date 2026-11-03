const FALLBACK = '/dashboard';

/**
 * Where to send a user after they sign in: the `?next=` they arrived with
 * (an invite link, say), or the dashboard.
 *
 * Only a same-site path is accepted — one leading `/`, never `//` or `/\`
 * (both are read by browsers as "another host"), never a scheme — so `next`
 * cannot become an open redirect. The auth pages themselves are refused, so
 * a sign-in can never bounce back to the form it just left.
 */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw) return FALLBACK;
  let path = raw;
  try {
    path = decodeURIComponent(raw);
  } catch {
    return FALLBACK;
  }
  if (!path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) return FALLBACK;
  if (/^\/(login|register)(?:[/?#]|$)/.test(path)) return FALLBACK;
  return path;
}

/** The login URL that brings a guest back to `location` after signing in. */
export function loginWithNext(location: { pathname: string; search?: string }): string {
  const target = location.pathname + (location.search ?? '');
  return target && target !== '/' ? `/login?next=${encodeURIComponent(target)}` : '/login';
}
