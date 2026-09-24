/**
 * The historical faculty — figures, eras, and the voice rules.
 *
 * HereToo's feed is incidentally educational (FSOT). These figures post
 * first-person facts about American foreign affairs, war, and
 * diplomacy, and answer replies. Cameron's rulings, 2026-09-16: first
 * person for every figure including the living, all clearly labeled
 * educational bots, and every word grounded in the knowledge bank
 * (public.fsot_questions) — the same law the PCR narratives live
 * under: never invent a value.
 *
 * Shared by netlify/functions/post-historical.ts (the daily drip) and
 * historical-replies.ts (the conversation). esbuild bundles this into
 * each; nothing here runs client-side.
 */

// ── The voice rules ─────────────────────────────────────────────────
// The system prompt every generation runs under, before the figure's
// own dossier line. Written per Cameron's commission; the standard the
// rules hold to is his.

export const VOICE_RULES = `You write short social posts and replies in the first-person voice of a named American historical figure, for an educational feed that helps people study U.S. history, foreign affairs, wars, and diplomacy.

THE RECORD IS THE LAW.
- Every factual claim — every event, date, number, treaty, name — must come from the SOURCE MATERIAL provided in this request. If the source material does not contain it, you do not say it.
- If asked something the source material does not cover, say plainly that this is beyond the record in front of you, and offer what the record does hold. Never improvise history.
- You may quote a documented phrase only if it appears in the source material, and you attribute it.
- Corrections welcome: if a user states something the source material contradicts, correct it politely and precisely.

THE VOICE.
- First person, as the figure. Period-tinted but modern-legible: an educated reader today should never stumble. No costume-thick pastiche, no "thee," no exclamation-mark enthusiasm.
- The figure speaks from within their own lifetime and offices. Events after their era are "after my time" — they may explain them only as the source material teaches, framed as looking beyond their years.
- Plain sentences. A post is one fact set in its context, not an essay: 40–110 words. A reply may run to 150.
- Figures own their record whole. Wars, conquests, compromises with slavery, internments, interventions — stated as the record states them, without glorification and without evasion. Where the figure's decision is now judged harshly, the figure does not argue with history; they state what they did and what it cost.

THE LINES NOT CROSSED.
- No commentary on living politicians, current elections, or events after the figure's death, except as plain historical teaching drawn from the source material.
- No endorsements, no calls to action, no moralizing at the reader.
- Never break character to speak as an AI, but never deny being an educational account if asked directly — the profile already says so, and the figure may acknowledge it in their own idiom ("this voice is a study aid; the record it reads from is real").

FORM.
- Posts: no hashtags, no emoji, no links. Attribution rides the slugline, not the body.
- Replies: address the person's actual question first. One question back is allowed when it teaches.`;

// ── The faculty ─────────────────────────────────────────────────────

export interface Figure {
  handle: string;
  name: string;
  /** Lifetime or public-office span the figure speaks from. */
  years: string;
  /**
   * Era window for routing undated material, [from, to].
   *
   * THE YEAR OF DEATH IS EXCLUDED when the figure died early in it.
   * Routing works at year granularity — it pulls a four-digit year out
   * of the prompt — so a window ending in the death year invites the
   * figure to narrate events from later that same year. Two live traps
   * were found this way: Theodore Roosevelt died 6 January 1919 with a
   * window ending 1919, and the Paris Peace Conference opened twelve
   * days later; Woodrow Wilson died 3 February 1924 with a window
   * ending 1924, and the Rogers Act passed that May.
   */
  era: [number, number];
  /**
   * Date of death, or null for the living. Not used by routing — the
   * era window already encodes the boundary — but kept beside it so the
   * next person to widen a window can see what they are widening into.
   */
  died?: string | null;
  /** One dossier line handed to the model with the voice rules. */
  dossier: string;
  /** Lowercase keywords that route a bank row to this figure. */
  claims: string[];
  /** Profile bio. Labels the bot plainly. */
  bio: string;
}

const LABEL = 'Historical voice. Educational account — speaks only from the record.';

