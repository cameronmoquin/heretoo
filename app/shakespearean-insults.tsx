/**
 * /shakespearean-insults
 *
 * The insults room is retired. The forge — tier, meter, ending, strict,
 * Strike / Summon / Cascade — was a workbench for a thing that only ever
 * needed one gesture, and the gesture already exists: every drop carries
 * "fire a Shakespeare line at this", which is the thumbs-down. The engine
 * (lib/insultEngine.ts) is untouched and still drives it through
 * lib/lineReactions.ts.
 *
 * This route stays so old links and bookmarks land somewhere correct.
 */

import { Redirect } from 'expo-router';

export default function ShakespeareanInsultsScreen() {
  return <Redirect href="/feed" />;
}
