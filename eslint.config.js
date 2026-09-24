import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Shipped console calls leak internals to anyone with devtools open —
      // one of them printed a plaintext password on the register page. Errors
      // belong in state the UI renders, not in the console.
      'no-console': 'error',
    },
  },
  {
    // Tests and mocks may report freely; nothing here reaches a user.
    files: ['**/*.test.{ts,tsx}', 'src/__mocks__/**', 'src/setupTests.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    // The map3d "pure" modules are unit-tested in jsdom, which has no WebGL —
    // they must stay three-free. Type-only imports are still allowed.
    files: [
      'src/components/map3d/sceneBuilder.ts',
      'src/components/map3d/geometry3d.ts',
      'src/components/map3d/theme3d.ts',
      'src/components/map3d/picking.ts',
      'src/components/map3d/routeScene.ts',
    ],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [{ name: 'three', message: 'Pure map3d modules must not import three (jsdom tests).', allowTypeImports: true }],
          patterns: [{ group: ['three/*'], message: 'Pure map3d modules must not import three (jsdom tests).', allowTypeImports: true }],
        },
      ],
    },
  },
])
