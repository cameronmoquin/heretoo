/**
 * Vocab — the platform lexicon.
 *
 * One place for the group noun and the post noun. The product calls a
 * group a "crew" and a post a "slip".
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
  group: 'crew',
  groupPlural: 'crews',
  Group: 'Crew',
  GroupPlural: 'Crews',
  member: 'member',
  memberPlural: 'members',
  groupWithArticle: 'a crew',
  post: 'slip',
  postPlural: 'slips',
  Post: 'Slip',
  PostPlural: 'Slips',
  postVerb: 'slip',
  postVerbPast: 'slipped',
} as const;

export type VocabKey = keyof typeof Vocab;
