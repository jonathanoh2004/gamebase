import path from 'node:path';
import { defineConfig } from 'vitest/config';

const alias = {
  '@': path.resolve(import.meta.dirname),
  // `server-only` throws outside a React Server bundle; tests run in plain Node.
  'server-only': path.resolve(import.meta.dirname, 'tests/stubs/empty.ts'),
};

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'unit',
          environment: 'node',
          include: ['**/*.test.ts'],
          exclude: ['**/*.db.test.ts', '**/node_modules/**', 'e2e/**', '.data/**'],
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'db',
          environment: 'node',
          include: ['**/*.db.test.ts'],
          exclude: ['**/node_modules/**', '.data/**'],
          globalSetup: ['tests/db-global-setup.ts'],
          setupFiles: ['tests/db-setup.ts'],
          // One database for the whole run; files share it, so run serially.
          fileParallelism: false,
          testTimeout: 20_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
