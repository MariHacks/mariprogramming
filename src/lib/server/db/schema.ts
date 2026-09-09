import { sql } from 'drizzle-orm';
import {
	boolean,
	check,
	customType,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
	varchar
} from 'drizzle-orm/pg-core';
import {
	account,
	accountRelations,
	session,
	sessionRelations,
	user,
	userRelations,
	verification
} from '../auth/auth-schema.generated';

export { account, accountRelations, session, sessionRelations, user, userRelations, verification };

const createdAt = () => timestamp('created_at', { withTimezone: true }).defaultNow().notNull();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).defaultNow().notNull();
const version = () => integer('version').default(1).notNull();
const bytea = customType({
	dataType() {
		return 'bytea';
	}
});

export const teachers = pgTable(
	'teachers',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		slug: varchar('slug', { length: 120 }).notNull(),
		name: varchar('name', { length: 160 }).notNull(),
		active: boolean('active').default(true).notNull(),
		version: version(),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		uniqueIndex('teachers_slug_unique_idx').on(table.slug),
		index('teachers_active_idx').on(table.active),
		check('teachers_version_positive', sql`${table.version} > 0`)
	]
);

export const courses = pgTable(
	'courses',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		teacherId: uuid('teacher_id')
			.notNull()
			.references(() => teachers.id, { onDelete: 'restrict' }),
		code: varchar('code', { length: 64 }).notNull(),
		title: varchar('title', { length: 200 }).notNull(),
		section: varchar('section', { length: 80 }).default('').notNull(),
		active: boolean('active').default(true).notNull(),
		version: version(),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		uniqueIndex('courses_teacher_code_section_unique_idx').on(
			table.teacherId,
			table.code,
			table.section
		),
		index('courses_teacher_idx').on(table.teacherId),
		index('courses_active_idx').on(table.active),
		check('courses_version_positive', sql`${table.version} > 0`)
	]
);

export const bookstores = pgTable(
	'bookstores',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		name: varchar('name', { length: 160 }).notNull(),
		serviceFeeCents: integer('service_fee_cents').notNull(),
		active: boolean('active').default(true).notNull(),
		version: version(),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		uniqueIndex('bookstores_name_unique_idx').on(table.name),
		index('bookstores_active_idx').on(table.active),
		check(
			'bookstores_service_fee_range',
			sql`${table.serviceFeeCents} >= 500 AND ${table.serviceFeeCents} <= 700`
		),
		check('bookstores_version_positive', sql`${table.version} > 0`)
	]
);

export const books = pgTable(
	'books',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		bookstoreId: uuid('bookstore_id').references(() => bookstores.id, { onDelete: 'restrict' }),
		title: varchar('title', { length: 240 }).notNull(),
		author: varchar('author', { length: 200 }),
		isbn: varchar('isbn', { length: 32 }),
		edition: varchar('edition', { length: 240 }),
		notes: varchar('notes', { length: 500 }),
		sourceDate: varchar('source_date', { length: 10 }),
		retailerUrl: varchar('retailer_url', { length: 2048 }),
		coverUrl: varchar('cover_url', { length: 2048 }),
		priceCents: integer('price_cents'),
		active: boolean('active').default(true).notNull(),
		version: version(),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		uniqueIndex('books_isbn_unique_idx').on(table.isbn),
		index('books_bookstore_idx').on(table.bookstoreId),
		index('books_active_idx').on(table.active),
		check('books_price_nonnegative', sql`${table.priceCents} IS NULL OR ${table.priceCents} >= 0`),
		check(
			'books_source_date_shape',
			sql`${table.sourceDate} IS NULL OR ${table.sourceDate} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'`
		),
		check('books_version_positive', sql`${table.version} > 0`)
	]
);

