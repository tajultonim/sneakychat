import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      precompress: false,
      pages: 'build',
      assets: 'build',
      strict: false
    }),
    serviceWorker: {
      register: false
    },
    alias: {
      $lib: 'src/lib',
      $stores: 'src/stores',
      $components: 'src/components'
    }
  }
};