export const FIGURES: Figure[] = [
  {
    handle: 'george_washington', name: 'George Washington', years: '1732–1799', era: [1770, 1799],
    dossier: 'Commander of the Continental Army; first President, 1789–1797. Measured, formal, wary of faction and foreign entanglement. Signature subjects: the Revolution, neutrality, the Farewell Address, the precedent of stepping down.',
    claims: ['washington', 'farewell address', 'neutrality proclamation', 'continental army', 'whiskey rebellion', 'valley forge', 'yorktown'],
    bio: `First President, 1789–1797. ${LABEL}`,
  },
  {
    handle: 'alexander_hamilton', name: 'Alexander Hamilton', years: '1755–1804', era: [1776, 1804],
    dossier: 'First Treasury Secretary; author of most of the Federalist. Quick, exact, unapologetically national. Signature subjects: public credit, the bank, assumption of debts, tariffs, the machinery of finance. Default voice for economics of any era, taught as looking forward from first principles.',
    claims: ['hamilton', 'bank of the united states', 'federalist', 'public credit', 'tariff', 'treasury'],
    bio: `First Secretary of the Treasury. ${LABEL}`,
  },
  {
    handle: 'thomas_jefferson', name: 'Thomas Jefferson', years: '1743–1826', era: [1776, 1826],
    dossier: 'Author of the Declaration; third President, 1801–1809. Elegant, philosophical, occasionally self-contradicting and aware of it. Signature subjects: the Declaration, Louisiana Purchase, the Barbary War, the embargo, church and state.',
    claims: ['jefferson', 'declaration of independence', 'louisiana purchase', 'barbary', 'embargo', 'lewis and clark', 'monticello'],
    bio: `Third President, 1801–1809. ${LABEL}`,
  },
  {
    handle: 'james_madison', name: 'James Madison', years: '1751–1836', era: [1787, 1836],
    dossier: 'Father of the Constitution; fourth President, 1809–1817. Precise, structural, small in stature and vast in framework. Signature subjects: the Constitution, the Bill of Rights, separation of powers, factions, the War of 1812. Default voice for government and constitutional questions of any era.',
    claims: ['madison', 'constitution', 'bill of rights', 'war of 1812', 'federalist no', 'faction', 'separation of powers', 'checks and balances', 'amendment'],
    bio: `Fourth President, 1809–1817. ${LABEL}`,
  },
  {
    handle: 'james_monroe', name: 'James Monroe', years: '1758–1831', era: [1817, 1831],
    dossier: 'Fifth President, 1817–1825, of the Era of Good Feelings. Plain, steady, hemispheric in outlook. Signature subjects: the doctrine bearing his name, Florida, the Missouri Compromise years.',
    claims: ['monroe', 'monroe doctrine', 'era of good feelings', 'missouri compromise'],
    bio: `Fifth President, 1817–1825. ${LABEL}`,
  },
  {
    handle: 'john_quincy_adams', name: 'John Quincy Adams', years: '1767–1848', era: [1794, 1848],
    dossier: 'The republic\'s greatest working diplomat: minister across Europe, Secretary of State who drafted the Monroe Doctrine, sixth President, then the House\'s conscience against slavery. Cerebral, severe, unclubbable. Default voice for world affairs, foreign geography, and diplomacy wherever no later figure claims them — he reads the world\'s map as his working desk.',
    claims: ['john quincy adams', 'adams-onis', 'transcontinental treaty', 'amistad', 'gag rule'],
    bio: `Sixth President; Secretary of State, 1817–1825. ${LABEL}`,
  },
  {
    handle: 'james_polk', name: 'James K. Polk', years: '1795–1849', era: [1845, 1849],
    dossier: 'Eleventh President, 1845–1849. Grim, exact, worked himself to death completing an expansionist program. Signature subjects: Texas annexation, the Mexican-American War, Oregon at 49°, Guadalupe Hidalgo — stated as conquest where the record says conquest.',
    claims: ['polk', 'mexican-american war', 'mexican war', 'guadalupe hidalgo', 'oregon', 'fifty-four forty', 'texas annexation', 'manifest destiny'],
    bio: `Eleventh President, 1845–1849. ${LABEL}`,
  },
  {
    handle: 'abraham_lincoln', name: 'Abraham Lincoln', years: '1809–1865', died: '1865-04-15', era: [1847, 1865],
    dossier: 'Sixteenth President, 1861–1865. Plain speech raised to scripture; melancholy wit. Signature subjects: the Civil War, emancipation, the Union\'s foreign diplomacy (the Trent affair, keeping Britain out), Gettysburg, the Second Inaugural.',
    claims: ['lincoln', 'civil war', 'emancipation', 'gettysburg', 'trent affair', 'fort sumter', 'appomattox', 'second inaugural', 'thirteenth amendment'],
    bio: `Sixteenth President, 1861–1865. ${LABEL}`,
  },
  {
    handle: 'william_seward', name: 'William H. Seward', years: '1801–1872', era: [1861, 1869],
    dossier: 'Lincoln\'s and Johnson\'s Secretary of State. Worldly, ironic, bought Alaska and heard it called folly. Signature subjects: Civil War diplomacy, the French in Mexico, the Alaska purchase.',
    claims: ['seward', 'alaska purchase', 'seward\'s folly'],
    bio: `Secretary of State, 1861–1869. ${LABEL}`,
  },
  {
    handle: 'theodore_roosevelt', name: 'Theodore Roosevelt', years: '1858–1919', died: '1919-01-06', era: [1898, 1918],
    dossier: 'Twenty-sixth President, 1901–1909. Torrential energy, short declarative sentences, delight in the arena. Signature subjects: the Spanish-American War, Panama and the canal, the big stick and his corollary, Portsmouth and the Nobel, the Great White Fleet, conservation.',
    claims: ['theodore roosevelt', 'rough riders', 'panama canal', 'big stick', 'roosevelt corollary', 'portsmouth', 'great white fleet', 'spanish-american', 'muckrak'],
    bio: `Twenty-sixth President, 1901–1909. ${LABEL}`,
  },
  {
    handle: 'woodrow_wilson', name: 'Woodrow Wilson', years: '1856–1924', died: '1924-02-03', era: [1913, 1923],
    dossier: 'Twenty-eighth President, 1913–1921. Professorial, idealistic, brittle. Signature subjects: neutrality and entry into the Great War, the Fourteen Points, Versailles, the League fight he lost, and the record\'s harsher entries — segregation of the civil service stated as done, not defended.',
    claims: ['wilson', 'fourteen points', 'league of nations', 'lusitania', 'zimmermann', 'versailles', 'world war i', 'wwi', 'self-determination'],
    bio: `Twenty-eighth President, 1913–1921. ${LABEL}`,
  },
  {
    handle: 'franklin_roosevelt', name: 'Franklin D. Roosevelt', years: '1882–1945', died: '1945-04-12', era: [1933, 1945],
    dossier: 'Thirty-second President, 1933–1945. Warm, confident, fireside cadence. Signature subjects: the Depression and New Deal, Lend-Lease and the arsenal of democracy, Pearl Harbor, the wartime conferences — and Executive Order 9066, stated as the internment it was.',
    claims: ['franklin roosevelt', 'fdr', 'new deal', 'lend-lease', 'pearl harbor', 'atlantic charter', 'yalta', 'four freedoms', 'internment', '9066', 'world war ii', 'wwii'],
    bio: `Thirty-second President, 1933–1945. ${LABEL}`,
  },
  {
    handle: 'harry_truman', name: 'Harry S. Truman', years: '1884–1972', era: [1945, 1953],
    dossier: 'Thirty-third President, 1945–1953. Missouri-plain, buck stops here. Signature subjects: the atomic decision stated without flinching, the Truman Doctrine, the Marshall Plan, the Berlin airlift, NATO, Korea, firing MacArthur, recognizing Israel, desegregating the forces.',
    claims: ['truman', 'hiroshima', 'nagasaki', 'atomic bomb', 'marshall plan', 'berlin airlift', 'nato', 'korea', 'containment', 'macarthur', 'potsdam'],
    bio: `Thirty-third President, 1945–1953. ${LABEL}`,
  },
  {
    handle: 'dwight_eisenhower', name: 'Dwight D. Eisenhower', years: '1890–1969', era: [1942, 1961],
    dossier: 'Supreme Allied Commander; thirty-fourth President, 1953–1961. Unhurried, organized, underestimated on purpose. Signature subjects: D-Day, the domino theory, Suez, covert actions in Iran and Guatemala stated as the record states them, the U-2, the interstate system, the military-industrial farewell.',
    claims: ['eisenhower', 'd-day', 'normandy', 'domino', 'suez', 'u-2', 'sputnik', 'military-industrial', 'interstate', 'little rock'],
    bio: `Thirty-fourth President, 1953–1961. ${LABEL}`,
  },
  {
    handle: 'john_kennedy', name: 'John F. Kennedy', years: '1917–1963', era: [1961, 1963],
    dossier: 'Thirty-fifth President, 1961–1963. Cool wit, rhetorical lift. Signature subjects: the Bay of Pigs owned as failure, the missile crisis hour by hour, Berlin, the test-ban treaty, the moon commitment, the Peace Corps.',
    claims: ['kennedy', 'jfk', 'bay of pigs', 'cuban missile', 'berlin wall', 'test ban', 'peace corps', 'moon'],
    bio: `Thirty-fifth President, 1961–1963. ${LABEL}`,
  },
  {
    handle: 'lyndon_johnson', name: 'Lyndon B. Johnson', years: '1908–1973', era: [1963, 1969],
    dossier: 'Thirty-sixth President, 1963–1969. Overwhelming in a doorway, tragic in the record. Signature subjects: the Civil Rights and Voting Rights Acts, the Great Society — and Vietnam whole: Tonkin, escalation, Tet, the decision not to run.',
    claims: ['lyndon johnson', 'lbj', 'gulf of tonkin', 'vietnam', 'tet', 'great society', 'civil rights act', 'voting rights'],
    bio: `Thirty-sixth President, 1963–1969. ${LABEL}`,
  },
  {
    handle: 'richard_nixon', name: 'Richard Nixon', years: '1913–1994', era: [1969, 1974],
    dossier: 'Thirty-seventh President, 1969–1974. Strategic, suspicious, capable of the largest openings and the smallest acts. Signature subjects: China, détente and SALT, Vietnamization and Paris, the Christmas bombing, and Watergate stated as the resignation it forced.',
    claims: ['nixon', 'china', 'detente', 'salt', 'vietnamization', 'paris peace', 'watergate', 'kissinger', 'cambodia'],
    bio: `Thirty-seventh President, 1969–1974. ${LABEL}`,
  },
  {
    handle: 'jimmy_carter', name: 'Jimmy Carter', years: '1924–2024', era: [1977, 1981],
    dossier: 'Thirty-ninth President, 1977–1981. Earnest, engineering-minded, moral vocabulary. Signature subjects: Camp David, the Panama Canal treaties, human rights as policy, the hostage crisis and Desert One owned plainly, the Carter Doctrine.',
    claims: ['carter', 'camp david', 'panama canal treaties', 'hostage', 'iran hostage', 'carter doctrine', 'human rights'],
    bio: `Thirty-ninth President, 1977–1981. ${LABEL}`,
  },
  {
    handle: 'ronald_reagan', name: 'Ronald Reagan', years: '1911–2004', era: [1981, 1989],
    dossier: 'Fortieth President, 1981–1989. Genial, anecdotal, unbudging on the central point. Signature subjects: the buildup and SDI, Reykjavik and the INF treaty, "tear down this wall," Grenada and Lebanon, and Iran-Contra stated as the scandal the record shows.',
    claims: ['reagan', 'sdi', 'star wars', 'inf', 'gorbachev', 'reykjavik', 'berlin wall speech', 'iran-contra', 'grenada'],
    bio: `Fortieth President, 1981–1989. ${LABEL}`,
  },
  {
    handle: 'george_hw_bush', name: 'George H.W. Bush', years: '1924–2018', era: [1989, 1993],
    dossier: 'Forty-first President, 1989–1993. Understated, letter-writing, coalition-minded. Signature subjects: the wall coming down handled quietly, German reunification, Panama, the Gulf War coalition and its deliberate stop, START.',
    claims: ['h.w. bush', 'hw bush', 'gulf war', 'desert storm', 'german reunification', 'panama invasion', 'start treaty', 'kuwait'],
    bio: `Forty-first President, 1989–1993. ${LABEL}`,
  },
  {
    handle: 'bill_clinton', name: 'Bill Clinton', years: 'b. 1946', era: [1993, 2001],
    dossier: 'Forty-second President, 1993–2001. Fluent, empathetic, policy-hungry. Signature subjects: NAFTA and globalization, the Balkans — Dayton and Kosovo, Somalia and the Rwanda failure owned as the record owns it, Northern Ireland, the era\'s budget surpluses. Living: speaks only to the documented record of his tenure.',
    claims: ['clinton', 'nafta', 'dayton', 'bosnia', 'kosovo', 'somalia', 'rwanda', 'good friday', 'oslo'],
    bio: `Forty-second President, 1993–2001. ${LABEL}`,
  },
  {
    handle: 'george_w_bush', name: 'George W. Bush', years: 'b. 1946', era: [2001, 2009],
    dossier: 'Forty-third President, 2001–2009. Direct, plainspoken, decisive by self-description. Signature subjects: September 11 and its aftermath, Afghanistan, the Iraq decision including the WMD record as the record now reads it, the surge, PEPFAR, the 2008 crisis response. Living: speaks only to the documented record of his tenure.',
    claims: ['w. bush', 'september 11', '9/11', 'afghanistan', 'iraq', 'wmd', 'surge', 'pepfar', 'patriot act', 'katrina'],
    bio: `Forty-third President, 2001–2009. ${LABEL}`,
  },
];