export const courseBooks = pgTable(
	'course_books',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		courseId: uuid('course_id')
			.notNull()
			.references(() => courses.id, { onDelete: 'restrict' }),
		bookId: uuid('book_id')
			.notNull()
			.references(() => books.id, { onDelete: 'restrict' }),
		position: integer('position').default(0).notNull(),
		active: boolean('active').default(true).notNull(),
		version: version(),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		uniqueIndex('course_books_course_book_unique_idx').on(table.courseId, table.bookId),
		index('course_books_course_idx').on(table.courseId),
		index('course_books_book_idx').on(table.bookId),
		index('course_books_active_idx').on(table.active),
		check('course_books_position_nonnegative', sql`${table.position} >= 0`),
		check('course_books_version_positive', sql`${table.version} > 0`)
	]
);

export const orders = pgTable(
	'orders',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		customerName: varchar('customer_name', { length: 160 }).notNull(),
		customerEmail: varchar('customer_email', { length: 320 }).notNull(),
		publicReference: varchar('public_reference', { length: 64 }).notNull(),
		confirmationTokenHash: varchar('confirmation_token_hash', { length: 128 }),
		confirmationExpiresAt: timestamp('confirmation_expires_at', { withTimezone: true }),
		currency: varchar('currency', { length: 3 }).default('cad').notNull(),
		paymentStatus: varchar('payment_status', { length: 32 }).default('pending').notNull(),
		fulfillmentStatus: varchar('fulfillment_status', { length: 32 }).default('unstarted').notNull(),
		version: version(),
		subtotalCents: integer('subtotal_cents').default(0).notNull(),
		serviceFeeCents: integer('service_fee_cents').default(0).notNull(),
		taxCents: integer('tax_cents').default(0).notNull(),
		totalCents: integer('total_cents').default(0).notNull(),
		refundedAmountCents: integer('refunded_amount_cents').default(0).notNull(),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
		piiPurgeAfter: timestamp('pii_purge_after', { withTimezone: true })
	},
	(table) => [
		uniqueIndex('orders_public_reference_unique_idx').on(table.publicReference),
		uniqueIndex('orders_confirmation_token_hash_unique_idx').on(table.confirmationTokenHash),
		index('orders_payment_fulfillment_idx').on(table.paymentStatus, table.fulfillmentStatus),
		index('orders_created_at_idx').on(table.createdAt),
		index('orders_pii_purge_after_idx').on(table.piiPurgeAfter),
		index('orders_staff_ledger_idx').on(
			table.paymentStatus,
			table.fulfillmentStatus,
			table.createdAt.desc(),
			table.id.desc()
		),
		index('orders_staff_email_created_idx').on(
			sql`lower(${table.customerEmail})`,
			table.createdAt.desc(),
			table.id.desc()
		),
		check('orders_currency_cad', sql`${table.currency} = 'cad'`),
		check(
			'orders_payment_status_valid',
			sql`${table.paymentStatus} IN ('pending', 'paid', 'partially_refunded', 'refunded', 'expired', 'failed', 'cancelled')`
		),
		check(
			'orders_fulfillment_status_valid',
			sql`${table.fulfillmentStatus} IN ('unstarted', 'purchasing', 'received', 'ready_for_pickup', 'picked_up')`
		),
		check(
			'orders_fulfillment_payment_consistent',
			sql`${table.fulfillmentStatus} = 'unstarted' OR ${table.paymentStatus} IN ('paid', 'partially_refunded', 'refunded')`
		),
		check(
			'orders_amounts_nonnegative',
			sql`${table.subtotalCents} >= 0 AND ${table.serviceFeeCents} >= 0 AND ${table.taxCents} >= 0 AND ${table.totalCents} >= 0`
		),
		check(
			'orders_total_equation',
			sql`${table.totalCents} = ${table.subtotalCents} + ${table.serviceFeeCents} + ${table.taxCents}`
		),
		check(
			'orders_refund_amount_valid',
			sql`${table.refundedAmountCents} >= 0 AND ${table.refundedAmountCents} <= ${table.totalCents}`
		),
		check(
			'orders_refund_status_consistent',
			sql`(${table.paymentStatus} IN ('pending', 'paid', 'expired', 'failed', 'cancelled') AND ${table.refundedAmountCents} = 0) OR (${table.paymentStatus} = 'partially_refunded' AND ${table.refundedAmountCents} > 0 AND ${table.refundedAmountCents} < ${table.totalCents}) OR (${table.paymentStatus} = 'refunded' AND ${table.totalCents} > 0 AND ${table.refundedAmountCents} = ${table.totalCents})`
		),
		check(
			'orders_confirmation_pair',
			sql`(${table.confirmationTokenHash} IS NULL AND ${table.confirmationExpiresAt} IS NULL) OR (${table.confirmationTokenHash} IS NOT NULL AND ${table.confirmationExpiresAt} IS NOT NULL)`
		),
		check('orders_version_positive', sql`${table.version} > 0`)
	]
);

