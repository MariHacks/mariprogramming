// @vitest-environment node

import { readdir, readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const DRIZZLE_DIRECTORY = new URL('../../../../drizzle/', import.meta.url);
const JOURNAL_FILE = new URL('../../../../drizzle/meta/_journal.json', import.meta.url);

describe('MariTools migration journal', () => {
	it('registers every committed SQL migration in execution order', async () => {
		const sqlTags = (await readdir(DRIZZLE_DIRECTORY))
			.filter((name) => /^\d{4}_.+\.sql$/u.test(name))
			.sort()
			.map((name) => name.replace(/\.sql$/u, ''));
		const journal = JSON.parse(await readFile(JOURNAL_FILE, 'utf8'));
		const journalTags = journal.entries.map((entry) => entry.tag);

		expect(journalTags).toEqual(sqlTags);
	});
});
