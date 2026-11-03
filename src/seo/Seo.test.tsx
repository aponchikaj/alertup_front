import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import Seo from './Seo';
import { SITE, getRouteSeo } from './seo.config';

const description = () =>
  document.head.querySelector('meta[name="description"]')?.getAttribute('content');
const robots = () =>
  document.head.querySelector('meta[name="robots"]')?.getAttribute('content');
const canonical = () =>
  document.head.querySelector('link[rel="canonical"]')?.getAttribute('href');

function Nav() {
  const navigate = useNavigate();
  return <button onClick={() => navigate('/help')}>go-help</button>;
}

function app(start: string) {
  return render(
    <MemoryRouter initialEntries={[start]}>
      <Nav />
      <Seo fallback />
      <Routes>
        <Route path="/pricing" element={<Seo title="Custom pricing" description="page-level" />} />
        <Route path="*" element={null} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  document.head.innerHTML = '';
});

it('fallback applies the registry entry for the current route', () => {
  app('/help');
  expect(description()).toBe(getRouteSeo('/help')?.description);
  expect(canonical()).toBe(`${SITE.url}/help`);
});

it('a page-level <Seo /> wins over the app fallback', () => {
  app('/pricing');
  expect(description()).toBe('page-level');
  expect(document.title).toBe(SITE.titleTemplate.replace('%s', 'Custom pricing'));
});

it('navigating away never keeps the previous page metadata', () => {
  app('/pricing');
  act(() => screen.getByText('go-help').click());
  expect(description()).toBe(getRouteSeo('/help')?.description);
});

it('unknown and auth routes are noindex with a concrete canonical', () => {
  app('/building/b42');
  expect(robots()).toBe('noindex, follow');
  expect(canonical()).toBe(`${SITE.url}/building/b42`);
});