export const orderLines = pgTable(
	'order_lines',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		orderId: uuid('order_id')
			.notNull()
			.references(() => orders.id, { onDelete: 'restrict' }),
		kind: varchar('kind', { length: 24 }).notNull(),
		label: varchar('label', { length: 240 }).notNull(),
		isbn: varchar('isbn', { length: 32 }),
		bookstoreId: uuid('bookstore_id')
			.notNull()
			.references(() => bookstores.id, { onDelete: 'restrict' }),
		bookstoreName: varchar('bookstore_name', { length: 160 }).notNull(),
		bookId: uuid('book_id').references(() => books.id, { onDelete: 'restrict' }),
		teacherId: uuid('teacher_id').references(() => teachers.id, { onDelete: 'restrict' }),
		teacherName: varchar('teacher_name', { length: 160 }),
		courseId: uuid('course_id').references(() => courses.id, { onDelete: 'restrict' }),
		courseCode: varchar('course_code', { length: 64 }),
		courseTitle: varchar('course_title', { length: 200 }),
		quantity: integer('quantity').notNull(),
		unitAmountCents: integer('unit_amount_cents').notNull(),
		lineAmountCents: integer('line_amount_cents').notNull(),
		createdAt: createdAt()
	},
	(table) => [
		index('order_lines_order_idx').on(table.orderId),
		index('order_lines_bookstore_idx').on(table.bookstoreId),
		index('order_lines_teacher_idx').on(table.teacherId),
		index('order_lines_course_idx').on(table.courseId),
		index('order_lines_book_idx').on(table.bookId),
		check('order_lines_kind_valid', sql`${table.kind} IN ('book', 'service_fee')`),
		check('order_lines_quantity_positive', sql`${table.quantity} > 0`),
		check('order_lines_unit_amount_nonnegative', sql`${table.unitAmountCents} >= 0`),
		check('order_lines_amount_nonnegative', sql`${table.lineAmountCents} >= 0`),
		check(
			'order_lines_amount_equation',
			sql`${table.lineAmountCents} = ${table.quantity} * ${table.unitAmountCents}`
		),
		check(
			'order_lines_service_fee_valid',
			sql`${table.kind} <> 'service_fee' OR (${table.quantity} = 1 AND ${table.unitAmountCents} >= 500 AND ${table.unitAmountCents} <= 700)`
		),
		check(
			'order_lines_snapshot_kind_consistent',
			sql`(${table.kind} = 'book' AND ${table.bookId} IS NOT NULL AND ${table.teacherId} IS NOT NULL AND ${table.teacherName} IS NOT NULL AND ${table.courseId} IS NOT NULL AND ${table.courseCode} IS NOT NULL AND ${table.courseTitle} IS NOT NULL) OR (${table.kind} = 'service_fee' AND ${table.bookId} IS NULL AND ${table.teacherId} IS NULL AND ${table.teacherName} IS NULL AND ${table.courseId} IS NULL AND ${table.courseCode} IS NULL AND ${table.courseTitle} IS NULL)`
		)
	]
);

