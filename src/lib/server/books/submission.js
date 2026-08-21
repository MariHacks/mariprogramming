// @ts-nocheck

import { createHash } from 'node:crypto';
import { parseCatalogRef, CatalogRefError } from './catalog-ref.js';

const MAX_REQUEST_BYTES = 2_500_000;
const MAX_OUTLINE_BYTES = 2_097_152;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const ALLOWED_FIELDS = new Set([
	'name',
	'email',
	'teacher',
	'teacherOther',
	'course',
	'courseOther',
	'title',
	'author',
	'isbn',
	'quantity',
	'notes',
	'outline',
	'clientRequestId'
]);

export class BookRequestSubmissionError extends Error {
	/** @param {number} status @param {string} summary @param {readonly string[]} [fields] */
	constructor(status, summary, fields = []) {
		super('Book request submission is invalid');
		this.name = 'BookRequestSubmissionError';
		this.code = 'BOOK_REQUEST_SUBMISSION_INVALID';
		this.status = status;
		this.summary = summary;
		this.fields = Object.freeze([...fields]);
	}
}

/** @param {number} status @param {string} summary @param {string[]} [fields] */
function reject(status, summary, fields = []) {
	throw new BookRequestSubmissionError(status, summary, fields);
}

/** @param {FormData} form @param {string} name @param {number} maximum */
function text(form, name, maximum) {
	const values = form.getAll(name);
	if (values.length !== 1 || typeof values[0] !== 'string')
		reject(400, 'Check the form and try again.', [name]);
	const value = values[0].trim();
	if (!value || value.length > maximum || /[\0\r\n]/u.test(value)) {
		reject(400, 'Check the form and try again.', [name]);
	}
	return value;
}

/** @param {FormData} form @param {string} name @param {number} maximum */
function optionalText(form, name, maximum) {
	const value = form.get(name);
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	if (!trimmed) return null;
	if (trimmed.length > maximum || trimmed.includes('\0'))
		reject(400, 'Check the form and try again.', [name]);
	return trimmed;
}

/**
 * @param {Request} request
 * @param {{ clientAddress: string }} context
 */
export async function readBookRequestSubmission(request, context) {
	const contentType = request.headers.get('content-type');
	if (!contentType?.toLowerCase().startsWith('multipart/form-data;')) {
		reject(415, 'This form could not be read.');
	}
	if (request.body === null) reject(400, 'This form could not be read.');
	const reader = request.body.getReader();
	const chunks = [];
	let length = 0;
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		length += value.byteLength;
		if (length > MAX_REQUEST_BYTES) {
			await reader.cancel().catch(() => {});
			reject(413, 'The request is too large.');
		}
		chunks.push(value);
	}
	reader.releaseLock();
	const bytes = new Uint8Array(length);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	let form;
	try {
		form = await new Response(bytes, { headers: { 'content-type': contentType } }).formData();
	} catch {
		reject(400, 'This form could not be read.');
	}
	for (const key of form.keys())
		if (!ALLOWED_FIELDS.has(key)) reject(400, 'This form could not be read.');

	const name = text(form, 'name', 160);
	const email = text(form, 'email', 320).toLowerCase();
	if (!EMAIL_PATTERN.test(email)) reject(400, 'Enter a valid email address.', ['email']);
	let teacher;
	let course;
	try {
		teacher = parseCatalogRef(
			{ selection: form.get('teacher'), freeText: form.get('teacherOther') },
			'teacher'
		);
		course = parseCatalogRef(
			{ selection: form.get('course'), freeText: form.get('courseOther') },
			'course'
		);
	} catch (error) {
		/* v8 ignore start -- parseCatalogRef converts expected input failures; unexpected defects propagate. */
		if (!(error instanceof CatalogRefError)) throw error;
		/* v8 ignore stop */
		reject(400, 'Choose a teacher and course.', [error.field]);
	}
	const titles = form.getAll('title');
	const authors = form.getAll('author');
	const isbns = form.getAll('isbn');
	const quantities = form.getAll('quantity');
	if (
		titles.length < 1 ||
		titles.length > 20 ||
		authors.length !== titles.length ||
		isbns.length !== titles.length ||
		quantities.length !== titles.length
	) {
		reject(400, 'Add at least one valid book.', ['title']);
	}
	const items = [];
	for (let index = 0; index < titles.length; index += 1) {
		const title = typeof titles[index] === 'string' ? titles[index].trim() : '';
		if (!title) continue;
		const author = typeof authors[index] === 'string' ? authors[index].trim() || null : null;
		const isbn = typeof isbns[index] === 'string' ? isbns[index].trim() || null : null;
		const quantity = typeof quantities[index] === 'string' ? Number(quantities[index]) : 0;
		if (
			title.length > 240 ||
			(author && author.length > 200) ||
			(isbn && isbn.length > 32) ||
			!Number.isSafeInteger(quantity) ||
			quantity < 1 ||
			quantity > 20
		) {
			reject(400, 'Add at least one valid book.', ['title', 'quantity']);
		}
		items.push(Object.freeze({ title, author, isbn, quantity }));
	}
	if (items.length < 1) reject(400, 'Add at least one valid book.', ['title']);
	const fileValues = form
		.getAll('outline')
		.filter((value) => value instanceof File && value.size > 0);
	if (fileValues.length > 1) reject(400, 'Attach only one PDF.', ['outline']);
	let outline = null;
	if (fileValues.length === 1) {
		const file = fileValues[0];
		if (file.type !== 'application/pdf' || file.size > MAX_OUTLINE_BYTES) {
			reject(file.size > MAX_OUTLINE_BYTES ? 413 : 415, 'The outline must be a PDF under 2 MiB.', [
				'outline'
			]);
		}
		const content = new Uint8Array(await file.arrayBuffer());
		if (new TextDecoder().decode(content.slice(0, 5)) !== '%PDF-') {
			reject(415, 'The outline must be a PDF under 2 MiB.', ['outline']);
		}
		outline = Object.freeze({
			filename: file.name.slice(0, 160),
			byteLength: content.byteLength,
			sha256: createHash('sha256').update(content).digest('hex'),
			bytes: content
		});
	}
	const clientRequestId = text(form, 'clientRequestId', 128);
	if (!UUID_PATTERN.test(clientRequestId)) reject(400, 'Reload the form and try again.');
	return Object.freeze({
		student: Object.freeze({ name, email }),
		teacher,
		course,
		items: Object.freeze(items),
		note: optionalText(form, 'notes', 1000),
		outline,
		clientRequestId,
		clientAddress: context.clientAddress
	});
}
