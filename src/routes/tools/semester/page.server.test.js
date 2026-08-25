// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import { MaritoolsInputError, MaritoolsUnavailableError } from '$lib/server/maritools/student-store.js';
import { prerender, _createHandlers } from './+page.server.js';

const SESSION = {
	userId: 'user-1',
	sessionId: 'session-1',
	email: 'ada@gmail.com',
	googleSubject: 'sub-1',
	expiresAt: new Date('2030-01-01T00:00:00.000Z')
};
const PROFILE = {
	userId: SESSION.userId,
	studentId: '2530622',
	displayName: 'Ada',
	role: 'student',
	nimDisclosureAcceptedAt: new Date('2026-08-20T00:00:00.000Z')
};
const TEXT =
	'Assessment: Midterm 30% on 2026-10-20. Required book: Title, Author. Extra outline sentences for length.';

function handlers(overrides = {}) {
	const repository = {
		getProfile: vi.fn(async () => PROFILE),
		getExtraction: vi.fn(async () => null),
		saveOutlineDocument: vi.fn(async () => undefined),
		saveExtraction: vi.fn(async () => undefined),
		contribute: vi.fn(async () => ({ offeringId: 'off-1' })),
		...overrides.repository
	};
	const extractPdf = overrides.extractPdf ?? vi.fn(() => ({ text: TEXT, byteLength: 1200, sha256: 'ab'.repeat(32) }));
	const provider = {
		extract: vi.fn(async () => ({
			ok: true,
			reason: null,
			proposals: { assessments: [{ title: 'Midterm', weight: 30 }], books: [] },
			inferenceCount: 1,
			cacheHit: false
		}))
	};
	return {
		..._createHandlers({
			createRepository: vi.fn(() => repository),
			extractPdf,
			isPdf: overrides.isPdf ?? vi.fn(() => true),
			createProvider: vi.fn(() => provider),
			getNimKey: vi.fn(() => 'nvapi-test'),
			getNimModel: vi.fn(() => 'nvidia/nemotron-3.5-lightning-30b-a3b'),
			...overrides
		}),
		repository,
		provider,
		extractPdf
	};
}

function event({ locals = { maritools: SESSION }, form, file } = {}) {
	const data = new FormData();
	if (form) {
		for (const [key, value] of Object.entries(form)) data.set(key, String(value));
	}
	if (file) data.set('outline', file);
	return {
		locals,
		request: { formData: async () => data }
	};
}

