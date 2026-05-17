import { defineConfig, globalIgnores } from 'eslint/config';
import stf from '@shrinktofit/eslint-config';
import node from '@shrinktofit/eslint-config/node';

export default defineConfig([
  {
    settings: {
      node: {
        version: '>=24.0.0',
      },
    },
  },
  globalIgnores([
    'node_modules',
    'packages/**/lib',
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
          ],
        },
      },
    },
  },
]);
