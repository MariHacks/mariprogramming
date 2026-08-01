// you may need to run `npm i -D @sveltejs/adapter-vercel` locally to install the adapter first
import adapter from '@sveltejs/adapter-vercel';

export default {
	kit: {
		adapter: adapter({ runtime: 'nodejs22.x' })
	}
};
