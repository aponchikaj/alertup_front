/**
 * Jest config for the Vite + React + TypeScript frontend.
 *
 * Without this file Jest had no transform for .tsx and no jsdom environment, so
 * `npm test` matched nothing and exited 0 while running zero assertions.
 *
 * Runs in CommonJS so that `jest.mock()` and the `jest` global behave normally.
 * The only ESM-only syntax in the app is `import.meta`, which is confined to
 * src/apis/env.ts and swapped for a stub below.
 */
export default {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: {
          jsx: 'react-jsx',
          module: 'commonjs',
          target: 'es2022',
          esModuleInterop: true,
          // Relaxed for tests only; the app build still enforces these.
          verbatimModuleSyntax: false,
          erasableSyntaxOnly: false,
          noUnusedLocals: false,
          noUnusedParameters: false,
        },
        diagnostics: false,
      },
    ],
  },
  moduleNameMapper: {
    // `import.meta` cannot be compiled to CommonJS — see src/apis/env.ts.
    '^\\./env$': '<rootDir>/src/__mocks__/envMock.cjs',
    '^\\.\\./apis/env$': '<rootDir>/src/__mocks__/envMock.cjs',
    '\\.(css|less|scss|sass)$': '<rootDir>/src/__mocks__/styleMock.cjs',
    '\\.(png|jpg|jpeg|gif|svg|webp|avif|woff2?|ttf|eot)$': '<rootDir>/src/__mocks__/fileMock.cjs',
  },
  testMatch: ['<rootDir>/src/**/*.test.ts', '<rootDir>/src/**/*.test.tsx'],
};
