import { resolve } from 'node:path';
import { ArtifactScanError, scanProductionArtifacts } from './production-artifact-scanner.mjs';

const artifactRoot = resolve(process.argv[2] ?? '.vercel/output');

async function main() {
	try {
		const report = await scanProductionArtifacts(artifactRoot);
		process.stdout.write(
			`Production artifact scan passed: ${report.filesScanned} files, ${report.bytesScanned} bytes\n`
		);
	} catch (error) {
		const message =
			error instanceof ArtifactScanError
				? error.message
				: 'Production artifact scan could not complete';
		process.stderr.write(`${message}\n`);
		process.exitCode = 1;
	}
}

void main();
