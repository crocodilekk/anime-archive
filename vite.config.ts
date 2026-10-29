import { defineConfig } from 'vite';

// base: './' —— 相对路径，可直接部署到 GitHub Pages 任意子路径
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
  },
});
