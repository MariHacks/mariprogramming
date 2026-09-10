import {
	createPblRuntime,
	memberFromRequest,
	pblErrorResponse,
	pblJson,
	requirePblSession
} from '$lib/server/pbl/http.js';

export const prerender = false;

/** @param {Record<string, any>} [dependencies] */
export function _createPblJoinEndpoint(dependencies = {}) {
	const runtime = createPblRuntime(dependencies);
	return async function POST(event) {
		try {
			const { userId } = requirePblSession(event.locals);
			const membership = memberFromRequest(event.request, event);
			const room = await runtime.withStore((store) =>
				store.joinRoom({
					code: event.params.code,
					memberId: membership.memberId,
					userId
				})
			);
			return pblJson(room, 200, membership.setCookie ? { 'set-cookie': membership.setCookie } : {});
		} catch (error) {
			return pblErrorResponse(error);
		}
	};
}

export const POST = _createPblJoinEndpoint();
