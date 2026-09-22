import { normalizeApiBase, apiBaseForHost, PROD_API, STAGE_API } from './apiBase';

describe('normalizeApiBase', () => {
  it('returns null when nothing is configured', () => {
    expect(normalizeApiBase(undefined)).toBeNull();
    expect(normalizeApiBase(null)).toBeNull();
    expect(normalizeApiBase('')).toBeNull();
    expect(normalizeApiBase('   ')).toBeNull();
  });

  it('keeps an absolute URL as-is', () => {
    expect(normalizeApiBase('https://alertup-backend.fly.dev')).toBe(
      'https://alertup-backend.fly.dev',
    );
    expect(normalizeApiBase('http://localhost:3001')).toBe('http://localhost:3001');
  });

  it('adds https to a scheme-less host', () => {
    // The real incident: VITE_API_URL was set in Vercel without a scheme, so
    // every request resolved against the frontend origin and 404'd.
    expect(normalizeApiBase('alertup-backend-stage.fly.dev')).toBe(
      'https://alertup-backend-stage.fly.dev',
    );
  });

  it('strips trailing slashes and surrounding whitespace', () => {
    expect(normalizeApiBase('  https://api.example.com///  ')).toBe('https://api.example.com');
    expect(normalizeApiBase('api.example.com/')).toBe('https://api.example.com');
  });
});

describe('apiBaseForHost', () => {
  it('sends stage and pre-prod to the stage backend', () => {
    expect(apiBaseForHost('stage.alertup.world')).toBe(STAGE_API);
    expect(apiBaseForHost('pre-prod.alertup.world')).toBe(STAGE_API);
  });

  it('sends everything else to production', () => {
    expect(apiBaseForHost('alertup.world')).toBe(PROD_API);
    expect(apiBaseForHost('www.alertup.world')).toBe(PROD_API);
    expect(apiBaseForHost('')).toBe(PROD_API);
  });

  it('points at Fly, never the deleted Render services', () => {
    expect(`${PROD_API}${STAGE_API}`).not.toContain('onrender.com');
  });
});
