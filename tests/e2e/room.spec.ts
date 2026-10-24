import { expect, test } from '@playwright/test';
import { converged, signedIn, startCamelUp, whoseTurn } from './helpers';

test('three friends play Camel Up live; a reload and a spectator see the same board', async ({
  browser,
}) => {
  const ada = await signedIn(browser, 'ada');
  const ben = await signedIn(browser, 'ben');
  const cy = await signedIn(browser, 'cy');
  const table = [ada, ben, cy];
  const roomUrl = await startCamelUp(ada, [ben, cy]);

  for (const page of table) await expect(page.getByTestId('channel-status')).toHaveText(/live/);

  let state = await converged(table);
  for (const move of ['ticket', 'roll', 'tile', 'roll', 'bet', 'roll'] as const) {
    const actor = await whoseTurn(table);
    for (const other of table.filter((p) => p !== actor)) {
      await expect(other.locator('[data-your-turn]')).not.toHaveText(/^Your turn/);
    }
    if (move === 'ticket') {
      await actor
        .getByRole('button', { name: /^Take the .* ticket worth/ })
        .first()
        .click();
    }
    if (move === 'roll') await actor.getByTestId('pyramid').click();
    if (move === 'tile') {
      await actor
        .getByRole('button', { name: /^Place your spectator tile/ })
        .first()
        .click();
    }
    if (move === 'bet') {
      await actor.locator('[data-pile=winner] button').click();
      await actor.getByTestId('action-bar').getByRole('button', { name: /^Bet / }).first().click();
    }
    await actor.getByTestId('confirm').click();
    const next = await converged(table, state);
    expect(next.turn, `turn passes after the ${move}`).not.toBe(state.turn);
    state = next;
  }
  expect(Number(state.rolled)).toBe(3);

  // A reload mid-game comes back to the same board.
  await ben.reload();
  await expect(ben.getByTestId('camel-up')).toBeVisible();
  expect(await converged(table)).toEqual(state);

  // A member outside the table can watch, but has no turn.
  const dee = await signedIn(browser, 'dee');
  await dee.goto(roomUrl);
  await expect(dee.getByText('Watching as a spectator')).toBeVisible();
  await expect(dee.locator('[data-your-turn]')).toHaveText(/^Watching/);
  expect(await converged([...table, dee])).toEqual(state);
});
