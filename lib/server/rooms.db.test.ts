import { afterAll, describe, expect, it } from 'vitest';
import { applyAction, syncMatch } from '@/lib/runtime/match-service';
import { closeOwner, makeUser, owner } from '@/tests/helpers/users';
import { createRoom, getRoomView, runLobbyCommand } from './rooms';

afterAll(closeOwner);

function only<T>(x: T | undefined): T {
  if (x === undefined) throw new Error('missing test fixture');
  return x;
}

async function lobbyWith(n: number) {
  const host = await makeUser('Host', 'member', 'red');
  const roomId = await createRoom(host, 'guess-roll', { target: 2 });
  const others = [];
  for (let i = 1; i < n; i++) {
    const p = await makeUser(`P${i}`, 'member', 'red');
    await runLobbyCommand(p, roomId, { type: 'join' });
    others.push(p);
  }
  return { host, roomId, others };
}

describe('rooms and lobby', () => {
  it('seats joiners with distinct colors and hides user ids', async () => {
    const { host, roomId } = await lobbyWith(3);
    const view = await getRoomView(host, roomId);
    expect(view.seats).toHaveLength(3);
    expect(new Set(view.seats.map((s) => s.color)).size).toBe(3);
    expect(view.you).toMatchObject({ seat: 0, isHost: true });
    expect(JSON.stringify(view)).not.toContain(host.id);
  });

  it('keeps host powers with the host', async () => {
    const { roomId, others } = await lobbyWith(2);
    const guest = others[0];
    if (!guest) throw new Error('setup');
    await expect(runLobbyCommand(guest, roomId, { type: 'kick', seat: 0 })).rejects.toMatchObject({
      status: 403,
    });
    await expect(runLobbyCommand(guest, roomId, { type: 'start' })).rejects.toMatchObject({
      status: 403,
    });
    await expect(
      runLobbyCommand(guest, roomId, { type: 'lock', locked: true }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('refuses joins when locked or full', async () => {
    const { host, roomId } = await lobbyWith(1);
    await runLobbyCommand(host, roomId, { type: 'lock', locked: true });
    const late = await makeUser('Late', 'member');
    await expect(runLobbyCommand(late, roomId, { type: 'join' })).rejects.toMatchObject({
      status: 409,
    });
  });

  it('needs everyone ready before starting', async () => {
    const { host, roomId, others } = await lobbyWith(2);
    await expect(runLobbyCommand(host, roomId, { type: 'start' })).rejects.toMatchObject({
      status: 409,
    });
    await runLobbyCommand(only(others[0]), roomId, { type: 'ready', ready: true });
    await runLobbyCommand(host, roomId, { type: 'start' });
    expect((await getRoomView(host, roomId)).status).toBe('playing');
  });

  it('rings the room doorbell on every lobby change', async () => {
    const { host, roomId } = await lobbyWith(1);
    const before = (await getRoomView(host, roomId)).lobbyVersion;
    await runLobbyCommand(host, roomId, { type: 'spectators', allow: false });
    expect((await getRoomView(host, roomId)).lobbyVersion).toBe(before + 1);
  });
});

describe('match runtime', () => {
  async function started() {
    const { host, roomId, others } = await lobbyWith(2);
    const guest = only(others[0]);
    await runLobbyCommand(guest, roomId, { type: 'ready', ready: true });
    await runLobbyCommand(host, roomId, { type: 'start' });
    return { host, guest, roomId };
  }

  it('applies a move and hides it from the other player', async () => {
    const { host, guest, roomId } = await started();
    const result = await applyAction(host, roomId, {
      expectedVersion: 0,
      action: { type: 'pick', guess: 'high' },
    });
    expect(result.version).toBe(1);
    expect(result.frames[0]?.event).toEqual({ type: 'picked', seat: 0, guess: 'high' });

    const theirs = await syncMatch(guest, roomId, 0);
    expect(theirs.frames).toHaveLength(1);
    expect(theirs.frames[0]?.event).toEqual({ type: 'picked', seat: 0, guess: null });
    expect(JSON.stringify(theirs)).not.toContain('high');
  });

  it('refuses stale versions, wrong turns, illegal and malformed moves', async () => {
    const { host, guest, roomId } = await started();
    await applyAction(host, roomId, { expectedVersion: 0, action: { type: 'pick', guess: 'low' } });
    await expect(
      applyAction(guest, roomId, { expectedVersion: 0, action: { type: 'pick', guess: 'low' } }),
    ).rejects.toMatchObject({ status: 409, code: 'stale' });
    await expect(
      applyAction(host, roomId, { expectedVersion: 1, action: { type: 'pick', guess: 'low' } }),
    ).rejects.toMatchObject({ status: 409, code: 'not_your_turn' });
    await expect(
      applyAction(guest, roomId, {
        expectedVersion: 1,
        action: { type: 'pick', guess: 'sideways' },
      }),
    ).rejects.toThrow();
    await expect(
      applyAction(guest, roomId, {
        expectedVersion: 1,
        action: { type: 'pick', guess: 'low', x: 1 },
      }),
    ).rejects.toThrow();
  });

  it('lets members spectate only when allowed, and never act', async () => {
    const { host, roomId } = await started();
    const watcher = await makeUser('W', 'member');
    const view = await syncMatch(watcher, roomId, null);
    expect(view.seat).toBeNull();
    await expect(
      applyAction(watcher, roomId, { expectedVersion: 0, action: { type: 'pick', guess: 'low' } }),
    ).rejects.toMatchObject({ status: 403 });
    await runLobbyCommand(host, roomId, { type: 'spectators', allow: false });
    await expect(syncMatch(watcher, roomId, null)).rejects.toMatchObject({ status: 403 });
  });

  it('serializes concurrent moves with the row lock', async () => {
    const { host, guest, roomId } = await started();
    const results = await Promise.allSettled([
      applyAction(host, roomId, { expectedVersion: 0, action: { type: 'pick', guess: 'low' } }),
      applyAction(guest, roomId, { expectedVersion: 0, action: { type: 'pick', guess: 'high' } }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rows = await owner()`
      select count(*)::int as n from app.match_actions a join app.rooms r on r.current_match_id = a.match_id where r.id = ${roomId}
    `;
    expect(rows[0]?.n).toBe(2); // setup + one move
  });

  it('plays a full game to the finish', async () => {
    const { host, guest, roomId } = await started();
    let version = 0;
    for (let round = 0; round < 50; round++) {
      const view = await getRoomView(host, roomId);
      if (view.status === 'finished') break;
      for (const p of [host, guest]) {
        const r = await applyAction(p, roomId, {
          expectedVersion: version,
          action: { type: 'pick', guess: 'low' },
        });
        version = r.version;
        if (r.outcome) break;
      }
    }
    const done = await getRoomView(host, roomId);
    expect(done.status).toBe('finished');
    expect(done.match?.outcome?.standings).toHaveLength(2);
  });

  it('never lets the browser roles read game tables', async () => {
    await expect(
      owner().begin(async (tx) => {
        await tx`set local role authenticated`;
        await tx`select seed from app.matches limit 1`;
      }),
    ).rejects.toThrow(/permission denied/);
    await expect(
      owner().begin(async (tx) => {
        await tx`set local role anon`;
        await tx`select * from app.profiles limit 1`;
      }),
    ).rejects.toThrow(/permission denied/);
  });
});
