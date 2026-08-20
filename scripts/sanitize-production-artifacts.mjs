import { resolve } from 'node:path';
import {
	ArtifactScanError,
	sanitizeProductionDependencySourceMaps
} from './production-artifact-scanner.mjs';

const artifactRoot = resolve(process.argv[2] ?? '.vercel/output');

async function main() {
	try {
		const report = await sanitizeProductionDependencySourceMaps(artifactRoot);
		process.stdout.write(
			`Approved production dependency source-map directives removed: ${report.filesChanged} files updated; ${report.mapsRemoved} map files removed\n`
		);
	} catch (error) {
		const message =
			error instanceof ArtifactScanError
				? error.message
				: 'Production artifact sanitation could not complete';
		process.stderr.write(`${message}\n`);
		process.exitCode = 1;
	}
}

void main();
