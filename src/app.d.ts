declare global {
	namespace App {
		interface Locals {
			staff: Readonly<{
				userId: string;
				sessionId: string;
				email: 'team@marihacks.com';
				displayName?: string;
				googleSubject: string;
				expiresAt: Date;
			}> | null;
			maritools: Readonly<{
				userId: string;
				sessionId: string;
				email: string;
				displayName?: string;
				googleSubject: string;
				expiresAt: Date;
			}> | null;
		}
	}
}

export {};
