/**
 * /api/memoir-render — kick off a book render.
 *
 * Validates the caller owns the project, inserts a pending
 * memoir_book_renders row, then pokes the Render.com worker (which
 * ACKs in 202 and processes in the background). Returns the render id
 * so the client can poll the row until status flips to done/failed.
 *
 * Fail-soft: if the worker URL isn't configured we still create the
 * row but mark it failed with a clear message, so the UI explains the
 * setup gap instead of hanging.
 */

import type { Config } from '@netlify/functions';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const WORKER_URL = process.env.MEMOIR_RENDER_WORKER_URL;
const RENDER_SECRET = process.env.MEMOIR_RENDER_SECRET;

interface Body { project_id?: string }

async function rest(path: string, init: RequestInit) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
}

export default async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return json({ error: 'Server not configured' }, 503);
  }

  // Identify the caller.
  const auth = req.headers.get('authorization');
  if (!auth) return json({ error: 'Not signed in' }, 401);
  let userId: string | null = null;
  try {
    const u = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: auth, apikey: SERVICE_ROLE },
    });
    if (u.ok) userId = ((await u.json()) as any)?.id ?? null;
  } catch {}
  if (!userId) return json({ error: 'Not signed in' }, 401);

  let body: Body;
  try { body = await req.json(); } catch { body = {}; }
  const projectId = body.project_id;
  if (!projectId) return json({ error: 'project_id required' }, 400);

  // Verify ownership.
  const ownRes = await rest(
    `memoir_projects?id=eq.${projectId}&author_id=eq.${userId}&select=id`,
    { method: 'GET' },
  );
  const owned = ownRes.ok ? ((await ownRes.json()) as any[]) : [];
  if (!owned.length) return json({ error: 'Project not found' }, 404);

  // Create the pending render row.
  const insRes = await rest('memoir_book_renders', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ project_id: projectId, status: 'pending', requested_by: userId }),
  });
  if (!insRes.ok) {
    const t = await insRes.text();
    return json({ error: `Could not start render: ${t.slice(0, 200)}` }, 500);
  }
  const renderId = ((await insRes.json()) as any[])[0]?.id;

  // No worker configured yet — mark failed with a helpful message.
  if (!WORKER_URL || !RENDER_SECRET) {
    await rest(`memoir_book_renders?id=eq.${renderId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'failed',
        error: 'Render worker not configured. Set MEMOIR_RENDER_WORKER_URL and MEMOIR_RENDER_SECRET.',
      }),
    });
    return json({ render_id: renderId, warning: 'worker_not_configured' }, 202);
  }

  // Poke the worker. Await only the ACK, not the render.
  try {
    await fetch(`${WORKER_URL.replace(/\/$/, '')}/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-render-secret': RENDER_SECRET },
      body: JSON.stringify({ render_id: renderId, project_id: projectId }),
    });
  } catch (e: any) {
    await rest(`memoir_book_renders?id=eq.${renderId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'failed', error: `Worker unreachable: ${e?.message ?? ''}`.slice(0, 300) }),
    });
    return json({ render_id: renderId, error: 'worker_unreachable' }, 502);
  }

  return json({ render_id: renderId }, 202);
};

function json(obj: unknown, status: number) {
  return new Response(JSON.stringify(obj), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}

export const config: Config = { path: '/api/memoir-render' };
