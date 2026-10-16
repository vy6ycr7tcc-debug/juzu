import { defineConfig, Plugin } from 'vite';
import fs from 'fs';
import path from 'path';

function getFilesFromDir(dir: string, base: string = ''): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFilesFromDir(filePath, path.join(base, file)));
    } else {
      results.push(path.join(base, file));
    }
  });
  return results;
}

function pwaAssetsPlugin(): Plugin {
  return {
    name: 'pwa-assets-plugin',
    apply: 'build',
    enforce: 'post',
    generateBundle(options, bundle) {
      const assets: string[] = [];

      // 1. Collect all bundle chunks & generated assets (except sw.js)
      for (const fileName in bundle) {
        if (fileName !== 'sw.js') {
          assets.push(`/juzu/${fileName}`);
        }
      }

      // 2. Collect all public static assets (models, textures, icons, manifest)
      const publicDir = path.resolve(import.meta.dirname, 'public');
      if (fs.existsSync(publicDir)) {
        const publicFiles = getFilesFromDir(publicDir);
        for (const file of publicFiles) {
          const normalized = file.split(path.sep).join('/');
          const url = `/juzu/${normalized}`;
          if (!assets.includes(url)) {
            assets.push(url);
          }
        }
      }

      // 3. Inject into sw.js
      const swChunk = bundle['sw.js'];
      if (swChunk && swChunk.type === 'chunk') {
        const assetsJson = JSON.stringify(assets);
        swChunk.code = swChunk.code.replace(
          /\[\s*[`'"]__PRECACHE_ASSETS__[`'"]\s*\]/,
          assetsJson
        );
      }
    },
  };
}

export default defineConfig({
  base: '/juzu/',
  build: {
    target: 'esnext',
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: 'index.html',
        sw: path.resolve(import.meta.dirname, 'src/pwa/sw.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'sw') {
            return 'sw.js';
          }
          return 'assets/[name]-[hash].js';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
  plugins: [pwaAssetsPlugin()],
});
