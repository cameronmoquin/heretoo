#!/usr/bin/env node
/**
 * Populate the shakespeare_quotes catalogue table with a comprehensive
 * reservoir of canonical quotes from the full Shakespeare canon —
 * tragedies, comedies, histories, romances, sonnets.
 *
 * Idempotent — the (quote) UNIQUE constraint silently dedups re-runs.
 * Existing rows keep their `last_posted_at`; new rows go in with
 * `last_posted_at = null` so the scheduled drip picks them first.
 *
 * This script is the source of truth for the catalogue. To add more
 * quotes later, append to QUOTES[] and re-run.
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

// already_posted=true marks quotes that were dumped into the feed in the
// initial 50-shot run. They get last_posted_at=now() so the rotation
// picks fresh quotes first. Everything else starts at null = next-up.
const QUOTES = [
  // ── HAMLET ────────────────────────────────────────────────────────────
  { quote: 'To be, or not to be, that is the question.', character: 'Hamlet', play: 'Hamlet, Act 3 Scene 1', already_posted: true },
  { quote: 'There are more things in heaven and earth, Horatio, than are dreamt of in your philosophy.', character: 'Hamlet', play: 'Hamlet, Act 1 Scene 5', already_posted: true },
  { quote: 'This above all: to thine own self be true.', character: 'Polonius', play: 'Hamlet, Act 1 Scene 3', already_posted: true },
  { quote: 'Brevity is the soul of wit.', character: 'Polonius', play: 'Hamlet, Act 2 Scene 2', already_posted: true },
  { quote: 'Though this be madness, yet there is method in\'t.', character: 'Polonius', play: 'Hamlet, Act 2 Scene 2', already_posted: true },
  { quote: 'Frailty, thy name is woman!', character: 'Hamlet', play: 'Hamlet, Act 1 Scene 2', already_posted: true },
  { quote: 'The lady doth protest too much, methinks.', character: 'Gertrude', play: 'Hamlet, Act 3 Scene 2', already_posted: true },
  { quote: 'Something is rotten in the state of Denmark.', character: 'Marcellus', play: 'Hamlet, Act 1 Scene 4', already_posted: true },
  { quote: 'The play\'s the thing wherein I\'ll catch the conscience of the king.', character: 'Hamlet', play: 'Hamlet, Act 2 Scene 2', already_posted: true },
  { quote: 'Goodnight, sweet prince, and flights of angels sing thee to thy rest.', character: 'Horatio', play: 'Hamlet, Act 5 Scene 2', already_posted: true },
  { quote: 'When sorrows come, they come not single spies, but in battalions.', character: 'Claudius', play: 'Hamlet, Act 4 Scene 5', already_posted: true },
  { quote: 'Give every man thy ear, but few thy voice.', character: 'Polonius', play: 'Hamlet, Act 1 Scene 3', already_posted: true },
  { quote: 'Hoist with his own petard.', character: 'Hamlet', play: 'Hamlet, Act 3 Scene 4' },
  { quote: 'My words fly up, my thoughts remain below.', character: 'Claudius', play: 'Hamlet, Act 3 Scene 3' },
  { quote: 'There is nothing either good or bad, but thinking makes it so.', character: 'Hamlet', play: 'Hamlet, Act 2 Scene 2' },
  { quote: 'The undiscover\'d country, from whose bourn no traveller returns.', character: 'Hamlet', play: 'Hamlet, Act 3 Scene 1' },
  { quote: 'Conscience does make cowards of us all.', character: 'Hamlet', play: 'Hamlet, Act 3 Scene 1' },
  { quote: 'Get thee to a nunnery.', character: 'Hamlet', play: 'Hamlet, Act 3 Scene 1' },
  { quote: 'I must be cruel only to be kind.', character: 'Hamlet', play: 'Hamlet, Act 3 Scene 4' },
  { quote: 'Now cracks a noble heart. Good night, sweet prince.', character: 'Horatio', play: 'Hamlet, Act 5 Scene 2' },
  { quote: 'Alas, poor Yorick! I knew him, Horatio: a fellow of infinite jest.', character: 'Hamlet', play: 'Hamlet, Act 5 Scene 1' },
  { quote: 'The rest is silence.', character: 'Hamlet', play: 'Hamlet, Act 5 Scene 2' },
  { quote: 'Neither a borrower nor a lender be.', character: 'Polonius', play: 'Hamlet, Act 1 Scene 3' },
  { quote: 'There\'s a special providence in the fall of a sparrow.', character: 'Hamlet', play: 'Hamlet, Act 5 Scene 2' },
  { quote: 'O, what a noble mind is here o\'erthrown!', character: 'Ophelia', play: 'Hamlet, Act 3 Scene 1' },
  { quote: 'In my mind\'s eye, Horatio.', character: 'Hamlet', play: 'Hamlet, Act 1 Scene 2' },
  { quote: 'O, that this too too solid flesh would melt.', character: 'Hamlet', play: 'Hamlet, Act 1 Scene 2' },
  { quote: 'The time is out of joint. O cursed spite, that ever I was born to set it right!', character: 'Hamlet', play: 'Hamlet, Act 1 Scene 5' },
  { quote: 'How weary, stale, flat, and unprofitable seem to me all the uses of this world.', character: 'Hamlet', play: 'Hamlet, Act 1 Scene 2' },

  // ── MACBETH ───────────────────────────────────────────────────────────
  { quote: 'Tomorrow, and tomorrow, and tomorrow, creeps in this petty pace from day to day.', character: 'Macbeth', play: 'Macbeth, Act 5 Scene 5', already_posted: true },
  { quote: 'Out, damned spot! Out, I say!', character: 'Lady Macbeth', play: 'Macbeth, Act 5 Scene 1', already_posted: true },
  { quote: 'Double, double, toil and trouble; fire burn and cauldron bubble.', character: 'The Witches', play: 'Macbeth, Act 4 Scene 1', already_posted: true },
  { quote: 'Fair is foul, and foul is fair.', character: 'The Witches', play: 'Macbeth, Act 1 Scene 1', already_posted: true },
  { quote: 'I bear a charmed life.', character: 'Macbeth', play: 'Macbeth, Act 5 Scene 8' },
  { quote: 'Time and the hour run through the roughest day.', character: 'Macbeth', play: 'Macbeth, Act 1 Scene 3' },
  { quote: 'What\'s done cannot be undone.', character: 'Lady Macbeth', play: 'Macbeth, Act 5 Scene 1' },
  { quote: 'Life\'s but a walking shadow, a poor player that struts and frets his hour upon the stage.', character: 'Macbeth', play: 'Macbeth, Act 5 Scene 5' },
  { quote: 'It is a tale told by an idiot, full of sound and fury, signifying nothing.', character: 'Macbeth', play: 'Macbeth, Act 5 Scene 5' },
  { quote: 'By the pricking of my thumbs, something wicked this way comes.', character: 'Second Witch', play: 'Macbeth, Act 4 Scene 1' },
  { quote: 'Look like the innocent flower, but be the serpent under\'t.', character: 'Lady Macbeth', play: 'Macbeth, Act 1 Scene 5' },
  { quote: 'I dare do all that may become a man; who dares do more is none.', character: 'Macbeth', play: 'Macbeth, Act 1 Scene 7' },
  { quote: 'Stars, hide your fires; let not light see my black and deep desires.', character: 'Macbeth', play: 'Macbeth, Act 1 Scene 4' },
  { quote: 'Is this a dagger which I see before me, the handle toward my hand?', character: 'Macbeth', play: 'Macbeth, Act 2 Scene 1' },
  { quote: 'Sleep no more! Macbeth does murder sleep.', character: 'Macbeth', play: 'Macbeth, Act 2 Scene 2' },
  { quote: 'Will all great Neptune\'s ocean wash this blood clean from my hand?', character: 'Macbeth', play: 'Macbeth, Act 2 Scene 2' },
  { quote: 'Out, out, brief candle!', character: 'Macbeth', play: 'Macbeth, Act 5 Scene 5' },
  { quote: 'Lay on, Macduff, and damned be him that first cries, "Hold, enough!"', character: 'Macbeth', play: 'Macbeth, Act 5 Scene 8' },
  { quote: 'Yet do I fear thy nature; it is too full o\' the milk of human kindness.', character: 'Lady Macbeth', play: 'Macbeth, Act 1 Scene 5' },

  // ── KING LEAR ─────────────────────────────────────────────────────────
  { quote: 'Nothing will come of nothing.', character: 'Lear', play: 'King Lear, Act 1 Scene 1', already_posted: true },
  { quote: 'How sharper than a serpent\'s tooth it is to have a thankless child!', character: 'Lear', play: 'King Lear, Act 1 Scene 4', already_posted: true },
  { quote: 'I am a man more sinned against than sinning.', character: 'Lear', play: 'King Lear, Act 3 Scene 2', already_posted: true },
  { quote: 'The wheel is come full circle.', character: 'Edmund', play: 'King Lear, Act 5 Scene 3' },
  { quote: 'Blow, winds, and crack your cheeks! Rage, blow!', character: 'Lear', play: 'King Lear, Act 3 Scene 2' },
  { quote: 'As flies to wanton boys are we to the gods; they kill us for their sport.', character: 'Gloucester', play: 'King Lear, Act 4 Scene 1' },
  { quote: 'When we are born, we cry that we are come to this great stage of fools.', character: 'Lear', play: 'King Lear, Act 4 Scene 6' },
  { quote: 'O, that way madness lies; let me shun that.', character: 'Lear', play: 'King Lear, Act 3 Scene 4' },
  { quote: 'I am bound upon a wheel of fire, that mine own tears do scald like molten lead.', character: 'Lear', play: 'King Lear, Act 4 Scene 7' },
  { quote: 'Pray, do not mock me: I am a very foolish, fond old man.', character: 'Lear', play: 'King Lear, Act 4 Scene 7' },
  { quote: 'The weight of this sad time we must obey; speak what we feel, not what we ought to say.', character: 'Edgar', play: 'King Lear, Act 5 Scene 3' },

  // ── OTHELLO ───────────────────────────────────────────────────────────
  { quote: 'O, beware, my lord, of jealousy! It is the green-eyed monster which doth mock the meat it feeds on.', character: 'Iago', play: 'Othello, Act 3 Scene 3', already_posted: true },
  { quote: 'I am one who loved not wisely, but too well.', character: 'Othello', play: 'Othello, Act 5 Scene 2', already_posted: true },
  { quote: 'The robbed that smiles steals something from the thief.', character: 'Duke', play: 'Othello, Act 1 Scene 3', already_posted: true },
  { quote: 'How poor are they that have not patience! What wound did ever heal but by degrees?', character: 'Iago', play: 'Othello, Act 2 Scene 3' },
  { quote: 'Reputation is an idle and most false imposition; oft got without merit, and lost without deserving.', character: 'Iago', play: 'Othello, Act 2 Scene 3' },
  { quote: 'Put out the light, and then put out the light.', character: 'Othello', play: 'Othello, Act 5 Scene 2' },
  { quote: 'I will wear my heart upon my sleeve for daws to peck at.', character: 'Iago', play: 'Othello, Act 1 Scene 1' },
  { quote: 'But I will wear my heart upon my sleeve.', character: 'Iago', play: 'Othello, Act 1 Scene 1' },
  { quote: 'Demand me nothing: what you know, you know.', character: 'Iago', play: 'Othello, Act 5 Scene 2' },
  { quote: 'Good name in man and woman, dear my lord, is the immediate jewel of their souls.', character: 'Iago', play: 'Othello, Act 3 Scene 3' },

  // ── ROMEO & JULIET ────────────────────────────────────────────────────
  { quote: 'What\'s in a name? That which we call a rose by any other name would smell as sweet.', character: 'Juliet', play: 'Romeo and Juliet, Act 2 Scene 2', already_posted: true },
  { quote: 'But, soft! what light through yonder window breaks? It is the east, and Juliet is the sun.', character: 'Romeo', play: 'Romeo and Juliet, Act 2 Scene 2', already_posted: true },
  { quote: 'My only love sprung from my only hate!', character: 'Juliet', play: 'Romeo and Juliet, Act 1 Scene 5', already_posted: true },
  { quote: 'Parting is such sweet sorrow.', character: 'Juliet', play: 'Romeo and Juliet, Act 2 Scene 2', already_posted: true },
  { quote: 'A plague o\' both your houses!', character: 'Mercutio', play: 'Romeo and Juliet, Act 3 Scene 1', already_posted: true },
  { quote: 'For never was a story of more woe than this of Juliet and her Romeo.', character: 'Prince', play: 'Romeo and Juliet, Act 5 Scene 3', already_posted: true },
  { quote: 'These violent delights have violent ends.', character: 'Friar Laurence', play: 'Romeo and Juliet, Act 2 Scene 6', already_posted: true },
  { quote: 'Did my heart love till now? Forswear it, sight! For I ne\'er saw true beauty till this night.', character: 'Romeo', play: 'Romeo and Juliet, Act 1 Scene 5' },
  { quote: 'O Romeo, Romeo! wherefore art thou Romeo?', character: 'Juliet', play: 'Romeo and Juliet, Act 2 Scene 2' },
  { quote: 'Good night, good night! Parting is such sweet sorrow that I shall say good night till it be morrow.', character: 'Juliet', play: 'Romeo and Juliet, Act 2 Scene 2' },
  { quote: 'Tempt not a desperate man.', character: 'Romeo', play: 'Romeo and Juliet, Act 5 Scene 3' },
  { quote: 'Wisely and slow; they stumble that run fast.', character: 'Friar Laurence', play: 'Romeo and Juliet, Act 2 Scene 3' },
  { quote: 'Thus with a kiss I die.', character: 'Romeo', play: 'Romeo and Juliet, Act 5 Scene 3' },
  { quote: 'O happy dagger! This is thy sheath; there rust, and let me die.', character: 'Juliet', play: 'Romeo and Juliet, Act 5 Scene 3' },

  // ── JULIUS CAESAR ─────────────────────────────────────────────────────
  { quote: 'Cowards die many times before their deaths; the valiant never taste of death but once.', character: 'Caesar', play: 'Julius Caesar, Act 2 Scene 2', already_posted: true },
  { quote: 'Et tu, Brute? — Then fall, Caesar.', character: 'Caesar', play: 'Julius Caesar, Act 3 Scene 1', already_posted: true },
  { quote: 'Friends, Romans, countrymen, lend me your ears; I come to bury Caesar, not to praise him.', character: 'Mark Antony', play: 'Julius Caesar, Act 3 Scene 2', already_posted: true },
  { quote: 'The fault, dear Brutus, is not in our stars, but in ourselves.', character: 'Cassius', play: 'Julius Caesar, Act 1 Scene 2', already_posted: true },
  { quote: 'Beware the ides of March.', character: 'Soothsayer', play: 'Julius Caesar, Act 1 Scene 2', already_posted: true },
  { quote: 'Men at some time are masters of their fates.', character: 'Cassius', play: 'Julius Caesar, Act 1 Scene 2' },
  { quote: 'There is a tide in the affairs of men, which, taken at the flood, leads on to fortune.', character: 'Brutus', play: 'Julius Caesar, Act 4 Scene 3' },
  { quote: 'Cry "Havoc!" and let slip the dogs of war.', character: 'Mark Antony', play: 'Julius Caesar, Act 3 Scene 1' },
  { quote: 'This was the noblest Roman of them all.', character: 'Mark Antony', play: 'Julius Caesar, Act 5 Scene 5' },
  { quote: 'The evil that men do lives after them; the good is oft interred with their bones.', character: 'Mark Antony', play: 'Julius Caesar, Act 3 Scene 2' },

  // ── ANTONY & CLEOPATRA ────────────────────────────────────────────────
  { quote: 'My salad days, when I was green in judgement, cold in blood.', character: 'Cleopatra', play: 'Antony and Cleopatra, Act 1 Scene 5', already_posted: true },
  { quote: 'Age cannot wither her, nor custom stale her infinite variety.', character: 'Enobarbus', play: 'Antony and Cleopatra, Act 2 Scene 2', already_posted: true },
  { quote: 'I am dying, Egypt, dying.', character: 'Antony', play: 'Antony and Cleopatra, Act 4 Scene 15' },
  { quote: 'Give me my robe, put on my crown; I have immortal longings in me.', character: 'Cleopatra', play: 'Antony and Cleopatra, Act 5 Scene 2' },
  { quote: 'The barge she sat in, like a burnish\'d throne, burned on the water.', character: 'Enobarbus', play: 'Antony and Cleopatra, Act 2 Scene 2' },
  { quote: 'I have not kept my square, but that to come shall all be done by the rule.', character: 'Antony', play: 'Antony and Cleopatra, Act 2 Scene 3' },

  // ── THE TEMPEST ───────────────────────────────────────────────────────
  { quote: 'O brave new world, that has such people in\'t!', character: 'Miranda', play: 'The Tempest, Act 5 Scene 1', already_posted: true },
  { quote: 'We are such stuff as dreams are made on, and our little life is rounded with a sleep.', character: 'Prospero', play: 'The Tempest, Act 4 Scene 1', already_posted: true },
  { quote: 'Hell is empty and all the devils are here.', character: 'Ariel', play: 'The Tempest, Act 1 Scene 2', already_posted: true },
  { quote: 'Misery acquaints a man with strange bedfellows.', character: 'Trinculo', play: 'The Tempest, Act 2 Scene 2' },
  { quote: 'Full fathom five thy father lies; of his bones are coral made.', character: 'Ariel', play: 'The Tempest, Act 1 Scene 2' },
  { quote: 'What\'s past is prologue.', character: 'Antonio', play: 'The Tempest, Act 2 Scene 1' },
  { quote: 'Our revels now are ended.', character: 'Prospero', play: 'The Tempest, Act 4 Scene 1' },
  { quote: 'How beauteous mankind is! O brave new world!', character: 'Miranda', play: 'The Tempest, Act 5 Scene 1' },

  // ── A MIDSUMMER NIGHT\'S DREAM ─────────────────────────────────────────
  { quote: 'The course of true love never did run smooth.', character: 'Lysander', play: 'A Midsummer Night\'s Dream, Act 1 Scene 1', already_posted: true },
  { quote: 'Lord, what fools these mortals be!', character: 'Puck', play: 'A Midsummer Night\'s Dream, Act 3 Scene 2', already_posted: true },
  { quote: 'Though she be but little, she is fierce.', character: 'Helena', play: 'A Midsummer Night\'s Dream, Act 3 Scene 2' },
  { quote: 'Love looks not with the eyes, but with the mind.', character: 'Helena', play: 'A Midsummer Night\'s Dream, Act 1 Scene 1' },
  { quote: 'I have had a most rare vision.', character: 'Bottom', play: 'A Midsummer Night\'s Dream, Act 4 Scene 1' },
  { quote: 'If we shadows have offended, think but this, and all is mended.', character: 'Puck', play: 'A Midsummer Night\'s Dream, Act 5 Scene 1' },
  { quote: 'I\'ll put a girdle round about the earth in forty minutes.', character: 'Puck', play: 'A Midsummer Night\'s Dream, Act 2 Scene 1' },

  // ── TWELFTH NIGHT ─────────────────────────────────────────────────────
  { quote: 'If music be the food of love, play on.', character: 'Orsino', play: 'Twelfth Night, Act 1 Scene 1', already_posted: true },
  { quote: 'Some are born great, some achieve greatness, and some have greatness thrust upon them.', character: 'Malvolio', play: 'Twelfth Night, Act 2 Scene 5', already_posted: true },
  { quote: 'Be not afraid of greatness.', character: 'Malvolio', play: 'Twelfth Night, Act 2 Scene 5' },
  { quote: 'Better a witty fool than a foolish wit.', character: 'Feste', play: 'Twelfth Night, Act 1 Scene 5' },
  { quote: 'Many a good hanging prevents a bad marriage.', character: 'Feste', play: 'Twelfth Night, Act 1 Scene 5' },
  { quote: 'I was adored once too.', character: 'Sir Andrew', play: 'Twelfth Night, Act 2 Scene 3' },
  { quote: 'Journeys end in lovers meeting.', character: 'Feste', play: 'Twelfth Night, Act 2 Scene 3' },

  // ── AS YOU LIKE IT ────────────────────────────────────────────────────
  { quote: 'All the world\'s a stage, and all the men and women merely players.', character: 'Jaques', play: 'As You Like It, Act 2 Scene 7', already_posted: true },
  { quote: 'Sweet are the uses of adversity.', character: 'Duke Senior', play: 'As You Like It, Act 2 Scene 1' },
  { quote: 'Can one desire too much of a good thing?', character: 'Rosalind', play: 'As You Like It, Act 4 Scene 1' },
  { quote: 'The fool doth think he is wise, but the wise man knows himself to be a fool.', character: 'Touchstone', play: 'As You Like It, Act 5 Scene 1' },
  { quote: 'Do you not know I am a woman? When I think, I must speak.', character: 'Rosalind', play: 'As You Like It, Act 3 Scene 2' },
  { quote: 'I do desire we may be better strangers.', character: 'Orlando', play: 'As You Like It, Act 3 Scene 2' },
  { quote: 'And so, from hour to hour, we ripe and ripe, and then, from hour to hour, we rot and rot.', character: 'Jaques', play: 'As You Like It, Act 2 Scene 7' },

  // ── MUCH ADO ABOUT NOTHING ────────────────────────────────────────────
  { quote: 'In a false quarrel there is no true valour.', character: 'Benedick', play: 'Much Ado About Nothing, Act 5 Scene 1' },
  { quote: 'Speak low, if you speak love.', character: 'Don Pedro', play: 'Much Ado About Nothing, Act 2 Scene 1' },
  { quote: 'There was a star danced, and under that was I born.', character: 'Beatrice', play: 'Much Ado About Nothing, Act 2 Scene 1' },
  { quote: 'I had rather hear my dog bark at a crow than a man swear he loves me.', character: 'Beatrice', play: 'Much Ado About Nothing, Act 1 Scene 1' },
  { quote: 'When I said I would die a bachelor, I did not think I should live till I were married.', character: 'Benedick', play: 'Much Ado About Nothing, Act 2 Scene 3' },
  { quote: 'I do love nothing in the world so well as you. Is not that strange?', character: 'Benedick', play: 'Much Ado About Nothing, Act 4 Scene 1' },
  { quote: 'Sigh no more, ladies, sigh no more, men were deceivers ever.', character: 'Balthasar', play: 'Much Ado About Nothing, Act 2 Scene 3' },
  { quote: 'O, what men dare do! What men may do! What men daily do, not knowing what they do!', character: 'Claudio', play: 'Much Ado About Nothing, Act 4 Scene 1' },

  // ── THE MERCHANT OF VENICE ────────────────────────────────────────────
  { quote: 'The quality of mercy is not strained. It droppeth as the gentle rain from heaven.', character: 'Portia', play: 'The Merchant of Venice, Act 4 Scene 1', already_posted: true },
  { quote: 'If you prick us, do we not bleed? If you tickle us, do we not laugh?', character: 'Shylock', play: 'The Merchant of Venice, Act 3 Scene 1', already_posted: true },
  { quote: 'All that glitters is not gold.', character: 'Prince of Morocco', play: 'The Merchant of Venice, Act 2 Scene 7', already_posted: true },
  { quote: 'I am not bound to please thee with my answers.', character: 'Shylock', play: 'The Merchant of Venice, Act 4 Scene 1' },
  { quote: 'How far that little candle throws his beams! So shines a good deed in a weary world.', character: 'Portia', play: 'The Merchant of Venice, Act 5 Scene 1' },
  { quote: 'I am a Jew. Hath not a Jew eyes? Hath not a Jew hands, organs, dimensions, senses, affections, passions?', character: 'Shylock', play: 'The Merchant of Venice, Act 3 Scene 1' },
  { quote: 'The world is still deceived with ornament.', character: 'Bassanio', play: 'The Merchant of Venice, Act 3 Scene 2' },
  { quote: 'Love is blind, and lovers cannot see.', character: 'Jessica', play: 'The Merchant of Venice, Act 2 Scene 6' },

  // ── HENRY V, HENRY IV, RICHARD III ────────────────────────────────────
  { quote: 'A horse, a horse, my kingdom for a horse!', character: 'King Richard', play: 'Richard III, Act 5 Scene 4', already_posted: true },
  { quote: 'Now is the winter of our discontent made glorious summer by this sun of York.', character: 'Richard', play: 'Richard III, Act 1 Scene 1', already_posted: true },
  { quote: 'Once more unto the breach, dear friends, once more.', character: 'King Henry', play: 'Henry V, Act 3 Scene 1', already_posted: true },
  { quote: 'We few, we happy few, we band of brothers.', character: 'King Henry', play: 'Henry V, Act 4 Scene 3', already_posted: true },
  { quote: 'Uneasy lies the head that wears a crown.', character: 'King Henry', play: 'Henry IV, Part 2, Act 3 Scene 1', already_posted: true },
  { quote: 'O coward conscience, how dost thou afflict me!', character: 'Richard', play: 'Richard III, Act 5 Scene 3' },
  { quote: 'The better part of valour is discretion.', character: 'Falstaff', play: 'Henry IV, Part 1, Act 5 Scene 4' },
  { quote: 'Out of this nettle, danger, we pluck this flower, safety.', character: 'Hotspur', play: 'Henry IV, Part 1, Act 2 Scene 3' },
  { quote: 'Better three hours too soon than a minute too late.', character: 'Falstaff', play: 'The Merry Wives of Windsor, Act 2 Scene 2', already_posted: true },
  { quote: 'I am not only witty in myself, but the cause that wit is in other men.', character: 'Falstaff', play: 'Henry IV, Part 2, Act 1 Scene 2' },
  { quote: 'Banish plump Jack, and banish all the world.', character: 'Falstaff', play: 'Henry IV, Part 1, Act 2 Scene 4' },
  { quote: 'God for Harry, England, and Saint George!', character: 'King Henry', play: 'Henry V, Act 3 Scene 1' },
  { quote: 'He which hath no stomach to this fight, let him depart.', character: 'King Henry', play: 'Henry V, Act 4 Scene 3' },
  { quote: 'I am a man whom Fortune hath cruelly scratched.', character: 'Lavatch', play: 'All\'s Well That Ends Well, Act 5 Scene 2' },
  { quote: 'I have lived long enough: my way of life is fall\'n into the sere, the yellow leaf.', character: 'Macbeth', play: 'Macbeth, Act 5 Scene 3' },

  // ── COMEDY OF ERRORS, MERRY WIVES, TAMING OF THE SHREW ───────────────
  { quote: 'I was thinking with what manners I might safely be admitted.', character: 'Tranio', play: 'The Taming of the Shrew, Act 1 Scene 2' },
  { quote: 'There\'s small choice in rotten apples.', character: 'Hortensio', play: 'The Taming of the Shrew, Act 1 Scene 1' },
  { quote: 'The poorest service is repaid with thanks.', character: 'Helena', play: 'All\'s Well That Ends Well, Act 2 Scene 5' },
  { quote: 'A young man married is a man that\'s marred.', character: 'Parolles', play: 'All\'s Well That Ends Well, Act 2 Scene 3' },

  // ── ALL\'S WELL, MEASURE FOR MEASURE ───────────────────────────────────
  { quote: 'Love all, trust a few, do wrong to none.', character: 'Countess', play: 'All\'s Well That Ends Well, Act 1 Scene 1', already_posted: true },
  { quote: 'Some Cupid kills with arrows, some with traps.', character: 'Hero', play: 'Much Ado About Nothing, Act 3 Scene 1' },
  { quote: 'O, what may man within him hide, though angel on the outward side!', character: 'Duke Vincentio', play: 'Measure for Measure, Act 3 Scene 2' },
  { quote: 'Our doubts are traitors, and make us lose the good we oft might win, by fearing to attempt.', character: 'Lucio', play: 'Measure for Measure, Act 1 Scene 4' },
  { quote: 'The miserable have no other medicine but only hope.', character: 'Claudio', play: 'Measure for Measure, Act 3 Scene 1' },

  // ── CYMBELINE, WINTER\'S TALE ─────────────────────────────────────────
  { quote: 'Fear no more the heat o\' the sun, nor the furious winter\'s rages.', character: 'Guiderius & Arviragus', play: 'Cymbeline, Act 4 Scene 2' },
  { quote: 'Hark, hark! The lark at heaven\'s gate sings.', character: 'Cloten\'s Musician', play: 'Cymbeline, Act 2 Scene 3' },
  { quote: 'Exit, pursued by a bear.', character: 'Stage direction', play: 'The Winter\'s Tale, Act 3 Scene 3' },
  { quote: 'A sad tale\'s best for winter.', character: 'Mamillius', play: 'The Winter\'s Tale, Act 2 Scene 1' },
  { quote: 'I am a feather for each wind that blows.', character: 'Leontes', play: 'The Winter\'s Tale, Act 2 Scene 3' },

  // ── TWO GENTLEMEN, LOVE\'S LABOUR\'S LOST ──────────────────────────────
  { quote: 'I have no other but a woman\'s reason: I think him so because I think him so.', character: 'Lucetta', play: 'Two Gentlemen of Verona, Act 1 Scene 2' },
  { quote: 'Love is a familiar; love is a devil: there is no evil angel but love.', character: 'Speed', play: 'Two Gentlemen of Verona, Act 2 Scene 1' },
  { quote: 'Light seeking light doth light of light beguile.', character: 'Berowne', play: 'Love\'s Labour\'s Lost, Act 1 Scene 1' },

  // ── TROILUS, CORIOLANUS, TIMON ────────────────────────────────────────
  { quote: 'One touch of nature makes the whole world kin.', character: 'Ulysses', play: 'Troilus and Cressida, Act 3 Scene 3' },
  { quote: 'Action is eloquence.', character: 'Volumnia', play: 'Coriolanus, Act 3 Scene 2' },
  { quote: 'Nothing can seem foul to those that win.', character: 'King Henry', play: 'Henry IV, Part 1, Act 5 Scene 1' },
  { quote: 'I had rather be a kitten and cry mew than one of these same metre balladmongers.', character: 'Hotspur', play: 'Henry IV, Part 1, Act 3 Scene 1' },

  // ── SONNETS ───────────────────────────────────────────────────────────
  { quote: 'Shall I compare thee to a summer\'s day? Thou art more lovely and more temperate.', character: 'Sonnet 18', play: 'Sonnets' },
  { quote: 'Let me not to the marriage of true minds admit impediments.', character: 'Sonnet 116', play: 'Sonnets' },
  { quote: 'Love is not love which alters when it alteration finds.', character: 'Sonnet 116', play: 'Sonnets' },
  { quote: 'Love\'s not Time\'s fool, though rosy lips and cheeks within his bending sickle\'s compass come.', character: 'Sonnet 116', play: 'Sonnets' },
  { quote: 'When in disgrace with fortune and men\'s eyes, I all alone beweep my outcast state.', character: 'Sonnet 29', play: 'Sonnets' },
  { quote: 'Haply I think on thee, and then my state, like to the lark at break of day arising, sings hymns at heaven\'s gate.', character: 'Sonnet 29', play: 'Sonnets' },
  { quote: 'Tired with all these, for restful death I cry.', character: 'Sonnet 66', play: 'Sonnets' },
  { quote: 'When to the sessions of sweet silent thought I summon up remembrance of things past.', character: 'Sonnet 30', play: 'Sonnets' },
  { quote: 'My mistress\' eyes are nothing like the sun.', character: 'Sonnet 130', play: 'Sonnets' },
  { quote: 'And yet, by heaven, I think my love as rare as any she belied with false compare.', character: 'Sonnet 130', play: 'Sonnets' },
  { quote: 'That time of year thou mayst in me behold when yellow leaves, or none, or few, do hang.', character: 'Sonnet 73', play: 'Sonnets' },
  { quote: 'Th\' expense of spirit in a waste of shame is lust in action.', character: 'Sonnet 129', play: 'Sonnets' },
  { quote: 'Not marble, nor the gilded monuments of princes, shall outlive this powerful rhyme.', character: 'Sonnet 55', play: 'Sonnets' },
  { quote: 'But thy eternal summer shall not fade, nor lose possession of that fair thou ow\'st.', character: 'Sonnet 18', play: 'Sonnets' },
];

async function main() {
  // Filter out anything that ever got tagged spurious / attributed.
  const valid = QUOTES.filter((q) => !/spurious|attributed/i.test(q.play));

  let inserted = 0, skipped = 0, failed = 0;
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
      else { failed++; console.warn('  failed:', t.slice(0, 200)); }
    }
  }
  console.log(`Catalogue seeded: ${inserted} inserted/upserted, ${skipped} skipped, ${failed} failed.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
