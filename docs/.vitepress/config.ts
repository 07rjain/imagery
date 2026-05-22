import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Imagery',
  description: 'Provider-agnostic TypeScript image generation library.',
  base: '/imagery/',
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/getting-started' },
      { text: 'API', link: '/api/' },
      { text: 'npm', link: 'https://www.npmjs.com/package/@rishabhbothra/imagery' },
    ],
    sidebar: [
      { text: 'Overview', link: '/' },
      { text: 'Getting Started', link: '/getting-started' },
      { text: 'BYOK', link: '/guides/byok' },
      { text: 'Long-Running Jobs', link: '/guides/nextjs-jobs' },
      { text: 'Inpainting', link: '/guides/inpainting' },
      { text: 'Mask Cookbook', link: '/guides/mask-cookbook' },
      { text: 'Safety', link: '/guides/safety' },
      { text: 'Usage And Billing', link: '/guides/usage-billing' },
      { text: 'Model Discovery', link: '/guides/model-discovery' },
      { text: 'Errors And Progress', link: '/guides/errors-progress' },
      { text: 'Environment Variables', link: '/guides/env-vars' },
      { text: 'Edit Cookbook', link: '/guides/edit-cookbook' },
      { text: 'Testing', link: '/guides/testing' },
    ],
  },
});