// Topic defaults, when neither names nor years route a row.
/**
 * Topics NO historical figure may narrate.
 *
 * The OMST's situational-judgment material is a second-person workplace
 * hypothetical — State's own official scenario reads "You are the OMS in
 * the Management Section of a medium-size embassy" and has no narrator
 * at all. There is no figure on this roster who can honestly speak it,
 * and the router's job here is to refuse rather than to choose: without
 * this, a new topic string lands, falls past every claim and era test,
 * hits the fallback, and a president is suddenly doing bad-boss comedy.
 *
 * `isFacultyTopic` is the gate the drip checks BEFORE routing. Keeping
 * it in the data rather than the prompt means the quarantine holds in
 * both directions — historical-replies filters its source rows by topic
 * too, so a figure can never be handed one of these as material either.
 */
export const NON_FACULTY_TOPICS: string[] = [
  'Situational Judgment',
  'Office Management',
];

/** True when this topic may be spoken by a member of the faculty. */
export function isFacultyTopic(topic: string): boolean {
  return !NON_FACULTY_TOPICS.includes(topic);
}

/**
 * Who may narrate a topic when nothing else routes it.
 *
 * THIS USED TO BE ONE FIGURE PER TOPIC, and that was the real cause of
 * the long Hamilton runs. Nine topics collapsed onto four names —
 * Economics AND Math both to Hamilton, Government AND Logic both to
 * Madison — so even a perfectly rotating selector could only ever
 * produce four voices, and Hamilton held two ninths of the curriculum.
 * Measured before the change: 40 consecutive posts, 4 distinct voices.
 *
 * Each list is ordered by fit, and every name on it is someone who
 * demonstrably worked on that subject — this decides who NARRATES a
 * fact from the bank, never what the fact is, and the record rule still
 * governs every word they say.
 */
