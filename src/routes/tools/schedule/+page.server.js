import { parseOmnivox } from '$lib/maritools/schedule/parseOmnivox.js';

export const prerender = false;

export const actions = {
	default: async ({ request }) => {
		const data = await request.formData();
		const paste = String(data.get('paste') ?? '');
		return { result: parseOmnivox(paste) };
	}
};
