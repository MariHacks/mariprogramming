import { sql } from 'drizzle-orm';
import {
	boolean,
	check,
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
import { user } from '../auth/auth-schema.generated';

const createdAt = () => timestamp('created_at', { withTimezone: true }).defaultNow().notNull();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).defaultNow().notNull();
const version = () => integer('version').default(1).notNull();

export const mtAcademicTerms = pgTable(
	'mt_academic_terms',
	{
		id: varchar('id', { length: 64 }).primaryKey(),
		name: varchar('name', { length: 120 }).notNull(),
		startDate: varchar('start_date', { length: 10 }).notNull(),
		endDate: varchar('end_date', { length: 10 }).notNull(),
		classStartDate: varchar('class_start_date', { length: 10 }).notNull(),
		classEndDate: varchar('class_end_date', { length: 10 }).notNull(),
		status: varchar('status', { length: 16 }).default('active').notNull(),
		version: version(),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		check('mt_academic_terms_status_valid', sql`${table.status} IN ('active', 'historical')`),
		check('mt_academic_terms_version_positive', sql`${table.version} > 0`)
	]
);

export const mtAcademicCalendarRules = pgTable(
	'mt_academic_calendar_rules',
	{
		termId: varchar('term_id', { length: 64 })
			.primaryKey()
			.references(() => mtAcademicTerms.id, { onDelete: 'restrict' }),
		noClassDates: jsonb('no_class_dates').$type<string[]>().default([]).notNull(),
		scheduleOverrides: jsonb('schedule_overrides')
			.$type<Array<{ date: string; followsWeekday: string }>>()
			.default([])
			.notNull(),
		version: version(),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [check('mt_academic_calendar_rules_version_positive', sql`${table.version} > 0`)]
);

export const mtCourses = pgTable(
	'mt_courses',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		code: varchar('code', { length: 64 }).notNull(),
		canonicalTitle: varchar('canonical_title', { length: 240 }).notNull(),
		version: version(),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		uniqueIndex('mt_courses_code_unique_idx').on(table.code),
		check('mt_courses_version_positive', sql`${table.version} > 0`)
	]
);

export const mtCourseOfferings = pgTable(
	'mt_course_offerings',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		courseId: uuid('course_id')
			.notNull()
			.references(() => mtCourses.id, { onDelete: 'restrict' }),
		termId: varchar('term_id', { length: 64 })
			.notNull()
			.references(() => mtAcademicTerms.id, { onDelete: 'restrict' }),
		section: varchar('section', { length: 80 }).notNull(),
		teacherName: varchar('teacher_name', { length: 160 }).notNull(),
		version: version(),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		uniqueIndex('mt_course_offerings_identity_unique_idx').on(
			table.termId,
			table.courseId,
			table.section,
			table.teacherName
		),
		index('mt_course_offerings_term_idx').on(table.termId),
		index('mt_course_offerings_course_idx').on(table.courseId),
		check('mt_course_offerings_version_positive', sql`${table.version} > 0`)
	]
);

export const mtStudentProfiles = pgTable(
	'mt_student_profiles',
	{
		userId: text('user_id')
			.primaryKey()
			.references(() => user.id, { onDelete: 'cascade' }),
		studentId: varchar('student_id', { length: 32 }).notNull(),
		displayName: varchar('display_name', { length: 120 }),
		role: varchar('role', { length: 16 }).default('student').notNull(),
		nimDisclosureAcceptedAt: timestamp('nim_disclosure_accepted_at', { withTimezone: true }),
		mutedUntil: timestamp('muted_until', { withTimezone: true }),
		bannedAt: timestamp('banned_at', { withTimezone: true }),
		version: version(),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		uniqueIndex('mt_student_profiles_student_id_unique_idx').on(table.studentId),
		check(
			'mt_student_profiles_role_valid',
			sql`${table.role} IN ('student', 'moderator', 'staff')`
		),
		check('mt_student_profiles_version_positive', sql`${table.version} > 0`)
	]
);

