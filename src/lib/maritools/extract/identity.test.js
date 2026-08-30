import { describe, expect, it } from 'vitest';
import {
	guessOutlineIdentity,
	proposalsNeedIdentity,
	withGuessedIdentity
} from './identity.js';

describe('outline identity helpers', () => {
	it('detects missing course identity', () => {
		expect(proposalsNeedIdentity({ assessments: [] })).toBe(true);
		expect(proposalsNeedIdentity({ courseCode: '420-SNT-MS', title: 'Web' })).toBe(false);
	});

	it('guesses identity fields from outline text', () => {
		const text = `Mariana Academy
420-SNT-MS
Web Programming
Section: 00001
Teacher: Ada Lovelace
Assessments follow.`;
		expect(guessOutlineIdentity(text)).toMatchObject({
			courseCode: '420-SNT-MS',
			section: '00001',
			teacherName: 'Ada Lovelace'
		});
	});

	it('fills blank identity from text without clobbering assessments', () => {
		expect(
			withGuessedIdentity(
				{ assessments: [{ title: 'Midterm' }], courseCode: null, title: null },
				'420-SNT-MS\nWeb Programming\nSection: 00002\nInstructor: Blake'
			)
		).toMatchObject({
			courseCode: '420-SNT-MS',
			title: 'Web Programming',
			section: '00002',
			teacherName: 'Blake',
			assessments: [{ title: 'Midterm' }]
		});
	});
});
