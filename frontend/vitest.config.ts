import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup-tests.ts'],
      css: false,
      // Inline MUI packages through Vite's transform pipeline so directory
      // imports like @mui/material/styles resolve correctly in jsdom/ESM mode.
      server: {
        deps: {
          inline: [/@mui\//],
        },
      },
    },
  })
);
