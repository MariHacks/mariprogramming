import { sql } from 'drizzle-orm';
import {
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

const createdAt = () => timestamp('created_at', { withTimezone: true }).defaultNow().notNull();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).defaultNow().notNull();
const version = () => integer('version').default(1).notNull();

export const pblRooms = pgTable(
	'pbl_rooms',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		code: varchar('code', { length: 8 }).notNull(),
		pblId: varchar('pbl_id', { length: 64 }).notNull(),
		teamName: varchar('team_name', { length: 80 }).notNull(),
		source: text('source').default('').notNull(),
		currentStep: integer('current_step').default(0).notNull(),
		unlockedStep: integer('unlocked_step').default(0).notNull(),
		lastCheck: jsonb('last_check'),
		openedHints: jsonb('opened_hints').$type<Record<string, number>>().default({}).notNull(),
		stepEnteredAt: timestamp('step_entered_at', { withTimezone: true }).defaultNow().notNull(),
		memberCount: integer('member_count').default(1).notNull(),
		driverMemberId: varchar('driver_member_id', { length: 64 }),
		version: version(),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		uniqueIndex('pbl_rooms_code_unique_idx').on(table.code),
		index('pbl_rooms_pbl_id_idx').on(table.pblId),
		check('pbl_rooms_version_positive', sql`${table.version} > 0`),
		check(
			'pbl_rooms_steps_nonnegative',
			sql`${table.currentStep} >= 0 AND ${table.unlockedStep} >= 0 AND ${table.unlockedStep} >= ${table.currentStep}`
		),
		check(
			'pbl_rooms_member_count_range',
			sql`${table.memberCount} >= 1 AND ${table.memberCount} <= 10`
		),
		check('pbl_rooms_source_length', sql`char_length(${table.source}) <= 100000`)
	]
);

export const pblRoomMembers = pgTable(
	'pbl_room_members',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		roomId: uuid('room_id')
			.notNull()
			.references(() => pblRooms.id, { onDelete: 'cascade' }),
		memberId: varchar('member_id', { length: 64 }).notNull(),
		joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull()
	},
	(table) => [
		uniqueIndex('pbl_room_members_room_member_unique_idx').on(table.roomId, table.memberId),
		index('pbl_room_members_room_idx').on(table.roomId)
	]
);
