import {
	createPblRuntime,
	memberFromRequest,
	pblErrorResponse,
	pblJson,
	readPblJson
} from '$lib/server/pbl/http.js';

export const prerender = false;

/** @param {Record<string, any>} [dependencies] */
export function _createPblSubmissionsEndpoint(dependencies = {}) {
	const runtime = createPblRuntime(dependencies);

	/** @param {any} event */
	async function POST(event) {
		try {
			const body = await readPblJson(event.request);
			const membership = memberFromRequest(event.request, event);
			const submission = await runtime.withStore((store) =>
				store.recordSubmission({
					code: event.params.code,
					memberId: membership.memberId,
					step: body.step,
					source: body.source,
					passed: body.passed,
					message: body.message
				})
			);
			return pblJson(
				submission,
				201,
				membership.setCookie ? { 'set-cookie': membership.setCookie } : {}
			);
		} catch (error) {
			return pblErrorResponse(error);
		}
	}

	return { POST };
}

const endpoint = _createPblSubmissionsEndpoint();
export const POST = endpoint.POST;
