import { redirect } from '@sveltejs/kit';
import { requireStaff } from '$lib/server/auth/authorization.js';

export function load({ locals }) {
	requireStaff(locals);
	redirect(303, '/staff/catalogue/entries');
}
