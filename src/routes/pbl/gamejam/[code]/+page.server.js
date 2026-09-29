export const prerender = false;

/** @type {import('./$types').PageServerLoad} */
export function load({ locals }) {
	const session = locals.maritools;
	if (!session?.userId) {
		return { collabUser: null };
	}
	return {
		collabUser: {
			userId: session.userId,
			email: session.email,
			name: session.displayName ?? null
		}
	};
}
