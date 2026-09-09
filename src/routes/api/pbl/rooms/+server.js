import { createPblRuntime, memberFromRequest, pblErrorResponse, pblJson, readPblJson } from '$lib/server/pbl/http.js';

export const prerender = false;

/** @param {Record<string, any>} [dependencies] */
export function _createPblCreateEndpoint(dependencies = {}) {
	const runtime = createPblRuntime(dependencies);
	return async function POST(event) {
		try {
			const body = await readPblJson(event.request);
			const membership = memberFromRequest(event.request, event);
			const room = await runtime.withStore((store) =>
				store.createRoom({
					pblId: body.pblId,
					teamName: body.teamName,
					memberId: membership.memberId
				})
			);
			return pblJson(room, 201, membership.setCookie ? { 'set-cookie': membership.setCookie } : {});
		} catch (error) {
			return pblErrorResponse(error);
		}
	};
}

export const POST = _createPblCreateEndpoint();