describe('semester page server', () => {
	it('is not prerendered', () => {
		expect(prerender).toBe(false);
	});

	it('asks anonymous visitors to sign in', async () => {
		const data = await handlers().load(event({ locals: {} }));
		expect(data.view).toEqual({ kind: 'need-sign-in' });
	});

	it('asks signed-in students to finish the account', async () => {
		const current = handlers({
			repository: { getProfile: vi.fn(async () => null) }
		});
		const data = await current.load(event());
		expect(data.view).toEqual({ kind: 'need-profile' });
	});

	it('asks for NVIDIA disclosure before extraction', async () => {
		const current = handlers({
			repository: {
				getProfile: vi.fn(async () => ({ ...PROFILE, nimDisclosureAcceptedAt: null }))
			}
		});
		const data = await current.load(event());
		expect(data.view).toEqual({ kind: 'need-disclosure' });
	});

	it('is ready when the account is complete', async () => {
		const data = await handlers().load(event());
		expect(data.view).toEqual({ kind: 'ready' });
	});

	it('extracts a text PDF and keeps it private', async () => {
		const current = handlers();
		const result = await current.actions.extract(
			event({ file: new File([TEXT], 'outline.pdf', { type: 'application/pdf' }) })
		);
		expect(result.extraction.ok).toBe(true);
		expect(result.extraction.proposals.assessments[0].title).toBe('Midterm');
		expect(current.repository.saveOutlineDocument).toHaveBeenCalled();
		expect(current.provider.extract).toHaveBeenCalled();
	});

	it('reuses a stored extraction without calling NVIDIA', async () => {
		const current = handlers({
			repository: {
				getProfile: vi.fn(async () => PROFILE),
				getExtraction: vi.fn(async () => ({
					proposals: { assessments: [{ title: 'Cached' }], books: [] },
					inferenceCount: 4
				}))
			}
		});
		const result = await current.actions.extract(
			event({ file: new File([TEXT], 'outline.pdf', { type: 'application/pdf' }) })
		);
		expect(result.extraction.cacheHit).toBe(true);
		expect(current.provider.extract).not.toHaveBeenCalled();
	});

	it('refuses a scanned PDF before NVIDIA', async () => {
		const current = handlers({
			extractPdf: vi.fn(() => ({ text: '', byteLength: 90_000, sha256: 'cd'.repeat(32) }))
		});
		const result = await current.actions.extract(
			event({ file: new File(['x'], 'scan.pdf', { type: 'application/pdf' }) })
		);
		expect(result.status).toBe(400);
		expect(result.data.error).toMatch(/text PDF/i);
		expect(current.provider.extract).not.toHaveBeenCalled();
	});

	it('refuses a non-PDF upload', async () => {
		const current = handlers({
			extractPdf: vi.fn(() => ({ text: '', byteLength: 4, sha256: 'ee'.repeat(32) })),
			isPdf: vi.fn(() => false)
		});
		const result = await current.actions.extract(
			event({ file: new File(['note'], 'notes.txt', { type: 'text/plain' }) })
		);
		expect(result.status).toBe(400);
		expect(result.data.error).toMatch(/PDF/i);
	});

	it('keeps the file when NVIDIA is missing a key so the student can type fields', async () => {
		const current = handlers({
			getNimKey: vi.fn(() => ''),
			createProvider: vi.fn(() => ({
				extract: vi.fn(async () => ({
					ok: false,
					reason: 'missing-key',
					proposals: null,
					inferenceCount: 0
				}))
			}))
		});
		const result = await current.actions.extract(
			event({ file: new File([TEXT], 'outline.pdf', { type: 'application/pdf' }) })
		);
		expect(result.extraction.ok).toBe(false);
		expect(result.extraction.reason).toBe('missing-key');
		expect(current.repository.saveOutlineDocument).toHaveBeenCalled();
	});

	it('rejects extract without a session', async () => {
		const result = await handlers().actions.extract(event({ locals: {}, file: new File(['x'], 'a.pdf') }));
		expect(result.status).toBe(401);
	});

	it('contributes reviewed structured fields', async () => {
		const current = handlers();
		const result = await current.actions.contribute(
			event({
				form: {
					sha256: 'ab'.repeat(32),
					termId: 'fall-2026',
					courseCode: '203-SN3-RE',
					title: 'Modern Physics',
					section: '00021',
					teacherName: 'Baharak Fatholahzadeh',
					structured: JSON.stringify({
						assessments: [{ title: 'Midterm', weight: 30 }],
						books: []
					})
				}
			})
		);
		expect(result).toMatchObject({ contributed: true });
		expect(current.repository.contribute).toHaveBeenCalled();
	});

	it('rejects invalid contribute JSON', async () => {
		const result = await handlers().actions.contribute(
			event({
				form: {
					sha256: 'ab'.repeat(32),
					termId: 'fall-2026',
					courseCode: '203-SN3-RE',
					title: 'Modern Physics',
					section: '00021',
					teacherName: 'Baharak',
					structured: 'not-json'
				}
			})
		);
		expect(result.status).toBe(400);
	});

	it('maps repository input errors on contribute', async () => {
		const current = handlers({
			repository: {
				getProfile: vi.fn(async () => PROFILE),
				contribute: vi.fn(async () => {
					throw new MaritoolsInputError('invalid-offering');
				})
			}
		});
		const result = await current.actions.contribute(
			event({
				form: {
					sha256: 'ab'.repeat(32),
					termId: 'fall-2026',
					courseCode: '203-SN3-RE',
					title: 'Modern Physics',
					section: '00021',
					teacherName: 'Baharak',
					structured: JSON.stringify({ assessments: [], books: [] })
				}
			})
		);
		expect(result.status).toBe(400);
	});

	it('maps unavailable errors on extract', async () => {
		const current = handlers({
			repository: {
				getProfile: vi.fn(async () => PROFILE),
				getExtraction: vi.fn(async () => {
					throw new MaritoolsUnavailableError();
				})
			}
		});
		const result = await current.actions.extract(
			event({ file: new File([TEXT], 'outline.pdf', { type: 'application/pdf' }) })
		);
		expect(result.status).toBe(503);
	});

	it('rejects an empty upload and an oversized PDF', async () => {
		const current = handlers();
		const empty = await current.actions.extract(event({ file: new File([], 'empty.pdf') }));
		expect(empty.status).toBe(400);
		const huge = new File([TEXT], 'huge.pdf');
		Object.defineProperty(huge, 'size', { value: 8_000_001 });
		const oversized = await current.actions.extract(event({ file: huge }));
		expect(oversized.status).toBe(400);
	});

	it('blocks extract until the account is ready', async () => {
		const unsigned = await handlers().actions.extract(event({ locals: {}, file: new File([TEXT], 'a.pdf') }));
		expect(unsigned.status).toBe(401);
		const incomplete = handlers({
			repository: { getProfile: vi.fn(async () => null) }
		});
		const profile = await incomplete.actions.extract(
			event({ file: new File([TEXT], 'outline.pdf') })
		);
		expect(profile.status).toBe(400);
		const disclosure = handlers({
			repository: {
				getProfile: vi.fn(async () => ({ ...PROFILE, nimDisclosureAcceptedAt: null }))
			}
		});
		const blocked = await disclosure.actions.extract(
			event({ file: new File([TEXT], 'outline.pdf') })
		);
		expect(blocked.status).toBe(400);
	});

	it('returns 503 when profile lookup is down', async () => {
		const current = handlers({
			repository: {
				getProfile: vi.fn(async () => {
					throw new MaritoolsUnavailableError();
				})
			}
		});
		const result = await current.actions.extract(
			event({ file: new File([TEXT], 'outline.pdf') })
		);
		expect(result.status).toBe(503);
		const loaded = await current.load(event());
		expect(loaded.view.kind).toBe('need-profile');
	});

	it('treats missing contribute fields as empty', async () => {
		const current = handlers({
			repository: {
				getProfile: vi.fn(async () => PROFILE),
				contribute: vi.fn(async () => {
					throw new MaritoolsInputError('invalid-offering');
				})
			}
		});
		const missingJson = await current.actions.contribute(event({ form: {} }));
		expect(missingJson.status).toBe(400);
		const result = await current.actions.contribute(event({ form: { structured: '{}' } }));
		expect(result.status).toBe(400);
		expect(current.repository.contribute).toHaveBeenCalledWith(
			expect.objectContaining({
				documentSha256: '',
				termId: '',
				courseCode: '',
				title: '',
				section: '',
				teacherName: ''
			})
		);
	});
		const unsigned = await handlers().actions.contribute(event({ locals: {}, form: { structured: 'null' } }));
		expect(unsigned.status).toBe(401);
		const nullish = await handlers().actions.contribute(
			event({ form: { structured: 'null', sha256: 'ab'.repeat(32) } })
		);
		expect(nullish.status).toBe(400);
	});

	it('rejects a missing outline file', async () => {
		const result = await handlers().actions.extract(event({ form: { outline: 'not-a-file' } }));
		expect(result.status).toBe(400);
	});

	it('rethrows unexpected extract and contribute failures', async () => {
		const extractFail = handlers({
			repository: {
				getProfile: vi.fn(async () => PROFILE),
				saveOutlineDocument: vi.fn(async () => {
					throw new Error('disk');
				})
			}
		});
		await expect(
			extractFail.actions.extract(event({ file: new File([TEXT], 'outline.pdf') }))
		).rejects.toThrow('disk');

		const profileFail = handlers({
			repository: {
				getProfile: vi.fn(async () => {
					throw new Error('profile');
				})
			}
		});
		await expect(
			profileFail.actions.extract(event({ file: new File([TEXT], 'outline.pdf') }))
		).rejects.toThrow('profile');

		const contributeFail = handlers({
			repository: {
				getProfile: vi.fn(async () => PROFILE),
				contribute: vi.fn(async () => {
					throw new Error('share');
				})
			}
		});
		await expect(
			contributeFail.actions.contribute(
				event({
					form: {
						sha256: 'ab'.repeat(32),
						termId: 'fall-2026',
						courseCode: '203-SN3-RE',
						title: 'Modern Physics',
						section: '00021',
						teacherName: 'Baharak',
						structured: JSON.stringify({ assessments: [], books: [] })
					}
				})
			)
		).rejects.toThrow('share');
	});

	it('uses default NVIDIA helpers when extract succeeds without cache', async () => {
		const previousKey = process.env.NVIDIA_NIM_API_KEY;
		const previousModel = process.env.NVIDIA_NIM_MODEL;
		delete process.env.NVIDIA_NIM_API_KEY;
		delete process.env.NVIDIA_NIM_MODEL;
		try {
			const current = handlers({
				getNimKey: undefined,
				getNimModel: undefined,
				createProvider: undefined
			});
			const result = await current.actions.extract(
				event({ file: new File([TEXT], 'outline.pdf', { type: 'application/pdf' }) })
			);
			expect(result.extraction.ok).toBe(false);
			expect(result.extraction.reason).toBe('missing-key');
			process.env.NVIDIA_NIM_MODEL = 'nvidia/custom';
			const withModel = handlers({
				getNimKey: undefined,
				getNimModel: undefined,
				createProvider: vi.fn(() => ({
					extract: vi.fn(async () => ({
						ok: true,
						reason: null,
						proposals: { assessments: [], books: [] },
						inferenceCount: 1
					}))
				}))
			});
			const saved = await withModel.actions.extract(
				event({ file: new File([TEXT], 'outline.pdf', { type: 'application/pdf' }) })
			);
			expect(saved.extraction.ok).toBe(true);
			expect(withModel.repository.saveExtraction).toHaveBeenCalledWith(
				expect.objectContaining({ model: 'nvidia/custom' })
			);
			delete process.env.NVIDIA_NIM_MODEL;
			const defaultModel = handlers({
				getNimKey: undefined,
				getNimModel: undefined,
				createProvider: vi.fn(() => ({
					extract: vi.fn(async () => ({
						ok: true,
						reason: null,
						proposals: { assessments: [], books: [] },
						inferenceCount: 1
					}))
				}))
			});
			await defaultModel.actions.extract(
				event({ file: new File([TEXT], 'outline.pdf', { type: 'application/pdf' }) })
			);
			expect(defaultModel.repository.saveExtraction).toHaveBeenCalledWith(
				expect.objectContaining({
					model: 'nvidia/nemotron-3.5-lightning-30b-a3b'
				})
			);
			const fallbackModel = handlers({
				getNimKey: undefined,
				getNimModel: undefined,
				createProvider: vi.fn(() => ({
					extract: vi.fn(async () => ({
						ok: true,
						reason: null,
						proposals: null,
						inferenceCount: 1
					}))
				}))
			});
			const skipped = await fallbackModel.actions.extract(
				event({ file: new File([TEXT], 'outline.pdf', { type: 'application/pdf' }) })
			);
			expect(skipped.extraction.ok).toBe(true);
			expect(fallbackModel.repository.saveExtraction).not.toHaveBeenCalled();
		} finally {
			if (previousKey === undefined) delete process.env.NVIDIA_NIM_API_KEY;
			else process.env.NVIDIA_NIM_API_KEY = previousKey;
			if (previousModel === undefined) delete process.env.NVIDIA_NIM_MODEL;
			else process.env.NVIDIA_NIM_MODEL = previousModel;
		}
	});

	it('maps unavailable errors on contribute', async () => {
		const current = handlers({
			repository: {
				getProfile: vi.fn(async () => PROFILE),
				contribute: vi.fn(async () => {
					throw new MaritoolsUnavailableError();
				})
			}
		});
		const result = await current.actions.contribute(
			event({
				form: {
					sha256: 'ab'.repeat(32),
					termId: 'fall-2026',
					courseCode: '203-SN3-RE',
					title: 'Modern Physics',
					section: '00021',
					teacherName: 'Baharak',
					structured: JSON.stringify({ assessments: [], books: [] })
				}
			})
		);
		expect(result.status).toBe(503);
	});
});
