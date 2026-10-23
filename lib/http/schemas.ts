import { z } from 'zod';

// Shared request schemas. Everything is strict: unknown fields are refused.

export const roomParams = z.strictObject({ id: z.uuid() });
export const idParams = z.strictObject({ id: z.uuid() });

export const minute = 60;
export const hour = 60 * 60;
export const day = 24 * hour;
