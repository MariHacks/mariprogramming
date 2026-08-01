/**
 * @param {number} cents
 * @returns {string}
 */
export function formatCad(cents) {
	return new Intl.NumberFormat('en-CA', {
		style: 'currency',
		currency: 'CAD'
	}).format(cents / 100);
}
