// you may need to run `npm i -D @sveltejs/adapter-vercel` locally to install the adapter first
import adapter from '@sveltejs/adapter-vercel';

export default {
	compilerOptions: {
		compatibility: {
			componentApi: 4
		}
	},
	kit: {
		adapter: adapter({ runtime: 'nodejs22.x' }),
		csp: {
			mode: 'auto',
			directives: {
				'default-src': ['self'],
				'base-uri': ['none'],
				'object-src': ['none'],
				'script-src': ['self'],
				'style-src': ['self'],
				// SvelteKit's generated screen-reader announcer uses this one static style attribute.
				'style-src-attr': ['unsafe-hashes', 'sha256-S8qMpvofolR8Mpjy4kQvEm7m1q8clzU4dfDH0AmvZjo='],
				'font-src': ['self'],
				'img-src': ['self', 'data:', 'blob:', 'https:'],
				'connect-src': ['self'],
				'form-action': ['self'],
				'frame-src': ['self', 'https://www.google.com'],
				'frame-ancestors': ['none'],
				'manifest-src': ['self'],
				'worker-src': ['self'],
				'upgrade-insecure-requests': true
			}
		}
	}
};
