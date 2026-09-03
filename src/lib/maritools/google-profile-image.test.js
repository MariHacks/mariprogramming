import { describe, expect, it } from 'vitest';
import { googleProfileImageUrl } from './google-profile-image.js';

describe('googleProfileImageUrl', () => {
	it('returns a canonical Google HTTPS avatar URL', () => {
		expect(googleProfileImageUrl('https://LH3.googleusercontent.com:443/a/avatar=s96-c')).toBe(
			'https://lh3.googleusercontent.com/a/avatar=s96-c'
		);
	});

	it.each([
		null,
		undefined,
		42,
		'',
		'not a URL',
		'http://lh3.googleusercontent.com/avatar',
		'https://example.com/avatar',
		'https://lh3.googleusercontent.com.evil.test/avatar',
		'https://googleusercontent.com/avatar',
		'https://lh.googleusercontent.com/avatar',
		'https://user@lh3.googleusercontent.com/avatar',
		'https://:password@lh3.googleusercontent.com/avatar',
		'https://lh3.googleusercontent.com:8443/avatar',
		`https://lh3.googleusercontent.com/${'a'.repeat(2048)}`
	])('rejects unsafe or malformed avatar value %s', (value) => {
		expect(googleProfileImageUrl(value)).toBeNull();
	});
});
