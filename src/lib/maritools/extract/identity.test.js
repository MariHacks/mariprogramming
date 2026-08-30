import { describe, expect, it } from 'vitest';
import {
	assessmentExpectsCalendarDate,
	guessOutlineIdentity,
	proposalsNeedAssessmentDates,
	proposalsNeedIdentity,
	withGuessedAssessmentDates,
	withGuessedIdentity
} from './identity.js';

describe('outline identity helpers', () => {
	it('detects missing course identity', () => {
		expect(proposalsNeedIdentity({ assessments: [] })).toBe(true);
		expect(proposalsNeedIdentity({ courseCode: '420-SNT-MS', title: 'Web' })).toBe(false);
	});

	it('detects named assessments missing dates only when a calendar day is expected', () => {
		expect(proposalsNeedAssessmentDates({ assessments: [{ title: 'Midterm', date: '' }] })).toBe(
			true
		);
		expect(
			proposalsNeedAssessmentDates({ assessments: [{ title: 'Midterm', date: '2026-10-01' }] })
		).toBe(false);
		expect(proposalsNeedAssessmentDates({ assessments: [{ title: 'Weekly Labs', date: '' }] })).toBe(
			false
		);
		expect(proposalsNeedAssessmentDates({ assessments: [] })).toBe(false);
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

	it('fills only blank identity holes when model already returned code+title', () => {
		expect(
			withGuessedIdentity(
				{
					courseCode: '420-SNT-MS',
					title: 'Object-Oriented Programming',
					section: null,
					teacherName: null,
					assessments: []
				},
				'INSTRUCTOR:\n\nRobert Vincent, G-326\nSection: 00007'
			)
		).toMatchObject({
			courseCode: '420-SNT-MS',
			title: 'Object-Oriented Programming',
			section: '00007',
			teacherName: 'Robert Vincent'
		});
	});

	it('defaults section to 01 when outline omits section but has code+title+teacher', () => {
		expect(
			withGuessedIdentity(
				{
					courseCode: '420-SNT-MS',
					title: 'Object-Oriented Programming',
					section: null,
					teacherName: 'Robert Vincent',
					assessments: []
				},
				'Object-Oriented Programming\nINSTRUCTOR:\n\nRobert Vincent, G-326\n420-SNT-MS Fall 2026'
			)
		).toMatchObject({ section: '01', teacherName: 'Robert Vincent' });
	});

	it('maps evaluation-table calendar dues onto assessment rows', () => {
		const text = `Fall 2026
Due Date / Due Week                 Type                         Platform         Option A        Option B
Weekly                              Labs                         Lea              10%             10%
As announced                        Quizzes                      In class         10%             10%
Friday, October 2                   First test                   In class         30%             40%
Friday, November 27                 Project*                     Lea              10%             10%
In common evaluation period         Second test*                                  40%             30%
`;
		const out = withGuessedAssessmentDates(
			{
				assessments: [
					{ title: 'Weekly Labs', weight: 10, date: null },
					{ title: 'Quizzes', weight: 10, date: '2026-10-02' },
					{ title: 'First test', weight: 30, date: '2026-11-27' },
					{ title: 'Project', weight: 10, date: null },
					{ title: 'Second test', weight: 40, date: null }
				]
			},
			text
		);
		expect(out.assessments).toEqual([
			{ title: 'Weekly Labs', weight: 10, date: null },
			{ title: 'Quizzes', weight: 10, date: null },
			{ title: 'First test', weight: 30, date: '2026-10-02' },
			{ title: 'Project', weight: 10, date: '2026-11-27' },
			{ title: 'Second test', weight: 40, date: null }
		]);
		expect(assessmentExpectsCalendarDate('First test')).toBe(true);
		expect(assessmentExpectsCalendarDate('Weekly Labs')).toBe(false);
		expect(proposalsNeedAssessmentDates(out)).toBe(false);
	});
});
