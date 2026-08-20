const CSV_FIELDS = ['bookstore', 'title', 'isbn', 'quantity'];
const MAX_ROWS = 1000;
const MAX_AGGREGATE_QUANTITY = 9999;

export class CsvExportError extends Error {
	constructor() {
		super('Purchase export is invalid');
		this.name = 'CsvExportError';
		this.code = 'CSV_EXPORT_INVALID';
	}
}

/** @returns {never} */
function invalid() {
	throw new CsvExportError();
}

/** @param {unknown} value @param {number} maximum */
function text(value, maximum) {
	if (
		typeof value !== 'string' ||
		value.length === 0 ||
		value.length > maximum ||
		value.includes('\0')
	) {
		invalid();
	}
	return value;
}

/** @param {string} value */
function formulaNeutralized(value) {
	return /^(?:[\p{Z}\s\p{Cc}]*[=+@-]|[\t\r])/u.test(value) ? `'${value}` : value;
}

/** @param {string} value */
function csvCell(value) {
	const safe = formulaNeutralized(value);
	return /[",\r\n]/u.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

/** @param {unknown} rows */
export function createBookstorePurchaseCsv(rows) {
	if (!Array.isArray(rows) || rows.length > MAX_ROWS) invalid();
	let aggregateQuantity = 0;
	const lines = ['bookstore,title,ISBN,quantity'];
	for (const row of rows) {
		if (row === null || typeof row !== 'object' || Array.isArray(row)) invalid();
		const value = /** @type {Record<string, unknown>} */ (row);
		const keys = Object.keys(value);
		if (
			keys.length !== CSV_FIELDS.length ||
			CSV_FIELDS.some((field) => !Object.prototype.hasOwnProperty.call(value, field)) ||
			keys.some((field) => !CSV_FIELDS.includes(field)) ||
			!Number.isSafeInteger(value.quantity) ||
			/** @type {number} */ (value.quantity) < 1 ||
			/** @type {number} */ (value.quantity) > MAX_AGGREGATE_QUANTITY ||
			!(value.isbn === null || typeof value.isbn === 'string')
		) {
			invalid();
		}
		aggregateQuantity += /** @type {number} */ (value.quantity);
		if (aggregateQuantity > MAX_AGGREGATE_QUANTITY) invalid();
		const bookstore = text(value.bookstore, 160);
		const title = text(value.title, 240);
		const isbn = value.isbn === null ? '' : text(value.isbn, 32);
		lines.push(
			`${csvCell(bookstore)},${csvCell(title)},${csvCell(isbn)},${String(value.quantity)}`
		);
	}
	return `${lines.join('\r\n')}\r\n`;
}
