// you may need to run `npm i -D @sveltejs/adapter-static` to install the adapter first
import adapter from '@sveltejs/adapter-static';

export default {
	kit: {
		adapter: adapter({
			// prep for github pages deployment
			pages: 'build',
			assets: 'build',
			fallback: undefined,
			precompress: false,
			strict: true
		})
	}
};