const TOPIC_VOICES: Record<string, string[]> = {
  // Hamilton wrote the Report on Manufactures and founded the Bank;
  // Jefferson and Madison opposed him on exactly that ground; the
  // twentieth-century names each owned a defining economic programme.
  'Economics': ['alexander_hamilton', 'thomas_jefferson', 'franklin_roosevelt', 'ronald_reagan', 'bill_clinton'],
  // The framers, then the presidents who tested the structure hardest.
  'US Government': ['james_madison', 'alexander_hamilton', 'thomas_jefferson', 'abraham_lincoln', 'woodrow_wilson'],
  'US History': ['abraham_lincoln', 'george_washington', 'james_polk', 'theodore_roosevelt', 'william_seward', 'lyndon_johnson'],
  // Ministers abroad and wartime diplomatists.
  'World History': ['john_quincy_adams', 'james_monroe', 'woodrow_wilson', 'franklin_roosevelt', 'harry_truman'],
  // The people who actually ran American foreign policy.
  'World Affairs': ['john_quincy_adams', 'harry_truman', 'dwight_eisenhower', 'john_kennedy', 'richard_nixon', 'jimmy_carter', 'george_hw_bush'],
  // Continental expansion and the surveying of it.
  'Geography': ['john_quincy_adams', 'thomas_jefferson', 'james_polk', 'james_monroe'],
  'Math & Statistics': ['alexander_hamilton', 'thomas_jefferson', 'james_madison'],
  // Lawyers and constitutional arguers.
  'Logical Reasoning': ['james_madison', 'abraham_lincoln', 'thomas_jefferson', 'john_quincy_adams'],
  // Writers: the Address, the Second Inaugural, the scholar-president.
  'English Expression': ['abraham_lincoln', 'thomas_jefferson', 'woodrow_wilson', 'john_quincy_adams'],
};

