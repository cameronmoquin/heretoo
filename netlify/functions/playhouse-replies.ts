/**
 * Scheduled function — the playhouse talks back.
 *
 * When a Shakespeare character bot posts a line in The Room (a public
 * quote post with a slugline), related characters from the SAME play
 * reply in character: friends affirm or tease, enemies needle and
 * retort. Each reply is authored by that character's own bot profile
 * (not a generic chorus account), so a thread reads like the players
 * ribbing each other across the room.
 *
 * This deliberately REVERSES the Milestone-7 "no bot-to-bot
 * conversations" rule — at Cameron's request, the in-play friend/enemy
 * banter IS the feature. It stays bounded and quiet:
 *   - replies land only on top-level POSTS, never on other replies, so
 *     nothing can cascade,
 *   - at most 2 character replies per post over its life,
 *   - a probabilistic gate so most posts get none,
 *   - a small cap per run.
 *
 * Relationships are keyed by character display_name (the bot profile
 * name set by post-shakespeare). Fail-soft: dormant without
 * ANTHROPIC_API_KEY.
 */

import type { Config } from '@netlify/functions';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5';

const HEADERS = {
  apikey: SERVICE_ROLE,
  Authorization: `Bearer ${SERVICE_ROLE}`,
  'Content-Type': 'application/json',
};

const MAX_REPLIES_PER_POST = 2;
const MAX_REPLIES_PER_RUN = 3;
const REPLY_PROBABILITY = 0.6;

type Stance = 'friend' | 'enemy';
interface Rel { play: string; friends?: string[]; enemies?: string[]; }

// Keyed by character display_name. Within-play only. Asymmetry is fine:
// Iago hunts Othello; Othello (until the end) trusts "honest Iago".
const RELATIONSHIPS: Record<string, Rel> = {
  Hamlet: { play: 'Hamlet', friends: ['Horatio'], enemies: ['Claudius', 'Polonius'] },
  Horatio: { play: 'Hamlet', friends: ['Hamlet'] },
  Claudius: { play: 'Hamlet', enemies: ['Hamlet'] },
  Polonius: { play: 'Hamlet', enemies: ['Hamlet'] },
  Ophelia: { play: 'Hamlet', friends: ['Hamlet'] },
  Macbeth: { play: 'Macbeth', friends: ['Lady Macbeth'], enemies: ['The Witches'] },
  'Lady Macbeth': { play: 'Macbeth', friends: ['Macbeth'] },
  'The Witches': { play: 'Macbeth', enemies: ['Macbeth'] },
  Iago: { play: 'Othello', enemies: ['Othello'] },
  Othello: { play: 'Othello', enemies: ['Iago'] },
  Caesar: { play: 'Julius Caesar', friends: ['Mark Antony'], enemies: ['Cassius', 'Brutus'] },
  Cassius: { play: 'Julius Caesar', enemies: ['Caesar', 'Mark Antony'] },
  Brutus: { play: 'Julius Caesar', enemies: ['Mark Antony'] },
  'Mark Antony': { play: 'Julius Caesar', friends: ['Caesar'], enemies: ['Cassius', 'Brutus'] },
  Falstaff: { play: 'Henry IV', friends: ['King Henry'] },
  'King Henry': { play: 'Henry IV', friends: ['Falstaff'], enemies: ['Hotspur'] },
  Hotspur: { play: 'Henry IV', enemies: ['King Henry'] },
  Beatrice: { play: 'Much Ado About Nothing', enemies: ['Benedick'] },
  Benedick: { play: 'Much Ado About Nothing', enemies: ['Beatrice'] },
  Romeo: { play: 'Romeo and Juliet', friends: ['Juliet', 'Mercutio'] },
  Juliet: { play: 'Romeo and Juliet', friends: ['Romeo'] },
  Mercutio: { play: 'Romeo and Juliet', friends: ['Romeo'] },
  // The Merchant of Venice is deliberately kept OUT of the banter map.
  // Its adversary dynamics (Shylock vs. his accusers) trade on an
  // antisemitic caricature; AI-generated antagonism there is a risk we
  // do not take. Portia/Jessica still post their neutral lines; they
  // just do not banter.
  Prospero: { play: 'The Tempest', friends: ['Ariel'], enemies: ['Antonio'] },
  Ariel: { play: 'The Tempest', friends: ['Prospero'] },
  Antonio: { play: 'The Tempest', enemies: ['Prospero'] },
  Edmund: { play: 'King Lear', enemies: ['Edgar'] },
  Edgar: { play: 'King Lear', enemies: ['Edmund'] },
  Malvolio: { play: 'Twelfth Night', enemies: ['Feste'] },
  Feste: { play: 'Twelfth Night', enemies: ['Malvolio'] },
};

function characterToHandle(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, '_').slice(0, 24);
}

/** Find (or create on demand) the responder's own bot profile. */
async function findOrCreateCharacterBot(character: string): Promise<string | null> {
  const handle = characterToHandle(character);
  if (!handle) return null;
  const lookup = await fetch(`${SUPABASE_URL}/rest/v1/profiles?handle=eq.${handle}&select=id&limit=1`, { headers: HEADERS });
  const found = await lookup.json();
  if (found?.[0]?.id) return found[0].id;

  const email = `bot+${handle}@bot.heretoo.social`;
  const password = `bot-${Math.random().toString(36).slice(2)}-${Date.now()}`;
  const create = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST', headers: HEADERS,
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { handle, display_name: character, is_bot: true } }),
  });
  if (!create.ok) return null;
  const cj = await create.json();
  const userId: string | undefined = cj.id ?? cj.user?.id;
  if (!userId) return null;
  await new Promise((r) => setTimeout(r, 400));
  await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
    method: 'PATCH', headers: { ...HEADERS, Prefer: 'return=minimal' },
    body: JSON.stringify({ handle, display_name: character, bio: 'Character voice from Shakespeare. Posting lines as they were spoken.' }),
  });
  return userId;
}

