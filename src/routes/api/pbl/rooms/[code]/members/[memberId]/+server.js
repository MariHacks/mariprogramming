import {
	createPblRuntime,
	memberFromRequest,
	pblErrorResponse,
	pblJson
} from '$lib/server/pbl/http.js';

export const prerender = false;

/** @param {Record<string, any>} [dependencies] */
export function _createPblEjectMemberEndpoint(dependencies = {}) {
	const runtime = createPblRuntime(dependencies);

	/** @param {any} event */
	async function DELETE(event) {
		try {
			const membership = memberFromRequest(event.request, event);
			const room = await runtime.withStore(async (store) => {
				await store.ejectMember({
					code: event.params.code,
					actorMemberId: membership.memberId,
					targetMemberId: event.params.memberId
				});
				return store.getRoom(event.params.code, membership.memberId);
			});
			return pblJson(room, 200, membership.setCookie ? { 'set-cookie': membership.setCookie } : {});
		} catch (error) {
			return pblErrorResponse(error);
		}
	}

	return { DELETE };
}

const endpoint = _createPblEjectMemberEndpoint();
export const DELETE = endpoint.DELETE;
