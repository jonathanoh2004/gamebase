import 'server-only';
import postgres from 'postgres';
import { env } from '@/lib/env';

// LOCAL BACKEND ONLY: stands in for Supabase Realtime inside one dev server
// process. Doorbells arrive from Postgres (realtime.send -> pg_notify) and are
// fanned out to each room's open event streams, along with presence and
// ephemeral "fx" messages. Unlike peer broadcast on Supabase, the server
// stamps the sender's seat here.

export interface HubMessage {
  event: string;
  payload: unknown;
}

interface Subscriber {
  id: number;
  seat: number | null;
  name: string;
  send: (msg: HubMessage) => void;
}

interface Hub {
  subscribe(topic: string, sub: Omit<Subscriber, 'id'>): () => void;
  publish(topic: string, msg: HubMessage): void;
}

function createHub(): Hub {
  const topics = new Map<string, Map<number, Subscriber>>();
  let nextId = 1;

  const deliver = (topic: string, msg: HubMessage) => {
    for (const sub of topics.get(topic)?.values() ?? []) sub.send(msg);
  };
  const announcePresence = (topic: string) => {
    const present = [...(topics.get(topic)?.values() ?? [])].map((s) => ({
      seat: s.seat,
      name: s.name,
    }));
    deliver(topic, { event: 'presence', payload: present });
  };

  const listener = postgres(env().DATABASE_URL, { max: 1, onnotice: () => {} });
  void listener.listen('gb_realtime', (raw) => {
    try {
      const msg = JSON.parse(raw) as { topic: string; event: string; payload: unknown };
      deliver(msg.topic, { event: msg.event, payload: msg.payload });
    } catch {
      // ignore malformed notifications
    }
  });

  return {
    subscribe(topic, sub) {
      const id = nextId++;
      let subs = topics.get(topic);
      if (!subs) {
        subs = new Map();
        topics.set(topic, subs);
      }
      subs.set(id, { ...sub, id });
      announcePresence(topic);
      return () => {
        subs.delete(id);
        if (subs.size === 0) topics.delete(topic);
        else announcePresence(topic);
      };
    },
    publish: deliver,
  };
}

const holder = globalThis as unknown as { __gamebaseHub?: Hub };

export function localHub(): Hub {
  if (env().GAMEBASE_BACKEND !== 'local') throw new Error('local realtime is dev-only');
  holder.__gamebaseHub ??= createHub();
  return holder.__gamebaseHub;
}
