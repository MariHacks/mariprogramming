import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';

/**
 * @param {ArrayBuffer | Uint8Array | Buffer} bytes
 */
export function isPdfHeader(bytes) {
	const buffer = Buffer.from(bytes);
	return buffer.subarray(0, 5).toString('latin1') === '%PDF-';
}

/**
 * @param {ArrayBuffer | Uint8Array | Buffer} bytes
 */
export function extractPdfText(bytes) {
	const buffer = Buffer.from(bytes);
	const sha256 = createHash('sha256').update(buffer).digest('hex');
	const byteLength = buffer.byteLength;
	if (!isPdfHeader(buffer)) {
		return { text: '', byteLength, sha256 };
	}

	const pieces = [];
	const streamMarker = Buffer.from('stream');
	const endMarker = Buffer.from('endstream');
	let pos = 0;
	while (pos < buffer.length) {
		const start = buffer.indexOf(streamMarker, pos);
		if (start === -1) break;
		let dataStart = start + streamMarker.length;
		if (buffer[dataStart] === 0x0d) dataStart += 1;
		if (buffer[dataStart] === 0x0a) dataStart += 1;
		const end = buffer.indexOf(endMarker, dataStart);
		if (end === -1) break;
		const dictStart = buffer.lastIndexOf(Buffer.from('<<'), start);
		const dict = dictStart >= 0 ? buffer.subarray(dictStart, start).toString('latin1') : '';
		pos = end + endMarker.length;
		if (/\/Subtype\s*\/Image/.test(dict) || /\/Type\s*\/XObject/.test(dict)) continue;
		let data = buffer.subarray(dataStart, end);
		if (/\/FlateDecode/.test(dict)) {
			try {
				data = inflateSync(data);
			} catch {
				continue;
			}
		}
		pieces.push(textFromContent(data.toString('latin1')));
	}

	return { text: pieces.filter(Boolean).join('\n'), byteLength, sha256 };
}

/** @param {string} content */
function textFromContent(content) {
	const chunks = [];
	const show = /\((?:\\.|[^\\)])*\)\s*Tj/g;
	let match;
	while ((match = show.exec(content))) {
		const literal = match[0].replace(/\s*Tj$/u, '');
		chunks.push(unescapePdfString(literal.slice(1, -1)));
	}
	const arrayShow = /\[(?:[^\]]*)\]\s*TJ/g;
	while ((match = arrayShow.exec(content))) {
		const inner = /\((?:\\.|[^\\)])*\)/g;
		let literal;
		while ((literal = inner.exec(match[0]))) {
			chunks.push(unescapePdfString(literal[0].slice(1, -1)));
		}
	}
	return chunks.join('');
}

/** @param {string} value */
function unescapePdfString(value) {
	return value
		.replace(/\\n/g, '\n')
		.replace(/\\r/g, '\r')
		.replace(/\\t/g, '\t')
		.replace(/\\\(/g, '(')
		.replace(/\\\)/g, ')')
		.replace(/\\\\/g, '\\');
}