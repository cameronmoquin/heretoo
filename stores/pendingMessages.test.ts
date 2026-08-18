/**
 * The retirement rules for an in-flight message bubble.
 *
 * This is the load-bearing half of the fix for "the message I just sent
 * flickers out and comes back on my phone." Retire too eagerly and the
 * bubble blinks; retire too late and the message draws twice. Both were
 * observed, which is why this is a test and not a comment.
 */

import { describe, it, expect } from 'vitest';
import { unsettled, type PendingMessage } from './pendingMessages';

const ME = 'user-me';

function row(id: string, body: string, createdAt: string, sender = ME) {
  return { id, sender_id: sender, body, created_at: createdAt, thread_id: 't', read_at: null };
}

function pending(tempId: string, body: string, createdAt: string, settledId?: string): PendingMessage {
  return { tempId, threadId: 't', senderId: ME, body, createdAt, settledId };
}

describe('unsettled', () => {
  it('keeps drawing a message the server has not answered for', () => {
    const p = [pending('tmp1', 'hello', '2026-08-17T12:00:00.000Z')];
    expect(unsettled(p, [])).toHaveLength(1);
  });

  it('keeps drawing a settled message until its real row is actually fetched', () => {
    // The insert answered, but the refetch carrying the row has not
    // landed. Dropping the bubble here is the flicker.
    const p = [pending('tmp1', 'hello', '2026-08-17T12:00:00.000Z', 'real1')];
    expect(unsettled(p, [row('other', 'earlier', '2026-08-17T11:59:00.000Z')])).toHaveLength(1);
  });

  it('retires a settled message once its real row is in hand', () => {
    const p = [pending('tmp1', 'hello', '2026-08-17T12:00:00.000Z', 'real1')];
    expect(unsettled(p, [row('real1', 'hello', '2026-08-17T12:00:00.500Z')])).toHaveLength(0);
  });

  it('retires an unsettled message when realtime beats the insert promise', () => {
    // The thread channel does not filter self-inserts, so the refetch it
    // triggers can deliver the row before the mutation resolves. No id to
    // match on yet; sender + body + time is the row.
    const p = [pending('tmp1', 'hello', '2026-08-17T12:00:00.000Z')];
    expect(unsettled(p, [row('real1', 'hello', '2026-08-17T12:00:00.400Z')])).toHaveLength(0);
  });

  it('does not let an older identical message retire a new one', () => {
    const p = [pending('tmp1', 'ok', '2026-08-17T12:00:00.000Z')];
    const yesterday = [row('old', 'ok', '2026-08-16T09:00:00.000Z')];
    expect(unsettled(p, yesterday)).toHaveLength(1);
  });

  it('sending the same word twice still shows twice', () => {
    // One server row may only retire one bubble.
    const p = [
      pending('tmp1', 'ok', '2026-08-17T12:00:00.000Z'),
      pending('tmp2', 'ok', '2026-08-17T12:00:01.000Z'),
    ];
    const kept = unsettled(p, [row('real1', 'ok', '2026-08-17T12:00:00.500Z')]);
    expect(kept.map((k) => k.tempId)).toEqual(['tmp2']);
  });

  it('does not retire on someone else saying the same thing back', () => {
    const p = [pending('tmp1', 'hello', '2026-08-17T12:00:00.000Z')];
    const theirs = [row('real1', 'hello', '2026-08-17T12:00:05.000Z', 'user-them')];
    expect(unsettled(p, theirs)).toHaveLength(1);
  });

  it('tolerates a phone clock running slightly ahead of the server', () => {
    // The bubble is stamped with the device clock; the row with the
    // database clock. A second of skew must not orphan the bubble.
    const p = [pending('tmp1', 'hello', '2026-08-17T12:00:00.900Z')];
    expect(unsettled(p, [row('real1', 'hello', '2026-08-17T12:00:00.000Z')])).toHaveLength(0);
  });
});
