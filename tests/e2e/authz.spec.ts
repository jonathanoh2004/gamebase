import { type APIResponse, expect, type Page, test } from '@playwright/test';
import { devUserId } from '../../lib/auth/dev-users';
import { newcomer, signedIn } from './helpers';

// The authorization matrix (docs/DESIGN.md §8): every API refuses the wrong
// person, the wrong origin and the wrong shape of request, and no response
// carries another player's secrets or anyone's account id.

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;
const NOWHERE = '00000000-0000-4000-8000-000000000000';

type Json = Record<string, unknown>;

function origin() {
  return test.info().project.use.baseURL ?? 'http://localhost:3100';
}

/** A same-origin JSON request from a page's session (what the app itself sends). */
async function call(
  page: Page,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<APIResponse> {
  return page.request.fetch(path, {
    method,
    headers: {
      Origin: origin(),
      ...(body !== undefined && { 'Content-Type': 'application/json' }),
      ...headers,
    },
    data: body === undefined ? undefined : JSON.stringify(body),
  });
}

test.describe
  .serial('authorization', () => {
    test('anonymous visitors get nothing', async ({ browser }) => {
      const context = await browser.newContext({ baseURL: origin() });
      const page = await context.newPage();
      expect((await call(page, 'GET', '/api/rooms')).status()).toBe(401);
      expect((await call(page, 'POST', '/api/rooms', { gameId: 'camel-up' })).status()).toBe(401);
      expect((await call(page, 'GET', `/api/rooms/${NOWHERE}/sync`)).status()).toBe(401);
      expect((await call(page, 'PATCH', '/api/profile', { displayName: 'x' })).status()).toBe(401);
      await page.goto(`/r/${NOWHERE}`);
      await expect(page).toHaveURL(/\/signin/);
      await page.goto('/admin');
      await expect(page).toHaveURL(/\/signin/);
      await context.close();
    });

    test('pending accounts wait at the door', async ({ browser }) => {
      const stranger = await newcomer(browser);
      await expect(stranger).toHaveURL(/\/(welcome|pending)/);
      expect((await call(stranger, 'GET', '/api/rooms')).status()).toBe(403);
      const create = await call(stranger, 'POST', '/api/rooms', { gameId: 'camel-up' });
      expect(create.status()).toBe(403);
      expect((await call(stranger, 'POST', '/api/invites', {})).status()).toBe(403);
      await stranger.goto(`/r/${NOWHERE}`);
      await expect(stranger).toHaveURL(/\/(welcome|pending)/);
    });

    test('requests from other sites or in the wrong shape are refused', async ({ browser }) => {
      const ben = await signedIn(browser, 'ben');
      const create = { gameId: 'camel-up' };
      const evil = await call(ben, 'POST', '/api/rooms', create, {
        Origin: 'https://evil.example',
      });
      expect(evil.status()).toBe(403);
      const crossSite = await call(ben, 'POST', '/api/rooms', create, {
        'Sec-Fetch-Site': 'cross-site',
      });
      expect(crossSite.status()).toBe(403);
      const noOrigin = await ben.request.post('/api/rooms', { data: create });
      expect(noOrigin.status()).toBe(403);
      const form = await ben.request.post('/api/rooms', {
        headers: { Origin: origin(), 'Content-Type': 'text/plain' },
        data: JSON.stringify(create),
      });
      expect(form.status()).toBe(415);
      const huge = await call(ben, 'POST', '/api/rooms', {
        gameId: 'camel-up',
        options: { pad: 'x'.repeat(40_000) },
      });
      expect(huge.status()).toBe(413);
      const extra = await call(ben, 'POST', '/api/rooms', { ...create, role: 'owner' });
      expect(extra.status()).toBe(400);
      const sqlish = await call(ben, 'POST', '/api/rooms', {
        gameId: "camel-up'; drop table app.rooms;--",
      });
      expect(sqlish.status()).toBe(400);
      const notJson = await ben.request.post('/api/rooms', {
        headers: { Origin: origin(), 'Content-Type': 'application/json' },
        data: '{"gameId":',
      });
      expect(notJson.status()).toBe(400);
      expect((await call(ben, 'GET', '/api/rooms/not-a-uuid/sync')).status()).toBe(400);
      expect((await call(ben, 'GET', `/api/rooms/${NOWHERE}/sync`)).status()).toBe(404);
      // Errors never echo internals.
      const body = await (await call(ben, 'GET', '/api/rooms/not-a-uuid/sync')).text();
      expect(body).not.toMatch(/stack|postgres|drizzle|at \w+ \(/i);
    });

    test('players act only on their turn, and hidden cards stay hidden', async ({ browser }) => {
      const ada = await signedIn(browser, 'ada');
      const ben = await signedIn(browser, 'ben');
      const cy = await signedIn(browser, 'cy');
      const dee = await signedIn(browser, 'dee');

      const created = await call(ada, 'POST', '/api/rooms', { gameId: 'camel-up' });
      expect(created.status()).toBe(200);
      const { roomId } = (await created.json()) as { roomId: string };
      const lobby = (page: Page, command: Json) =>
        call(page, 'POST', `/api/rooms/${roomId}/lobby`, { command });
      for (const page of [ben, cy]) {
        expect((await lobby(page, { type: 'join' })).status()).toBe(200);
        expect((await lobby(page, { type: 'ready', ready: true })).status()).toBe(200);
      }
      // Only the host starts or kicks.
      expect((await lobby(ben, { type: 'start' })).status()).toBe(403);
      expect((await lobby(ben, { type: 'kick', seat: 0 })).status()).toBe(403);
      expect((await lobby(ada, { type: 'start' })).status()).toBe(200);

      const sync = async (page: Page) => {
        const res = await call(page, 'GET', `/api/rooms/${roomId}/sync`);
        expect(res.status()).toBe(200);
        return (await res.json()) as {
          version: number;
          seat: number | null;
          snapshot: { turn: number; players: { hand: string[] | null }[] };
        };
      };
      const seats = [ada, ben, cy];
      const views = await Promise.all(seats.map(sync));
      for (const view of views) {
        view.snapshot.players.forEach((p, seat) => {
          if (seat === view.seat) expect(p.hand).toHaveLength(5);
          else expect(p.hand).toBeNull();
        });
      }
      const watching = await sync(dee);
      expect(watching.seat).toBeNull();
      for (const p of watching.snapshot.players) expect(p.hand).toBeNull();

      const turn = views[0]?.snapshot.turn ?? 0;
      const version = views[0]?.version ?? 0;
      const onTurn = seats.find((_, i) => views[i]?.seat === turn) as Page;
      const offTurn = seats.find((_, i) => views[i]?.seat !== turn) as Page;
      const act = (page: Page, action: Json, expectedVersion = version) =>
        call(page, 'POST', `/api/rooms/${roomId}/actions`, { expectedVersion, action });

      expect((await act(offTurn, { type: 'roll' })).status()).toBe(409);
      expect((await act(dee, { type: 'roll' })).status()).toBe(403);
      expect((await act(onTurn, { type: 'roll', extra: 1 })).status()).toBe(400);
      expect((await act(onTurn, { type: 'teleport' })).status()).toBe(400);
      expect((await act(onTurn, { type: 'roll' }, version + 7)).status()).toBe(409);

      // A secret bet: only its owner sees the color, in frames and in the pile.
      const bet = await act(onTurn, { type: 'bet', pile: 'winner', color: 'blue' });
      expect(bet.status()).toBe(200);
      for (const [i, page] of seats.entries()) {
        const res = await call(page, 'GET', `/api/rooms/${roomId}/sync?after=${version}`);
        const text = await res.text();
        const mine = views[i]?.seat === turn;
        expect(text.includes('"color":"blue"'), `seat ${views[i]?.seat} sees the bet`).toBe(mine);
      }

      // No response carries anyone's account id.
      const ids = ['ada', 'ben', 'cy', 'dee'].map(devUserId);
      for (const path of [`/api/rooms/${roomId}`, `/api/rooms/${roomId}/sync`, '/api/rooms']) {
        for (const page of [ada, ben, dee]) {
          const text = await (await call(page, 'GET', path)).text();
          for (const found of text.match(UUID) ?? []) expect(ids).not.toContain(found);
        }
      }
    });

    test('only the owner manages members and invites', async ({ browser }) => {
      const ben = await signedIn(browser, 'ben');
      const ada = devUserId('ada');
      const revoke = await call(ben, 'POST', `/api/admin/members/${ada}`, { action: 'revoke' });
      expect(revoke.status()).toBe(403);
      expect((await call(ben, 'DELETE', `/api/admin/invites/${NOWHERE}`)).status()).toBe(403);
      await ben.goto('/admin');
      await expect(ben).toHaveURL(/\/$/);
      // The owner can't be revoked, not even by themselves.
      const owner = await signedIn(browser, 'ada');
      const self = await call(owner, 'POST', `/api/admin/members/${ada}`, { action: 'revoke' });
      expect(self.status()).toBeGreaterThanOrEqual(400);
    });

    test('the maintenance cron answers only to its secret', async ({ browser }) => {
      const context = await browser.newContext({ baseURL: origin() });
      const page = await context.newPage();
      expect((await page.request.get('/api/cron/maintenance')).status()).toBe(404);
      const wrong = await page.request.get('/api/cron/maintenance', {
        headers: { Authorization: 'Bearer nope' },
      });
      expect(wrong.status()).toBe(404);
      await context.close();
    });

    test('an invite link works exactly once', async ({ browser }) => {
      const ada = await signedIn(browser, 'ada');
      const made = await call(ada, 'POST', '/api/invites', {});
      expect(made.status()).toBe(200);
      const { path } = (await made.json()) as { path: string };
      const token = path.split('/').pop() ?? '';

      const friend = await newcomer(browser);
      expect((await call(friend, 'POST', '/api/invites/redeem', { token })).status()).toBe(200);
      expect((await call(friend, 'GET', '/api/rooms')).status()).toBe(200);
      // Used up: a second redemption, by anyone, fails.
      const other = await newcomer(browser);
      const again = await call(other, 'POST', '/api/invites/redeem', { token });
      expect(again.status()).toBe(404);
      expect((await call(other, 'GET', '/api/rooms')).status()).toBe(403);
      const bogus = await call(other, 'POST', '/api/invites/redeem', { token: 'x'.repeat(43) });
      expect(bogus.status()).toBe(404);
    });
  });
