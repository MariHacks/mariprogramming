// @vitest-environment node
// @ts-nocheck

import { describe, expect, it } from 'vitest';
import { BookRequestSubmissionError, readBookRequestSubmission } from './submission.js';

const ID = '10000000-0000-4000-8000-000000000001';

function requestWith(overrides = {}) {
	const form = new FormData();
	form.set('name', 'Sam Tremblay');
	form.set('email', 'sam@example.com');
	form.set('teacher', 'other');
	form.set('teacherOther', 'Mme. Nadeau');
	form.set('course', ID);
	form.set('courseOther', '');
	form.append('title', 'Calculus 8e');
	form.append('author', 'Stewart');
	form.append('isbn', '9781285740621');
	form.append('quantity', '2');
	form.set('notes', '');
	form.set('clientRequestId', '20000000-0000-4000-8000-000000000001');
	for (const [key, value] of Object.entries(overrides)) form.set(key, value);
	return new Request('https://books.example.com/books/request', { method: 'POST', body: form });
}

describe('book request multipart boundary', () => {
	it('parses a request without an outline', async () => {
		const parsed = await readBookRequestSubmission(requestWith(), { clientAddress: '127.0.0.1' });
		expect(parsed).toMatchObject({
			student: { name: 'Sam Tremblay', email: 'sam@example.com' },
			teacher: { source: 'other', name: 'Mme. Nadeau' },
			course: { source: 'catalog', id: ID },
			items: [{ title: 'Calculus 8e', quantity: 2 }],
			outline: null
		});
	});

	it('accepts a PDF by declared type and magic bytes', async () => {
		const form = new FormData();
		const seed = await requestWith().formData();
		for (const [key, value] of seed) form.append(key, value);
		form.set(
			'outline',
			new File([new TextEncoder().encode('%PDF-1.7\nbook')], 'outline.pdf', {
				type: 'application/pdf'
			})
		);
		const parsed = await readBookRequestSubmission(
			new Request('https://books.example.com/books/request', { method: 'POST', body: form }),
			{ clientAddress: '127.0.0.1' }
		);
		expect(parsed.outline).toMatchObject({ filename: 'outline.pdf', byteLength: 13 });
		expect(parsed.outline.sha256).toMatch(/^[0-9a-f]{64}$/u);
	});

	it('skips empty extra book rows', async () => {
		const form = await requestWith().formData();
		form.append('title', '');
		form.append('author', '');
		form.append('isbn', '');
		form.append('quantity', '1');
		const parsed = await readBookRequestSubmission(
			new Request('https://books.example.com/books/request', { method: 'POST', body: form }),
			{ clientAddress: '127.0.0.1' }
		);
		expect(parsed.items).toEqual([
			{ title: 'Calculus 8e', author: 'Stewart', isbn: '9781285740621', quantity: 2 }
		]);
	});

	it('rejects non-PDF bytes', async () => {
		const form = await requestWith().formData();
		form.set('outline', new File(['hello'], 'outline.pdf', { type: 'application/pdf' }));
		await expect(
			readBookRequestSubmission(
				new Request('https://books.example.com/books/request', { method: 'POST', body: form }),
				{
					clientAddress: '127.0.0.1'
				}
			)
		).rejects.toBeInstanceOf(BookRequestSubmissionError);
	});

	it('rejects a non-multipart body', async () => {
		await expect(
			readBookRequestSubmission(
				new Request('https://books.example.com/books/request', {
					method: 'POST',
					headers: { 'content-type': 'application/x-www-form-urlencoded' },
					body: 'name=Sam'
				}),
				{ clientAddress: '127.0.0.1' }
			)
		).rejects.toMatchObject({ status: 415 });
	});

	it('rejects an empty multipart body', async () => {
		const request = new Request('https://books.example.com/books/request', {
			method: 'POST',
			headers: { 'content-type': 'multipart/form-data; boundary=abc' },
			body: new Uint8Array()
		});
		Object.defineProperty(request, 'body', { value: null });
		await expect(
			readBookRequestSubmission(request, { clientAddress: '127.0.0.1' })
		).rejects.toMatchObject({ status: 400 });
	});

	it('rejects an invalid email and missing title', async () => {
		await expect(
			readBookRequestSubmission(requestWith({ email: 'not-an-email' }), {
				clientAddress: '127.0.0.1'
			})
		).rejects.toMatchObject({ status: 400, fields: ['email'] });
		const form = await requestWith().formData();
		form.set('title', '');
		await expect(
			readBookRequestSubmission(
				new Request('https://books.example.com/books/request', { method: 'POST', body: form }),
				{ clientAddress: '127.0.0.1' }
			)
		).rejects.toMatchObject({ fields: ['title'] });
	});

	it('rejects a quantity outside 1 to 20 and a second outline', async () => {
		const form = await requestWith({ quantity: '99' }).formData();
		await expect(
			readBookRequestSubmission(
				new Request('https://books.example.com/books/request', { method: 'POST', body: form }),
				{ clientAddress: '127.0.0.1' }
			)
		).rejects.toMatchObject({ fields: ['title', 'quantity'] });
		const doubled = await requestWith().formData();
		doubled.append(
			'outline',
			new File([new TextEncoder().encode('%PDF-1')], 'a.pdf', { type: 'application/pdf' })
		);
		doubled.append(
			'outline',
			new File([new TextEncoder().encode('%PDF-2')], 'b.pdf', { type: 'application/pdf' })
		);
		await expect(
			readBookRequestSubmission(
				new Request('https://books.example.com/books/request', { method: 'POST', body: doubled }),
				{ clientAddress: '127.0.0.1' }
			)
		).rejects.toMatchObject({ fields: ['outline'] });
	});

	it('rejects a non-PDF declared type and an invalid client request id', async () => {
		const form = await requestWith().formData();
		form.set('outline', new File(['%PDF-1'], 'notes.txt', { type: 'text/plain' }));
		await expect(
			readBookRequestSubmission(
				new Request('https://books.example.com/books/request', { method: 'POST', body: form }),
				{ clientAddress: '127.0.0.1' }
			)
		).rejects.toMatchObject({ status: 415 });
		await expect(
			readBookRequestSubmission(requestWith({ clientRequestId: 'not-a-uuid' }), {
				clientAddress: '127.0.0.1'
			})
		).rejects.toMatchObject({ status: 400 });
	});

	it('keeps an optional note and rejects unknown fields', async () => {
		const parsed = await readBookRequestSubmission(requestWith({ notes: ' Need two copies. ' }), {
			clientAddress: '127.0.0.1'
		});
		expect(parsed.note).toBe('Need two copies.');
		const extra = await requestWith().formData();
		extra.set('honeypot', 'nope');
		await expect(
			readBookRequestSubmission(
				new Request('https://books.example.com/books/request', { method: 'POST', body: extra }),
				{ clientAddress: '127.0.0.1' }
			)
		).rejects.toMatchObject({ status: 400 });
	});

	it('rejects a name with a newline and a teacher that is not a catalogue choice', async () => {
		await expect(
			readBookRequestSubmission(requestWith({ name: 'Sam\nTremblay' }), {
				clientAddress: '127.0.0.1'
			})
		).rejects.toMatchObject({ fields: ['name'] });
		await expect(
			readBookRequestSubmission(requestWith({ teacher: 'not-a-uuid', teacherOther: '' }), {
				clientAddress: '127.0.0.1'
			})
		).rejects.toMatchObject({ fields: ['teacher'] });
	});

	it('rejects mismatched book field arrays and keeps empty author as null', async () => {
		const parsed = await readBookRequestSubmission(requestWith({ author: '' }), {
			clientAddress: '127.0.0.1'
		});
		expect(parsed.items[0].author).toBeNull();
		const extra = await requestWith().formData();
		extra.append('title', 'Extra');
		await expect(
			readBookRequestSubmission(
				new Request('https://books.example.com/books/request', { method: 'POST', body: extra }),
				{ clientAddress: '127.0.0.1' }
			)
		).rejects.toMatchObject({ fields: ['title'] });
	});

	it('rejects a note with a NUL and a name that is not text', async () => {
		await expect(
			readBookRequestSubmission(requestWith({ notes: 'bad\0note' }), { clientAddress: '127.0.0.1' })
		).rejects.toMatchObject({ fields: ['notes'] });
		const form = await requestWith().formData();
		form.set('name', new File(['x'], 'name.txt'));
		await expect(
			readBookRequestSubmission(
				new Request('https://books.example.com/books/request', { method: 'POST', body: form }),
				{ clientAddress: '127.0.0.1' }
			)
		).rejects.toMatchObject({ fields: ['name'] });
	});

	it('keeps empty isbn as null', async () => {
		const parsed = await readBookRequestSubmission(requestWith({ isbn: '' }), {
			clientAddress: '127.0.0.1'
		});
		expect(parsed.items[0].isbn).toBeNull();
	});

	it('treats a non-text quantity as invalid', async () => {
		const form = await requestWith().formData();
		form.set('quantity', new File(['2'], 'qty.txt'));
		await expect(
			readBookRequestSubmission(
				new Request('https://books.example.com/books/request', { method: 'POST', body: form }),
				{ clientAddress: '127.0.0.1' }
			)
		).rejects.toMatchObject({ fields: ['title', 'quantity'] });
	});

	it('rejects non-text identity and title fields while treating optional file values as empty', async () => {
		const identityForm = await requestWith().formData();
		identityForm.set('name', new File(['Student'], 'name.txt'));
		await expect(
			readBookRequestSubmission(
				new Request('https://books.example.com/books/request', {
					method: 'POST',
					body: identityForm
				}),
				{ clientAddress: '127.0.0.1' }
			)
		).rejects.toMatchObject({ fields: ['name'] });

		const titleForm = await requestWith().formData();
		titleForm.set('title', new File(['Calculus'], 'title.txt'));
		await expect(
			readBookRequestSubmission(
				new Request('https://books.example.com/books/request', { method: 'POST', body: titleForm }),
				{ clientAddress: '127.0.0.1' }
			)
		).rejects.toMatchObject({ fields: ['title'] });

		const optionalForm = await requestWith().formData();
		optionalForm.set('author', new File(['Author'], 'author.txt'));
		optionalForm.set('isbn', new File(['9780000000000'], 'isbn.txt'));
		optionalForm.set('notes', new File(['Note'], 'note.txt'));
		await expect(
			readBookRequestSubmission(
				new Request('https://books.example.com/books/request', {
					method: 'POST',
					body: optionalForm
				}),
				{ clientAddress: '127.0.0.1' }
			)
		).resolves.toMatchObject({ items: [{ author: null, isbn: null }], note: null });
	});

	it('rejects an outline larger than 2 MiB', async () => {
		const form = await requestWith().formData();
		form.set(
			'outline',
			new File([new Uint8Array(2_097_153)], 'outline.pdf', { type: 'application/pdf' })
		);
		await expect(
			readBookRequestSubmission(
				new Request('https://books.example.com/books/request', { method: 'POST', body: form }),
				{ clientAddress: '127.0.0.1' }
			)
		).rejects.toMatchObject({ status: 413, fields: ['outline'] });
	});

	it('rejects a malformed multipart body', async () => {
		await expect(
			readBookRequestSubmission(
				new Request('https://books.example.com/books/request', {
					method: 'POST',
					headers: { 'content-type': 'multipart/form-data; boundary=abc' },
					body: 'not-multipart'
				}),
				{ clientAddress: '127.0.0.1' }
			)
		).rejects.toMatchObject({ status: 400 });
	});

	it('rejects an oversized multipart stream', async () => {
		const chunk = new Uint8Array(2_500_001);
		const body = new ReadableStream({
			start(controller) {
				controller.enqueue(chunk);
				controller.close();
			}
		});
		await expect(
			readBookRequestSubmission(
				new Request('https://books.example.com/books/request', {
					method: 'POST',
					headers: { 'content-type': 'multipart/form-data; boundary=abc' },
					body,
					duplex: 'half'
				}),
				{ clientAddress: '127.0.0.1' }
			)
		).rejects.toMatchObject({ status: 413 });
	});
});
