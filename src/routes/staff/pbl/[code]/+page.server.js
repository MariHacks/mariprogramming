import { error, fail, isRedirect, redirect } from '@sveltejs/kit';
import { requireStaff } from '$lib/server/auth/authorization.js';
import { createPblRuntime, pblErrorResponse } from '$lib/server/pbl/http.js';
import {
	PblConflictError,
	PblInputError,
	PblNotFoundError
} from '$lib/server/pbl/store.js';

export const prerender = false;

/** @param {unknown} failure */
function actionFailure(failure) {
	if (failure instanceof PblInputError || failure instanceof PblNotFoundError) {
		return fail(failure.status, { error: failure.message });
	}
	if (failure instanceof PblConflictError) {
		return fail(409, { error: failure.message });
	}
	const response = pblErrorResponse(failure);
	if (response.status === 503) {
		return fail(503, { error: 'Workshop room data is unavailable. Try again shortly.' });
	}
	throw failure;
}

/** @param {Record<string, any>} [dependencies] */
export function _createStaffPblDetailHandlers(dependencies = {}) {
	const authorize = dependencies.authorize ?? requireStaff;
	const runtime = createPblRuntime(dependencies);

	/**
	 * @param {any} event
	 * @param {(store: any, fields: { code: string, form: FormData }) => Promise<any>} run
	 */
	async function mutate(event, run) {
		authorize(event.locals);
		const code = String(event.params.code ?? '').trim();
		if (!code) return fail(400, { error: 'That room code is not valid.' });
		try {
			const form = await event.request.formData();
			return await runtime.withStore((store) => run(store, { code, form }));
		} catch (failure) {
			if (isRedirect(failure)) throw failure;
			return actionFailure(failure);
		}
	}

	return Object.freeze({
		/** @param {any} event */
		async load(event) {
			authorize(event.locals);
			try {
				const room = await runtime.withStore((store) => store.getStaffRoom(event.params.code));
				return { room, unavailable: false };
			} catch (failure) {
				if (failure instanceof PblNotFoundError) error(404, 'Room not found');
				const response = pblErrorResponse(failure);
				if (response.status === 503) {
					return { room: null, unavailable: true };
				}
				if (response.status === 400 || response.status === 404) {
					error(response.status, 'Room not found');
				}
				throw failure;
			}
		},
		actions: Object.freeze({
			/** @param {any} event */
			ejectMember: (event) =>
				mutate(event, async (store, { code, form }) => {
					const targetMemberId = String(form.get('memberId') ?? '').trim();
					if (!targetMemberId) return fail(400, { error: 'Pick a teammate to remove.' });
					await store.staffEjectMember({ code, targetMemberId });
					return { ok: true, action: 'ejectMember' };
				}),
			/** @param {any} event */
			transferLeader: (event) =>
				mutate(event, async (store, { code, form }) => {
					const newDriverMemberId = String(form.get('memberId') ?? '').trim();
					if (!newDriverMemberId) return fail(400, { error: 'Pick a new team leader.' });
					await store.transferDriver({ code, newDriverMemberId });
					return { ok: true, action: 'transferLeader' };
				}),
			/** @param {any} event */
			async disbandTeam(event) {
				authorize(event.locals);
				const code = String(event.params.code ?? '').trim();
				if (!code) return fail(400, { error: 'That room code is not valid.' });
				try {
					const form = await event.request.formData();
					const confirm = String(form.get('confirm') ?? '').trim().toUpperCase();
					if (confirm !== code.toUpperCase()) {
						return fail(400, {
							error: 'Type the room code to confirm disbanding this team.'
						});
					}
					await runtime.withStore((store) => store.disbandRoom({ code }));
				} catch (failure) {
					return actionFailure(failure);
				}
				redirect(303, '/staff/pbl');
			}
		})
	});
}

const handlers = _createStaffPblDetailHandlers();
export const load = handlers.load;
export const actions = handlers.actions;
