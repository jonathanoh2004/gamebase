import { expect, test } from '@playwright/test';
import { signedIn } from './helpers';

// Partnerships only exist with 6+ players, so this runs in the dev sandbox,
// where one screen holds every seat.
test('with six players, you can partner up from the action bar', async ({ browser }) => {
  const ada = await signedIn(browser, 'ada');
  await ada.goto('/dev/camel-up');
  await ada.getByRole('button', { name: '6p', exact: true }).click();
  const board = ada.getByTestId('camel-up');
  await expect(board.locator('[data-partner]')).toHaveCount(6);
  await expect(board.locator('[data-partner]').first()).toContainText('partner card available');

  await ada.getByTestId('partner').click();
  await expect(ada.getByTestId('action-bar')).toContainText('Pick a partner');
  const choices = ada.getByTestId('partner-picker').getByRole('button');
  await expect(choices).toHaveCount(5);
  await choices.first().click();
  await ada.getByTestId('confirm').click();

  await expect(board.locator('[data-partner]', { hasText: /partner · /i })).toHaveCount(2);
  await expect(ada.getByLabel('Game log')).toContainText('partners this leg');
  // The in-game rules explain it too.
  await ada.getByRole('button', { name: 'Rules' }).click();
  await expect(ada.getByRole('dialog')).toContainText('Partner (6+ players)');
});