export const checkoutAttempts = pgTable(
	'checkout_attempts',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		orderId: uuid('order_id')
			.notNull()
			.references(() => orders.id, { onDelete: 'restrict' }),
		clientRequestId: varchar('client_request_id', { length: 128 }).notNull(),
		requestFingerprint: varchar('request_fingerprint', { length: 128 }).notNull(),
		stripeIdempotencyKey: varchar('stripe_idempotency_key', { length: 255 }).notNull(),
		stripeSessionId: varchar('stripe_session_id', { length: 255 }),
		paymentIntentId: varchar('payment_intent_id', { length: 255 }),
		stripeChargeId: varchar('stripe_charge_id', { length: 255 }),
		stripeExpiresAt: timestamp('stripe_expires_at', { withTimezone: true }),
		checkoutReadyAt: timestamp('checkout_ready_at', { withTimezone: true }),
		terminalAt: timestamp('terminal_at', { withTimezone: true }),
		status: varchar('status', { length: 24 }).default('created').notNull(),
		version: version(),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		uniqueIndex('checkout_attempts_client_request_id_unique_idx').on(table.clientRequestId),
		uniqueIndex('checkout_attempts_order_id_unique_idx').on(table.orderId),
		uniqueIndex('checkout_attempts_nonterminal_fingerprint_unique_idx')
			.on(table.requestFingerprint)
			.where(sql`${table.status} IN ('created', 'ready')`),
		uniqueIndex('checkout_attempts_stripe_idempotency_key_unique_idx').on(
			table.stripeIdempotencyKey
		),
		uniqueIndex('checkout_attempts_stripe_session_id_unique_idx').on(table.stripeSessionId),
		uniqueIndex('checkout_attempts_payment_intent_id_unique_idx').on(table.paymentIntentId),
		uniqueIndex('checkout_attempts_stripe_charge_id_unique_idx').on(table.stripeChargeId),
		index('checkout_attempts_order_idx').on(table.orderId),
		index('checkout_attempts_status_idx').on(table.status),
		index('checkout_attempts_created_at_idx').on(table.createdAt),
		check(
			'checkout_attempts_status_valid',
			sql`${table.status} IN ('created', 'ready', 'completed', 'expired', 'failed')`
		),
		check(
			'checkout_attempts_provider_state_consistent',
			sql`(${table.status} = 'created' AND ${table.stripeSessionId} IS NULL AND ${table.paymentIntentId} IS NULL AND ${table.stripeChargeId} IS NULL AND ${table.stripeExpiresAt} IS NULL AND ${table.checkoutReadyAt} IS NULL AND ${table.terminalAt} IS NULL) OR (${table.status} = 'ready' AND ${table.stripeSessionId} IS NOT NULL AND ${table.stripeChargeId} IS NULL AND ${table.stripeExpiresAt} IS NOT NULL AND ${table.checkoutReadyAt} IS NOT NULL AND ${table.terminalAt} IS NULL) OR (${table.status} = 'completed' AND ${table.stripeSessionId} IS NOT NULL AND ${table.paymentIntentId} IS NOT NULL AND ${table.stripeChargeId} IS NOT NULL AND ${table.stripeExpiresAt} IS NOT NULL AND ${table.checkoutReadyAt} IS NOT NULL AND ${table.terminalAt} IS NOT NULL) OR (${table.status} = 'expired' AND ${table.stripeSessionId} IS NOT NULL AND ${table.stripeChargeId} IS NULL AND ${table.stripeExpiresAt} IS NOT NULL AND ${table.checkoutReadyAt} IS NOT NULL AND ${table.terminalAt} IS NOT NULL) OR (${table.status} = 'failed' AND ${table.stripeSessionId} IS NULL AND ${table.paymentIntentId} IS NULL AND ${table.stripeChargeId} IS NULL AND ${table.stripeExpiresAt} IS NULL AND ${table.checkoutReadyAt} IS NULL AND ${table.terminalAt} IS NOT NULL)`
		),
		check('checkout_attempts_version_positive', sql`${table.version} > 0`)
	]
);

