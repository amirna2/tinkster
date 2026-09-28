import { defineGame } from '../../types';
import type { FixtureOptions, FixtureState } from './state';

// Pure-annotated below so bundlers can tree-shake this call (and its dynamic
// `import('./module')`) out of production builds when nothing references
// `fixtureGame`, so the test-only fixture game never ships as a chunk when
// __TEST_HOOKS__ is false.
export const fixtureGame = /* @__PURE__ */ defineGame<FixtureState, FixtureOptions>({
	id: 'test-fixture',
	title: 'Test Fixture',
	pitch: 'Platform test game',
	category: 'logic',
	pace: 'timed',
	minutes: [1, 1],
	icon: '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="12" /></svg>',
	saveVersion: 1,
	options: [
		{
			key: 'mode',
			label: 'Mode',
			default: 'calm',
			choices: [
				{ value: 'calm', label: 'Calm' },
				{ value: 'wild', label: 'Wild' },
			],
		},
	],
	load: () => import('./module').then((m) => m.default),
});
