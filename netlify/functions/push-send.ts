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
import webpush from 'web-push';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Public half is shipped to browsers in lib/web-push.ts; only the private
// half is secret, and it lives solely in the Netlify environment.
const VAPID_PUBLIC_KEY =
  'BMeAhzmiHGnZ4za6iIHS3PL0SDrwn3eZAS0pZNxeCg2snIrcZ_lunNShpK2YU3UWhftN6CdlLgEQh-TjC_Td1oo';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
// RFC 8292 wants a contact for the push service to reach on abuse.
const VAPID_SUBJECT = 'mailto:cameron@billing-therapy.com';

const SERVICE_HEADERS = {
  apikey: SERVICE_ROLE,
  Authorization: `Bearer ${SERVICE_ROLE}`,
  'Content-Type': 'application/json',
};

type WebTarget = {
  sender_id: string;
  sender_name: string | null;
  recipient_id: string;
  endpoint: string;
  p256dh: string;
  auth_key: string;
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

  // The browser half. Separate RPC because push_targets_for_message INNER
  // JOINs push_tokens, so anyone reading HereToo in a browser — which on an
  // iPhone is everyone, since there is no iOS build — never appears in it.
  let webTargets: WebTarget[] = [];
  try {
    const wr = await fetch(`${SUPABASE_URL}/rest/v1/rpc/web_push_targets_for_message`, {
      method: 'POST',
      headers: SERVICE_HEADERS,
      body: JSON.stringify({ message_id_in: messageId }),
    });
    if (wr.ok) webTargets = (await wr.json()) as WebTarget[];
    else console.error('[push-send] web target lookup failed', wr.status, await wr.text());
  } catch (e) {
    console.error('[push-send] web target lookup threw', e);
  }

  // Bail only when NEITHER channel has anywhere to go. Checking targets alone
  // would skip web push for every recipient without a phone app.
  if (targets.length === 0 && webTargets.length === 0) {
    return new Response('no targets');
  }

  // The message must actually be the caller's. Without this, any signed-in
  // person could notify anyone by guessing a message id.
  const senderId = targets[0]?.sender_id ?? webTargets[0]?.sender_id;
  if (senderId !== callerId) return new Response('forbidden', { status: 403 });

  const who_ = targets[0]?.sender_name || webTargets[0]?.sender_name || 'Someone';

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

  // ── Web push ───────────────────────────────────────────────────────
  // Fires here rather than from message-email's two-minute poller, so a
  // browser buzzes at the same moment a phone does.
  //
  // Body is withheld deliberately: a push renders on a lock screen anyone
  // can read. Sender and kind only, matching the email path's reasoning.
  if (webTargets.length > 0) {
    if (!VAPID_PRIVATE_KEY) {
      console.warn('[push-send] VAPID_PRIVATE_KEY unset — skipping web push');
    } else {
      webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

      const payload = JSON.stringify({
        title: who_,
        body: isCall ? 'is calling' : 'sent you a message',
        url: isCall && callId ? `/call/${callId}` : '/messages',
        tag: `heretoo-${messageId}`,
      });

      const results = await Promise.allSettled(
        webTargets.map((w) =>
          webpush.sendNotification(
            { endpoint: w.endpoint, keys: { p256dh: w.p256dh, auth: w.auth_key } },
            payload,
            { TTL: 600, urgency: 'high' },
          ),
        ),
      );

      // 404 and 410 mean the browser threw the subscription away. Anything
      // else may be transient, so only those are deleted — a network blip
      // must not cost someone their notifications.
      const dead: string[] = [];
      results.forEach((res, i) => {
        if (res.status === 'rejected') {
          const code = (res.reason as any)?.statusCode;
          if (code === 404 || code === 410) dead.push(webTargets[i].endpoint);
          else console.error('[push-send] web push failed', code, (res.reason as any)?.body);
        }
      });

      if (dead.length > 0) {
        await fetch(
          `${SUPABASE_URL}/rest/v1/web_push_subscriptions?endpoint=in.(${dead.map((d) => `"${d}"`).join(',')})`,
          { method: 'DELETE', headers: SERVICE_HEADERS },
        ).catch(() => {});
      }

      const ok = results.filter((x) => x.status === 'fulfilled').length;
      console.log(`[push-send] web push ${ok}/${webTargets.length}`);
    }
  }

  // Nothing further to do when the only recipients were browsers.
  if (targets.length === 0) return new Response('web push only');

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
