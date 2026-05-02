#!/usr/bin/env node
/**
 * Populate the shakespeare_quotes catalogue table.
 *
 * Imports ~80 famous quotes for the scheduled drip function to draw
 * from. Idempotent — the (quote) UNIQUE constraint silently dedups
 * re-runs.
 *
 * Quotes that have ALREADY been posted to the feed (the initial
 * batch of 50) get `last_posted_at = now()` so the rotation picks
 * fresh ones first.
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
const HEADERS = {
  apikey: SERVICE_ROLE,
  Authorization: `Bearer ${SERVICE_ROLE}`,
  'Content-Type': 'application/json',
};

// already_posted = true means we ran this quote in the initial 50-shot
// dump and don't want the scheduler to re-post it before fresh ones.
const QUOTES = [
  // Initial 50 — mark as already posted
  { quote: 'To be, or not to be, that is the question.', character: 'Hamlet', play: 'Hamlet, Act 3 Scene 1', already_posted: true },
  { quote: 'All the world\'s a stage, and all the men and women merely players.', character: 'Jaques', play: 'As You Like It, Act 2 Scene 7', already_posted: true },
  { quote: 'The lady doth protest too much, methinks.', character: 'Gertrude', play: 'Hamlet, Act 3 Scene 2', already_posted: true },
  { quote: 'A horse, a horse, my kingdom for a horse!', character: 'King Richard', play: 'Richard III, Act 5 Scene 4', already_posted: true },
  { quote: 'Some are born great, some achieve greatness, and some have greatness thrust upon them.', character: 'Malvolio', play: 'Twelfth Night, Act 2 Scene 5', already_posted: true },
  { quote: 'What\'s in a name? That which we call a rose by any other name would smell as sweet.', character: 'Juliet', play: 'Romeo and Juliet, Act 2 Scene 2', already_posted: true },
  { quote: 'But, soft! what light through yonder window breaks? It is the east, and Juliet is the sun.', character: 'Romeo', play: 'Romeo and Juliet, Act 2 Scene 2', already_posted: true },
  { quote: 'The course of true love never did run smooth.', character: 'Lysander', play: 'A Midsummer Night\'s Dream, Act 1 Scene 1', already_posted: true },
  { quote: 'If music be the food of love, play on.', character: 'Orsino', play: 'Twelfth Night, Act 1 Scene 1', already_posted: true },
  { quote: 'Lord, what fools these mortals be!', character: 'Puck', play: 'A Midsummer Night\'s Dream, Act 3 Scene 2', already_posted: true },
  { quote: 'Cowards die many times before their deaths; the valiant never taste of death but once.', character: 'Caesar', play: 'Julius Caesar, Act 2 Scene 2', already_posted: true },
  { quote: 'Et tu, Brute? — Then fall, Caesar.', character: 'Caesar', play: 'Julius Caesar, Act 3 Scene 1', already_posted: true },
  { quote: 'Friends, Romans, countrymen, lend me your ears; I come to bury Caesar, not to praise him.', character: 'Mark Antony', play: 'Julius Caesar, Act 3 Scene 2', already_posted: true },
  { quote: 'Tomorrow, and tomorrow, and tomorrow, creeps in this petty pace from day to day.', character: 'Macbeth', play: 'Macbeth, Act 5 Scene 5', already_posted: true },
  { quote: 'Out, damned spot! Out, I say!', character: 'Lady Macbeth', play: 'Macbeth, Act 5 Scene 1', already_posted: true },
  { quote: 'Double, double, toil and trouble; fire burn and cauldron bubble.', character: 'The Witches', play: 'Macbeth, Act 4 Scene 1', already_posted: true },
  { quote: 'Fair is foul, and foul is fair.', character: 'The Witches', play: 'Macbeth, Act 1 Scene 1', already_posted: true },
  { quote: 'The fault, dear Brutus, is not in our stars, but in ourselves.', character: 'Cassius', play: 'Julius Caesar, Act 1 Scene 2', already_posted: true },
  { quote: 'Nothing will come of nothing.', character: 'Lear', play: 'King Lear, Act 1 Scene 1', already_posted: true },
  { quote: 'How sharper than a serpent\'s tooth it is to have a thankless child!', character: 'Lear', play: 'King Lear, Act 1 Scene 4', already_posted: true },
  { quote: 'I am a man more sinned against than sinning.', character: 'Lear', play: 'King Lear, Act 3 Scene 2', already_posted: true },
  { quote: 'O brave new world, that has such people in\'t!', character: 'Miranda', play: 'The Tempest, Act 5 Scene 1', already_posted: true },
  { quote: 'We are such stuff as dreams are made on, and our little life is rounded with a sleep.', character: 'Prospero', play: 'The Tempest, Act 4 Scene 1', already_posted: true },
  { quote: 'Hell is empty and all the devils are here.', character: 'Ariel', play: 'The Tempest, Act 1 Scene 2', already_posted: true },
  { quote: 'Brevity is the soul of wit.', character: 'Polonius', play: 'Hamlet, Act 2 Scene 2', already_posted: true },
  { quote: 'There are more things in heaven and earth, Horatio, than are dreamt of in your philosophy.', character: 'Hamlet', play: 'Hamlet, Act 1 Scene 5', already_posted: true },
  { quote: 'This above all: to thine own self be true.', character: 'Polonius', play: 'Hamlet, Act 1 Scene 3', already_posted: true },
  { quote: 'Though this be madness, yet there is method in\'t.', character: 'Polonius', play: 'Hamlet, Act 2 Scene 2', already_posted: true },
  { quote: 'Frailty, thy name is woman!', character: 'Hamlet', play: 'Hamlet, Act 1 Scene 2', already_posted: true },
  { quote: 'Something is rotten in the state of Denmark.', character: 'Marcellus', play: 'Hamlet, Act 1 Scene 4', already_posted: true },
  { quote: 'The play\'s the thing wherein I\'ll catch the conscience of the king.', character: 'Hamlet', play: 'Hamlet, Act 2 Scene 2', already_posted: true },
  { quote: 'Goodnight, sweet prince, and flights of angels sing thee to thy rest.', character: 'Horatio', play: 'Hamlet, Act 5 Scene 2', already_posted: true },
  { quote: 'My only love sprung from my only hate!', character: 'Juliet', play: 'Romeo and Juliet, Act 1 Scene 5', already_posted: true },
  { quote: 'Parting is such sweet sorrow.', character: 'Juliet', play: 'Romeo and Juliet, Act 2 Scene 2', already_posted: true },
  { quote: 'A plague o\' both your houses!', character: 'Mercutio', play: 'Romeo and Juliet, Act 3 Scene 1', already_posted: true },
  { quote: 'For never was a story of more woe than this of Juliet and her Romeo.', character: 'Prince', play: 'Romeo and Juliet, Act 5 Scene 3', already_posted: true },
  { quote: 'Now is the winter of our discontent made glorious summer by this sun of York.', character: 'Richard', play: 'Richard III, Act 1 Scene 1', already_posted: true },
  { quote: 'Once more unto the breach, dear friends, once more.', character: 'King Henry', play: 'Henry V, Act 3 Scene 1', already_posted: true },
  { quote: 'We few, we happy few, we band of brothers.', character: 'King Henry', play: 'Henry V, Act 4 Scene 3', already_posted: true },
  { quote: 'The quality of mercy is not strained. It droppeth as the gentle rain from heaven.', character: 'Portia', play: 'The Merchant of Venice, Act 4 Scene 1', already_posted: true },
  { quote: 'If you prick us, do we not bleed? If you tickle us, do we not laugh?', character: 'Shylock', play: 'The Merchant of Venice, Act 3 Scene 1', already_posted: true },
  { quote: 'All that glitters is not gold.', character: 'Prince of Morocco', play: 'The Merchant of Venice, Act 2 Scene 7', already_posted: true },
  { quote: 'Give every man thy ear, but few thy voice.', character: 'Polonius', play: 'Hamlet, Act 1 Scene 3', already_posted: true },
  { quote: 'Better three hours too soon than a minute too late.', character: 'Falstaff', play: 'The Merry Wives of Windsor, Act 2 Scene 2', already_posted: true },
  { quote: 'When sorrows come, they come not single spies, but in battalions.', character: 'Claudius', play: 'Hamlet, Act 4 Scene 5', already_posted: true },
  { quote: 'O, beware, my lord, of jealousy! It is the green-eyed monster which doth mock the meat it feeds on.', character: 'Iago', play: 'Othello, Act 3 Scene 3', already_posted: true },
  { quote: 'I am one who loved not wisely, but too well.', character: 'Othello', play: 'Othello, Act 5 Scene 2', already_posted: true },
  { quote: 'My salad days, when I was green in judgement, cold in blood.', character: 'Cleopatra', play: 'Antony and Cleopatra, Act 1 Scene 5', already_posted: true },
  { quote: 'Age cannot wither her, nor custom stale her infinite variety.', character: 'Enobarbus', play: 'Antony and Cleopatra, Act 2 Scene 2', already_posted: true },
  { quote: 'Uneasy lies the head that wears a crown.', character: 'King Henry', play: 'Henry IV, Part 2, Act 3 Scene 1', already_posted: true },
  { quote: 'The robbed that smiles steals something from the thief.', character: 'Duke', play: 'Othello, Act 1 Scene 3', already_posted: true },
  { quote: 'Love all, trust a few, do wrong to none.', character: 'Countess', play: 'All\'s Well That Ends Well, Act 1 Scene 1', already_posted: true },
  { quote: 'These violent delights have violent ends.', character: 'Friar Laurence', play: 'Romeo and Juliet, Act 2 Scene 6', already_posted: true },
  { quote: 'Beware the ides of March.', character: 'Soothsayer', play: 'Julius Caesar, Act 1 Scene 2', already_posted: true },

  // Fresh batch — these will be picked first by the scheduler.
  { quote: 'The better part of valour is discretion.', character: 'Falstaff', play: 'Henry IV, Part 1, Act 5 Scene 4' },
  { quote: 'I bear a charmed life.', character: 'Macbeth', play: 'Macbeth, Act 5 Scene 8' },
  { quote: 'Hoist with his own petard.', character: 'Hamlet', play: 'Hamlet, Act 3 Scene 4' },
  { quote: 'In a false quarrel there is no true valour.', character: 'Benedick', play: 'Much Ado About Nothing, Act 5 Scene 1' },
  { quote: 'Time and the hour run through the roughest day.', character: 'Macbeth', play: 'Macbeth, Act 1 Scene 3' },
  { quote: 'Men at some time are masters of their fates.', character: 'Cassius', play: 'Julius Caesar, Act 1 Scene 2' },
  { quote: 'There is a tide in the affairs of men, which, taken at the flood, leads on to fortune.', character: 'Brutus', play: 'Julius Caesar, Act 4 Scene 3' },
  { quote: 'Sweet are the uses of adversity.', character: 'Duke Senior', play: 'As You Like It, Act 2 Scene 1' },
  { quote: 'Can one desire too much of a good thing?', character: 'Rosalind', play: 'As You Like It, Act 4 Scene 1' },
  { quote: 'Nothing can come of nothing.', character: 'Lear', play: 'King Lear, Act 1 Scene 1' },
  { quote: 'Out of this nettle, danger, we pluck this flower, safety.', character: 'Hotspur', play: 'Henry IV, Part 1, Act 2 Scene 3' },
  { quote: 'I am not bound to please thee with my answers.', character: 'Shylock', play: 'The Merchant of Venice, Act 4 Scene 1' },
  { quote: 'Lawyers, I suppose, were children once.', character: 'Lamb', play: 'spurious — Charles Lamb, removing this' }, // will skip below
  { quote: 'O coward conscience, how dost thou afflict me!', character: 'Richard', play: 'Richard III, Act 5 Scene 3' },
  { quote: 'My words fly up, my thoughts remain below.', character: 'Claudius', play: 'Hamlet, Act 3 Scene 3' },
  { quote: 'There is nothing either good or bad, but thinking makes it so.', character: 'Hamlet', play: 'Hamlet, Act 2 Scene 2' },
  { quote: 'The undiscover\'d country, from whose bourn no traveller returns.', character: 'Hamlet', play: 'Hamlet, Act 3 Scene 1' },
  { quote: 'Conscience does make cowards of us all.', character: 'Hamlet', play: 'Hamlet, Act 3 Scene 1' },
  { quote: 'Get thee to a nunnery.', character: 'Hamlet', play: 'Hamlet, Act 3 Scene 1' },
  { quote: 'I must be cruel only to be kind.', character: 'Hamlet', play: 'Hamlet, Act 3 Scene 4' },
  { quote: 'Now cracks a noble heart. Good night, sweet prince.', character: 'Horatio', play: 'Hamlet, Act 5 Scene 2' },
  { quote: 'Some Cupid kills with arrows, some with traps.', character: 'Hero', play: 'Much Ado About Nothing, Act 3 Scene 1' },
  { quote: 'When I said I would die a bachelor, I did not think I should live till I were married.', character: 'Benedick', play: 'Much Ado About Nothing, Act 2 Scene 3' },
  { quote: 'I do love nothing in the world so well as you. Is not that strange?', character: 'Benedick', play: 'Much Ado About Nothing, Act 4 Scene 1' },
  { quote: 'The fool doth think he is wise, but the wise man knows himself to be a fool.', character: 'Touchstone', play: 'As You Like It, Act 5 Scene 1' },
  { quote: 'Be not afraid of greatness.', character: 'Malvolio', play: 'Twelfth Night, Act 2 Scene 5' },
  { quote: 'Misery acquaints a man with strange bedfellows.', character: 'Trinculo', play: 'The Tempest, Act 2 Scene 2' },
  { quote: 'What\'s done cannot be undone.', character: 'Lady Macbeth', play: 'Macbeth, Act 5 Scene 1' },
  { quote: 'I have no other but a woman\'s reason: I think him so because I think him so.', character: 'Lucetta', play: 'Two Gentlemen of Verona, Act 1 Scene 2' },
  { quote: 'How poor are they that have not patience! What wound did ever heal but by degrees?', character: 'Iago', play: 'Othello, Act 2 Scene 3' },
  { quote: 'Reputation is an idle and most false imposition; oft got without merit, and lost without deserving.', character: 'Iago', play: 'Othello, Act 2 Scene 3' },
  { quote: 'Speak low, if you speak love.', character: 'Don Pedro', play: 'Much Ado About Nothing, Act 2 Scene 1' },
  { quote: 'There was a star danced, and under that was I born.', character: 'Beatrice', play: 'Much Ado About Nothing, Act 2 Scene 1' },
  { quote: 'I had rather hear my dog bark at a crow than a man swear he loves me.', character: 'Beatrice', play: 'Much Ado About Nothing, Act 1 Scene 1' },
  { quote: 'How far that little candle throws his beams! So shines a good deed in a weary world.', character: 'Portia', play: 'The Merchant of Venice, Act 5 Scene 1' },
  { quote: 'The wheel is come full circle.', character: 'Edmund', play: 'King Lear, Act 5 Scene 3' },
];

async function main() {
  // Filter out the obviously-spurious row.
  const valid = QUOTES.filter((q) => !/spurious|attributed/i.test(q.play));

  let inserted = 0, skipped = 0;
  for (const q of valid) {
    const row = {
      quote: q.quote,
      character: q.character,
      play: q.play,
      last_posted_at: q.already_posted ? new Date().toISOString() : null,
    };
    const r = await fetch(`${SUPABASE_URL}/rest/v1/shakespeare_quotes`, {
      method: 'POST',
      headers: { ...HEADERS, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(row),
    });
    if (r.ok) inserted++;
    else {
      const t = await r.text();
      if (/duplicate|23505/i.test(t)) skipped++;
      else console.warn('  failed:', t.slice(0, 200));
    }
  }
  console.log(`Catalogue seeded: ${inserted} inserted, ${skipped} skipped (already in table).`);
}

main().catch((e) => { console.error(e); process.exit(1); });
