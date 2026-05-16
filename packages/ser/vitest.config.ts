import { defineConfig } from 'vitest/config';
import path from 'node:path';
import ccTest from '@feb/cc-test/vitest-plugin';

const projectRoot = path.resolve(__dirname);

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*test.ts'],
  },
  resolve: {
    alias: [
      {
        find: /^@src\/(.*)/,
        replacement: path.join(projectRoot, 'src', '$1'),
      },
    ],
  },
  plugins: [
    ...ccTest({
      defaultStrategy: 'standalone',
    }),
  ],
});
