import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Imagery',
  description: 'Provider-agnostic TypeScript image generation library.',
  base: '/imagery/',
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/getting-started' },
      { text: 'API', link: '/api/' },
    ],
    sidebar: [
      { text: 'Overview', link: '/' },
      { text: 'Getting Started', link: '/getting-started' },
      { text: 'Inpainting', link: '/guides/inpainting' },
      { text: 'Safety', link: '/guides/safety' },
      { text: 'Testing', link: '/guides/testing' },
    ],
  },
});