/** Everyone who holds a stance toward X (they list X as friend/enemy). */
function respondersTo(x: string): Array<{ name: string; stance: Stance }> {
  const out: Array<{ name: string; stance: Stance }> = [];
  for (const [name, rel] of Object.entries(RELATIONSHIPS)) {
    if (name === x) continue;
    if (rel.friends?.includes(x)) out.push({ name, stance: 'friend' });
    if (rel.enemies?.includes(x)) out.push({ name, stance: 'enemy' });
  }
  return out;
}

function clean(raw: string): string | null {
  let t = (raw ?? '').trim();
  if (t.length < 8 || t.length > 500) return null;
  if (/!{1,}/.test(t)) return null;
  if (/^(as a|i am an? ai|i'm an? ai|as a fictional|i'm a fictional)/i.test(t)) return null;
  t = t.replace(/^["'“”]|["'“”]$/g, '').trim();
  return t || null;
}

async function generateReply(responder: string, play: string, stance: Stance, target: string, line: string): Promise<string | null> {
  if (!ANTHROPIC_KEY) return null;
  const posture = stance === 'friend'
    ? `You are ${target}'s ally in the play — loyal, or fond, or teasing in a familiar way. Warm, or wry, but on their side.`
    : `You are ${target}'s adversary in the play — you needle them, undercut them, answer with a sharp or sly retort. Wit, not vulgarity.`;
  const system =
    `You are ${responder} from Shakespeare's ${play}. Speak only in your own character voice — Elizabethan register, but readable. ${posture} ` +
    `${target} has just posted a line in a public room. Reply directly to ${target}, one or two sentences of prose, in character. ` +
    `Do not quote them back verbatim; respond as if across the room. Never say you are fictional or an AI. No exclamation marks.`;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL, max_tokens: 160, temperature: 0.95, system,
        messages: [{ role: 'user', content: `${target} posted:\n\n"${line.slice(0, 1200)}"\n\nYour reply:` }],
      }),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as any;
    return clean(j?.content?.[0]?.text ?? '');
  } catch { return null; }
}

export default async () => {
  if (!SUPABASE_URL || !SERVICE_ROLE) return new Response('Missing Supabase credentials', { status: 500 });
  if (!ANTHROPIC_KEY) {
    return new Response(JSON.stringify({ status: 'dormant' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  // Recent character posts in The Room (public, slugline present).
  const since = new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString();
  const postsRes = await fetch(
    `${SUPABASE_URL}/rest/v1/posts?select=id,body,created_at,author:profiles!author_id(display_name)` +
      `&visibility=eq.public&slugline=not.is.null&created_at=gte.${since}&order=created_at.desc&limit=30`,
    { headers: HEADERS },
  );
  const posts = (await postsRes.json()) as Array<{ id: string; body: string | null; author: { display_name: string } | null }>;
  if (!Array.isArray(posts)) return new Response(JSON.stringify({ error: 'posts query failed' }), { status: 500 });

  let replied = 0;
  let skipped = 0;

  for (const post of posts) {
    if (replied >= MAX_REPLIES_PER_RUN) break;
    const x = post.author?.display_name;
    if (!x || !RELATIONSHIPS[x] || !post.body) { skipped++; continue; }

    // Who could answer X?
    const candidates = respondersTo(x);
    if (candidates.length === 0) { skipped++; continue; }

    // Existing character replies on this post — dedup + cap.
    const cRes = await fetch(
      `${SUPABASE_URL}/rest/v1/comments?select=author:profiles!author_id(display_name)&post_id=eq.${post.id}`,
      { headers: HEADERS },
    );
    const existing = (await cRes.json()) as Array<{ author: { display_name: string } | null }>;
    const already = new Set((Array.isArray(existing) ? existing : []).map((c) => c.author?.display_name).filter(Boolean) as string[]);
    if (already.size >= MAX_REPLIES_PER_POST) { skipped++; continue; }

    const fresh = candidates.filter((c) => !already.has(c.name));
    if (fresh.length === 0) { skipped++; continue; }
    if (Math.random() > REPLY_PROBABILITY) { skipped++; continue; }

    const who = fresh[Math.floor(Math.random() * fresh.length)];
    const play = RELATIONSHIPS[who.name].play;
    const reply = await generateReply(who.name, play, who.stance, x, post.body);
    if (!reply) { skipped++; continue; }

    const authorId = await findOrCreateCharacterBot(who.name);
    if (!authorId) { skipped++; continue; }

    const ins = await fetch(`${SUPABASE_URL}/rest/v1/comments`, {
      method: 'POST', headers: { ...HEADERS, Prefer: 'return=minimal' },
      body: JSON.stringify({ post_id: post.id, author_id: authorId, body: reply }),
    });
    if (!ins.ok) { skipped++; continue; }
    replied++;
  }

  return new Response(JSON.stringify({ replied, skipped, scanned: posts.length }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
};

/** Every 20 minutes — the room is talkative but not frantic. */
export const config: Config = { schedule: '*/20 * * * *' };
