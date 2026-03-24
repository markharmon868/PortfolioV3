import { defineConfig } from 'vite';

export default defineConfig({
  base: '/PortfolioV3/',
  optimizeDeps: {
    // Bundle all Three.js sub-imports into a single pre-bundled chunk
    // so the core module isn't duplicated across CSS3DRenderer / GLTFLoader.
    include: [
      'three',
      'three/examples/jsm/renderers/CSS3DRenderer.js',
      'three/examples/jsm/loaders/GLTFLoader.js',
    ],
  },
});
