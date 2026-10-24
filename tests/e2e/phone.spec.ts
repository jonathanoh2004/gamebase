import { expect, type Page, test } from '@playwright/test';
import { converged, signedIn, startCamelUp, whoseTurn } from './helpers';

async function noSideScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `${page.url()} scrolls sideways`).toBeLessThanOrEqual(0);
}

test('two players on phones take turns with the touch picker', async ({ browser }) => {
  const ada = await signedIn(browser, 'ada');
  const ben = await signedIn(browser, 'ben');
  for (const path of ['/', '/games/camel-up', '/me']) {
    await ada.goto(path);
    await noSideScroll(ada);
  }
  await startCamelUp(ada, [ben]);
  const table = [ada, ben];
  for (const page of table) await noSideScroll(page);

  let state = await converged(table);
  for (const move of ['ticket', 'tile', 'roll', 'bet'] as const) {
    const actor = await whoseTurn(table);
    const picker = actor.getByTestId('action-picker');
    if (move === 'ticket') {
      await picker
        .getByRole('button', { name: /^Take the/ })
        .first()
        .tap();
    }
    if (move === 'roll') await picker.getByRole('button', { name: 'Roll' }).tap();
    if (move === 'tile') {
      await picker.getByRole('button', { name: 'Tile' }).tap();
      await actor
        .getByRole('button', { name: /^Place your spectator tile/ })
        .first()
        .tap();
      await actor.getByRole('button', { name: '−1 boo' }).tap();
    }
    if (move === 'bet') {
      await picker.getByRole('button', { name: 'Bet' }).tap();
      await actor.getByRole('button', { name: 'loser', exact: true }).tap();
      await actor.getByTestId('action-bar').getByRole('button', { name: /^Bet / }).first().tap();
    }
    await actor.getByTestId('confirm').tap();
    state = await converged(table, state);
  }
  expect(Number(state.rolled)).toBe(1);
});