export const mtOutlineDocuments = pgTable(
	'mt_outline_documents',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		sha256: varchar('sha256', { length: 64 }).notNull(),
		byteLength: integer('byte_length').notNull(),
		extractedText: text('extracted_text'),
		version: version(),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		uniqueIndex('mt_outline_documents_user_sha_unique_idx').on(table.userId, table.sha256),
		index('mt_outline_documents_sha_idx').on(table.sha256),
		check('mt_outline_documents_byte_length_positive', sql`${table.byteLength} > 0`),
		check('mt_outline_documents_version_positive', sql`${table.version} > 0`)
	]
);

export const mtOutlineExtractions = pgTable(
	'mt_outline_extractions',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		documentSha256: varchar('document_sha256', { length: 64 }).notNull(),
		offeringId: uuid('offering_id').references(() => mtCourseOfferings.id, {
			onDelete: 'set null'
		}),
		proposals: jsonb('proposals').notNull(),
		model: varchar('model', { length: 120 }),
		inferenceCount: integer('inference_count').default(1).notNull(),
		version: version(),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		uniqueIndex('mt_outline_extractions_sha_offering_unique_idx').on(
			table.documentSha256,
			table.offeringId
		),
		uniqueIndex('mt_outline_extractions_sha_null_offering_unique_idx')
			.on(table.documentSha256)
			.where(sql`${table.offeringId} IS NULL`),
		index('mt_outline_extractions_sha_idx').on(table.documentSha256),
		check('mt_outline_extractions_inference_positive', sql`${table.inferenceCount} > 0`),
		check('mt_outline_extractions_version_positive', sql`${table.version} > 0`)
	]
);

export const mtCatalogContributions = pgTable(
	'mt_catalog_contributions',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		offeringId: uuid('offering_id')
			.notNull()
			.references(() => mtCourseOfferings.id, { onDelete: 'restrict' }),
		contributorUserId: text('contributor_user_id').references(() => user.id, {
			onDelete: 'set null'
		}),
		documentSha256: varchar('document_sha256', { length: 64 }).notNull(),
		structured: jsonb('structured').notNull(),
		status: varchar('status', { length: 16 }).default('published').notNull(),
		version: version(),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		uniqueIndex('mt_catalog_contributions_offering_sha_unique_idx').on(
			table.offeringId,
			table.documentSha256
		),
		index('mt_catalog_contributions_offering_idx').on(table.offeringId),
		check(
			'mt_catalog_contributions_status_valid',
			sql`${table.status} IN ('published', 'conflict', 'withdrawn')`
		),
		check('mt_catalog_contributions_version_positive', sql`${table.version} > 0`)
	]
);

export const mtClubs = pgTable(
	'mt_clubs',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		name: varchar('name', { length: 160 }).notNull(),
		slug: varchar('slug', { length: 120 }).notNull(),
		category: varchar('category', { length: 80 }),
		description: text('description'),
		links: jsonb('links').$type<Array<{ label: string; url: string }>>().default([]).notNull(),
		published: boolean('published').default(false).notNull(),
		version: version(),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		uniqueIndex('mt_clubs_slug_unique_idx').on(table.slug),
		index('mt_clubs_published_idx').on(table.published),
		check('mt_clubs_version_positive', sql`${table.version} > 0`)
	]
);

export const mtClubSubmissions = pgTable(
	'mt_club_submissions',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		submitterUserId: text('submitter_user_id').references(() => user.id, { onDelete: 'set null' }),
		clubId: uuid('club_id').references(() => mtClubs.id, { onDelete: 'set null' }),
		payload: jsonb('payload').notNull(),
		status: varchar('status', { length: 16 }).default('pending').notNull(),
		version: version(),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		index('mt_club_submissions_status_idx').on(table.status),
		check(
			'mt_club_submissions_status_valid',
			sql`${table.status} IN ('pending', 'published', 'rejected')`
		),
		check('mt_club_submissions_version_positive', sql`${table.version} > 0`)
	]
);

