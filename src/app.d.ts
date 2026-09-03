declare global {
	namespace App {
		interface Locals {
			staff: Readonly<{
				userId: string;
				sessionId: string;
				email: 'team@marihacks.com';
				displayName?: string;
				profileImageUrl?: string;
				googleSubject: string;
				expiresAt: Date;
			}> | null;
			maritools: Readonly<{
				userId: string;
				sessionId: string;
				email: string;
				displayName?: string;
				profileImageUrl?: string;
				googleSubject: string;
				expiresAt: Date;
			}> | null;
		}
	}
}

export {};
