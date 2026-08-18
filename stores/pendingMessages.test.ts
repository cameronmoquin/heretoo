/**
 * The retirement rules for an in-flight message bubble.
 *
 * This is the load-bearing half of the fix for "the message I just sent
 * flickers out and comes back on my phone." Retire too eagerly and the
 * bubble blinks; retire too late and the message draws twice. Both were
 * observed, which is why this is a test and not a comment.
 *
 * The cases below marked REGRESSION are ones an adversarial review found
 * in the first version of this file, where retirement was decided by a
 * timestamp window instead of by identity.
 */

import { describe, it, expect } from 'vitest';
import { unsettled, usePendingMessages, type PendingMessage } from './pendingMessages';

const ME = 'user-me';

function row(id: string, body: string, sender = ME) {
  return { id, sender_id: sender, body, thread_id: 't', read_at: null };
}

function pending(
  tempId: string,
  body: string,
  opts: { settledId?: string; knownIds?: string[] } = {},
): PendingMessage {
  return {
    tempId,
    threadId: 't',
    senderId: ME,
    body,
    createdAt: '2026-08-17T12:00:00.000Z',
    settledId: opts.settledId,
    knownIds: new Set(opts.knownIds ?? []),
  };
}

const ids = (list: PendingMessage[]) => list.map((p) => p.tempId);

describe('unsettled', () => {
  it('keeps drawing a message the server has not answered for', () => {
    expect(unsettled([pending('tmp1', 'hello')], [])).toHaveLength(1);
  });

  it('keeps drawing a settled message until its real row is actually fetched', () => {
    // The insert answered, but the refetch carrying the row has not
    // landed. Dropping the bubble here is the flicker.
    const p = [pending('tmp1', 'hello', { settledId: 'real1' })];
    expect(unsettled(p, [row('other', 'earlier')])).toHaveLength(1);
  });

  it('retires a settled message once its real row is in hand', () => {
    const p = [pending('tmp1', 'hello', { settledId: 'real1' })];
    expect(unsettled(p, [row('real1', 'hello')])).toHaveLength(0);
  });

  it('retires an unsettled message when realtime beats the insert promise', () => {
    // The thread channel does not filter self-inserts, so the refetch it
    // triggers can deliver the row before the mutation resolves. No id to
    // match on yet, so the row's absence at queue time is the evidence.
    const p = [pending('tmp1', 'hello')];
    expect(unsettled(p, [row('real1', 'hello')])).toHaveLength(0);
  });

  it('does not let a message the thread already held retire a new bubble', () => {
    // The user said "ok" an hour ago. Saying it again must not match that
    // row. This used to be guarded by a timestamp window; the window was
    // wrong in both directions, so the guard is now the known-id set.
    const p = [pending('tmp1', 'ok', { knownIds: ['old'] })];
    expect(unsettled(p, [row('old', 'ok')])).toHaveLength(1);
  });

  it('sending the same word twice still shows twice', () => {
    // One server row may only retire one bubble.
    const p = [pending('tmp1', 'ok'), pending('tmp2', 'ok')];
    expect(ids(unsettled(p, [row('real1', 'ok')]))).toEqual(['tmp2']);
  });

  it('REGRESSION: a settled bubble claims its row so a duplicate cannot take it', () => {
    // The settled branch used to return early WITHOUT claiming, leaving
    // the row free for the next identical message. The second bubble
    // vanished while its own insert was still in flight.
    const p = [pending('tmp1', 'ok', { settledId: 'real1' }), pending('tmp2', 'ok')];
    expect(ids(unsettled(p, [row('real1', 'ok')]))).toEqual(['tmp2']);
  });

  it('REGRESSION: settled bubbles claim first, whatever order they sit in', () => {
    // Same as above with the array the other way round — the fuzzy
    // matcher must not get first pick just because it comes first.
    const p = [pending('tmp2', 'ok'), pending('tmp1', 'ok', { settledId: 'real1' })];
    expect(ids(unsettled(p, [row('real1', 'ok')]))).toEqual(['tmp2']);
  });

  it('REGRESSION: retiring a bubble hands its claim to the survivors', () => {
    // The claim used to exist only inside whichever call was matching, so
    // deleting the finished bubble released its row and the next
    // identical message matched it and vanished mid-flight. The store
    // writes the id into the survivors instead, so the claim outlives the
    // entry that made it.
    usePendingMessages.setState({ byThread: {} });
    const store = usePendingMessages.getState();
    store.add(pending('tmp1', 'ok'));
    store.add(pending('tmp2', 'ok'));

    const rows = [row('real1', 'ok')];
    const before = usePendingMessages.getState().byThread.t;
    expect(ids(unsettled(before, rows))).toEqual(['tmp2']);

    // tmp1 is done and takes real1 out of circulation on its way out.
    usePendingMessages.getState().retire('t', 'tmp1', 'real1');

    const after = usePendingMessages.getState().byThread.t;
    expect(ids(after)).toEqual(['tmp2']);
    expect(after[0].knownIds.has('real1')).toBe(true);
    // The survivor keeps drawing: real1 was never its message.
    expect(ids(unsettled(after, rows))).toEqual(['tmp2']);
  });

  it('a survivor still retires against its OWN row after a hand-off', () => {
    usePendingMessages.setState({ byThread: {} });
    const store = usePendingMessages.getState();
    store.add(pending('tmp1', 'ok'));
    store.add(pending('tmp2', 'ok'));
    usePendingMessages.getState().retire('t', 'tmp1', 'real1');

    const after = usePendingMessages.getState().byThread.t;
    expect(unsettled(after, [row('real1', 'ok'), row('real2', 'ok')])).toHaveLength(0);
  });

  it('redraws a bubble whose row disappears from a stale refetch', () => {
    // A refetch that started before the insert committed resolves after
    // it and replaces the array without the row. The entry is still
    // there, so the bubble comes straight back rather than vanishing.
    const p = [pending('tmp1', 'hello', { settledId: 'real1' })];
    expect(unsettled(p, [row('real1', 'hello')])).toHaveLength(0);
    expect(unsettled(p, [])).toHaveLength(1);
  });

  it('does not retire on someone else saying the same thing back', () => {
    const p = [pending('tmp1', 'hello')];
    expect(unsettled(p, [row('real1', 'hello', 'user-them')])).toHaveLength(1);
  });

  it('three identical sends retire one per arriving row', () => {
    const p = [pending('t1', 'ok'), pending('t2', 'ok'), pending('t3', 'ok')];
    expect(ids(unsettled(p, [row('r1', 'ok')]))).toEqual(['t2', 't3']);
    expect(ids(unsettled(p, [row('r1', 'ok'), row('r2', 'ok')]))).toEqual(['t3']);
    expect(unsettled(p, [row('r1', 'ok'), row('r2', 'ok'), row('r3', 'ok')])).toHaveLength(0);
  });

  it('is unaffected by the device clock', () => {
    // No branch reads a timestamp any more. A phone half an hour out of
    // step retires exactly the same bubbles.
    const skewed: PendingMessage = { ...pending('tmp1', 'hello'), createdAt: '1999-01-01T00:00:00.000Z' };
    expect(unsettled([skewed], [row('real1', 'hello')])).toHaveLength(0);
  });
});
