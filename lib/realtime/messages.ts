import { z } from 'zod';

// Peer messages ("fx"): hovers and emotes. They're untrusted decoration:
// strictly shaped, small, and never able to change game state.

export const EMOTES = ['wave', 'gg', 'wow', 'oops', 'think', 'go'] as const;

export const fxMessage = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('hover'),
    seat: z.number().int().min(0).max(15),
    /** A piece or target id from the game's public vocabulary, or null to clear. */
    target: z
      .string()
      .regex(/^[a-z0-9:-]{1,48}$/)
      .nullable(),
  }),
  z.strictObject({
    kind: z.literal('emote'),
    seat: z.number().int().min(0).max(15),
    emote: z.enum(EMOTES),
  }),
]);

export type FxMessage = z.infer<typeof fxMessage>;

export const presenceEntry = z.strictObject({
  seat: z.number().int().min(0).max(15).nullable(),
  name: z.string().max(24),
});
export type PresenceEntry = z.infer<typeof presenceEntry>;
