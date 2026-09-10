import { memberCookie } from '$lib/server/pbl/cookie.js';
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
			const canonical =
				room && typeof room === 'object' && typeof room.memberId === 'string' && room.memberId
					? room.memberId
					: membership.memberId;
			const secure = event.url.protocol === 'https:';
			// Always re-bind pbl_member to the membership row for this user so a
			// second tab can PUT awareness/source after rejoin.
			return pblJson(room, 200, { 'set-cookie': memberCookie(canonical, { secure }) });
		} catch (error) {
			return pblErrorResponse(error);
		}
	};
}

export const POST = _createPblJoinEndpoint();
