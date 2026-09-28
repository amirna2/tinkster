import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit()],
	define: {
		__TEST_HOOKS__: JSON.stringify(process.env.PUBLIC_TEST_HOOKS === '1'),
	},
	test: {
		include: ['src/**/*.test.ts'],
		environment: 'node',
	},
});
