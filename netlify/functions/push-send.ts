/**
 * push-send — ring the recipient's phone.
 *
 * NOT scheduled. The email function (072) polls every two minutes, which
 * is fine for mail and useless for a notification: a push that lands
 * three minutes after the message is not telling you anything you have
 * not already found out. So the SENDER'S client calls this the instant
 * their insert succeeds, and the buzz is immediate.
 *
 * That means this endpoint is reachable by anyone with a session, so it
 * verifies rather than trusts: the caller's JWT is exchanged for a user
 * id, and push_targets_for_message returns the message's real sender_id
 * for comparison. Calling it with someone else's message id sends
 * nothing. The only input is a message id — no recipient, no body, no
 * token — so a caller cannot aim it or write its contents.
 *
 * THE BODY IS NOT IN THE NOTIFICATION. Same reasoning as the email: a
 * lock screen is a public surface. It says who wrote.
 */

import type { Context } from '@netlify/functions';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const SERVICE_HEADERS = {
  apikey: SERVICE_ROLE,
  Authorization: `Bearer ${SERVICE_ROLE}`,
  'Content-Type': 'application/json',
};

type Target = {
  sender_id: string;
  sender_name: string | null;
  recipient_id: string;
  token: string;
  platform: string | null;
};

export default async (req: Request, _ctx: Context) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });

  const auth = req.headers.get('authorization') ?? '';
  const jwt = auth.replace(/^Bearer\s+/i, '');
  if (!jwt) return new Response('unauthorized', { status: 401 });

  let messageId: string | undefined;
  try {
    messageId = (await req.json())?.messageId;
  } catch {
    return new Response('bad request', { status: 400 });
  }
  if (!messageId) return new Response('bad request', { status: 400 });

  // Who is calling. The anon key plus the caller's JWT is the cheapest
  // way to turn a token into a verified user id.
  const who = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? SERVICE_ROLE, Authorization: `Bearer ${jwt}` },
  });
  if (!who.ok) return new Response('unauthorized', { status: 401 });
  const callerId = (await who.json())?.id;
  if (!callerId) return new Response('unauthorized', { status: 401 });

  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/push_targets_for_message`, {
    method: 'POST',
    headers: SERVICE_HEADERS,
    body: JSON.stringify({ message_id_in: messageId }),
  });
  if (!r.ok) {
    // eslint-disable-next-line no-console
    console.error('[push-send] target lookup failed', r.status, await r.text());
    return new Response('lookup failed', { status: 500 });
  }

  const targets = (await r.json()) as Target[];
  if (targets.length === 0) return new Response('no targets');

  // The message must actually be the caller's. Without this, any signed-in
  // person could notify anyone by guessing a message id.
  if (targets[0].sender_id !== callerId) return new Response('forbidden', { status: 403 });

  const who_ = targets[0].sender_name || 'Someone';

  // A message whose entire body is a call link IS a call — the thread's
  // camera button writes exactly that shape — so the phone should say
  // so. The body itself still never rides the notification; this is a
  // server-side shape check, and the lock screen learns only the kind.
  let isCall = false;
  let callId: string | null = null;
  try {
    const mr = await fetch(
      `${SUPABASE_URL}/rest/v1/messages?id=eq.${messageId}&select=body`,
      { headers: SERVICE_HEADERS },
    );
    if (mr.ok) {
      const rows = (await mr.json()) as Array<{ body: string | null }>;
      const m = (rows[0]?.body ?? '').trim()
        .match(/^https:\/\/\S+\/call\/([0-9a-f-]{36})$/i);
      if (m) { isCall = true; callId = m[1]; }
    }
  } catch {}

  const messages = targets.map((t) => ({
    to: t.token,
    title: who_,
    body: isCall ? 'is calling' : 'sent you a message',
    sound: 'default',
    channelId: 'default',
    priority: 'high',
    data: isCall ? { kind: 'call', callId, messageId } : { kind: 'message', messageId },
  }));

  const push = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  });
  if (!push.ok) {
    // eslint-disable-next-line no-console
    console.error('[push-send] expo error', push.status, await push.text());
    return new Response('push failed', { status: 502 });
  }

  // Expo answers per-token. A DeviceNotRegistered ticket means the app
  // was uninstalled; drop that row so it stops being tried forever.
  try {
    const body = await push.json();
    const tickets: any[] = body?.data ?? [];
    const dead = tickets
      .map((t, i) => (t?.details?.error === 'DeviceNotRegistered' ? targets[i].token : null))
      .filter(Boolean);
    if (dead.length > 0) {
      await fetch(`${SUPABASE_URL}/rest/v1/push_tokens?token=in.(${dead.map((t) => `"${t}"`).join(',')})`, {
        method: 'DELETE',
        headers: SERVICE_HEADERS,
      });
    }
  } catch {}

  return new Response(`pushed ${messages.length}`);
};