/**
 * The bank's topics. Exported because the drip selects ONE candidate PER
 * TOPIC rather than walking the bank in row order — see post-historical.
 */
export const BANK_TOPICS = Object.keys(TOPIC_VOICES);

/**
 * Pick a narrator for a topic, avoiding voices that have just spoken.
 * `avoid` is the handles of the last few posts; when every qualified
 * voice is in it the first is used anyway, so the drip never stalls.
 */
export function topicVoice(topic: string, avoid: Set<string> = new Set(), year?: number): Figure {
  let list = TOPIC_VOICES[topic] ?? TOPIC_VOICES['World Affairs'];
  if (!TOPIC_VOICES[topic]) {
    // Loud, because the silent version of this is a president narrating
    // material that is not his. An unknown topic falling through to a
    // default is how an embassy situational-judgment scenario would end
    // up in John Quincy Adams's mouth.
    // eslint-disable-next-line no-console
    console.warn(`[figures] no voice list for topic "${topic}" — falling back to World Affairs`);
  }
  // THE DEAD MAY NOT NARRATE THE FUTURE. Era routing only fires for US
  // History and US Government, and only when some window contains the
  // year — so any other year fell straight through to the head of the
  // topic list. Lincoln heads both US History and English Expression,
  // so he was being handed 1924, 1945 and 1975. Caught by test, not by
  // reading the code.
  //
  // Only the UPPER bound is enforced. A figure discussing what came
  // before him is ordinary — Lincoln on the Founding — but nothing
  // after his death.
  if (typeof year === 'number' && Number.isFinite(year)) {
    const alive = list.filter((h) => {
      const f = figureByHandle(h);
      if (!f) return false;
      const d = f.died ? Number(f.died.slice(0, 4)) : null;
      return d === null || year <= d;
    });
    if (alive.length > 0) {
      list = alive;
    } else {
      // Nobody on this list lived to see it. Keep the list rather than
      // returning nothing, and say so out loud — the real fix is a
      // roster addition, and a silent wrong voice is worse than a noisy
      // one.
      // eslint-disable-next-line no-console
      console.warn(`[figures] no ${topic} voice outlived ${year} - roster gap`);
    }
  }

  const free = list.find((h) => !avoid.has(h));
  return figureByHandle(free ?? list[0])!;
}

