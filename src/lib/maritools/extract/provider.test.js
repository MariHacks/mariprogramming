import { describe, expect, it } from 'vitest';
import { createOutlineExtractionProvider, needsTextPdf } from './provider.js';

const SAMPLE = 'Assessment: Midterm 30% on 2026-10-20. Required book: Title, Author.';

describe('needsTextPdf', () => {
	it('rejects empty or scan-like text', () => {
		expect(needsTextPdf('')).toBe(true);
		expect(needsTextPdf('hi', 90_000)).toBe(true);
		expect(needsTextPdf(SAMPLE)).toBe(false);
	});
});

describe('createOutlineExtractionProvider', () => {
	it('fails closed when getKey is omitted', async () => {
		const provider = createOutlineExtractionProvider({
			fetchImpl: async () => {
				throw new Error('should not run');
			}
		});
		expect((await provider.extract({ text: SAMPLE, sha256: 'z' })).reason).toBe('missing-key');
	});

	it('fails closed without a key and does not call the network', async () => {
		let called = 0;
		const provider = createOutlineExtractionProvider({
			getKey: () => '',
			fetchImpl: async () => {
				called += 1;
				return /** @type {Response} */ ({ ok: true, json: async () => ({}) });
			}
		});
		const result = await provider.extract({ text: SAMPLE, sha256: 'abc' });
		expect(result.ok).toBe(false);
		expect(result.reason).toBe('missing-key');
		expect(called).toBe(0);
		expect(provider.inferenceCount()).toBe(0);
	});

	it('counts one inference then reuses the cache', async () => {
		let called = 0;
		const provider = createOutlineExtractionProvider({
			getKey: () => 'nvapi-test',
			getModel: () => 'nvidia/nemotron-3.5-lightning-30b-a3b',
			fetchImpl: async () => {
				called += 1;
				return {
					ok: true,
					json: async () => ({
						choices: [
							{
								message: {
									content: JSON.stringify({
										assessments: [{ title: 'Midterm', weight: 30 }]
									})
								}
							}
						]
					})
				};
			}
		});
		const first = await provider.extract({
			text: SAMPLE,
			sha256: 'same-doc',
			offeringKey: 'fall-2026:203-SN3-RE:00021'
		});
		const second = await provider.extract({
			text: SAMPLE,
			sha256: 'same-doc',
			offeringKey: 'fall-2026:203-SN3-RE:00021'
		});
		expect(first.ok).toBe(true);
		expect(first.cacheHit).toBe(false);
		expect(second.cacheHit).toBe(true);
		expect(called).toBe(1);
		expect(provider.inferenceCount()).toBe(1);
		expect(second.inferenceCount).toBe(1);
	});

	it('fails closed on invalid JSON', async () => {
		const provider = createOutlineExtractionProvider({
			getKey: () => 'nvapi-test',
			fetchImpl: async () => ({
				ok: true,
				json: async () => ({ choices: [{ message: { content: 'not-json' } }] })
			})
		});
		const result = await provider.extract({ text: SAMPLE, sha256: 'bad' });
		expect(result.ok).toBe(false);
		expect(result.reason).toBe('invalid-json');
	});

	it('fails closed on HTTP errors and network throws', async () => {
		const http = createOutlineExtractionProvider({
			getKey: () => 'k',
			fetchImpl: async () => ({ ok: false, json: async () => ({}) })
		});
		expect((await http.extract({ text: SAMPLE, sha256: 'h' })).reason).toBe('http');

		const net = createOutlineExtractionProvider({
			getKey: () => 'k',
			fetchImpl: async () => {
				throw new Error('offline');
			}
		});
		expect((await net.extract({ text: SAMPLE, sha256: 'n' })).reason).toBe('network');
	});

	it('rejects a scanned PDF before calling the model', async () => {
		const provider = createOutlineExtractionProvider({
			getKey: () => 'k',
			fetchImpl: async () => {
				throw new Error('should not run');
			}
		});
		const result = await provider.extract({ text: '', byteLength: 1200, sha256: 'scan' });
		expect(result.reason).toBe('needs-text-pdf');
	});

	it('rejects a JSON null payload', async () => {
		const provider = createOutlineExtractionProvider({
			getKey: () => 'k',
			fetchImpl: async () => ({
				ok: true,
				json: async () => ({ choices: [{ message: { content: 'null' } }] })
			})
		});
		expect((await provider.extract({ text: SAMPLE, sha256: 'nullish' })).reason).toBe(
			'invalid-json'
		);
	});
});
