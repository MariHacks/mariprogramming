import { describe, expect, it } from 'vitest';
import {
	assessmentExpectsCalendarDate,
	guessOutlineIdentity,
	proposalsNeedAssessmentFacts,
	proposalsNeedAssessmentDates,
	proposalsNeedIdentity,
	withGuessedAssessmentDates,
	withGuessedIdentity
} from './identity.js';

describe('outline identity helpers', () => {
	it('detects missing course identity', () => {
		expect(proposalsNeedIdentity({ assessments: [] })).toBe(true);
		expect(proposalsNeedIdentity({ courseCode: '420-SNT-MS', title: 'Web' })).toBe(false);
		expect(proposalsNeedIdentity(null)).toBe(true);
		expect(proposalsNeedIdentity([])).toBe(true);
		expect(proposalsNeedIdentity('bad')).toBe(true);
		expect(proposalsNeedIdentity({ courseCode: 42, title: '  ' })).toBe(true);
	});

	it('detects named assessments missing dates only when a calendar day is expected', () => {
		expect(proposalsNeedAssessmentDates({ assessments: [{ title: 'Midterm', date: '' }] })).toBe(
			true
		);
		expect(
			proposalsNeedAssessmentDates({ assessments: [{ title: 'Midterm', date: '2026-10-01' }] })
		).toBe(false);
		expect(
			proposalsNeedAssessmentDates({ assessments: [{ title: 'Weekly Labs', date: '' }] })
		).toBe(false);
		expect(proposalsNeedAssessmentDates({ assessments: [] })).toBe(false);
		expect(proposalsNeedAssessmentDates(null)).toBe(false);
		expect(proposalsNeedAssessmentDates([])).toBe(false);
		expect(proposalsNeedAssessmentDates({ assessments: 'bad' })).toBe(false);
		expect(
			proposalsNeedAssessmentDates({
				assessments: [null, { title: 3 }, { title: 'Midterm', date: 3 }]
			})
		).toBe(true);
		expect(Reflect.apply(assessmentExpectsCalendarDate, undefined, [null])).toBe(false);
		expect(assessmentExpectsCalendarDate('  ')).toBe(false);
		expect(assessmentExpectsCalendarDate('Quizzes')).toBe(false);
		expect(assessmentExpectsCalendarDate('Final exam')).toBe(false);
		expect(assessmentExpectsCalendarDate('Reading')).toBe(false);
	});

	it('rejects cached extraction data with no assessment facts', () => {
		expect(proposalsNeedAssessmentFacts({ assessments: [] })).toBe(true);
		expect(proposalsNeedAssessmentFacts(null)).toBe(false);
		expect(proposalsNeedAssessmentFacts([])).toBe(false);
		expect(proposalsNeedAssessmentFacts({ assessments: 'bad' })).toBe(true);
		expect(proposalsNeedAssessmentFacts({ assessments: [null, 3] })).toBe(false);
		expect(
			proposalsNeedAssessmentFacts({ assessments: [{ dateIso: null, weightLabel: '' }] })
		).toBe(false);
		expect(proposalsNeedAssessmentFacts({ assessments: [{ dateIso: null }] })).toBe(true);
		expect(proposalsNeedAssessmentFacts({ assessments: [{ weightLabel: '' }] })).toBe(true);
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

	it('reads an instructor name from the following line', () => {
		expect(guessOutlineIdentity('INSTRUCTOR:\nAda Lovelace')).toMatchObject({
			teacherName: 'Ada Lovelace'
		});
	});

	it('returns null identity fields when malformed text has no candidates', () => {
		expect(Reflect.apply(guessOutlineIdentity, undefined, [null])).toEqual({
			courseCode: null,
			title: null,
			section: null,
			teacherName: null
		});
		expect(guessOutlineIdentity('420-SNT-MS\nCOURSE CODE\nshort')).toMatchObject({
			courseCode: '420-SNT-MS',
			title: null,
			teacherName: null
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

	it('normalizes a short section and removes an office suffix from the teacher', () => {
		expect(
			withGuessedIdentity(
				{
					courseCode: '420-SNT-MS',
					title: 'Object-Oriented Programming',
					section: '1',
					teacherName: 'Robert Vincent, G-326',
					assessments: []
				},
				'Object-Oriented Programming\nINSTRUCTOR:\n\nRobert Vincent, G-326\n420-SNT-MS Fall 2026'
			)
		).toMatchObject({ section: '01', teacherName: 'Robert Vincent' });
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

	it('rejects model identity copied from a later PDF page', () => {
		const text =
			'420-SNT-MS Fall 2026 1 Object-Oriented Programming COURSE CODE(S) AND MINISTRY OBJECTIVES ' +
			'INSTRUCTOR: Robert Vincent, G-326 420-SNT-MS Fall 2026 2 Manipulating data with pandas';

		expect(
			withGuessedIdentity(
				{
					courseCode: '420-SNT-MS',
					title: 'Manipulating data with pandas',
					section: '02',
					teacherName: 'Robert Vincent'
				},
				text
			)
		).toMatchObject({
			courseCode: '420-SNT-MS',
			title: 'Object-Oriented Programming',
			section: '01',
			teacherName: 'Robert Vincent'
		});
	});

	it('normalizes malformed identity proposal shapes and keeps nonblank values', () => {
		expect(Reflect.apply(withGuessedIdentity, undefined, [null, null])).toMatchObject({
			courseCode: null,
			title: null,
			section: null,
			teacherName: null
		});
		expect(Reflect.apply(withGuessedIdentity, undefined, [[], ''])).toMatchObject({
			courseCode: null,
			title: null
		});
		expect(
			withGuessedIdentity(
				{ courseCode: 'KEEP', title: 'Keep title', section: 'AB', teacherName: 'Keep teacher' },
				'No outline identity here'
			)
		).toMatchObject({
			courseCode: 'KEEP',
			title: 'Keep title',
			section: 'AB',
			teacherName: 'Keep teacher'
		});
	});

	it('preserves exact due labels and option weights from the evaluation table', () => {
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
			{ title: 'Weekly Labs', weight: 10, date: 'Weekly', dateIso: null, weightLabel: '10%' },
			{ title: 'Quizzes', weight: 10, date: 'As announced', dateIso: null, weightLabel: '10%' },
			{
				title: 'First test',
				weight: null,
				date: 'Friday, October 2',
				dateIso: '2026-10-02',
				weightLabel: '30% / 40%'
			},
			{
				title: 'Project',
				weight: 10,
				date: 'Friday, November 27',
				dateIso: '2026-11-27',
				weightLabel: '10%'
			},
			{
				title: 'Second test',
				weight: null,
				date: 'In common evaluation period',
				dateIso: null,
				weightLabel: '40% / 30%'
			}
		]);
		expect(assessmentExpectsCalendarDate('First test')).toBe(true);
		expect(assessmentExpectsCalendarDate('Weekly Labs')).toBe(false);
		expect(proposalsNeedAssessmentDates(out)).toBe(false);
	});

	it('preserves assessment facts when the PDF extractor flattens the table to one line', () => {
		const text =
			'420-SNT-MS Fall 2026 EVALUATION Due Date / Due Week Type Platform Option A Option B Weekly Labs Lea 10% 10% As announced Quizzes In class 10% 10% Friday, October 2 First test In class 30% 40% Friday, November 27 Project* Lea 10% 10% In common evaluation period Second test* 40% 30% ENRICHMENT COMPONENT';
		const out = withGuessedAssessmentDates(
			{
				assessments: [
					{ title: 'Labs' },
					{ title: 'Quizzes' },
					{ title: 'First test' },
					{ title: 'Project*' },
					{ title: 'Second test*' }
				]
			},
			text
		);

		expect(out.assessments[0]).toMatchObject({ title: 'Weekly Labs' });
		const assessments = /** @type {Array<Record<string, unknown>>} */ (out.assessments);
		expect(assessments.map((row) => ({ date: row.date, weightLabel: row.weightLabel }))).toEqual([
			{ date: 'Weekly', weightLabel: '10%' },
			{ date: 'As announced', weightLabel: '10%' },
			{ date: 'Friday, October 2', weightLabel: '30% / 40%' },
			{ date: 'Friday, November 27', weightLabel: '10%' },
			{ date: 'In common evaluation period', weightLabel: '40% / 30%' }
		]);
	});

	it('recovers all assessment rows when the model returns an empty assessment array', () => {
		const text =
			'420-SNT-MS Fall 2026 EVALUATION Due Date / Due Week Type Platform Option A Option B Weekly Labs Lea 10% 10% As announced Quizzes In class 10% 10% Friday, October 2 First test In class 30% 40% Friday, November 27 Project* Lea 10% 10% In common evaluation period Second test* 40% 30% ENRICHMENT COMPONENT';
		const out = withGuessedAssessmentDates({ assessments: [] }, text);

		expect(out.assessments).toMatchObject([
			{ title: 'Weekly Labs', date: 'Weekly', weightLabel: '10%' },
			{ title: 'Quizzes', date: 'As announced', weightLabel: '10%' },
			{ title: 'First test', date: 'Friday, October 2', weightLabel: '30% / 40%' },
			{ title: 'Project*', date: 'Friday, November 27', weightLabel: '10%' },
			{
				title: 'Second test*',
				date: 'In common evaluation period',
				weightLabel: '40% / 30%'
			}
		]);
	});

	it('covers malformed assessment proposals and table rows', () => {
		expect(Reflect.apply(withGuessedAssessmentDates, undefined, [null, null])).toEqual({
			assessments: []
		});
		expect(Reflect.apply(withGuessedAssessmentDates, undefined, [[], ''])).toEqual({
			assessments: []
		});
		expect(withGuessedAssessmentDates({ assessments: 'bad' }, '')).toEqual({
			assessments: []
		});
		const text = `Due Date Option A
Weekly  Labs without weights
Weekly   10% 10%
Friday, October 0  Zero day  10% 10%
not a due row`;
		expect(
			withGuessedAssessmentDates(
				{ assessments: [null, 3, {}, { title: 4 }, { title: 'Missing' }] },
				text
			).assessments
		).toEqual([null, 3, {}, { title: 4 }, { title: 'Missing' }]);
		expect(
			withGuessedAssessmentDates({ assessments: [{ title: 'Missing' }] }, 'Weekly   10% 10%')
		).toEqual({ assessments: [{ title: 'Missing' }] });
	});

	it('derives calendar years from generic text and the current year fallback', () => {
		const generic = withGuessedAssessmentDates(
			{ assessments: [] },
			'Copyright 2027\nFriday, October 2  Project  10% 10%'
		);
		expect(generic.assessments[0].dateIso).toBe('2027-10-02');
		const current = withGuessedAssessmentDates(
			{ assessments: [] },
			'Friday, November 3  Essay  20% 30%'
		);
		expect(current.assessments[0]).toMatchObject({
			dateIso: `${new Date().getFullYear()}-11-03`,
			weight: null,
			weightLabel: '20% / 30%'
		});
	});

	it('matches assessment titles by exact and contained text', () => {
		const text = `Weekly  Labs  10% 10%
Friday, October 2  Final Project  20% 20%
Friday, October 3  Essay  30% 30%`;
		const out = withGuessedAssessmentDates(
			{
				assessments: [
					{ title: 'Labs' },
					{ title: 'Project' },
					{ title: 'Essay draft' },
					{ title: 'Unmatched' }
				]
			},
			text
		);
		expect(out.assessments).toMatchObject([
			{ title: 'Weekly Labs', weightLabel: '10%' },
			{ title: 'Project', weightLabel: '20%' },
			{ title: 'Essay draft', weightLabel: '30%' },
			{ title: 'Unmatched' }
		]);
	});
});
