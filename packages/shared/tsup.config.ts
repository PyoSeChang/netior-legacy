import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'types/index': 'src/types/index.ts',
    'constants/index': 'src/constants/index.ts',
    'i18n/index': 'src/i18n/index.ts',
    'dsl/index': 'src/dsl/index.ts',
    'interactive-view/index': 'src/interactive-view/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
});
