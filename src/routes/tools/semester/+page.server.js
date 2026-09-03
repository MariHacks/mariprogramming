import { env } from '$env/dynamic/private';
import { fail } from '@sveltejs/kit';
import { createOutlineExtractionProvider, needsTextPdf } from '$lib/maritools/extract/provider.js';
import {
	proposalsNeedAssessmentFacts,
	proposalsNeedAssessmentDates,
	proposalsNeedIdentity,
	withGuessedAssessmentDates,
	withGuessedIdentity
} from '$lib/maritools/extract/identity.js';
import { semesterPageView } from '$lib/server/maritools/community.js';
import { extractPdfText, isPdfHeader } from '$lib/server/maritools/pdf-text.js';
import {
	MaritoolsInputError,
	MaritoolsUnavailableError,
	openStudentStore
} from '$lib/server/maritools/student-store.js';

export const prerender = false;

const MAX_PDF_BYTES = 8_000_000;

/** @param {Record<string, any>} [dependencies] */
export function _createHandlers(dependencies = {}) {
	const createRepository = dependencies.createRepository ?? openStudentStore;
	const extractPdf = dependencies.extractPdf ?? extractPdfText;
	const isPdf = dependencies.isPdf ?? isPdfHeader;
	const privateEnv = dependencies.privateEnv ?? env;
	const getNimKey =
		dependencies.getNimKey ?? (() => String(privateEnv.NVIDIA_NIM_API_KEY ?? '').trim());
	const getNimModel =
		dependencies.getNimModel ?? (() => privateEnv.NVIDIA_NIM_MODEL || 'qwen/qwen3.5-122b-a10b');
	const getToday = dependencies.getToday ?? (() => new Date().toISOString().slice(0, 10));
	const createProvider =
		dependencies.createProvider ??
		(() => createOutlineExtractionProvider({ getKey: getNimKey, getModel: getNimModel }));

	/** @param {any} event */
	async function load(event) {
		const session = event.locals.maritools ?? null;
		let profile = null;
		let outlines = [];
		let activeTerm = null;
		if (session) {
			let repository;
			try {
				repository = createRepository();
				profile = await repository.getProfile(session.userId);
			} catch {
				profile = null;
			}
			if (repository && semesterPageView(session, profile).kind === 'ready') {
				try {
					const [savedOutlines, terms] = await Promise.all([
						repository.listOutlines(session.userId),
						repository.listTerms()
					]);
					outlines = savedOutlines;
					const today = getToday();
					const term = terms.find((entry) => entry.startDate <= today && today <= entry.endDate);
					activeTerm = term ? { id: term.id, name: term.name } : null;
				} catch {
					outlines = [];
				}
			}
		}
		return { view: semesterPageView(session, profile), outlines, activeTerm };
	}

	/** @param {any} event @param {{ kind: string }} view */
	function rejectView(view) {
		if (view.kind === 'need-sign-in') return fail(401, { error: 'Sign in with Google first.' });
		if (view.kind === 'need-profile') {
			return fail(400, { error: 'Finish your account before uploading an outline.' });
		}
		return fail(400, { error: 'Confirm outline analysis before uploading an outline.' });
	}

	/** @param {any} event */
	async function confirmAnalysis(event) {
		const session = event.locals.maritools;
		if (!session) return fail(401, { error: 'Sign in with Google first.' });
		try {
			const repository = createRepository();
			const profile = await repository.getProfile(session.userId);
			if (!profile) return fail(400, { error: 'Finish your account before continuing.' });
			await repository.acceptOutlineAnalysis(session.userId);
			return { confirmed: true };
		} catch (error) {
			if (error instanceof MaritoolsInputError) {
				return fail(400, { error: 'Could not confirm outline analysis. Try again.' });
			}
			if (error instanceof MaritoolsUnavailableError) {
				return fail(503, { error: 'Semester tools are unavailable. Try again.' });
			}
			throw error;
		}
	}

	/** @param {any} event */
	async function requireReady(event) {
		const session = event.locals.maritools;
		if (!session) return { error: rejectView({ kind: 'need-sign-in' }) };
		let profile;
		let repository;
		try {
			repository = createRepository();
			profile = await repository.getProfile(session.userId);
		} catch (error) {
			if (error instanceof MaritoolsUnavailableError) {
				return { error: fail(503, { error: 'Semester tools are unavailable. Try again.' }) };
			}
			throw error;
		}
		const view = semesterPageView(session, profile);
		if (view.kind !== 'ready') return { error: rejectView(view) };
		return { session, repository };
	}

	/** @param {any} repository */
	async function getActiveTerm(repository) {
		const today = getToday();
		const terms = await repository.listTerms();
		return terms.find((term) => term.startDate <= today && today <= term.endDate) ?? null;
	}

	/** @param {any} event */
	async function extract(event) {
		const ready = await requireReady(event);
		if (ready.error) return ready.error;
		const data = await event.request.formData();
		const file = data.get('outline');
		if (!(file instanceof File) || file.size === 0) {
			return fail(400, { error: 'Choose a PDF to upload.' });
		}
		const outlineFileName = file.name;
		if (file.size > MAX_PDF_BYTES) {
			return fail(400, { error: 'That PDF is too large. Try one under 8 MB.' });
		}
		const bytes = new Uint8Array(await file.arrayBuffer());
		if (!isPdf(bytes)) {
			return fail(400, { error: 'Upload a PDF file.' });
		}
		const extracted = extractPdf(bytes);
		const text = String(extracted.text ?? '').trim();
		if (needsTextPdf(text, extracted.byteLength)) {
			return fail(400, {
				error:
					'This looks like a scanned PDF. Export a text PDF from the original document and upload that.'
			});
		}
		try {
			const repository = ready.repository;
			await repository.saveOutlineDocument({
				userId: ready.session.userId,
				sha256: extracted.sha256,
				byteLength: extracted.byteLength,
				extractedText: text
			});
			const cached = await repository.getExtraction(extracted.sha256);
			if (
				cached &&
				!proposalsNeedIdentity(cached.proposals) &&
				!proposalsNeedAssessmentDates(cached.proposals) &&
				!proposalsNeedAssessmentFacts(cached.proposals)
			) {
				return {
					outlineFileName,
					extraction: {
						ok: true,
						reason: null,
						proposals: cached.proposals,
						inferenceCount: cached.inferenceCount,
						cacheHit: true,
						sha256: extracted.sha256
					}
				};
			}
			const provider = createProvider();
			const result = await provider.extract({
				text,
				sha256: extracted.sha256,
				byteLength: extracted.byteLength
			});
			const proposals = result.ok
				? withGuessedAssessmentDates(
						withGuessedIdentity(
							/** @type {Record<string, unknown> | null} */ (result.proposals),
							text
						),
						text
					)
				: null;
			if (result.ok && result.proposals) {
				await repository.saveExtraction({
					documentSha256: extracted.sha256,
					offeringId: null,
					proposals,
					model: getNimModel(),
					inferenceCount: result.inferenceCount
				});
			}
			return {
				outlineFileName,
				extraction: {
					...result,
					proposals,
					sha256: extracted.sha256
				}
			};
		} catch (error) {
			if (error instanceof MaritoolsInputError) {
				return fail(400, {
					error: 'Could not save that outline. Try another PDF or enter the details manually.'
				});
			}
			if (error instanceof MaritoolsUnavailableError) {
				return fail(503, { error: 'Semester tools are unavailable. Try again.' });
			}
			throw error;
		}
	}

	/** @param {any} event */
	async function contribute(event) {
		const ready = await requireReady(event);
		if (ready.error) return ready.error;
		const data = await event.request.formData();
		let structured;
		try {
			structured = JSON.parse(String(data.get('structured') ?? ''));
		} catch {
			return fail(400, { error: 'Review the assessments and books before sharing.' });
		}
		if (!structured || typeof structured !== 'object') {
			return fail(400, { error: 'Review the assessments and books before sharing.' });
		}
		try {
			const repository = ready.repository;
			const courseCode = String(data.get('courseCode') ?? '').trim();
			const title = String(data.get('title') ?? '').trim();
			const section = String(data.get('section') ?? '').trim();
			const teacherName = String(data.get('teacherName') ?? '').trim();
			const documentSha256 = String(data.get('sha256') ?? '').trim();
			const shareToCatalog = data.get('shareToCatalog') === 'yes';
			const reviewProposals = { ...structured, courseCode, title, section, teacherName };
			if (shareToCatalog) {
				const activeTerm = await getActiveTerm(repository);
				if (!activeTerm) {
					return fail(503, { error: 'No active academic term is configured.' });
				}
				await repository.saveOutlineReview({
					userId: ready.session.userId,
					sha256: documentSha256,
					proposals: reviewProposals
				});
				await repository.contribute({
					contributorUserId: ready.session.userId,
					documentSha256,
					termId: activeTerm.id,
					courseCode,
					title,
					section,
					teacherName,
					structured
				});
				return { contributed: true };
			}
			await repository.saveOutlineReview({
				userId: ready.session.userId,
				sha256: documentSha256,
				proposals: reviewProposals
			});
			return { saved: true, shared: false };
		} catch (error) {
			if (error instanceof MaritoolsInputError) {
				return fail(400, {
					error: 'Add the course code, section, teacher, and term before sharing.'
				});
			}
			if (error instanceof MaritoolsUnavailableError) {
				return fail(503, { error: 'Sharing to the catalog is unavailable. Try again.' });
			}
			throw error;
		}
	}

	/** @param {any} event */
	async function deleteOutline(event) {
		const ready = await requireReady(event);
		if (ready.error) return ready.error;
		const data = await event.request.formData();
		const sha256 = String(data.get('sha256') ?? '').trim();
		try {
			await ready.repository.deleteOutline({ userId: ready.session.userId, sha256 });
			return { deleted: true, sha256 };
		} catch (error) {
			if (error instanceof MaritoolsInputError) {
				return fail(400, { error: 'Could not delete that saved outline.' });
			}
			if (error instanceof MaritoolsUnavailableError) {
				return fail(503, { error: 'Deleting that outline is unavailable. Try again.' });
			}
			throw error;
		}
	}

	return { load, actions: { confirmAnalysis, extract, contribute, deleteOutline } };
}

const handlers = _createHandlers();
export const load = handlers.load;
export const actions = handlers.actions;