export const stripeEvents = pgTable(
	'stripe_events',
	{
		id: varchar('id', { length: 255 }).primaryKey(),
		type: varchar('type', { length: 64 }).notNull(),
		mode: varchar('mode', { length: 8 }).notNull(),
		receivedAt: timestamp('received_at', { withTimezone: true }).defaultNow().notNull(),
		processedAt: timestamp('processed_at', { withTimezone: true }),
		disposition: varchar('disposition', { length: 40 }).notNull()
	},
	(table) => [
		index('stripe_events_received_at_idx').on(table.receivedAt),
		index('stripe_events_processed_at_idx').on(table.processedAt),
		check('stripe_events_type_valid', sql`btrim(${table.type}) <> ''`),
		check('stripe_events_mode_valid', sql`${table.mode} IN ('test', 'live')`),
		check(
			'stripe_events_disposition_valid',
			sql`${table.disposition} IN ('applied', 'duplicate', 'stale', 'ignored_unsupported_type', 'rejected')`
		)
	]
);

export const auditLog = pgTable(
	'audit_log',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		orderId: uuid('order_id').references(() => orders.id, { onDelete: 'restrict' }),
		resourceType: varchar('resource_type', { length: 32 }).notNull(),
		resourceId: uuid('resource_id').notNull(),
		actorKind: varchar('actor_kind', { length: 24 }).notNull(),
		staffUserId: text('staff_user_id').references(() => user.id, { onDelete: 'restrict' }),
		staffIdentity: varchar('staff_identity', { length: 320 }),
		action: varchar('action', { length: 80 }).notNull(),
		previousState: jsonb('previous_state'),
		nextState: jsonb('next_state'),
		requestId: varchar('request_id', { length: 128 }),
		providerEventId: varchar('provider_event_id', { length: 255 }).references(
			() => stripeEvents.id,
			{ onDelete: 'restrict' }
		),
		createdAt: createdAt()
	},
	(table) => [
		index('audit_log_order_created_idx').on(table.orderId, table.createdAt),
		index('audit_log_created_at_idx').on(table.createdAt),
		index('audit_log_request_id_idx').on(table.requestId),
		index('audit_log_provider_event_id_idx').on(table.providerEventId),
		check(
			'audit_log_actor_kind_valid',
			sql`${table.actorKind} IN ('customer', 'staff', 'stripe', 'system', 'maintenance')`
		),
		check(
			'audit_log_staff_identity_consistent',
			sql`(${table.actorKind} = 'staff' AND ${table.staffUserId} IS NOT NULL AND ${table.staffIdentity} IS NOT NULL) OR (${table.actorKind} <> 'staff' AND ${table.staffUserId} IS NULL AND ${table.staffIdentity} IS NULL)`
		),
		check(
			'audit_log_resource_target_valid',
			sql`(${table.resourceType} = 'order' AND ${table.orderId} IS NOT NULL AND ${table.resourceId} = ${table.orderId}) OR (${table.resourceType} IN ('teacher', 'course', 'bookstore', 'book', 'course_book', 'book_request') AND ${table.orderId} IS NULL)`
		)
	]
);

export const rateLimitBuckets = pgTable(
	'rate_limit_buckets',
	{
		bucketKey: varchar('bucket_key', { length: 255 }).primaryKey(),
		scope: varchar('scope', { length: 40 }).notNull(),
		count: integer('count').default(0).notNull(),
		windowStartedAt: timestamp('window_started_at', { withTimezone: true }).notNull(),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		version: version(),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		index('rate_limit_buckets_scope_idx').on(table.scope),
		index('rate_limit_buckets_expires_at_idx').on(table.expiresAt),
		check(
			'rate_limit_buckets_scope_valid',
			sql`${table.scope} IN ('auth_request', 'checkout_email', 'checkout_client_address', 'staff_session', 'staff_action', 'book_request_email', 'book_request_client_address')`
		),
		check('rate_limit_buckets_count_nonnegative', sql`${table.count} >= 0`),
		check('rate_limit_buckets_window_valid', sql`${table.expiresAt} > ${table.windowStartedAt}`),
		check('rate_limit_buckets_version_positive', sql`${table.version} > 0`)
	]
);

