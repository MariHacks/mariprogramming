// @vitest-environment node

import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import * as artifactTools from '../../scripts/production-artifact-scanner.mjs';

const { ArtifactScanError, scanProductionArtifacts } = artifactTools;
const executeFile = promisify(execFile);
const scannerScript = fileURLToPath(
	new URL('../../scripts/scan-production-artifacts.mjs', import.meta.url)
);

/** @type {string[]} */
const temporaryDirectories = [];

async function fixture() {
	const directory = await mkdtemp(join(tmpdir(), 'mpc-artifact-scan-'));
	temporaryDirectories.push(directory);
	return directory;
}

afterEach(async () => {
	await Promise.all(
		temporaryDirectories
			.splice(0)
			.map((directory) => rm(directory, { recursive: true, force: true }))
	);
});

describe('production artifact scanner', () => {
	it('defaults to the exact Vercel output directory', async () => {
		const root = await fixture();
		await mkdir(join(root, '.vercel', 'output'), { recursive: true });
		await mkdir(join(root, '.svelte-kit', 'output'), { recursive: true });
		await writeFile(join(root, '.vercel', 'output', 'config.json'), '{}');
		await writeFile(
			join(root, '.svelte-kit', 'output', 'app.js'),
			'//# sourceMappingURL=app.js.map'
		);

		const { stdout } = await executeFile(process.execPath, [scannerScript], { cwd: root });
		expect(stdout).toBe('Production artifact scan passed: 1 files, 2 bytes\n');
	});

	it('scans an actual Vercel adapter layout and follows an in-root route symlink once', async () => {
		const root = await fixture();
		await mkdir(join(root, 'static'), { recursive: true });
		await mkdir(join(root, 'functions', '![-]', 'catchall.func'), { recursive: true });
		await writeFile(join(root, 'config.json'), '{}');
		await writeFile(join(root, 'static', 'app.js'), 'client');
		await writeFile(join(root, 'functions', '![-]', 'catchall.func', 'index.js'), 'server');
		await symlink('![-]/catchall.func', join(root, 'functions', 'books.func'));

		await expect(scanProductionArtifacts(root)).resolves.toEqual({
			filesScanned: 3,
			bytesScanned: 14
		});
	});

	it('classifies Vercel static output as client code', async () => {
		const root = await fixture();
		await mkdir(join(root, 'static'), { recursive: true });
		await writeFile(join(root, 'static', 'app.js'), 'const field = "DATABASE_URL";');

		await expect(scanProductionArtifacts(root)).rejects.toMatchObject({
			rule: 'client-private-name'
		});
	});

	it('does not mistake dependency connection-string examples or templates for credentials', async () => {
		const root = await fixture();
		await mkdir(join(root, 'functions', 'app.func', 'node_modules', 'database'), {
			recursive: true
		});
		await writeFile(
			join(root, 'functions', 'app.func', 'node_modules', 'database', 'index.js'),
			'const example = "postgresql://user:password@host.tld/dbname"; const runtime = `postgresql://${encode(user)}:${encode(password)}@${encode(host)}/database`;'
		);

		await expect(scanProductionArtifacts(root)).resolves.toMatchObject({ filesScanned: 1 });
	});

	it('allows the OpenTelemetry Unix socket example but still rejects temporary build paths', async () => {
		const cleanRoot = await fixture();
		await writeFile(join(cleanRoot, 'telemetry.js'), 'const socket = "/tmp/my.sock";');
		await expect(scanProductionArtifacts(cleanRoot)).resolves.toMatchObject({ filesScanned: 1 });

		const leakedRoot = await fixture();
		await writeFile(join(leakedRoot, 'app.js'), 'const file = "/tmp/build-output/image.png";');
		await expect(scanProductionArtifacts(leakedRoot)).rejects.toMatchObject({ rule: 'local-path' });
	});

	it('allows PEM parser delimiters without allowing a complete private key', async () => {
		const root = await fixture();
		await writeFile(
			join(root, 'crypto.js'),
			'const begin = "-----BEGIN PRIVATE KEY-----"; const end = "-----END PRIVATE KEY-----";'
		);

		await expect(scanProductionArtifacts(root)).resolves.toMatchObject({ filesScanned: 1 });
	});

	it('rejects escaping, cyclic, and non-directory Vercel route symlinks', async () => {
		const outside = await fixture();
		const escapeRoot = await fixture();
		await mkdir(join(outside, 'outside.func'), { recursive: true });
		await mkdir(join(escapeRoot, 'functions'), { recursive: true });
		await symlink(join(outside, 'outside.func'), join(escapeRoot, 'functions', 'books.func'));
		await expect(scanProductionArtifacts(escapeRoot)).rejects.toMatchObject({ rule: 'symlink' });

		const cycleRoot = await fixture();
		await mkdir(join(cycleRoot, 'functions'), { recursive: true });
		await symlink('loop.func', join(cycleRoot, 'functions', 'loop.func'));
		await expect(scanProductionArtifacts(cycleRoot)).rejects.toMatchObject({ rule: 'symlink' });

		const fileRoot = await fixture();
		await mkdir(join(fileRoot, 'functions'), { recursive: true });
		await writeFile(join(fileRoot, 'functions', 'target.func'), 'not a directory');
		await symlink('target.func', join(fileRoot, 'functions', 'books.func'));
		await expect(scanProductionArtifacts(fileRoot)).rejects.toMatchObject({ rule: 'symlink' });
	});

	it('removes only the pinned Better Fetch directives and leaves source-map files rejectable', async () => {
		expect(artifactTools.sanitizeProductionDependencySourceMaps).toBeTypeOf('function');
		const sanitize = /** @type {Function} */ (artifactTools.sanitizeProductionDependencySourceMaps);
		const root = await fixture();
		const dependency = join(
			root,
			'functions',
			'![-]',
			'catchall.func',
			'node_modules',
			'@better-fetch',
			'fetch',
			'dist'
		);
		await mkdir(dependency, { recursive: true });
		await writeFile(
			join(dependency, '..', 'package.json'),
			JSON.stringify({ name: '@better-fetch/fetch', version: '1.3.1' })
		);
		await writeFile(join(dependency, 'index.js'), 'export {};\n//# sourceMappingURL=index.js.map');
		await writeFile(
			join(dependency, 'index.cjs'),
			'module.exports = {};\n//# sourceMappingURL=index.cjs.map'
		);
		await writeFile(join(dependency, 'index.js.map'), '{}');
		await writeFile(join(dependency, 'index.cjs.map'), '{}');

		await expect(sanitize(root)).resolves.toEqual({ filesChanged: 2, mapsRemoved: 0 });
		expect(await readFile(join(dependency, 'index.js'), 'utf8')).toBe('export {};\n');
		expect(await readFile(join(dependency, 'index.cjs'), 'utf8')).toBe('module.exports = {};\n');
		expect(await readFile(join(dependency, 'index.js.map'), 'utf8')).toBe('{}');
		expect(await readFile(join(dependency, 'index.cjs.map'), 'utf8')).toBe('{}');
		await expect(scanProductionArtifacts(root)).rejects.toMatchObject({ rule: 'source-map' });
	});

	it('leaves unapproved dependency directives for the scanner to reject', async () => {
		const sanitize = /** @type {Function} */ (artifactTools.sanitizeProductionDependencySourceMaps);
		const root = await fixture();
		const dependency = join(
			root,
			'functions',
			'![-]',
			'catchall.func',
			'node_modules',
			'future-package',
			'dist'
		);
		await mkdir(dependency, { recursive: true });
		await writeFile(
			join(dependency, '..', 'package.json'),
			JSON.stringify({ name: 'future-package', version: '1.0.0' })
		);
		await writeFile(join(dependency, 'index.js'), 'export {};\n//# sourceMappingURL=index.js.map');

		await expect(sanitize(root)).resolves.toEqual({ filesChanged: 0, mapsRemoved: 0 });
		expect(await readFile(join(dependency, 'index.js'), 'utf8')).toContain('sourceMappingURL');
		await expect(scanProductionArtifacts(root)).rejects.toMatchObject({ rule: 'source-map' });
	});

	it('requires the exact pinned package inventory at the exact Vercel function path', async () => {
		const sanitize = /** @type {Function} */ (artifactTools.sanitizeProductionDependencySourceMaps);
		const root = await fixture();
		for (const functionName of ['![-]/catchall.func', 'other.func']) {
			const dependency = join(
				root,
				'functions',
				functionName,
				'node_modules',
				'@better-fetch',
				'fetch'
			);
			await mkdir(join(dependency, 'dist'), { recursive: true });
			await writeFile(
				join(dependency, 'package.json'),
				JSON.stringify({ name: '@better-fetch/fetch', version: '1.3.1' })
			);
			await writeFile(
				join(dependency, 'dist', 'index.js'),
				'export {};\n//# sourceMappingURL=index.js.map'
			);
			await writeFile(
				join(dependency, 'dist', 'index.cjs'),
				'module.exports = {};\n//# sourceMappingURL=index.cjs.map'
			);
		}
		const approvedDependency = join(
			root,
			'functions',
			'![-]',
			'catchall.func',
			'node_modules',
			'@better-fetch',
			'fetch'
		);
		await writeFile(
			join(approvedDependency, 'dist', 'unexpected.js'),
			'export {};\n//# sourceMappingURL=unexpected.js.map'
		);

		await expect(sanitize(root)).resolves.toEqual({ filesChanged: 0, mapsRemoved: 0 });
		for (const functionName of ['![-]/catchall.func', 'other.func']) {
			expect(
				await readFile(
					join(
						root,
						'functions',
						functionName,
						'node_modules',
						'@better-fetch',
						'fetch',
						'dist',
						'index.js'
					),
					'utf8'
				)
			).toContain('sourceMappingURL');
		}
		await expect(scanProductionArtifacts(root)).rejects.toMatchObject({ rule: 'source-map' });
	});

	it('does not sanitize through an intermediate dependency symlink', async () => {
		const sanitize = /** @type {Function} */ (artifactTools.sanitizeProductionDependencySourceMaps);
		const root = await fixture();
		const outside = await fixture();
		const dependencyRoot = join(root, 'functions', '![-]', 'catchall.func', 'node_modules');
		const outsideScope = join(outside, '@better-fetch');
		const dependency = join(outsideScope, 'fetch');
		await mkdir(dependencyRoot, { recursive: true });
		await mkdir(join(dependency, 'dist'), { recursive: true });
		await writeFile(
			join(dependency, 'package.json'),
			JSON.stringify({ name: '@better-fetch/fetch', version: '1.3.1' })
		);
		await writeFile(
			join(dependency, 'dist', 'index.js'),
			'export {};\n//# sourceMappingURL=index.js.map'
		);
		await writeFile(
			join(dependency, 'dist', 'index.cjs'),
			'module.exports = {};\n//# sourceMappingURL=index.cjs.map'
		);
		await symlink(outsideScope, join(dependencyRoot, '@better-fetch'));

		await expect(sanitize(root)).resolves.toEqual({ filesChanged: 0, mapsRemoved: 0 });
		expect(await readFile(join(dependency, 'dist', 'index.js'), 'utf8')).toContain(
			'sourceMappingURL'
		);
		await expect(scanProductionArtifacts(root)).rejects.toMatchObject({ rule: 'symlink' });
	});

	it('does not sanitize an otherwise matching inventory from another package version', async () => {
		const sanitize = /** @type {Function} */ (artifactTools.sanitizeProductionDependencySourceMaps);
		const root = await fixture();
		const dependency = join(
			root,
			'functions',
			'![-]',
			'catchall.func',
			'node_modules',
			'@better-fetch',
			'fetch'
		);
		await mkdir(join(dependency, 'dist'), { recursive: true });
		await writeFile(
			join(dependency, 'package.json'),
			JSON.stringify({ name: '@better-fetch/fetch', version: '1.3.2' })
		);
		await writeFile(
			join(dependency, 'dist', 'index.js'),
			'export {};\n//# sourceMappingURL=index.js.map'
		);
		await writeFile(
			join(dependency, 'dist', 'index.cjs'),
			'module.exports = {};\n//# sourceMappingURL=index.cjs.map'
		);

		await expect(sanitize(root)).resolves.toEqual({ filesChanged: 0, mapsRemoved: 0 });
		expect(await readFile(join(dependency, 'dist', 'index.js'), 'utf8')).toContain(
			'sourceMappingURL'
		);
		await expect(scanProductionArtifacts(root)).rejects.toMatchObject({ rule: 'source-map' });
	});

	it('requires each approved directive to be an exact terminal comment line', async () => {
		const sanitize = /** @type {Function} */ (artifactTools.sanitizeProductionDependencySourceMaps);
		const root = await fixture();
		const dependency = join(
			root,
			'functions',
			'![-]',
			'catchall.func',
			'node_modules',
			'@better-fetch',
			'fetch'
		);
		await mkdir(join(dependency, 'dist'), { recursive: true });
		await writeFile(
			join(dependency, 'package.json'),
			JSON.stringify({ name: '@better-fetch/fetch', version: '1.3.1' })
		);
		await writeFile(
			join(dependency, 'dist', 'index.js'),
			'export const value = "//# sourceMappingURL=index.js.map'
		);
		await writeFile(
			join(dependency, 'dist', 'index.cjs'),
			'module.exports = "//# sourceMappingURL=index.cjs.map'
		);

		await expect(sanitize(root)).resolves.toEqual({ filesChanged: 0, mapsRemoved: 0 });
		expect(await readFile(join(dependency, 'dist', 'index.js'), 'utf8')).toContain(
			'sourceMappingURL'
		);
		await expect(scanProductionArtifacts(root)).rejects.toMatchObject({ rule: 'source-map' });
	});

	it.each([
		['inline data', '//# sourceMappingURL=data:application/json;base64,e30='],
		['remote URL', '//# sourceMappingURL=https://example.com/index.js.map'],
		['path traversal', '//# sourceMappingURL=../../index.js.map'],
		['block comment', '/*# sourceMappingURL=index.js.map */'],
		['embedded sources', 'const metadata = { sourcesContent: ["private source"] };']
	])('leaves an unapproved %s shape for the scanner to reject', async (_label, unsafeShape) => {
		const sanitize = /** @type {Function} */ (artifactTools.sanitizeProductionDependencySourceMaps);
		const root = await fixture();
		const dependency = join(
			root,
			'functions',
			'![-]',
			'catchall.func',
			'node_modules',
			'@better-fetch',
			'fetch'
		);
		await mkdir(join(dependency, 'dist'), { recursive: true });
		await writeFile(
			join(dependency, 'package.json'),
			JSON.stringify({ name: '@better-fetch/fetch', version: '1.3.1' })
		);
		await writeFile(join(dependency, 'dist', 'index.js'), unsafeShape);
		await writeFile(
			join(dependency, 'dist', 'index.cjs'),
			'module.exports = {};\n//# sourceMappingURL=index.cjs.map'
		);

		await expect(sanitize(root)).resolves.toEqual({ filesChanged: 0, mapsRemoved: 0 });
		expect(await readFile(join(dependency, 'dist', 'index.js'), 'utf8')).toBe(unsafeShape);
		await expect(scanProductionArtifacts(root)).rejects.toMatchObject({ rule: 'source-map' });
	});

	it('scans a clean tree in deterministic order and permits private names only on the server', async () => {
		const root = await fixture();
		await mkdir(join(root, 'client'), { recursive: true });
		await mkdir(join(root, 'server'), { recursive: true });
		await writeFile(join(root, 'client', 'app.js'), 'console.log("ready")');
		await writeFile(join(root, 'server', 'env.js'), 'const name = "DATABASE_URL";');
		await writeFile(join(root, 'image.png'), Buffer.from([0, 1, 2, 3]));

		await expect(scanProductionArtifacts(root)).resolves.toEqual({
			filesScanned: 3,
			bytesScanned: 52
		});
	});

	it.each([
		['uppercase', 'client/app.MAP'],
		['mixed-case', 'server/chunk.mAp']
	])('rejects a %s source-map file extension', async (_label, relativePath) => {
		const root = await fixture();
		await mkdir(join(root, relativePath, '..'), { recursive: true });
		await writeFile(join(root, relativePath), '{}');

		await expect(scanProductionArtifacts(root)).rejects.toMatchObject({ rule: 'source-map' });
	});

	it.each([
		[
			'TypeScript source-map directive',
			'server/app.ts',
			'//# sourceMappingURL=app.ts.map',
			'source-map'
		],
		['TypeScript fixture import', 'server/catalogue.ts', 'src/test/fixtures/private.js', 'fixture'],
		['TypeScript Stripe key', 'server/stripe.ts', `sk_${'live'}_${'A'.repeat(24)}`, 'credential'],
		[
			'TSX embedded sources',
			'client/component.tsx',
			'const metadata = { sourcesContent: ["private source"] };',
			'source-map'
		],
		['JSX placeholder', 'client/component.jsx', 'Book cover placeholder', 'placeholder'],
		[
			'Markdown Drive URL',
			'server/README.md',
			'https://drive.google.com/drive/folders/1XI7VhePrlujhrDi3tVEGRVTf6wfTsKR0',
			'local-path'
		],
		[
			'Markdown Drive ID',
			'server/README.markdown',
			'1XI7VhePrlujhrDi3tVEGRVTf6wfTsKR0',
			'local-path'
		],
		['YAML fixture', 'server/config.yaml', 'teacher: Mme Tremblay', 'fixture'],
		['YML local path', 'server/config.yml', 'asset: /Users/student/private.png', 'local-path'],
		[
			'TOML webhook key',
			'server/config.toml',
			`secret = "wh${'sec'}_${'A'.repeat(24)}"`,
			'credential'
		],
		[
			'GraphQL placeholder',
			'server/schema.graphql',
			'description: "Book cover placeholder"',
			'placeholder'
		],
		['GQL fixture', 'server/schema.gql', 'course: "FRE-101"', 'fixture'],
		[
			'unknown text extension',
			'server/runtime.template',
			'//# sourceMappingURL=runtime.map',
			'source-map'
		],
		[
			'uppercase text extension',
			'server/runtime.TS',
			'//# sourceMappingURL=runtime.map',
			'source-map'
		]
	])(
		'scans a %s artifact without echoing its content',
		async (_label, relativePath, content, rule) => {
			const root = await fixture();
			await mkdir(join(root, relativePath, '..'), { recursive: true });
			await writeFile(join(root, relativePath), content);

			const failure = await scanProductionArtifacts(root).catch((error) => error);
			expect(failure).toBeInstanceOf(ArtifactScanError);
			expect(failure).toMatchObject({ code: 'PRODUCTION_ARTIFACT_REJECTED', rule });
			expect(failure.message).not.toContain(content);
		}
	);

	it.each([
		[
			'WebAssembly source-map payload',
			'module.WASM',
			Buffer.from([0x00, 0x61, 0x73, 0x6d, ...Buffer.from('sourceMappingURL')]),
			'source-map'
		],
		[
			'PNG metadata with the private Drive ID',
			'static/cover.png',
			Buffer.concat([
				Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
				Buffer.from('1XI7VhePrlujhrDi3tVEGRVTf6wfTsKR0')
			]),
			'local-path'
		],
		[
			'WOFF2 metadata with a Stripe key',
			'static/font.woff2',
			Buffer.concat([Buffer.from('wOF2\0'), Buffer.from(`sk_${'live'}_${'A'.repeat(24)}`)]),
			'credential'
		],
		[
			'AVIF metadata with a private environment name',
			'static/cover.avif',
			Buffer.concat([Buffer.from('ftypavif\0'), Buffer.from('DATABASE_URL')]),
			'client-private-name'
		]
	])('scans a %s without echoing binary content', async (_label, relativePath, content, rule) => {
		const root = await fixture();
		await mkdir(join(root, relativePath, '..'), { recursive: true });
		await writeFile(join(root, relativePath), content);

		const failure = await scanProductionArtifacts(root).catch((error) => error);
		expect(failure).toBeInstanceOf(ArtifactScanError);
		expect(failure).toMatchObject({ code: 'PRODUCTION_ARTIFACT_REJECTED', rule });
		expect(failure.message).not.toContain(content.toString('latin1'));
	});

	it('fails closed on an unapproved binary file type', async () => {
		const root = await fixture();
		await writeFile(join(root, 'payload.asset'), Buffer.from([0xff, 0xfe, 0xfd]));

		await expect(scanProductionArtifacts(root)).rejects.toMatchObject({
			code: 'PRODUCTION_ARTIFACT_REJECTED',
			rule: 'unapproved-binary'
		});
	});

	it.each([
		['fixture import path', 'tests/fixtures/private.js'],
		['source fixture import path', 'src/test/fixtures/private.js'],
		['teacher ID and slug', 'mme-tremblay'],
		['teacher ID and slug', 'mr-bennett'],
		['course ID', 'french-101'],
		['course ID', 'french-102'],
		['course ID', 'english-101'],
		['bookstore ID', 'renaud-bray'],
		['bookstore ID', 'archambault'],
		['book ID', 'le-petit-prince'],
		['book ID', 'bescherelle'],
		['book ID', 'antigone'],
		['book ID', 'the-great-gatsby'],
		['teacher name', 'Mme Tremblay'],
		['teacher name', 'Mr Bennett'],
		['course code', 'FRE-101'],
		['course code', 'FRE-102'],
		['course code', 'ENG-101'],
		['course title', 'French 101'],
		['course title', 'French 102'],
		['course title', 'English 101'],
		['book title', 'Le Petit Prince'],
		['book title', 'Bescherelle'],
		['book title', 'Antigone'],
		['book title', 'The Great Gatsby']
	])('rejects the exact fixture %s %s without echoing content', async (_label, marker) => {
		const root = await fixture();
		const content = `export const marker = ${JSON.stringify(marker)};`;
		await writeFile(join(root, 'app.js'), content);

		const failure = await scanProductionArtifacts(root).catch((error) => error);
		expect(failure).toBeInstanceOf(ArtifactScanError);
		expect(failure).toMatchObject({ code: 'PRODUCTION_ARTIFACT_REJECTED', rule: 'fixture' });
		expect(failure.message).not.toContain(content);
	});

	it.each([
		['private Drive folder ID', '1XI7VhePrlujhrDi3tVEGRVTf6wfTsKR0', 'local-path'],
		['cover sentinel', 'Cover placeholder', 'placeholder'],
		['standalone sentinel', 'placeholder', 'placeholder']
	])('rejects a %s without echoing content', async (_label, marker, rule) => {
		const root = await fixture();
		const content = `export const marker = ${JSON.stringify(marker)};`;
		await writeFile(join(root, 'app.js'), content);

		const failure = await scanProductionArtifacts(root).catch((error) => error);
		expect(failure).toBeInstanceOf(ArtifactScanError);
		expect(failure).toMatchObject({ code: 'PRODUCTION_ARTIFACT_REJECTED', rule });
		expect(failure.message).not.toContain(content);
	});

	it.each([
		['CSS pseudo-element', 'input::placeholder { color: gray; }'],
		['HTML attribute', '<input placeholder="5.00">'],
		['ordinary prose', 'Use the placeholder attribute to provide a short hint.'],
		['dependency type name', 'export const entityKind = "Placeholder";']
	])('allows ordinary production %s use', async (_label, content) => {
		const root = await fixture();
		await writeFile(join(root, 'app.js'), content);

		await expect(scanProductionArtifacts(root)).resolves.toMatchObject({ filesScanned: 1 });
	});

	it.each([
		['source-map file', 'client/app.js.map', '{}', 'source-map'],
		['source-map reference', 'client/app.js', '//# sourceMappingURL=app.js.map', 'source-map'],
		[
			'static source-map reference',
			'static/app.js',
			'//# sourceMappingURL=app.js.map',
			'source-map'
		],
		[
			'server source-map reference',
			'server/app.js',
			'//# sourceMappingURL=app.js.map',
			'source-map'
		],
		['fixture import', 'server/app.js', 'src/test/fixtures/book-catalogue.js', 'fixture'],
		['fixture teacher', 'server/app.js', 'Mme Tremblay', 'fixture'],
		['fixture book', 'server/app.js', 'Le Petit Prince', 'fixture'],
		['local path', 'server/app.js', '/Users/student/Downloads/image.png', 'local-path'],
		['temporary path', 'server/app.js', '/var/folders/xx/render.png', 'local-path'],
		['Drive path', 'server/app.js', 'https://drive.google.com/drive/folders/example', 'local-path'],
		['placeholder marker', 'client/app.js', 'Book cover placeholder', 'placeholder'],
		['client database name', 'client/app.js', 'DATABASE_URL', 'client-private-name'],
		['client cron name', 'client/app.js', 'CRON_SECRET', 'client-private-name'],
		['Stripe key', 'server/app.js', `sk_${'live'}_${'A'.repeat(24)}`, 'credential'],
		['webhook key', 'server/app.js', `wh${'sec'}_${'A'.repeat(24)}`, 'credential'],
		['Google key', 'server/app.js', `GOC${'SPX-'}${'A'.repeat(28)}`, 'credential'],
		[
			'database credential',
			'server/app.js',
			`postgre${'sql'}://runtime:password@database.example.com/app`,
			'credential'
		],
		[
			'private key',
			'server/app.js',
			`-----BEGIN ${'PRIVATE KEY'}-----\n${'A'.repeat(64)}\n-----END ${'PRIVATE KEY'}-----`,
			'credential'
		]
	])('rejects a %s without echoing its content', async (_label, relativePath, content, rule) => {
		const root = await fixture();
		await mkdir(join(root, relativePath, '..'), { recursive: true });
		await writeFile(join(root, relativePath), content);
		const failure = await scanProductionArtifacts(root).catch((error) => error);
		expect(failure).toBeInstanceOf(ArtifactScanError);
		expect(failure).toMatchObject({ code: 'PRODUCTION_ARTIFACT_REJECTED', rule });
		expect(failure.message).not.toContain(content);
	});

	it('rejects symlinks and unsafe scan bounds', async () => {
		const root = await fixture();
		await writeFile(join(root, 'one.js'), 'one');
		await writeFile(join(root, 'two.js'), 'two');
		await symlink(join(root, 'one.js'), join(root, 'linked.js'));
		await expect(scanProductionArtifacts(root)).rejects.toMatchObject({ rule: 'symlink' });
		await rm(join(root, 'linked.js'));
		await expect(scanProductionArtifacts(root, { maxFiles: 1 })).rejects.toMatchObject({
			rule: 'scan-limit'
		});
		await expect(scanProductionArtifacts(root, { maxFileBytes: 2 })).rejects.toMatchObject({
			rule: 'scan-limit'
		});
		await expect(scanProductionArtifacts(root, { maxTotalBytes: 5 })).rejects.toMatchObject({
			rule: 'scan-limit'
		});
	});

	it('rejects missing roots, files used as roots, and invalid limits', async () => {
		const root = await fixture();
		const file = join(root, 'app.js');
		await writeFile(file, 'safe');
		await expect(scanProductionArtifacts(join(root, 'missing'))).rejects.toMatchObject({
			rule: 'scan-root'
		});
		await expect(scanProductionArtifacts(file)).rejects.toMatchObject({ rule: 'scan-root' });
		await expect(scanProductionArtifacts(root, { maxFiles: 0 })).rejects.toMatchObject({
			rule: 'scan-limit'
		});
	});
});
