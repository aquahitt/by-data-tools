import { defineConfig } from 'vite';

// The npm package: src/lib.ts as one ES module in lib/; declarations come from tsconfig.lib.json.
export default defineConfig({
  build: {
    outDir: 'lib',
    emptyOutDir: true,
    minify: false,
    lib: { entry: 'src/lib.ts', formats: ['es'], fileName: 'index' },
  },
});
