/**
 * @typedef {object} ExtractionResult
 * @property {boolean} ok
 * @property {string | null} reason
 * @property {object | null} proposals
 * @property {number} inferenceCount
 * @property {boolean} [cacheHit]
 */

/**
 * @param {string} text
 * @param {number} [byteLength]
 * @returns {boolean}
 */
export function needsTextPdf(text, byteLength = 0) {
	const trimmed = String(text ?? '').trim();
	if (trimmed.length < 40) return true;
	if (byteLength > 80_000 && trimmed.length < 200) return true;
	return false;
}

/**
 * @param {{
 *   fetchImpl?: (url: string, init?: RequestInit) => Promise<{ ok: boolean, json: () => Promise<any> }>,
 *   getKey?: () => string,
 *   getModel?: () => string,
 *   endpoint?: string,
 *   timeoutMs?: number
 * }} [options]
 */
export function createOutlineExtractionProvider(options = {}) {
	const docCache = new Map();
	let inferenceCount = 0;
	const fetchImpl = options.fetchImpl ?? fetch;
	const endpoint =
		options.endpoint ?? 'https://integrate.api.nvidia.com/v1/chat/completions';
	const timeoutMs = options.timeoutMs ?? 90_000;

	/**
	 * @param {{ text: string, sha256?: string, offeringKey?: string, byteLength?: number }} input
	 * @returns {Promise<ExtractionResult>}
	 */
	async function extract(input) {
		if (needsTextPdf(input.text, input.byteLength ?? 0)) {
			return { ok: false, reason: 'needs-text-pdf', proposals: null, inferenceCount };
		}

		const cacheKey = input.sha256 || input.offeringKey || '';
		if (cacheKey && docCache.has(cacheKey)) {
			return {
				ok: true,
				reason: null,
				proposals: docCache.get(cacheKey),
				inferenceCount,
				cacheHit: true
			};
		}

		const key = options.getKey?.() ?? '';
		if (!key) {
			return { ok: false, reason: 'missing-key', proposals: null, inferenceCount };
		}

		inferenceCount += 1;
		let payload;
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), timeoutMs);
		try {
			const response = await fetchImpl(endpoint, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${key}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					model: options.getModel?.() ?? 'nvidia/nemotron-3.5-lightning-30b-a3b',
					temperature: 0,
					messages: [
						{
							role: 'user',
							content:
								'Extract assessments and books as JSON with shape {"assessments":[{"title":string,"weight":number|null,"date":"YYYY-MM-DD"|null}],"books":[{"title":string,"author":string|null,"isbn":string|null,"required":boolean}]}. Use null for unknown fields. Never invent dates. Text:\n' +
								input.text
						}
					]
				}),
				signal: controller.signal
			});
			if (!response.ok) {
				return { ok: false, reason: 'http', proposals: null, inferenceCount };
			}
			payload = await response.json();
		} catch {
			return { ok: false, reason: 'network', proposals: null, inferenceCount };
		} finally {
			clearTimeout(timer);
		}

		const content = payload?.choices?.[0]?.message?.content;
		let proposals;
		try {
			proposals = typeof content === 'string' ? JSON.parse(content) : content;
		} catch {
			return { ok: false, reason: 'invalid-json', proposals: null, inferenceCount };
		}

		if (!proposals || typeof proposals !== 'object') {
			return { ok: false, reason: 'invalid-json', proposals: null, inferenceCount };
		}

		if (cacheKey) docCache.set(cacheKey, proposals);
		if (input.offeringKey && input.offeringKey !== cacheKey) {
			docCache.set(input.offeringKey, proposals);
		}

		return { ok: true, reason: null, proposals, inferenceCount, cacheHit: false };
	}

	return {
		extract,
		inferenceCount() {
			return inferenceCount;
		}
	};
}