export const bookRequests = pgTable(
	'book_requests',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		publicReference: varchar('public_reference', { length: 64 }).notNull(),
		clientRequestId: varchar('client_request_id', { length: 128 }).notNull(),
		studentName: varchar('student_name', { length: 160 }).notNull(),
		studentEmail: varchar('student_email', { length: 320 }).notNull(),
		teacherId: uuid('teacher_id').references(() => teachers.id, { onDelete: 'restrict' }),
		teacherName: varchar('teacher_name', { length: 160 }),
		courseId: uuid('course_id').references(() => courses.id, { onDelete: 'restrict' }),
		courseName: varchar('course_name', { length: 200 }),
		note: varchar('note', { length: 1000 }),
		status: varchar('status', { length: 24 }).default('submitted').notNull(),
		bookstoreId: uuid('bookstore_id').references(() => bookstores.id, { onDelete: 'restrict' }),
		version: version(),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
		piiPurgeAfter: timestamp('pii_purge_after', { withTimezone: true })
	},
	(table) => [
		uniqueIndex('book_requests_public_reference_unique_idx').on(table.publicReference),
		uniqueIndex('book_requests_client_request_id_unique_idx').on(table.clientRequestId),
		index('book_requests_created_at_idx').on(table.createdAt.desc(), table.id.desc()),
		index('book_requests_pii_purge_after_idx').on(table.piiPurgeAfter),
		check(
			'book_requests_teacher_ref_exclusive',
			sql`num_nonnulls(${table.teacherId}, ${table.teacherName}) = 1`
		),
		check(
			'book_requests_course_ref_exclusive',
			sql`num_nonnulls(${table.courseId}, ${table.courseName}) = 1`
		),
		check(
			'book_requests_public_reference_shape',
			sql`${table.publicReference} ~ '^REQ-[A-HJ-NP-Z2-9]{12}$'`
		),
		check(
			'book_requests_status_valid',
			sql`${table.status} IN ('submitted', 'assigned', 'picked_up')`
		),
		check(
			'book_requests_assignment_consistent',
			sql`(${table.status} = 'submitted') = (${table.bookstoreId} IS NULL)`
		),
		check('book_requests_version_positive', sql`${table.version} > 0`)
	]
);

export const bookRequestItems = pgTable(
	'book_request_items',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		requestId: uuid('request_id')
			.notNull()
			.references(() => bookRequests.id, { onDelete: 'restrict' }),
		position: integer('position').notNull(),
		title: varchar('title', { length: 240 }).notNull(),
		author: varchar('author', { length: 200 }),
		isbn: varchar('isbn', { length: 32 }),
		quantity: integer('quantity').notNull(),
		createdAt: createdAt()
	},
	(table) => [
		uniqueIndex('book_request_items_position_unique_idx').on(table.requestId, table.position),
		index('book_request_items_request_idx').on(table.requestId),
		check('book_request_items_quantity_range', sql`${table.quantity} BETWEEN 1 AND 20`),
		check('book_request_items_title_present', sql`btrim(${table.title}) <> ''`)
	]
);

export const bookRequestOutlines = pgTable(
	'book_request_outlines',
	{
		requestId: uuid('request_id')
			.primaryKey()
			.references(() => bookRequests.id, { onDelete: 'restrict' }),
		filename: varchar('filename', { length: 160 }).notNull(),
		byteLength: integer('byte_length').notNull(),
		sha256: varchar('sha256', { length: 64 }).notNull(),
		content: bytea('content').notNull(),
		createdAt: createdAt()
	},
	(table) => [
		check(
			'book_request_outlines_byte_length_range',
			sql`${table.byteLength} >= 1 AND ${table.byteLength} <= 2097152`
		),
		check(
			'book_request_outlines_content_length',
			sql`octet_length(${table.content}) = ${table.byteLength}`
		),
		check('book_request_outlines_sha256_shape', sql`${table.sha256} ~ '^[0-9a-f]{64}$'`),
		check(
			'book_request_outlines_pdf_magic',
			sql`substring(${table.content} FROM 1 FOR 5) = '\x255044462d'::bytea`
		)
	]
);

