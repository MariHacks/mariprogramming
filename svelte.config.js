// you may need to run `npm i -D @sveltejs/adapter-vercel` locally to install the adapter first
import adapter from '@sveltejs/adapter-vercel';

export default {
	kit: {
		adapter: adapter() // see https://kit.svelte.dev/docs/adapter-vercel for config options
	}
};