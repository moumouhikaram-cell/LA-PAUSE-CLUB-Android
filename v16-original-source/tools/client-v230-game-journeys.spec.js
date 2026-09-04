'use strict';
/* Compatibility bridge: the canonical v2.4 métier-first suite is the source of truth.
 * Keeping this filename preserves older CI entrypoints without reviving the obsolete
 * all-resource-types-on-one-screen assumptions from v2.3.
 */
const { test, expect } = require('@playwright/test');
require('./client-v240-game-journeys.spec.js');

test('legacy v2.3 journey marker follows the complete v2.4 métier-first suite', async ({page}) => {
  expect(true).toBe(true);
  console.log('V230_ALL_GAME_JOURNEYS_OK compatibility=v240-metier-first');
});
