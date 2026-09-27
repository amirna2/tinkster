declare global {
	/** True only in builds made with PUBLIC_TEST_HOOKS=1 (the e2e build). */
	const __TEST_HOOKS__: boolean;
	namespace App {}
}

export {};
