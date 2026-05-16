import { defineConfig } from 'vitest/config';
import path from 'node:path';

const projectRoot = path.resolve(__dirname);

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/*.test.ts'],
  },
  resolve: {
    alias: [
      {
        find: /^@\/(.*)/,
        replacement: path.join(projectRoot, 'src', '$1'),
      },
    ],
  },
});
