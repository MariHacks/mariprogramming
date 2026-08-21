import { createHash } from 'node:crypto';
import { lstat, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import { basename, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { TextDecoder } from 'node:util';

const DEFAULT_MAX_FILES = 5000;
const DEFAULT_MAX_FILE_BYTES = 12 * 1024 * 1024;
const DEFAULT_MAX_TOTAL_BYTES = 128 * 1024 * 1024;
const APPROVED_BINARY_EXTENSIONS = new Set(['.avif', '.node', '.png', '.wasm', '.webp', '.woff2']);
const STRICT_UTF8_DECODER = new TextDecoder('utf-8', { fatal: true });
const DEPENDENCY_SOURCE_MAP_EXTENSIONS = new Set(['.cjs', '.css', '.js', '.mjs']);
const SOURCE_MAP_DIRECTIVE =
	/(?:\/\/[#@][ \t]*sourceMappingURL=[^\r\n]*(?:\r?\n|$)|\/\*[#@][ \t]*sourceMappingURL=[\s\S]*?\*\/(?:\r?\n)?)/gu;
const APPROVED_DEPENDENCY_SOURCE_MAP_INVENTORIES = Object.freeze({
	'@better-fetch/fetch': Object.freeze({
		version: '1.3.1',
		digest: 'ed352513dcc96144e3e5636733ceff320b5c141107bfdfe32a29b1e2b9ec4cd8'
	}),
	'@opentelemetry/semantic-conventions': Object.freeze({
		version: '1.43.0',
		digest: 'e32c143cace66e8e07b93a2ebba16874974f89e4e0d9cdf791b6b0da8b9b6db9'
	}),
	'better-call': Object.freeze({
		version: '1.4.0',
		digest: '81498dba0282c76e409ed1b38db5f6bf23350824b2b778ca20a2fd07c61b281b'
	}),
	'drizzle-orm': Object.freeze({
		version: '0.45.2',
		digest: 'd753610aa3f24e2b543a11a2ced922dcaedd8be17e23e65d758ab2b26fa734ab'
	}),
	'pg-cloudflare': Object.freeze({
		version: '1.4.0',
		digest: '479d7e4d2b894b68233672f01261e7ced3d52e7261bc2219b633e74787da7a0b'
	}),
	'pg-protocol': Object.freeze({
		version: '1.16.0',
		digest: 'abb0ba0bccd6d1a8edc92c05f9b13af4b9a7c5abaa0dbb662163f44b41e5331f'
	}),
	stripe: Object.freeze({
		version: '22.5.0',
		digest: '3e19d15fb87c2ab52b375476ec1b978e5d3dc0659ced61307be4634c6f204990'
	})
});
const CLIENT_PRIVATE_NAMES =
	/\b(?:DATABASE_URL|MIGRATION_DATABASE_URL|BETTER_AUTH_SECRET|GOOGLE_CLIENT_SECRET|STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|RATE_LIMIT_HMAC_KEY|BOOK_CHECKOUT_CAPABILITY_KEY|CRON_SECRET)\b/u;
const CONTENT_RULES = Object.freeze([
	{
		rule: 'source-map',
		pattern: /(?:sourceMappingURL|sourcesContent)/u
	},
	{
		rule: 'fixture',
		pattern:
			/\b(?:(?:src\/test|tests)\/fixtures|book-catalogue\.js|mme-tremblay|mr-bennett|french-10[12]|english-101|renaud-bray|archambault|le-petit-prince|bescherelle|antigone|the-great-gatsby|Mme Tremblay|Mr Bennett|FRE-10[12]|ENG-101|French 10[12]|English 101|Le Petit Prince|The Great Gatsby)\b/iu
	},
	{
		rule: 'local-path',
		pattern:
			/(?:\/Users\/[^/\s"']+\/|\/(?:private\/)?var\/folders\/|\/tmp\/(?!my\.sock\b)|codex-clipboard|\.worktrees\/|drive\.google\.com\/|1XI7VhePrlujhrDi3tVEGRVTf6wfTsKR0)/iu
	},
	{
		rule: 'placeholder',
		pattern:
			/\b(?:book cover placeholder|placeholder (?:book|image|copy|course)|(?:book|cover|image|copy|course) placeholder|lorem ipsum|replace me)\b/iu
	},
	{
		rule: 'placeholder',
		pattern: /(?:^|["'`>])\s*placeholder\s*(?=$|["'`<])/u
	},
	{
		rule: 'credential',
		pattern:
			/(?:\bsk_(?:test|live)_[A-Za-z0-9]{16,}\b|\bwhsec_[A-Za-z0-9]{16,}\b|\bGOCSPX-[A-Za-z0-9_-]{16,}\b|postgres(?:ql)?:\/\/(?!user:password@)[A-Za-z0-9._~!$&()*+,;=%-]+:[A-Za-z0-9._~!$&()*+,;=%-]+@|-----BEGIN ((?:RSA |EC |OPENSSH )?PRIVATE KEY)-----\r?\n[A-Za-z0-9+/=\r\n]{32,}-----END \1-----)/u
	}
]);

export class ArtifactScanError extends Error {
	/** @param {string} rule @param {string} [file] */
	constructor(rule, file = '') {
		super(
			file
				? `Production artifact rejected by ${rule}: ${file}`
				: `Production artifact rejected by ${rule}`
		);
		this.name = 'ArtifactScanError';
		this.code = 'PRODUCTION_ARTIFACT_REJECTED';
		this.rule = rule;
	}
}

/** @param {string} rule @param {string} [file] @returns {never} */
function reject(rule, file = '') {
	throw new ArtifactScanError(rule, file);
}

/** @param {unknown} value @param {number} fallback */
function positiveLimit(value, fallback) {
	const resolved = value === undefined ? fallback : value;
	if (!Number.isSafeInteger(resolved) || /** @type {number} */ (resolved) < 1) {
		reject('scan-limit');
	}
	return /** @type {number} */ (resolved);
}

/** @param {string} path */
async function safeStat(path) {
	try {
		return await lstat(path);
	} catch {
		reject('scan-root');
	}
}

/** @param {string} path */
async function optionalStat(path) {
	try {
		return await lstat(path);
	} catch (error) {
		if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
			return null;
		}
		reject('scan-root');
	}
}

/** @param {string} root @param {string[]} segments */
async function exactDirectory(root, segments) {
	let directory = root;
	for (const segment of segments) {
		directory = join(directory, segment);
		const stat = await optionalStat(directory);
		if (!stat?.isDirectory() || stat.isSymbolicLink()) return null;
	}
	return directory;
}

/** @param {string} value */
function normalized(value) {
	return value.split(sep).join('/');
}

/** @param {{ relativePath: string, content: string, directives: string[] }} file */
function hasExactTerminalSourceMapComment(file) {
	if (file.directives.length !== 1) return false;
	const expected = `//# sourceMappingURL=${basename(file.relativePath)}.map`;
	const [directive] = file.directives;
	if (![expected, `${expected}\n`, `${expected}\r\n`].includes(directive)) return false;
	const start = file.content.length - directive.length;
	return (
		start >= 0 &&
		file.content.endsWith(directive) &&
		(start === 0 || file.content[start - 1] === '\n')
	);
}

/** @param {string} root @param {string} candidate */
function isWithin(root, candidate) {
	const pathFromRoot = relative(root, candidate);
	return (
		pathFromRoot === '' ||
		(pathFromRoot !== '..' && !pathFromRoot.startsWith(`..${sep}`) && !isAbsolute(pathFromRoot))
	);
}

/** @param {string} relativePath */
function isVercelRouteLink(relativePath) {
	return relativePath.startsWith('functions/') && relativePath.endsWith('.func');
}

/** @param {string} path @param {string} relativePath */
async function safeRealpath(path, relativePath) {
	try {
		return await realpath(path);
	} catch {
		reject('symlink', relativePath);
	}
}

/**
 * @param {string} rawRoot
 * @param {{ maxFiles?: number, maxFileBytes?: number, maxTotalBytes?: number }} [options]
 */
export async function scanProductionArtifacts(rawRoot, options = {}) {
	if (typeof rawRoot !== 'string' || rawRoot.length === 0) reject('scan-root');
	const resolvedRoot = resolve(rawRoot);
	const maxFiles = positiveLimit(options.maxFiles, DEFAULT_MAX_FILES);
	const maxFileBytes = positiveLimit(options.maxFileBytes, DEFAULT_MAX_FILE_BYTES);
	const maxTotalBytes = positiveLimit(options.maxTotalBytes, DEFAULT_MAX_TOTAL_BYTES);
	const rootStat = await safeStat(resolvedRoot);
	if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) reject('scan-root');
	const root = await safeRealpath(resolvedRoot, '');

	let filesScanned = 0;
	let bytesScanned = 0;
	const visitedDirectories = new Set();
	const activeDirectories = new Set();

	/** @param {string} directory */
	async function visit(directory) {
		const canonicalDirectory = await safeRealpath(directory, normalized(relative(root, directory)));
		if (activeDirectories.has(canonicalDirectory)) {
			reject('symlink', normalized(relative(root, directory)));
		}
		if (visitedDirectories.has(canonicalDirectory)) return;
		visitedDirectories.add(canonicalDirectory);
		activeDirectories.add(canonicalDirectory);

		let entries;
		try {
			entries = await readdir(canonicalDirectory, { withFileTypes: true });
		} catch {
			reject('scan-root');
		}
		entries.sort(({ name: left }, { name: right }) => (left < right ? -1 : left > right ? 1 : 0));

		for (const entry of entries) {
			const absolutePath = join(canonicalDirectory, entry.name);
			const relativePath = normalized(relative(root, absolutePath));
			const stat = await safeStat(absolutePath);
			if (stat.isSymbolicLink()) {
				if (!isVercelRouteLink(relativePath)) reject('symlink', relativePath);
				const target = await safeRealpath(absolutePath, relativePath);
				const targetRelativePath = normalized(relative(root, target));
				if (
					!isWithin(root, target) ||
					!isVercelRouteLink(targetRelativePath) ||
					!(await safeStat(target)).isDirectory()
				) {
					reject('symlink', relativePath);
				}
				if (activeDirectories.has(target)) reject('symlink', relativePath);
				await visit(target);
				continue;
			}
			if (stat.isDirectory()) {
				await visit(absolutePath);
				continue;
			}
			if (!stat.isFile()) reject('scan-root', relativePath);
			if (relativePath.toLowerCase().endsWith('.map')) reject('source-map', relativePath);

			filesScanned += 1;
			bytesScanned += stat.size;
			if (filesScanned > maxFiles || stat.size > maxFileBytes || bytesScanned > maxTotalBytes) {
				reject('scan-limit', relativePath);
			}

			const bytes = await readFile(absolutePath);
			let content;
			if (APPROVED_BINARY_EXTENSIONS.has(extname(relativePath).toLowerCase())) {
				content = bytes.toString('latin1');
			} else {
				try {
					content = STRICT_UTF8_DECODER.decode(bytes);
				} catch {
					reject('unapproved-binary', relativePath);
				}
			}
			for (const { rule, pattern } of CONTENT_RULES) {
				if (pattern.test(content)) reject(rule, relativePath);
			}
			if (
				(relativePath.startsWith('client/') || relativePath.startsWith('static/')) &&
				CLIENT_PRIVATE_NAMES.test(content)
			) {
				reject('client-private-name', relativePath);
			}
		}
		activeDirectories.delete(canonicalDirectory);
	}

	await visit(root);
	return Object.freeze({ filesScanned, bytesScanned });
}

/**
 * Removes source-map directives only when the exact pinned package version and complete directive
 * inventory match the audited Vercel output. The inventory digest makes added, removed, moved, or
 * changed directives in dependencies ineligible for sanitation so the scanner still fails closed.
 * Source-map files are never removed.
 *
 * @param {string} rawRoot
 */
export async function sanitizeProductionDependencySourceMaps(rawRoot) {
	if (typeof rawRoot !== 'string' || rawRoot.length === 0) reject('scan-root');
	const root = resolve(rawRoot);
	const rootStat = await safeStat(root);
	if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) reject('scan-root');

	let filesChanged = 0;
	const dependencyRoot = await exactDirectory(root, [
		'functions',
		'![-]',
		'catchall.func',
		'node_modules'
	]);
	if (!dependencyRoot) {
		return Object.freeze({ filesChanged, mapsRemoved: 0 });
	}

	/** @param {string} directory @param {string} packageRoot @param {Array<{ path: string, relativePath: string, content: string, directives: string[] }>} files */
	async function collectDirectiveFiles(directory, packageRoot, files) {
		let entries;
		try {
			entries = await readdir(directory, { withFileTypes: true });
		} catch {
			reject('scan-root');
		}
		entries.sort(({ name: left }, { name: right }) => (left < right ? -1 : left > right ? 1 : 0));

		for (const entry of entries) {
			const absolutePath = join(directory, entry.name);
			const stat = await safeStat(absolutePath);
			if (stat.isSymbolicLink()) continue;
			if (stat.isDirectory()) {
				await collectDirectiveFiles(absolutePath, packageRoot, files);
				continue;
			}
			if (!stat.isFile()) continue;
			if (!DEPENDENCY_SOURCE_MAP_EXTENSIONS.has(extname(entry.name).toLowerCase())) continue;
			const content = await readFile(absolutePath, 'utf8');
			const directives = content.match(SOURCE_MAP_DIRECTIVE) ?? [];
			if (directives.length === 0) continue;
			files.push({
				path: absolutePath,
				relativePath: normalized(relative(packageRoot, absolutePath)),
				content,
				directives
			});
		}
	}

	for (const [packageName, approved] of Object.entries(
		APPROVED_DEPENDENCY_SOURCE_MAP_INVENTORIES
	)) {
		const packageRoot = await exactDirectory(dependencyRoot, packageName.split('/'));
		if (!packageRoot) continue;

		let packageMetadata;
		try {
			packageMetadata = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'));
		} catch {
			continue;
		}
		if (packageMetadata?.name !== packageName || packageMetadata?.version !== approved.version) {
			continue;
		}

		/** @type {Array<{ path: string, relativePath: string, content: string, directives: string[] }>} */
		const files = [];
		await collectDirectiveFiles(packageRoot, packageRoot, files);
		if (!files.every(hasExactTerminalSourceMapComment)) continue;
		const inventory = files
			.map(({ relativePath, directives }) => `${relativePath}\0${JSON.stringify(directives)}`)
			.sort()
			.join('\n');
		const digest = createHash('sha256').update(inventory).digest('hex');
		if (digest !== approved.digest) continue;

		for (const file of files) {
			const sanitized = file.content.replace(SOURCE_MAP_DIRECTIVE, '');
			if (sanitized === file.content) continue;
			await writeFile(file.path, sanitized);
			filesChanged += 1;
		}
	}

	return Object.freeze({ filesChanged, mapsRemoved: 0 });
}
