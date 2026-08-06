/**
 * Vocab — the platform lexicon.
 *
 * One place for the group noun and the post noun. Plain speech: a group
 * is a "group" (Aug 2026 — "crew" retired as too themed, same fate as
 * "family"). A post is still a "drop"; one with a location is a "dead
 * drop" (the geocache game), so everything a person posts is a drop and
 * the physical ones are dead drops.
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
  post: 'drop',
  postPlural: 'drops',
  Post: 'Drop',
  PostPlural: 'Drops',
  postVerb: 'drop',
  postVerbPast: 'dropped',
} as const;

export type VocabKey = keyof typeof Vocab;
