declare global {
	namespace App {
		interface Locals {
			staff: Readonly<{
				userId: string;
				sessionId: string;
				email: 'team@marihacks.com';
				googleSubject: string;
				expiresAt: Date;
			}> | null;
		}
	}
}

export {};
