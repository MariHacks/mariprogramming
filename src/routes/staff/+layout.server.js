import { requireStaff } from '$lib/server/auth/authorization.js';

export const prerender = false;

export function load({ locals, url }) {
	if (url.pathname === '/staff/sign-in') return { staff: null, pathname: url.pathname };
	return { staff: requireStaff(locals), pathname: url.pathname };
}
