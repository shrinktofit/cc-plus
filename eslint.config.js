// @ts-check

import { defineConfig, globalIgnores } from 'eslint/config';
import stf from '@shrinktofit/eslint-config';
import node from '@shrinktofit/eslint-config/node';

export default defineConfig([
  {
    settings: {
      node: {
        version: '>=22.17.0',
      },
    },
  },
  globalIgnores([
    'node_modules',
    'packages/*/lib',
  ]),
  stf.configs.recommended,
  node.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
        projectService: {
          allowDefaultProject: [
            'env.d.ts',
            'eslint.config.js',
            'vitest.workspace.ts',
            'packages/*/vite.config.ts',
            'packages/*/vitest.config.ts',
          ],
        },
      },
    },
  },
]);
