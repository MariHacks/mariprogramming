export async function endStaffSession() {
	try {
		const response = await fetch('/api/auth/sign-out', {
			method: 'POST',
			credentials: 'same-origin',
			headers: {
				accept: 'application/json',
				'content-type': 'application/json'
			},
			body: '{}'
		});
		if (!response.ok) throw new Error('request failed');
		const body = await response.json();
		if (body?.success !== true) throw new Error('request failed');
		return true;
	} catch {
		throw new Error('Sign out is unavailable');
	}
}
