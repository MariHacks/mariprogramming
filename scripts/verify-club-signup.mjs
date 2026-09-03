import { spawnSync } from 'node:child_process';

const result = spawnSync(
	'npx',
	[
		'vitest',
		'run',
		'src/lib/server/maritools/club-store.test.js',
		'src/lib/server/maritools/repository.integration.test.js',
		'src/lib/server/maritools/bootstrap.test.js',
		'src/lib/server/db/migration.integration.test.js',
		'src/routes/staff/members/page.server.test.js',
		'src/routes/staff/members/page.test.js',
		'src/routes/staff/members/[userId]/page.server.test.js',
		'src/routes/staff/members/[userId]/page.test.js',
		'src/routes/tools/account/page.server.test.js',
		'src/routes/tools/account/page.test.js',
		'src/routes/tools/schedule/page.server.test.js',
		'src/routes/tools/schedule/page.test.js',
		'src/routes/staff/layout.test.js'
	],
	{ stdio: 'inherit', shell: process.platform === 'win32' }
);

process.exitCode = result.status ?? 1;
