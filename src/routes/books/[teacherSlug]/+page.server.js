import { redirect } from '@sveltejs/kit';

export const prerender = false;

/** @param {{ parent: () => Promise<unknown> }} event */
export async function load({ parent }) {
	await parent();
	redirect(308, '/books');
}
