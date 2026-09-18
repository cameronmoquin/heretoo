/**
 * Vocab — the platform lexicon.
 *
 * One place for the group noun and the post noun.
 *
 * A post is a SUBMISSION (Aug 2026 — Cameron: "Drop a submission
 * should be the canon, so it should change from Drops to
 * submissions"). "Drop" now survives in exactly ONE place: as the verb
 * in the composer's own heading — you drop a submission. Nothing else
 * in the app calls a post a drop any more.
 *
 * The GPS game is a GEOCACHE (Sept 2026). It was "Deaddrop", which
 * read as espionage; the game is a photo geocache and now says so.
 * That was also the last thing on the platform still called a drop.
 * If either word ever changes again, it changes here and nowhere else.
 * Screens import Vocab instead of typing the word into a string.
 *
 * SCOPE: display copy only. Text a person reads on screen.
 *
 * HARD RULE — the database still says "family", on purpose.
 * Tables (families, family_members, family_chats, family_chat_messages,
 * family_invites, family_rename_proposals, family_rename_votes,
 * family_wallpaper_votes), columns (family_id, family_name, family_score,
 * family_weight, family_stature, every family_* column), RPCs, RLS
 * policies, views, route paths, TypeScript types, hooks, props, and
 * variable names keep the old word forever. Renaming any of them breaks
 * the app. Vocab is a display layer over stable identifiers. Treat the
 * two as separate languages.
 *
 * HARD RULE — the database still says "post", on purpose.
 * Tables (posts, post_media, post_reactions, post_boosts,
 * post_subjects), columns (post_id, post_count, post_kind, every
 * post_* column), the Post type, PostCard, useFeed, useDeletePost,
 * the /feed/[postId] route, and every prop and variable keep the old
 * word forever. Same two languages. Only the strings move.
 */

export const Vocab = {
  // "Cohort" (Aug 2026). "Crew" read as themed and went the way of
  // "family"; plain "group" lasted an hour. Cohort carries the
  // are-you-intelligent-enough register without costuming anybody.
  group: 'cohort',
  groupPlural: 'cohorts',
  Group: 'Cohort',
  GroupPlural: 'Cohorts',
  member: 'member',
  memberPlural: 'members',
  groupWithArticle: 'a cohort',
  // "Submission" (Aug 2026). The thing you contribute is a submission;
  // "drop" survives as the VERB of contributing it — the canon phrase is
  // "Drop a submission" and the button says Submit.
  post: 'submission',
  postPlural: 'submissions',
  Post: 'Submission',
  PostPlural: 'Submissions',
  postVerb: 'submit',
  postVerbPast: 'submitted',
  // "Geocache" (Sept 2026). The key says `hunt` because that is what the
  // stable side is called — the /hunt routes, hunt_caches, useHunt — and
  // the value is what a person reads. Two languages, same rule as
  // family/cohort above.
  hunt: 'geocache',
  huntPlural: 'geocaches',
  Hunt: 'Geocache',
  HuntPlural: 'Geocaches',
} as const;

export type VocabKey = keyof typeof Vocab;
