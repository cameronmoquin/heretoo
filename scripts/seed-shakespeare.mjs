#!/usr/bin/env node
/**
 * Seed the public feed with famous Shakespeare quotes.
 *
 * Creates one bot account (`@shakespeare`) via the Supabase Admin
 * API, then inserts ~50 of the best-known quotes as public posts
 * under that profile. Each post body is the quote followed by the
 * character + play attribution.
 *
 * Re-running is safe — the auth.users + profiles for @shakespeare
 * gets created once; subsequent runs find the existing user. Posts
 * go through with `author_id` = the bot. We don't dedup posts so
 * running this twice will double the quotes; that's intentional
 * (sometimes you want more variety in the feed).
 *
 * Usage:
 *   node scripts/seed-shakespeare.mjs
 *
 * Env: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (loaded from .env).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function loadDotEnv() {
  const path = join(process.cwd(), '.env');
  try {
    const text = readFileSync(path, 'utf8');
    for (const line of text.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {}
}
loadDotEnv();

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const HEADERS = {
  apikey: SERVICE_ROLE,
  Authorization: `Bearer ${SERVICE_ROLE}`,
  'Content-Type': 'application/json',
};

const BOT_HANDLE = 'shakespeare';
const BOT_DISPLAY = 'William Shakespeare';
const BOT_BIO = 'Plays and verse, 1564–1616. Posting the great moments — quote first, character + play after the dash.';
const BOT_EMAIL = 'shakespeare@bot.heretoo.social';
const BOT_PASSWORD = `bot-${Math.random().toString(36).slice(2)}-${Date.now()}`;

const QUOTES = [
  { quote: 'To be, or not to be, that is the question.', who: 'Hamlet', play: 'Hamlet, Act 3 Scene 1' },
  { quote: 'All the world\'s a stage, and all the men and women merely players.', who: 'Jaques', play: 'As You Like It, Act 2 Scene 7' },
  { quote: 'The lady doth protest too much, methinks.', who: 'Gertrude', play: 'Hamlet, Act 3 Scene 2' },
  { quote: 'A horse, a horse, my kingdom for a horse!', who: 'King Richard', play: 'Richard III, Act 5 Scene 4' },
  { quote: 'Some are born great, some achieve greatness, and some have greatness thrust upon them.', who: 'Malvolio', play: 'Twelfth Night, Act 2 Scene 5' },
  { quote: 'What\'s in a name? That which we call a rose by any other name would smell as sweet.', who: 'Juliet', play: 'Romeo and Juliet, Act 2 Scene 2' },
  { quote: 'But, soft! what light through yonder window breaks? It is the east, and Juliet is the sun.', who: 'Romeo', play: 'Romeo and Juliet, Act 2 Scene 2' },
  { quote: 'The course of true love never did run smooth.', who: 'Lysander', play: 'A Midsummer Night\'s Dream, Act 1 Scene 1' },
  { quote: 'If music be the food of love, play on.', who: 'Orsino', play: 'Twelfth Night, Act 1 Scene 1' },
  { quote: 'Lord, what fools these mortals be!', who: 'Puck', play: 'A Midsummer Night\'s Dream, Act 3 Scene 2' },
  { quote: 'Cowards die many times before their deaths; the valiant never taste of death but once.', who: 'Caesar', play: 'Julius Caesar, Act 2 Scene 2' },
  { quote: 'Et tu, Brute? — Then fall, Caesar.', who: 'Caesar', play: 'Julius Caesar, Act 3 Scene 1' },
  { quote: 'Friends, Romans, countrymen, lend me your ears; I come to bury Caesar, not to praise him.', who: 'Mark Antony', play: 'Julius Caesar, Act 3 Scene 2' },
  { quote: 'Tomorrow, and tomorrow, and tomorrow, creeps in this petty pace from day to day.', who: 'Macbeth', play: 'Macbeth, Act 5 Scene 5' },
  { quote: 'Out, damned spot! Out, I say!', who: 'Lady Macbeth', play: 'Macbeth, Act 5 Scene 1' },
  { quote: 'Double, double, toil and trouble; fire burn and cauldron bubble.', who: 'The Witches', play: 'Macbeth, Act 4 Scene 1' },
  { quote: 'Fair is foul, and foul is fair.', who: 'The Witches', play: 'Macbeth, Act 1 Scene 1' },
  { quote: 'The fault, dear Brutus, is not in our stars, but in ourselves.', who: 'Cassius', play: 'Julius Caesar, Act 1 Scene 2' },
  { quote: 'Nothing will come of nothing.', who: 'Lear', play: 'King Lear, Act 1 Scene 1' },
  { quote: 'How sharper than a serpent\'s tooth it is to have a thankless child!', who: 'Lear', play: 'King Lear, Act 1 Scene 4' },
  { quote: 'I am a man more sinned against than sinning.', who: 'Lear', play: 'King Lear, Act 3 Scene 2' },
  { quote: 'O brave new world, that has such people in\'t!', who: 'Miranda', play: 'The Tempest, Act 5 Scene 1' },
  { quote: 'We are such stuff as dreams are made on, and our little life is rounded with a sleep.', who: 'Prospero', play: 'The Tempest, Act 4 Scene 1' },
  { quote: 'Hell is empty and all the devils are here.', who: 'Ariel', play: 'The Tempest, Act 1 Scene 2' },
  { quote: 'Brevity is the soul of wit.', who: 'Polonius', play: 'Hamlet, Act 2 Scene 2' },
  { quote: 'There are more things in heaven and earth, Horatio, than are dreamt of in your philosophy.', who: 'Hamlet', play: 'Hamlet, Act 1 Scene 5' },
  { quote: 'This above all: to thine own self be true.', who: 'Polonius', play: 'Hamlet, Act 1 Scene 3' },
  { quote: 'Though this be madness, yet there is method in\'t.', who: 'Polonius', play: 'Hamlet, Act 2 Scene 2' },
  { quote: 'Frailty, thy name is woman!', who: 'Hamlet', play: 'Hamlet, Act 1 Scene 2' },
  { quote: 'Something is rotten in the state of Denmark.', who: 'Marcellus', play: 'Hamlet, Act 1 Scene 4' },
  { quote: 'The play\'s the thing wherein I\'ll catch the conscience of the king.', who: 'Hamlet', play: 'Hamlet, Act 2 Scene 2' },
  { quote: 'Goodnight, sweet prince, and flights of angels sing thee to thy rest.', who: 'Horatio', play: 'Hamlet, Act 5 Scene 2' },
  { quote: 'My only love sprung from my only hate!', who: 'Juliet', play: 'Romeo and Juliet, Act 1 Scene 5' },
  { quote: 'Parting is such sweet sorrow.', who: 'Juliet', play: 'Romeo and Juliet, Act 2 Scene 2' },
  { quote: 'A plague o\' both your houses!', who: 'Mercutio', play: 'Romeo and Juliet, Act 3 Scene 1' },
  { quote: 'For never was a story of more woe than this of Juliet and her Romeo.', who: 'Prince', play: 'Romeo and Juliet, Act 5 Scene 3' },
  { quote: 'Now is the winter of our discontent made glorious summer by this sun of York.', who: 'Richard', play: 'Richard III, Act 1 Scene 1' },
  { quote: 'Once more unto the breach, dear friends, once more.', who: 'King Henry', play: 'Henry V, Act 3 Scene 1' },
  { quote: 'We few, we happy few, we band of brothers.', who: 'King Henry', play: 'Henry V, Act 4 Scene 3' },
  { quote: 'The quality of mercy is not strained. It droppeth as the gentle rain from heaven.', who: 'Portia', play: 'The Merchant of Venice, Act 4 Scene 1' },
  { quote: 'If you prick us, do we not bleed? If you tickle us, do we not laugh?', who: 'Shylock', play: 'The Merchant of Venice, Act 3 Scene 1' },
  { quote: 'All that glitters is not gold.', who: 'Prince of Morocco', play: 'The Merchant of Venice, Act 2 Scene 7' },
  { quote: 'Give every man thy ear, but few thy voice.', who: 'Polonius', play: 'Hamlet, Act 1 Scene 3' },
  { quote: 'Better three hours too soon than a minute too late.', who: 'Falstaff', play: 'The Merry Wives of Windsor, Act 2 Scene 2' },
  { quote: 'When sorrows come, they come not single spies, but in battalions.', who: 'Claudius', play: 'Hamlet, Act 4 Scene 5' },
  { quote: 'O, beware, my lord, of jealousy! It is the green-eyed monster which doth mock the meat it feeds on.', who: 'Iago', play: 'Othello, Act 3 Scene 3' },
  { quote: 'I am one who loved not wisely, but too well.', who: 'Othello', play: 'Othello, Act 5 Scene 2' },
  { quote: 'My salad days, when I was green in judgement, cold in blood.', who: 'Cleopatra', play: 'Antony and Cleopatra, Act 1 Scene 5' },
  { quote: 'Age cannot wither her, nor custom stale her infinite variety.', who: 'Enobarbus', play: 'Antony and Cleopatra, Act 2 Scene 2' },
  { quote: 'Uneasy lies the head that wears a crown.', who: 'King Henry', play: 'Henry IV, Part 2, Act 3 Scene 1' },
  { quote: 'The robbed that smiles steals something from the thief.', who: 'Duke', play: 'Othello, Act 1 Scene 3' },
  { quote: 'O, what a tangled web we weave when first we practise to deceive.', who: 'Walter Scott', play: '— attributed often to Shakespeare, actually Marmion (1808). Skipping.' },
  { quote: 'Love all, trust a few, do wrong to none.', who: 'Countess', play: 'All\'s Well That Ends Well, Act 1 Scene 1' },
  { quote: 'These violent delights have violent ends.', who: 'Friar Laurence', play: 'Romeo and Juliet, Act 2 Scene 6' },
  { quote: 'Beware the ides of March.', who: 'Soothsayer', play: 'Julius Caesar, Act 1 Scene 2' },
];

async function findOrCreateBot() {
  // List existing users — find the bot by email.
  const list = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, {
    headers: HEADERS,
  });
  const j = await list.json();
  const existing = (j.users ?? []).find((u) => u.email === BOT_EMAIL);
  if (existing) {
    console.log('Bot already exists:', existing.id);
    // Make sure the profile has the right handle/display.
    await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${existing.id}`, {
      method: 'PATCH',
      headers: { ...HEADERS, Prefer: 'return=minimal' },
      body: JSON.stringify({
        handle: BOT_HANDLE,
        display_name: BOT_DISPLAY,
        bio: BOT_BIO,
      }),
    });
    return existing.id;
  }
  console.log('Creating bot user…');
  const create = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({
      email: BOT_EMAIL,
      password: BOT_PASSWORD,
      email_confirm: true,
      user_metadata: { handle: BOT_HANDLE, display_name: BOT_DISPLAY },
    }),
  });
  const cj = await create.json();
  if (!create.ok) {
    console.error('Failed to create bot:', cj);
    process.exit(1);
  }
  const userId = cj.id ?? cj.user?.id;
  console.log('Created bot:', userId);
  // Wait briefly for handle_new_user trigger to populate profile.
  await new Promise((r) => setTimeout(r, 500));
  // Update the bot profile with the proper handle/bio.
  await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
    method: 'PATCH',
    headers: { ...HEADERS, Prefer: 'return=minimal' },
    body: JSON.stringify({
      handle: BOT_HANDLE,
      display_name: BOT_DISPLAY,
      bio: BOT_BIO,
    }),
  });
  return userId;
}

async function postQuote(authorId, q) {
  // Skip the misattributed Marmion line.
  if (q.play.includes('attributed')) return;
  const body = `"${q.quote}"\n\n— ${q.who}, ${q.play}`;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/posts`, {
    method: 'POST',
    headers: { ...HEADERS, Prefer: 'return=minimal' },
    body: JSON.stringify({
      author_id: authorId,
      body,
      visibility: 'public',
      kind: 'post',
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    console.warn('  post failed:', t.slice(0, 200));
    return;
  }
  process.stdout.write(`  ✓ ${q.who}\n`);
}

async function main() {
  const botId = await findOrCreateBot();
  console.log(`Posting ${QUOTES.length} quotes as @${BOT_HANDLE}…`);
  for (const q of QUOTES) {
    await postQuote(botId, q);
    // Light pacing so the feed sees a stream of timestamps rather than
    // all 50 with the same created_at.
    await new Promise((r) => setTimeout(r, 200));
  }
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
