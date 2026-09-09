import {
	createPblRuntime,
	memberFromRequest,
	pblErrorResponse,
	pblJson,
	readPblJson
} from '$lib/server/pbl/http.js';
import { readMemberId } from '$lib/server/pbl/cookie.js';

export const prerender = false;

/** @param {Record<string, any>} [dependencies] */
export function _createPblRoomEndpoint(dependencies = {}) {
	const runtime = createPblRuntime(dependencies);

	/** @param {any} event */
	async function GET(event) {
		try {
			const viewer = readMemberId(event.request.headers.get('cookie'));
			const room = await runtime.withStore((store) =>
				store.getRoom(event.params.code, viewer ?? undefined)
			);
			return pblJson(room);
		} catch (error) {
			return pblErrorResponse(error);
		}
	}

	/** @param {any} event */
	async function PUT(event) {
		try {
			const body = await readPblJson(event.request);
			const membership = memberFromRequest(event.request, event);
			const room = await runtime.withStore((store) =>
				store.updateRoom({
					code: event.params.code,
					memberId: membership.memberId,
					version: body.version,
					source: body.source,
					currentStep: body.currentStep,
					unlockedStep: body.unlockedStep,
					openedHints: body.openedHints,
					lastCheck: body.lastCheck,
					yjsState: body.yjsState,
					awarenessState: body.awarenessState
				})
			);
			return pblJson(room, 200, membership.setCookie ? { 'set-cookie': membership.setCookie } : {});
		} catch (error) {
			return pblErrorResponse(error);
		}
	}

	return { GET, PUT };
}

const endpoint = _createPblRoomEndpoint();
export const GET = endpoint.GET;
export const PUT = endpoint.PUT;
