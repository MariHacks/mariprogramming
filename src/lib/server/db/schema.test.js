import { getTableConfig, PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import * as schema from './schema';

const APPLICATION_TABLES = [
	'teachers',
	'courses',
	'bookstores',
	'books',
	'course_books',
	'orders',
	'order_lines',
	'checkout_attempts',
	'stripe_events',
	'audit_log',
	'rate_limit_buckets',
	'book_requests',
	'book_request_items',
	'book_request_outlines',
	'book_pickups',
	'event_deliveries'
];

/** @param {import('drizzle-orm/pg-core').PgTable} table */
function tableName(table) {
	return getTableConfig(table).name;
}

/** @param {import('drizzle-orm/pg-core').PgTable} table */
function checkNames(table) {
	return getTableConfig(table)
		.checks.map((constraint) => constraint.name)
		.sort();
}

/** @param {import('drizzle-orm/pg-core').PgTable} table */
function indexNames(table) {
	return getTableConfig(table)
		.indexes.map((index) => index.config.name)
		.sort();
}

describe('consolidated database schema', () => {
	it('exports the approved Better Auth contract and every application table', () => {
		expect(
			[schema.user, schema.session, schema.account, schema.verification].map(tableName)
		).toEqual(['user', 'session', 'account', 'verification']);
		expect(
			[
				schema.teachers,
				schema.courses,
				schema.bookstores,
				schema.books,
				schema.courseBooks,
				schema.orders,
				schema.orderLines,
				schema.checkoutAttempts,
				schema.stripeEvents,
				schema.auditLog,
				schema.rateLimitBuckets,
				schema.bookRequests,
				schema.bookRequestItems,
				schema.bookRequestOutlines,
				schema.bookPickups,
				schema.eventDeliveries
			].map(tableName)
		).toEqual(APPLICATION_TABLES);
	});

	it('keeps generated Better Auth relations available from the one schema module', () => {
		expect(schema.userRelations).toBeDefined();
		expect(schema.sessionRelations).toBeDefined();
		expect(schema.accountRelations).toBeDefined();
	});

	it('declares PBL team rooms that are not hardcoded to a single lesson', () => {
		expect(tableName(schema.pblRooms)).toBe('pbl_rooms');
		expect(tableName(schema.pblRoomMembers)).toBe('pbl_room_members');
		expect(getTableConfig(schema.pblRooms).columns.map((column) => column.name)).toEqual(
			expect.arrayContaining([
				'code',
				'pbl_id',
				'team_name',
				'source',
				'current_step',
				'opened_hints',
				'driver_member_id',
				'yjs_state',
				'awareness_state'
			])
		);
		expect(indexNames(schema.pblRooms)).toEqual(['pbl_rooms_code_unique_idx', 'pbl_rooms_pbl_id_idx']);
		expect(checkNames(schema.pblRooms)).toEqual([
			'pbl_rooms_member_count_range',
			'pbl_rooms_source_length',
			'pbl_rooms_steps_nonnegative',
			'pbl_rooms_version_positive'
		]);
		expect(indexNames(schema.pblRoomMembers)).toEqual([
			'pbl_room_members_room_idx',
			'pbl_room_members_room_member_unique_idx'
		]);
	});

	it('tracks completion of the required Programming Club form', () => {
		const membershipColumns = getTableConfig(schema.mtProgrammingClubMemberships).columns.map(
			(column) => column.name
		);
		expect(membershipColumns).toEqual(
			expect.arrayContaining(['year_level', 'club_goals', 'required_form_completed_at'])
		);
		const profileColumns = getTableConfig(schema.mtStudentProfiles).columns.map(
			(column) => column.name
		);
		expect(profileColumns).toEqual(
			expect.arrayContaining(['username', 'first_name', 'last_name', 'profile_image_data_url'])
		);
	});

	it('declares catalogue uniqueness, lookup indexes, versions, timestamps, and value checks', () => {
		expect(indexNames(schema.teachers)).toEqual([
			'teachers_active_idx',
			'teachers_slug_unique_idx'
		]);
		expect(checkNames(schema.teachers)).toEqual(['teachers_version_positive']);
		expect(indexNames(schema.courses)).toEqual([
			'courses_active_idx',
			'courses_teacher_code_section_unique_idx',
			'courses_teacher_idx'
		]);
		expect(checkNames(schema.courses)).toEqual(['courses_version_positive']);
		expect(indexNames(schema.bookstores)).toEqual([
			'bookstores_active_idx',
			'bookstores_name_unique_idx'
		]);
		expect(checkNames(schema.bookstores)).toEqual([
			'bookstores_service_fee_range',
			'bookstores_version_positive'
		]);
		expect(indexNames(schema.books)).toEqual([
			'books_active_idx',
			'books_bookstore_idx',
			'books_isbn_unique_idx'
		]);
		expect(checkNames(schema.books)).toEqual([
			'books_price_nonnegative',
			'books_source_date_shape',
			'books_version_positive'
		]);
		expect(indexNames(schema.courseBooks)).toEqual([
			'course_books_active_idx',
			'course_books_book_idx',
			'course_books_course_book_unique_idx',
			'course_books_course_idx'
		]);
		expect(checkNames(schema.courseBooks)).toEqual([
			'course_books_position_nonnegative',
			'course_books_version_positive'
		]);

		expect(getTableConfig(schema.courses).columns.map((column) => column.name)).toEqual(
			expect.arrayContaining(['section'])
		);
		expect(getTableConfig(schema.books).columns.map((column) => column.name)).toEqual(
			expect.arrayContaining(['edition', 'notes', 'source_date'])
		);
		for (const table of [
			schema.teachers,
			schema.courses,
			schema.bookstores,
			schema.books,
			schema.courseBooks
		]) {
			const columns = getTableConfig(table).columns.map((column) => column.name);
			expect(columns).toEqual(
				expect.arrayContaining(['active', 'version', 'created_at', 'updated_at'])
			);
		}
	});

	it('declares order money, currency, state, version, and public-capability invariants', () => {
		expect(indexNames(schema.orders)).toEqual([
			'orders_confirmation_token_hash_unique_idx',
			'orders_created_at_idx',
			'orders_payment_fulfillment_idx',
			'orders_pii_purge_after_idx',
			'orders_public_reference_unique_idx',
			'orders_staff_email_created_idx',
			'orders_staff_ledger_idx'
		]);
		expect(checkNames(schema.orders)).toEqual([
			'orders_amounts_nonnegative',
			'orders_confirmation_pair',
			'orders_currency_cad',
			'orders_fulfillment_payment_consistent',
			'orders_fulfillment_status_valid',
			'orders_payment_status_valid',
			'orders_refund_amount_valid',
			'orders_refund_status_consistent',
			'orders_total_equation',
			'orders_version_positive'
		]);
		expect(getTableConfig(schema.orders).columns.map((column) => column.name)).toContain(
			'refunded_amount_cents'
		);
	});

	it('declares immutable line snapshot and checkout attempt invariants', () => {
		expect(indexNames(schema.orderLines)).toEqual([
			'order_lines_book_idx',
			'order_lines_bookstore_idx',
			'order_lines_course_idx',
			'order_lines_order_idx',
			'order_lines_teacher_idx'
		]);
		expect(checkNames(schema.orderLines)).toEqual([
			'order_lines_amount_equation',
			'order_lines_amount_nonnegative',
			'order_lines_kind_valid',
			'order_lines_quantity_positive',
			'order_lines_service_fee_valid',
			'order_lines_snapshot_kind_consistent',
			'order_lines_unit_amount_nonnegative'
		]);
		expect(indexNames(schema.checkoutAttempts)).toEqual([
			'checkout_attempts_client_request_id_unique_idx',
			'checkout_attempts_created_at_idx',
			'checkout_attempts_nonterminal_fingerprint_unique_idx',
			'checkout_attempts_order_id_unique_idx',
			'checkout_attempts_order_idx',
			'checkout_attempts_payment_intent_id_unique_idx',
			'checkout_attempts_status_idx',
			'checkout_attempts_stripe_charge_id_unique_idx',
			'checkout_attempts_stripe_idempotency_key_unique_idx',
			'checkout_attempts_stripe_session_id_unique_idx'
		]);
		expect(checkNames(schema.checkoutAttempts)).toEqual([
			'checkout_attempts_provider_state_consistent',
			'checkout_attempts_status_valid',
			'checkout_attempts_version_positive'
		]);
		expect(getTableConfig(schema.checkoutAttempts).columns.map((column) => column.name)).toEqual(
			expect.arrayContaining([
				'stripe_charge_id',
				'stripe_expires_at',
				'checkout_ready_at',
				'terminal_at'
			])
		);
	});

	it('declares provider event, append-only audit, and durable rate-bucket invariants', () => {
		expect(indexNames(schema.stripeEvents)).toEqual([
			'stripe_events_processed_at_idx',
			'stripe_events_received_at_idx'
		]);
		expect(checkNames(schema.stripeEvents)).toEqual([
			'stripe_events_disposition_valid',
			'stripe_events_mode_valid',
			'stripe_events_type_valid'
		]);
		expect(indexNames(schema.auditLog)).toEqual([
			'audit_log_created_at_idx',
			'audit_log_order_created_idx',
			'audit_log_provider_event_id_idx',
			'audit_log_request_id_idx'
		]);
		expect(checkNames(schema.auditLog)).toEqual([
			'audit_log_actor_kind_valid',
			'audit_log_resource_target_valid',
			'audit_log_staff_identity_consistent'
		]);
		expect(getTableConfig(schema.auditLog).columns.map((column) => column.name)).toEqual(
			expect.arrayContaining(['resource_type', 'resource_id'])
		);
		expect(indexNames(schema.rateLimitBuckets)).toEqual([
			'rate_limit_buckets_expires_at_idx',
			'rate_limit_buckets_scope_idx'
		]);
		expect(checkNames(schema.rateLimitBuckets)).toEqual([
			'rate_limit_buckets_count_nonnegative',
			'rate_limit_buckets_scope_valid',
			'rate_limit_buckets_version_positive',
			'rate_limit_buckets_window_valid'
		]);
	});

	it('declares request, append-only pickup, and relay delivery invariants', () => {
		expect(indexNames(schema.bookRequests)).toEqual([
			'book_requests_client_request_id_unique_idx',
			'book_requests_created_at_idx',
			'book_requests_pii_purge_after_idx',
			'book_requests_public_reference_unique_idx'
		]);
		expect(checkNames(schema.bookRequests)).toEqual([
			'book_requests_assignment_consistent',
			'book_requests_course_ref_exclusive',
			'book_requests_public_reference_shape',
			'book_requests_status_valid',
			'book_requests_teacher_ref_exclusive',
			'book_requests_version_positive'
		]);
		expect(indexNames(schema.bookRequestItems)).toEqual([
			'book_request_items_position_unique_idx',
			'book_request_items_request_idx'
		]);
		expect(checkNames(schema.bookRequestItems)).toEqual([
			'book_request_items_quantity_range',
			'book_request_items_title_present'
		]);
		expect(indexNames(schema.bookRequestOutlines)).toEqual([]);
		expect(checkNames(schema.bookRequestOutlines)).toEqual([
			'book_request_outlines_byte_length_range',
			'book_request_outlines_content_length',
			'book_request_outlines_pdf_magic',
			'book_request_outlines_sha256_shape'
		]);
		expect(indexNames(schema.bookPickups)).toEqual([
			'book_pickups_client_request_id_unique_idx',
			'book_pickups_order_line_idx',
			'book_pickups_request_item_idx'
		]);
		expect(checkNames(schema.bookPickups)).toEqual([
			'book_pickups_need_kind_valid',
			'book_pickups_quantity_positive',
			'book_pickups_target_consistent'
		]);
		expect(indexNames(schema.eventDeliveries)).toEqual([
			'event_deliveries_audit_sink_unique_idx',
			'event_deliveries_claimable_idx'
		]);
		expect(checkNames(schema.eventDeliveries)).toEqual([
			'event_deliveries_attempts_bounded',
			'event_deliveries_lease_consistent',
			'event_deliveries_settled_consistent',
			'event_deliveries_sink_valid',
			'event_deliveries_status_valid',
			'event_deliveries_version_positive'
		]);
		const sinkCheck = getTableConfig(schema.eventDeliveries).checks.find(
			(constraint) => constraint.name === 'event_deliveries_sink_valid'
		);
		if (!sinkCheck) throw new Error('Missing event delivery sink constraint');
		expect(new PgDialect().sqlToQuery(sinkCheck.value).sql).toContain(`IN ('discord', 'postmark')`);
		expect(getTableConfig(schema.orderLines).columns.map((column) => column.name)).not.toContain(
			'picked_up_quantity'
		);
	});
});