export const mtForumThreads = pgTable(
	'mt_forum_threads',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		authorUserId: text('author_user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'restrict' }),
		title: varchar('title', { length: 240 }).notNull(),
		body: text('body').notNull(),
		category: varchar('category', { length: 32 }).notNull(),
		courseId: uuid('course_id').references(() => mtCourses.id, { onDelete: 'set null' }),
		offeringId: uuid('offering_id').references(() => mtCourseOfferings.id, {
			onDelete: 'set null'
		}),
		termId: varchar('term_id', { length: 64 }).references(() => mtAcademicTerms.id, {
			onDelete: 'set null'
		}),
		lockedAt: timestamp('locked_at', { withTimezone: true }),
		removedAt: timestamp('removed_at', { withTimezone: true }),
		version: version(),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		index('mt_forum_threads_category_idx').on(table.category),
		index('mt_forum_threads_course_idx').on(table.courseId),
		check('mt_forum_threads_category_valid', sql`${table.category} IN ('courses', 'student-life')`),
		check('mt_forum_threads_version_positive', sql`${table.version} > 0`)
	]
);

export const mtForumReplies = pgTable(
	'mt_forum_replies',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		threadId: uuid('thread_id')
			.notNull()
			.references(() => mtForumThreads.id, { onDelete: 'restrict' }),
		authorUserId: text('author_user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'restrict' }),
		body: text('body').notNull(),
		removedAt: timestamp('removed_at', { withTimezone: true }),
		version: version(),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		index('mt_forum_replies_thread_idx').on(table.threadId),
		check('mt_forum_replies_version_positive', sql`${table.version} > 0`)
	]
);

export const mtGoogleCalendarGrants = pgTable(
	'mt_google_calendar_grants',
	{
		userId: text('user_id')
			.primaryKey()
			.references(() => user.id, { onDelete: 'cascade' }),
		refreshToken: text('refresh_token').notNull(),
		accessToken: text('access_token'),
		accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
		version: version(),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [check('mt_google_calendar_grants_version_positive', sql`${table.version} > 0}`)]
);

export const mtFreeTimeBoards = pgTable(
	'mt_free_time_boards',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		slug: varchar('slug', { length: 120 }).notNull(),
		title: varchar('title', { length: 240 }).notNull(),
		termId: varchar('term_id', { length: 64 })
			.notNull()
			.references(() => mtAcademicTerms.id, { onDelete: 'restrict' }),
		ownerUserId: text('owner_user_id').references(() => user.id, { onDelete: 'set null' }),
		version: version(),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		uniqueIndex('mt_free_time_boards_slug_unique_idx').on(table.slug),
		index('mt_free_time_boards_term_idx').on(table.termId),
		check('mt_free_time_boards_version_positive', sql`${table.version} > 0`)
	]
);

export const mtFreeTimeMembers = pgTable(
	'mt_free_time_members',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		boardId: uuid('board_id')
			.notNull()
			.references(() => mtFreeTimeBoards.id, { onDelete: 'cascade' }),
		displayName: varchar('display_name', { length: 120 }).notNull(),
		availability: jsonb('availability').$type<Record<string, unknown>>().default({}).notNull(),
		shareToken: varchar('share_token', { length: 64 }),
		version: version(),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		uniqueIndex('mt_free_time_members_share_token_unique_idx').on(table.shareToken),
		index('mt_free_time_members_board_idx').on(table.boardId),
		check('mt_free_time_members_version_positive', sql`${table.version} > 0`)
	]
);

export const mtForumReports = pgTable(
	'mt_forum_reports',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		targetKind: varchar('target_kind', { length: 16 }).notNull(),
		targetId: uuid('target_id').notNull(),
		reporterUserId: text('reporter_user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'restrict' }),
		reason: varchar('reason', { length: 500 }).notNull(),
		status: varchar('status', { length: 16 }).default('open').notNull(),
		resolvedAt: timestamp('resolved_at', { withTimezone: true }),
		version: version(),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		index('mt_forum_reports_status_idx').on(table.status),
		check('mt_forum_reports_target_kind_valid', sql`${table.targetKind} IN ('thread', 'reply')`),
		check(
			'mt_forum_reports_status_valid',
			sql`${table.status} IN ('open', 'resolved', 'dismissed')`
		),
		check('mt_forum_reports_version_positive', sql`${table.version} > 0`)
	]
);
