import {
	createPblRuntime,
	memberFromRequest,
	pblErrorResponse,
	pblJson,
	readPblJson,
	requirePblSession
} from '$lib/server/pbl/http.js';
import { memberCookie, readMemberId } from '$lib/server/pbl/cookie.js';

export const prerender = false;

/** @param {Record<string, any>} [dependencies] */
export function _createPblRoomEndpoint(dependencies = {}) {
	const runtime = createPblRuntime(dependencies);

	/** @param {any} event */
	async function GET(event) {
		try {
			const viewer = readMemberId(event.request.headers.get('cookie'));
			const userId = event.locals?.maritools?.userId;
			const room = await runtime.withStore((store) =>
				store.getRoom(
					event.params.code,
					viewer ?? undefined,
					typeof userId === 'string' && userId ? userId : undefined
				)
			);
			/** @type {Record<string, string>} */
			const headers = {};
			const rebound =
				room &&
				typeof room === 'object' &&
				typeof room.memberId === 'string' &&
				room.memberId &&
				room.memberId !== viewer
					? room.memberId
					: null;
			if (rebound) {
				const secure = event.url.protocol === 'https:';
				headers['set-cookie'] = memberCookie(rebound, { secure });
			}
			return pblJson(room, 200, headers);
		} catch (error) {
			return pblErrorResponse(error);
		}
	}

	/** @param {any} event */
	async function PUT(event) {
		try {
			requirePblSession(event.locals);
			const body = await readPblJson(event.request);
			const membership = memberFromRequest(event.request, event);
			const room = await runtime.withStore((store) =>
				store.updateRoom({
					code: event.params.code,
					memberId: membership.memberId,
					version: body.version,
					source: body.source,
					unlockedStep: body.unlockedStep,
					openedHints: body.openedHints,
					lastCheck: body.lastCheck,
					lastRun: body.lastRun,
					yjsState: body.yjsState,
					awarenessState: body.awarenessState,
					stepSources: body.stepSources,
					stepYjs: body.stepYjs,
					editingStep: body.editingStep,
					replaceEditor: body.replaceEditor
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