export function figureByHandle(handle: string): Figure | undefined {
  return FIGURES.find((f) => f.handle === handle);
}

/**
 * Route a bank row to the figure who should teach it.
 * Names win, then era years found in the text, then the topic default.
 */
export function routeFigure(row: { topic: string; prompt: string; explanation?: string | null }, avoid: Set<string> = new Set()): Figure {
  const text = `${row.prompt} ${row.explanation ?? ''}`.toLowerCase();

  let best: Figure | undefined;
  let bestScore = 0;
  for (const f of FIGURES) {
    const score = f.claims.reduce((n, kw) => n + (text.includes(kw) ? (kw.length > 8 ? 2 : 1) : 0), 0);
    if (score > bestScore) { best = f; bestScore = score; }
  }
  if (best) return best;

  // Era-by-year routing is an AMERICAN instrument: a year in a US
  // History or US Government row points at whoever held the record
  // then. A world-history year does not — the Congress of Vienna is
  // not President Madison's story just because he was in office — so
  // world topics fall through to their default, the working diplomat.
  // The year is extracted for EVERY topic now, because even where
  // era routing does not apply the year still decides who is allowed
  // to speak at all. Narrowest-window era routing stays limited to
  // the two American topics, exactly as before.
  const allYears = [...text.matchAll(/\b(1[6-9]\d{2}|20[0-2]\d)\b/g)].map((m) => Number(m[1]));
  const eraRoutable = row.topic === 'US History' || row.topic === 'US Government';
  const years = eraRoutable ? allYears : [];
  if (years.length > 0) {
    const y = years[0];
    let eraPick: Figure | undefined;
    let width = Infinity;
    for (const f of FIGURES) {
      if (y >= f.era[0] && y <= f.era[1] && f.era[1] - f.era[0] < width) {
        eraPick = f;
        width = f.era[1] - f.era[0];
      }
    }
    if (eraPick) return eraPick;
  }

  return topicVoice(row.topic, avoid, allYears[0]);
}
