import { describe, expect, it } from 'vitest';
import { defineServerDependencies } from './dependencies.js';

describe('server dependency seams', () => {
	it('keeps database, Stripe, and authenticated locals behind injected providers', async () => {
		const database = { kind: 'request-scoped-database' };
		const stripe = { kind: 'stripe-client' };
		const authenticatedLocals = { user: { id: 'staff' }, session: { id: 'session' } };
		const event = { request: new Request('https://books.example.com/staff') };
		const locals = { user: authenticatedLocals.user, session: authenticatedLocals.session };
		let databaseCalls = 0;
		let stripeCalls = 0;
		let localsCalls = 0;
		/** @param {unknown} receivedEvent */
		const createDatabase = async (receivedEvent) => {
			databaseCalls += 1;
			expect(receivedEvent).toBe(event);
			return database;
		};
		const createStripe = () => {
			stripeCalls += 1;
			return stripe;
		};
		/** @param {unknown} receivedLocals */
		const getAuthenticatedLocals = (receivedLocals) => {
			localsCalls += 1;
			expect(receivedLocals).toBe(locals);
			return authenticatedLocals;
		};
		const dependencies = defineServerDependencies({
			createDatabase,
			createStripe,
			getAuthenticatedLocals
		});

		await expect(dependencies.createDatabase(event)).resolves.toBe(database);
		expect(dependencies.createStripe()).toBe(stripe);
		expect(dependencies.getAuthenticatedLocals(locals)).toBe(authenticatedLocals);
		expect(databaseCalls).toBe(1);
		expect(stripeCalls).toBe(1);
		expect(localsCalls).toBe(1);
		expect(Object.isFrozen(dependencies)).toBe(true);
	});

	it.each([
		undefined,
		null,
		{},
		{ createDatabase: () => ({}) },
		{ createDatabase: () => ({}), createStripe: () => ({}) },
		{
			createDatabase: () => ({}),
			createStripe: () => ({}),
			getAuthenticatedLocals: true
		}
	])('rejects incomplete or non-callable dependency definitions', (definition) => {
		expect(() => defineServerDependencies(definition)).toThrowError(
			new TypeError('Server dependency configuration is invalid')
		);
	});
});
