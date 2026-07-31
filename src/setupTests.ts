import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';

/* eslint-disable @typescript-eslint/no-explicit-any */

// jsdom does not provide TextEncoder/TextDecoder, but react-router v7 needs
// them at import time. These must be installed before any component imports.
if (typeof globalThis.TextEncoder === 'undefined') {
  globalThis.TextEncoder = TextEncoder as any;
}
if (typeof globalThis.TextDecoder === 'undefined') {
  globalThis.TextDecoder = TextDecoder as any;
}

// jsdom has no fetch. The app's http client is built on it, so tests that do
// not explicitly mock a request get a clear failure rather than a confusing
// "fetch is not defined".
if (typeof globalThis.fetch === 'undefined') {
  globalThis.fetch = jest.fn(() =>
    Promise.reject(new Error('Unmocked fetch call in test — mock the API module you are exercising.')),
  ) as any;
}

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock IntersectionObserver
globalThis.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
} as any;
