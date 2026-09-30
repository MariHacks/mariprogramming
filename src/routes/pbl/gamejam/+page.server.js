export const prerender = false;

/** @type {import('./$types').PageServerLoad} */
export function load({ locals }) {
	const session = locals.maritools;
	return {
		signedIn: Boolean(session?.userId),
		email: session?.email ?? null
	};
}