export const bookPickups = pgTable(
	'book_pickups',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		needKind: varchar('need_kind', { length: 24 }).notNull(),
		orderId: uuid('order_id').references(() => orders.id, { onDelete: 'restrict' }),
		orderLineId: uuid('order_line_id').references(() => orderLines.id, { onDelete: 'restrict' }),
		requestId: uuid('request_id').references(() => bookRequests.id, { onDelete: 'restrict' }),
		requestItemId: uuid('request_item_id').references(() => bookRequestItems.id, {
			onDelete: 'restrict'
		}),
		quantity: integer('quantity').notNull(),
		clientRequestId: varchar('client_request_id', { length: 128 }).notNull(),
		staffUserId: text('staff_user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'restrict' }),
		staffIdentity: varchar('staff_identity', { length: 320 }).notNull(),
		createdAt: createdAt()
	},
	(table) => [
		uniqueIndex('book_pickups_client_request_id_unique_idx').on(table.clientRequestId),
		index('book_pickups_order_line_idx').on(table.orderLineId),
		index('book_pickups_request_item_idx').on(table.requestItemId),
		check('book_pickups_need_kind_valid', sql`${table.needKind} IN ('order_line', 'request_item')`),
		check('book_pickups_quantity_positive', sql`${table.quantity} > 0`),
		check(
			'book_pickups_target_consistent',
			sql`(${table.needKind} = 'order_line' AND ${table.orderId} IS NOT NULL AND ${table.orderLineId} IS NOT NULL AND ${table.requestId} IS NULL AND ${table.requestItemId} IS NULL) OR (${table.needKind} = 'request_item' AND ${table.orderId} IS NULL AND ${table.orderLineId} IS NULL AND ${table.requestId} IS NOT NULL AND ${table.requestItemId} IS NOT NULL)`
		)
	]
);

export const eventDeliveries = pgTable(
	'event_deliveries',
	{
		auditId: uuid('audit_id')
			.notNull()
			.references(() => auditLog.id, { onDelete: 'restrict' }),
		sink: varchar('sink', { length: 24 }).notNull(),
		status: varchar('status', { length: 16 }).default('pending').notNull(),
		attempts: integer('attempts').default(0).notNull(),
		leasedUntil: timestamp('leased_until', { withTimezone: true }),
		nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }).defaultNow().notNull(),
		settledAt: timestamp('settled_at', { withTimezone: true }),
		failureReason: varchar('failure_reason', { length: 64 }),
		version: version(),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		uniqueIndex('event_deliveries_audit_sink_unique_idx').on(table.auditId, table.sink),
		index('event_deliveries_claimable_idx')
			.on(table.sink, table.nextAttemptAt)
			.where(sql`${table.status} IN ('pending', 'in_flight')`),
		check('event_deliveries_sink_valid', sql`${table.sink} IN ('discord', 'postmark')`),
		check(
			'event_deliveries_status_valid',
			sql`${table.status} IN ('pending', 'in_flight', 'delivered', 'skipped', 'dead')`
		),
		check('event_deliveries_attempts_bounded', sql`${table.attempts} BETWEEN 0 AND 6`),
		check(
			'event_deliveries_lease_consistent',
			sql`(${table.status} = 'in_flight') = (${table.leasedUntil} IS NOT NULL)`
		),
		check(
			'event_deliveries_settled_consistent',
			sql`(${table.status} IN ('delivered', 'skipped', 'dead')) = (${table.settledAt} IS NOT NULL)`
		),
		check('event_deliveries_version_positive', sql`${table.version} > 0`)
	]
);

export * from './maritools-schema';
export * from './pbl-schema';
