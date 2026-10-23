import { afterAll, describe, expect, it } from 'vitest';
import { closeOwner, makeUser, owner, refresh } from '@/tests/helpers/users';
import { createInvite, hashToken, peekInvite, redeemInvite, revokeInvite } from './invites';
import { revokeMember } from './members';
import { createRoom, getRoomView } from './rooms';

afterAll(closeOwner);

describe('invites', () => {
  it('turns a pending account into a member, exactly once', async () => {
    const ada = await makeUser('Ada', 'owner');
    const nia = await makeUser('', 'pending');
    const { token } = await createInvite(ada, null);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(await peekInvite(token)).toEqual({ inviter: 'Ada', hasRoom: false });

    await redeemInvite(nia, token);
    expect((await refresh(nia)).profile.role).toBe('member');
    expect((await refresh(nia)).profile.invitedBy).toBe(ada.id);

    const late = await makeUser('', 'pending');
    await expect(redeemInvite(late, token)).rejects.toMatchObject({ status: 404 });
    expect(await peekInvite(token)).toBeNull();
  });

  it('stores only a hash of the token', async () => {
    const ada = await makeUser('Ada2', 'owner');
    const { token } = await createInvite(ada, null);
    const rows = await owner()`select token_hash from app.invites where created_by = ${ada.id}`;
    expect(rows).toHaveLength(1);
    expect(rows[0]?.token_hash).toBe(hashToken(token));
    expect(JSON.stringify(rows)).not.toContain(token);
  });

  it('seats the new member in the inviting room', async () => {
    const host = await makeUser('Host', 'member', 'blue');
    const roomId = await createRoom(host, 'guess-roll', {});
    const { token } = await createInvite(host, roomId);
    const guest = await makeUser('', 'pending');
    expect(await redeemInvite(guest, token)).toEqual({ roomId });
    const view = await getRoomView(await refresh(guest), roomId);
    expect(view.seats.map((s) => s.isYou)).toEqual([false, true]);
    expect(view.seats[1]?.color).not.toBe('blue');
  });

  it('refuses expired, revoked, and orphaned links', async () => {
    const ada = await makeUser('Ada3', 'owner');
    const ben = await makeUser('Ben3', 'member');

    const expired = await createInvite(ada, null);
    await owner()`update app.invites set expires_at = now() - interval '1 minute' where token_hash = ${hashToken(expired.token)}`;
    await expect(redeemInvite(await makeUser('', 'pending'), expired.token)).rejects.toMatchObject({
      status: 404,
    });

    const revoked = await createInvite(ada, null);
    const [row] = await owner()`select id from app.invites where token_hash = ${hashToken(revoked.token)}`;
    await revokeInvite(row?.id as string);
    await expect(redeemInvite(await makeUser('', 'pending'), revoked.token)).rejects.toMatchObject({
      status: 404,
    });

    // Revoking a member kills the links they handed out.
    const fromBen = await createInvite(ben, null);
    await revokeMember(ada, ben.id);
    expect(await peekInvite(fromBen.token)).toBeNull();
    await expect(redeemInvite(await makeUser('', 'pending'), fromBen.token)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('ignores malformed tokens without touching the database', async () => {
    const someone = await makeUser('', 'pending');
    await expect(redeemInvite(someone, "' or 1=1 --")).rejects.toMatchObject({ status: 404 });
    expect(await peekInvite('x'.repeat(43) + "'")).toBeNull();
  });

  it('only lets seated players invite into a room', async () => {
    const host = await makeUser('H', 'member');
    const outsider = await makeUser('O', 'member');
    const roomId = await createRoom(host, 'guess-roll', {});
    await expect(createInvite(outsider, roomId)).rejects.toMatchObject({ status: 403 });
  });
});
