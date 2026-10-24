import { type Browser, expect, type Page, test } from '@playwright/test';

export type DevUser = 'ada' | 'ben' | 'cy' | 'dee' | 'eli' | 'fay' | 'gus' | 'hal' | 'nia';

/** A fresh browser context signed in as one of the local dev users (lib/auth/dev-users.ts). */
export async function signedIn(browser: Browser, user: DevUser): Promise<Page> {
  const { baseURL, viewport, userAgent, isMobile, hasTouch, deviceScaleFactor } =
    test.info().project.use;
  const context = await browser.newContext({
    baseURL,
    viewport,
    userAgent,
    isMobile,
    hasTouch,
    deviceScaleFactor,
  });
  const page = await context.newPage();
  await page.goto('/signin');
  await page.getByTestId(`dev-user-${user}`).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/signin'));
  return page;
}

/** Host creates a Camel Up room; everyone else joins and readies up; host starts. */
export async function startCamelUp(host: Page, guests: Page[]): Promise<string> {
  await host.goto('/games/camel-up');
  await host.getByTestId('create-room').click();
  await host.waitForURL(/\/r\/[0-9a-f-]{36}$/);
  const roomUrl = new URL(host.url()).pathname;
  for (const guest of guests) {
    await guest.goto(roomUrl);
    await guest.getByTestId('join').click();
    await guest.getByTestId('ready').click();
    await expect(guest.getByTestId('ready')).toHaveText(/not ready/i);
  }
  await expect(host.getByTestId('start')).toBeEnabled();
  await host.getByTestId('start').click();
  for (const page of [host, ...guests]) {
    await expect(page.getByTestId('camel-up')).toBeVisible();
  }
  return roomUrl;
}

/**
 * Waits until every page shows the same public board state (and, given
 * `after`, one that has moved past it), then returns it.
 */
export async function converged(pages: Page[], after?: BoardState) {
  const previous = after ? JSON.stringify(after) : null;
  let snapshot = '';
  await expect
    .poll(
      async () => {
        const states = await Promise.all(pages.map(boardState));
        snapshot = states[0] ?? '';
        return (
          snapshot !== previous && states.every((s) => s === snapshot) && !(await anyBusy(pages))
        );
      },
      { timeout: 30_000, intervals: [250] },
    )
    .toBe(true);
  return JSON.parse(snapshot) as BoardState;
}

export interface BoardState {
  leg: string | null;
  turn: string | null;
  rolled: string | null;
  over: string | null;
  camels: Record<string, string>;
}

/** Leg, turn, dice and where every camel stands (piece transforms come from the view). */
export async function boardState(page: Page): Promise<string> {
  return page.evaluate(() => {
    const root = document.querySelector<HTMLElement>('[data-testid=camel-up]');
    const camels: Record<string, string> = {};
    for (const el of document.querySelectorAll<HTMLElement>('[data-piece^="camel-"]')) {
      camels[el.dataset.piece ?? ''] = el.style.transform;
    }
    return JSON.stringify({
      leg: root?.dataset.leg ?? null,
      turn: root?.dataset.turn ?? null,
      rolled: root?.dataset.rolled ?? null,
      over: root?.dataset.over ?? null,
      camels,
    });
  });
}

async function anyBusy(pages: Page[]) {
  const counts = await Promise.all(
    pages.map((p) => p.getByRole('button', { name: /skip/i }).count()),
  );
  return counts.some((n) => n > 0);
}

/** The page whose action bar says it's their turn. */
export async function whoseTurn(pages: Page[]): Promise<Page> {
  let found: Page | undefined;
  await expect
    .poll(
      async () => {
        for (const page of pages) {
          const text = await page.locator('[data-your-turn]').textContent();
          if (text?.startsWith('Your turn')) {
            found = page;
            return true;
          }
        }
        return false;
      },
      { timeout: 30_000 },
    )
    .toBe(true);
  if (!found) throw new Error('nobody has the turn');
  return found;
}
