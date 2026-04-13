/**
 * Seed content — Wayward Birds Productions characters.
 * heretoo.social
 */

import type { Profile } from '../stores/authStore';
import type { Post } from '../stores/feedStore';
import type { PulseTopic, PulseStatement } from '../stores/pulseStore';
import type { BridgeSession, BridgeMessage, BridgePrompt } from '../hooks/useBridge';

// ── Current user ──

export const MOCK_USER: Profile = {
  id: 'user-001',
  username: 'cameron',
  display_name: 'Cameron',
  avatar_url: null,
  birth_year: 1992,
  location_region: 'Massachusetts',
  origin_story: 'Building things that bring people together.',
  trust_score: 0.45,
  cluster_id: 1,
  cluster_confidence: 0.62,
  is_verified: false,
  is_human_verified: true,
  is_suspended: false,
  suspension_reason: null,
  bot_score: 0,
  invite_count: 3,
  invited_by: null,
  phone_verified: false,
  behavioral_verified: true,
  pulse_votes_count: 12,
  created_at: '2026-04-01T00:00:00Z',
  updated_at: '2026-04-13T00:00:00Z',
};

// ── Characters ──

const AUTHORS: Record<string, Post['author'] & { bio: string; age: number; location: string }> = {
  coldpack:          { username: 'coldpack',          display_name: 'Sandy Corvo',        avatar_url: null, cluster_id: 1, bio: 'Catering. Providence. Fifteen years in kitchens nobody photographed.', age: 44, location: 'Providence, RI' },
  longbox:           { username: 'longbox',           display_name: 'Vega',                avatar_url: null, cluster_id: 3, bio: 'Homicide. Cold cases on my own time. Still working one from 2009.', age: 51, location: 'Providence, RI' },
  walttwo:           { username: 'walttwo',           display_name: 'Walt Brennan',        avatar_url: null, cluster_id: 2, bio: 'Licensed therapist. I listen for a living. Some things I heard I still carry.', age: 48, location: 'Providence, RI' },
  ninerooms:         { username: 'ninerooms',         display_name: 'Nina Calloway',       avatar_url: null, cluster_id: 4, bio: 'Art consultant. Providence. I know what things are worth and what they are not.', age: 38, location: 'Providence, RI' },
  drystacker:        { username: 'drystacker',        display_name: 'Mark Dolan',          avatar_url: null, cluster_id: 1, bio: 'Construction. Federal Hill twenty years. I pull walls that were done wrong and start over.', age: 41, location: 'Providence, RI' },
  clearlyright:      { username: 'clearlyright',      display_name: 'Pat Reilly',          avatar_url: null, cluster_id: 5, bio: 'Risk management. Former city auditor. I make cases. Mostly correct ones.', age: 45, location: 'Providence, RI' },
  sevenpetalslena:   { username: 'sevenpetalslena',   display_name: 'Lena Park',           avatar_url: null, cluster_id: 2, bio: 'Runs Seven Petals Wellness on Westminster. Ten years. Still here.', age: 39, location: 'Providence, RI' },
  thirdfloor:        { username: 'thirdfloor',        display_name: 'Mike Walden',         avatar_url: null, cluster_id: 1, bio: 'Providence Fire. Cardiac EMT. Federal Hill kid. I know how systems fail.', age: 38, location: 'Providence, RI' },
  purpleshell:       { username: 'purpleshell',       display_name: 'Allen Hazard',        avatar_url: null, cluster_id: 3, bio: 'Wampum maker. Charlestown. My granddaughter picks the shells. I show her what they mean.', age: 62, location: 'Charlestown, RI' },
  greycoat:          { username: 'greycoat',          display_name: "Charles d'Eon",       avatar_url: null, cluster_id: 4, bio: 'Soldier. Diplomat. The last life is the one I chose. The others were practice.', age: 47, location: 'London, England' },
  thirdparty:        { username: 'thirdparty',        display_name: 'Pierre Beaumarchais', avatar_url: null, cluster_id: 4, bio: 'Playwright. Watchmaker. The best conversation is the one no one wrote down.', age: 43, location: 'Paris, France' },
  wrongcertain:      { username: 'wrongcertain',      display_name: 'Samuel Goudsmit',     avatar_url: null, cluster_id: 5, bio: 'Physicist. I spent three years certain about something that was not true. I am a better scientist for it.', age: 52, location: 'Ann Arbor, MI' },
  fixedloose:        { username: 'fixedloose',        display_name: 'Boris Pash',          avatar_url: null, cluster_id: 5, bio: 'Army intelligence. The objective stays fixed. The method stays loose. Thirty years of that.', age: 55, location: 'Washington, DC' },
  ocracokeborn:      { username: 'ocracokeborn',      display_name: 'Mary Ormond',         avatar_url: null, cluster_id: 3, bio: 'Outer Banks. I have been called many things. Most of them by men who did not stay long enough to be right.', age: 34, location: 'Ocracoke, NC' },
  freemanfirstmate:  { username: 'freemanfirstmate',  display_name: 'Caesar',              avatar_url: null, cluster_id: 5, bio: 'Free man. First mate. I chose this ship knowing exactly what it was.', age: 31, location: 'At sea' },
  notmyalpacas:      { username: 'notmyalpacas',      display_name: 'Dillon Marsh',        avatar_url: null, cluster_id: 2, bio: 'Event coordinator. Atlantic Consulting. Getting through December one catastrophe at a time.', age: 29, location: 'Newport, RI' },
  mosssword:         { username: 'mosssword',         display_name: 'Jude',                avatar_url: null, cluster_id: 4, bio: 'Adventurer. Raccoon wrangler. Mosspunkia forever.', age: 12, location: 'Mosspunkia' },
  softworldsprove:   { username: 'softworldsprove',   display_name: 'Fardo Mowkwin',       avatar_url: null, cluster_id: 3, bio: 'I was right about everything. The soft world proved it. I did not enjoy being right.', age: 0, location: 'The Deep Forest' },
};

function author(username: string): Post['author'] {
  const a = AUTHORS[username];
  return { username: a.username, display_name: a.display_name, avatar_url: null, cluster_id: a.cluster_id };
}

// ── Posts ──

export const MOCK_POSTS: Post[] = [
  // 1
  { id: 'post-001', author_id: 'thirdfloor', content: 'Pulled a man out of a Federal Hill triple-decker at 3am Tuesday. He was in his nineties. Every photograph he had ever owned was laid out on the kitchen table in rows. I do not know why. Some things you do not ask about at 3am.', media_type: 'none', photo_urls: null, mux_playback_id: null, mux_thumbnail_url: null, video_duration_seconds: null, bridging_score: 0.88, total_engagements: 214, cluster_reach: 5, cross_cluster_ratio: 0.81, topic_tags: ['Community', 'First Responders'], is_position: false, position_claim: null, position_steelman: null, position_common_ground: null, created_at: '2026-04-13T09:00:00Z', author: author('thirdfloor'), user_engagements: ['agree'] },
  // 2
  { id: 'post-002', author_id: 'purpleshell', content: 'My granddaughter found a shell this morning and held it out to me. Papa look, wampum. She does not know yet what she is holding. Three hundred years of something. I did not explain it. She already had the important part.', media_type: 'none', photo_urls: null, mux_playback_id: null, mux_thumbnail_url: null, video_duration_seconds: null, bridging_score: 0.94, total_engagements: 312, cluster_reach: 6, cross_cluster_ratio: 0.87, topic_tags: ['Culture & Heritage', 'Family'], is_position: false, position_claim: null, position_steelman: null, position_common_ground: null, created_at: '2026-04-13T08:30:00Z', author: author('purpleshell'), user_engagements: ['agree', 'bridge'] },
  // 3
  { id: 'post-003', author_id: 'coldpack', content: 'The difference between a good knife and a great knife is whether it does exactly what you ask of it. No more. No less. Most things worth having are like this.', media_type: 'none', photo_urls: null, mux_playback_id: null, mux_thumbnail_url: null, video_duration_seconds: null, bridging_score: 0.79, total_engagements: 148, cluster_reach: 5, cross_cluster_ratio: 0.73, topic_tags: ['Food & Cooking', 'Craft'], is_position: false, position_claim: null, position_steelman: null, position_common_ground: null, created_at: '2026-04-13T08:00:00Z', author: author('coldpack'), user_engagements: [] },
  // 4
  { id: 'post-004', author_id: 'longbox', content: 'Cold case. Fourteen years. A woman nobody filed a report for because nobody thought to. We found her today. I drove home the long way. Took about forty minutes longer than it needed to.', media_type: 'none', photo_urls: null, mux_playback_id: null, mux_thumbnail_url: null, video_duration_seconds: null, bridging_score: 0.85, total_engagements: 267, cluster_reach: 5, cross_cluster_ratio: 0.78, topic_tags: ['Justice', 'Community'], is_position: false, position_claim: null, position_steelman: null, position_common_ground: null, created_at: '2026-04-13T07:15:00Z', author: author('longbox'), user_engagements: ['important'] },
  // 5
  { id: 'post-005', author_id: 'greycoat', content: 'I have been asked a thousand times who I truly am. The question assumes one answer. I find it is mostly asked by people who have never had to choose.', media_type: 'none', photo_urls: null, mux_playback_id: null, mux_thumbnail_url: null, video_duration_seconds: null, bridging_score: 0.82, total_engagements: 198, cluster_reach: 5, cross_cluster_ratio: 0.76, topic_tags: ['Identity', 'Philosophy'], is_position: false, position_claim: null, position_steelman: null, position_common_ground: null, created_at: '2026-04-13T06:45:00Z', author: author('greycoat'), user_engagements: [] },
  // 6
  { id: 'post-006', author_id: 'wrongcertain', content: 'I spent three years certain the Germans had built a bomb. I was wrong. Being that completely wrong taught me more about science than being right ever had. I recommend it to no one and it changed everything.', media_type: 'none', photo_urls: null, mux_playback_id: null, mux_thumbnail_url: null, video_duration_seconds: null, bridging_score: 0.91, total_engagements: 289, cluster_reach: 6, cross_cluster_ratio: 0.84, topic_tags: ['Science', 'History'], is_position: false, position_claim: null, position_steelman: null, position_common_ground: null, created_at: '2026-04-13T06:00:00Z', author: author('wrongcertain'), user_engagements: ['agree'] },
  // 7
  { id: 'post-007', author_id: 'ocracokeborn', content: 'They call the Outer Banks the graveyard of the Atlantic. They mean the ships. I think about what those men were sailing toward. Not away from. Toward.', media_type: 'none', photo_urls: null, mux_playback_id: null, mux_thumbnail_url: null, video_duration_seconds: null, bridging_score: 0.77, total_engagements: 156, cluster_reach: 4, cross_cluster_ratio: 0.69, topic_tags: ['History', 'Sea'], is_position: false, position_claim: null, position_steelman: null, position_common_ground: null, created_at: '2026-04-13T05:30:00Z', author: author('ocracokeborn'), user_engagements: [] },
  // 8
  { id: 'post-008', author_id: 'walttwo', content: 'A patient told me he fired people the way other men change tires. Practical. Necessary. No drama. I wrote it down. Not the content. The phrasing. That phrasing told me everything about what the next three years would look like.', media_type: 'none', photo_urls: null, mux_playback_id: null, mux_thumbnail_url: null, video_duration_seconds: null, bridging_score: 0.86, total_engagements: 234, cluster_reach: 5, cross_cluster_ratio: 0.79, topic_tags: ['Work & Career', 'Psychology'], is_position: false, position_claim: null, position_steelman: null, position_common_ground: null, created_at: '2026-04-13T05:00:00Z', author: author('walttwo'), user_engagements: ['important'] },
  // 9
  { id: 'post-009', author_id: 'ninerooms', content: 'The Mondrian Fake has been at Seven Petals for eleven years. The story of what it is turned out to be worth more than what it was. Most things in this city work that way if you look long enough.', media_type: 'none', photo_urls: null, mux_playback_id: null, mux_thumbnail_url: null, video_duration_seconds: null, bridging_score: 0.73, total_engagements: 167, cluster_reach: 4, cross_cluster_ratio: 0.66, topic_tags: ['Art', 'Local Community'], is_position: false, position_claim: null, position_steelman: null, position_common_ground: null, created_at: '2026-04-13T04:30:00Z', author: author('ninerooms'), user_engagements: [] },
  // 10
  { id: 'post-010', author_id: 'clearlyright', content: 'I have made the correct decision in every professional situation I have encountered. I am starting to think about what I have missed by being right so consistently. I do not have an answer yet. This is unusual for me.', media_type: 'none', photo_urls: null, mux_playback_id: null, mux_thumbnail_url: null, video_duration_seconds: null, bridging_score: 0.81, total_engagements: 203, cluster_reach: 5, cross_cluster_ratio: 0.74, topic_tags: ['Work & Career', 'Self-Reflection'], is_position: false, position_claim: null, position_steelman: null, position_common_ground: null, created_at: '2026-04-13T04:00:00Z', author: author('clearlyright'), user_engagements: [] },
  // 11
  { id: 'post-011', author_id: 'drystacker', content: 'Pulled a forty-year-old dry stack retaining wall on Atwells today. Previous contractor used the wrong stone. Took the whole thing down and started over. Some things you cannot patch. That is not pessimism. That is walls.', media_type: 'none', photo_urls: null, mux_playback_id: null, mux_thumbnail_url: null, video_duration_seconds: null, bridging_score: 0.76, total_engagements: 142, cluster_reach: 4, cross_cluster_ratio: 0.68, topic_tags: ['Craft', 'Local Community'], is_position: false, position_claim: null, position_steelman: null, position_common_ground: null, created_at: '2026-04-13T03:30:00Z', author: author('drystacker'), user_engagements: ['agree'] },
  // 12
  { id: 'post-012', author_id: 'fixedloose', content: 'Intelligence work requires two things most people cannot hold at the same time. The objective stays fixed. The method stays completely loose. Men who get that backwards do not last long and usually take someone with them.', media_type: 'none', photo_urls: null, mux_playback_id: null, mux_thumbnail_url: null, video_duration_seconds: null, bridging_score: 0.83, total_engagements: 178, cluster_reach: 5, cross_cluster_ratio: 0.75, topic_tags: ['History', 'Leadership'], is_position: false, position_claim: null, position_steelman: null, position_common_ground: null, created_at: '2026-04-13T03:00:00Z', author: author('fixedloose'), user_engagements: [] },
  // 13
  { id: 'post-013', author_id: 'thirdparty', content: 'I have written plays, built watches, negotiated state secrets, and funded a revolution across two continents. The critics say my best work is The Marriage of Figaro. They are wrong. My best work is the conversation nobody recorded.', media_type: 'none', photo_urls: null, mux_playback_id: null, mux_thumbnail_url: null, video_duration_seconds: null, bridging_score: 0.80, total_engagements: 191, cluster_reach: 5, cross_cluster_ratio: 0.72, topic_tags: ['Arts & Culture', 'History'], is_position: false, position_claim: null, position_steelman: null, position_common_ground: null, created_at: '2026-04-13T02:30:00Z', author: author('thirdparty'), user_engagements: [] },
  // 14
  { id: 'post-014', author_id: 'notmyalpacas', content: 'Status update on the company Christmas gala. The venue confirmed the alpacas. I want to be precise: I did not suggest the alpacas. I said we needed something memorable and then stopped talking and that was the mistake.', media_type: 'none', photo_urls: null, mux_playback_id: null, mux_thumbnail_url: null, video_duration_seconds: null, bridging_score: 0.92, total_engagements: 342, cluster_reach: 6, cross_cluster_ratio: 0.88, topic_tags: ['Work & Career', 'Humor'], is_position: false, position_claim: null, position_steelman: null, position_common_ground: null, created_at: '2026-04-13T02:00:00Z', author: author('notmyalpacas'), user_engagements: ['agree'] },
  // 15
  { id: 'post-015', author_id: 'sevenpetalslena', content: 'Someone asked why a wellness center needs a substantial security system. I said because something valuable is here. They assumed I meant money. I meant the people who come back every Tuesday at noon regardless of what happened that week.', media_type: 'none', photo_urls: null, mux_playback_id: null, mux_thumbnail_url: null, video_duration_seconds: null, bridging_score: 0.87, total_engagements: 223, cluster_reach: 5, cross_cluster_ratio: 0.80, topic_tags: ['Community', 'Health & Wellness'], is_position: false, position_claim: null, position_steelman: null, position_common_ground: null, created_at: '2026-04-13T01:30:00Z', author: author('sevenpetalslena'), user_engagements: [] },
  // 16
  { id: 'post-016', author_id: 'mosssword', content: 'Pip stole three things from the market today. A brass gear, a piece of dried fish, and something glowing I cannot identify. He is extremely pleased with himself. I have questions about all three items. He will not answer them.', media_type: 'none', photo_urls: null, mux_playback_id: null, mux_thumbnail_url: null, video_duration_seconds: null, bridging_score: 0.89, total_engagements: 276, cluster_reach: 5, cross_cluster_ratio: 0.82, topic_tags: ['Adventure', 'Humor'], is_position: false, position_claim: null, position_steelman: null, position_common_ground: null, created_at: '2026-04-13T01:00:00Z', author: author('mosssword'), user_engagements: ['agree'] },
  // 17
  { id: 'post-017', author_id: 'freemanfirstmate', content: 'A free man on a pirate ship is still a man who chose his ship. I chose this one. That choice is the whole thing. People keep asking what I mean by that. I mean exactly that.', media_type: 'none', photo_urls: null, mux_playback_id: null, mux_thumbnail_url: null, video_duration_seconds: null, bridging_score: 0.84, total_engagements: 198, cluster_reach: 5, cross_cluster_ratio: 0.77, topic_tags: ['Freedom', 'Identity'], is_position: false, position_claim: null, position_steelman: null, position_common_ground: null, created_at: '2026-04-13T00:30:00Z', author: author('freemanfirstmate'), user_engagements: [] },
  // 18
  { id: 'post-018', author_id: 'softworldsprove', content: 'They call it protecting beauty. What they protect is comfort. Beauty that cannot defend itself is decoration. I stopped being interested in decoration a long time ago and I do not apologize for what followed.', media_type: 'none', photo_urls: null, mux_playback_id: null, mux_thumbnail_url: null, video_duration_seconds: null, bridging_score: 0.71, total_engagements: 134, cluster_reach: 4, cross_cluster_ratio: 0.63, topic_tags: ['Philosophy'], is_position: false, position_claim: null, position_steelman: null, position_common_ground: null, created_at: '2026-04-12T23:30:00Z', author: author('softworldsprove'), user_engagements: [] },
  // 19
  { id: 'post-019', author_id: 'thirdfloor', content: 'The press release used the word contained four times. The room went quiet when someone read it aloud. I had a bag packed. Not for this specifically. For the general shape of this that I had been watching come for three years. I left before the second paragraph.', media_type: 'none', photo_urls: null, mux_playback_id: null, mux_thumbnail_url: null, video_duration_seconds: null, bridging_score: 0.83, total_engagements: 189, cluster_reach: 5, cross_cluster_ratio: 0.76, topic_tags: ['Preparedness', 'Community'], is_position: false, position_claim: null, position_steelman: null, position_common_ground: null, created_at: '2026-04-12T23:00:00Z', author: author('thirdfloor'), user_engagements: [] },
  // 20
  { id: 'post-020', author_id: 'purpleshell', content: 'Wampum was never money. It was a record. Evidence that something happened between two people and both of them agreed it mattered. The colonists turned it into currency. That conversion is its own kind of history and not a flattering one.', media_type: 'none', photo_urls: null, mux_playback_id: null, mux_thumbnail_url: null, video_duration_seconds: null, bridging_score: 0.90, total_engagements: 256, cluster_reach: 6, cross_cluster_ratio: 0.85, topic_tags: ['History', 'Culture & Heritage'], is_position: false, position_claim: null, position_steelman: null, position_common_ground: null, created_at: '2026-04-12T22:30:00Z', author: author('purpleshell'), user_engagements: ['agree', 'important'] },
  // 21
  { id: 'post-021', author_id: 'wrongcertain', content: 'Werner Heisenberg was my guest at Michigan in 1939. We had dinner. We talked about physics. Six years later I was in his office in Hechingen looking for evidence of a bomb he never built. His photograph of the two of us was still on the wall. I had to explain it to a general. I did not enjoy the conversation.', media_type: 'none', photo_urls: null, mux_playback_id: null, mux_thumbnail_url: null, video_duration_seconds: null, bridging_score: 0.88, total_engagements: 278, cluster_reach: 5, cross_cluster_ratio: 0.81, topic_tags: ['History', 'Science'], is_position: false, position_claim: null, position_steelman: null, position_common_ground: null, created_at: '2026-04-12T22:00:00Z', author: author('wrongcertain'), user_engagements: [] },
  // 22
  { id: 'post-022', author_id: 'greycoat', content: 'The court required me to dress as a woman for the final decade of my diplomatic service. I want to be precise about what that meant. It meant I was still working. The dress was their condition. The work was mine. Those are different things.', media_type: 'none', photo_urls: null, mux_playback_id: null, mux_thumbnail_url: null, video_duration_seconds: null, bridging_score: 0.86, total_engagements: 212, cluster_reach: 5, cross_cluster_ratio: 0.79, topic_tags: ['Identity', 'History'], is_position: false, position_claim: null, position_steelman: null, position_common_ground: null, created_at: '2026-04-12T21:30:00Z', author: author('greycoat'), user_engagements: [] },
  // 23
  { id: 'post-023', author_id: 'longbox', content: 'Consistency is an argument. It says: this was intentional. I did not arrive here accidentally. This is craft. A copycat does something almost the same. The real thing does it exactly the same. That is how you tell them apart after fourteen years.', media_type: 'none', photo_urls: null, mux_playback_id: null, mux_thumbnail_url: null, video_duration_seconds: null, bridging_score: 0.78, total_engagements: 167, cluster_reach: 4, cross_cluster_ratio: 0.70, topic_tags: ['Justice', 'Craft'], is_position: false, position_claim: null, position_steelman: null, position_common_ground: null, created_at: '2026-04-12T21:00:00Z', author: author('longbox'), user_engagements: ['agree'] },
  // 24
  { id: 'post-024', author_id: 'coldpack', content: 'I cooked for fifteen years before anyone knew my name. Then someone knew my name in a way I had not planned for. Now I am careful about who I cook for and I do not explain that carefulness to anyone.', media_type: 'none', photo_urls: null, mux_playback_id: null, mux_thumbnail_url: null, video_duration_seconds: null, bridging_score: 0.74, total_engagements: 145, cluster_reach: 4, cross_cluster_ratio: 0.67, topic_tags: ['Food & Cooking', 'Identity'], is_position: false, position_claim: null, position_steelman: null, position_common_ground: null, created_at: '2026-04-12T20:30:00Z', author: author('coldpack'), user_engagements: [] },
  // 25
  { id: 'post-025', author_id: 'ocracokeborn', content: 'Blackbeard did not inspire fear. He designed it. Piece by piece. A man who inspires fear has it by accident. A man who designs it is doing something deliberate and considered and worth understanding on its own terms.', media_type: 'none', photo_urls: null, mux_playback_id: null, mux_thumbnail_url: null, video_duration_seconds: null, bridging_score: 0.80, total_engagements: 187, cluster_reach: 5, cross_cluster_ratio: 0.73, topic_tags: ['History', 'Leadership'], is_position: false, position_claim: null, position_steelman: null, position_common_ground: null, created_at: '2026-04-12T20:00:00Z', author: author('ocracokeborn'), user_engagements: [] },
  // 26
  { id: 'post-026', author_id: 'clearlyright', content: 'Dellacroix was with the firm twenty-two years. The decision was indicated by the data. I stand by it. I also think about whether he was the type to land somewhere. I do not know if that thinking makes me better. I know it makes me slower. I am undecided on the value of that.', media_type: 'none', photo_urls: null, mux_playback_id: null, mux_thumbnail_url: null, video_duration_seconds: null, bridging_score: 0.82, total_engagements: 176, cluster_reach: 5, cross_cluster_ratio: 0.75, topic_tags: ['Work & Career', 'Self-Reflection'], is_position: false, position_claim: null, position_steelman: null, position_common_ground: null, created_at: '2026-04-12T19:30:00Z', author: author('clearlyright'), user_engagements: [] },
  // 27
  { id: 'post-027', author_id: 'walttwo', content: 'The therapeutic relationship requires one party to withhold judgment long enough for something more accurate to arrive. Fifteen years of that. I am not sure whether it has made me better at judgment or only slower to use it. Both feel like the right answer on different days.', media_type: 'none', photo_urls: null, mux_playback_id: null, mux_thumbnail_url: null, video_duration_seconds: null, bridging_score: 0.85, total_engagements: 198, cluster_reach: 5, cross_cluster_ratio: 0.78, topic_tags: ['Psychology', 'Self-Reflection'], is_position: false, position_claim: null, position_steelman: null, position_common_ground: null, created_at: '2026-04-12T19:00:00Z', author: author('walttwo'), user_engagements: [] },
  // 28
  { id: 'post-028', author_id: 'notmyalpacas', content: 'There is a rumor that this event is in some way connected to a Fyre Festival situation from Newport several years ago. I was not involved in that. I need that on record. The alpacas are the extent of my unconventional choices and I was pressured into the alpacas.', media_type: 'none', photo_urls: null, mux_playback_id: null, mux_thumbnail_url: null, video_duration_seconds: null, bridging_score: 0.93, total_engagements: 367, cluster_reach: 6, cross_cluster_ratio: 0.89, topic_tags: ['Work & Career', 'Humor'], is_position: false, position_claim: null, position_steelman: null, position_common_ground: null, created_at: '2026-04-12T18:30:00Z', author: author('notmyalpacas'), user_engagements: ['agree'] },
  // 29
  { id: 'post-029', author_id: 'mosssword', content: 'The Village Elder said Fardo was not always bitter. That it matters more than it seems. I keep turning it over. Not everyone who ends up wrong started out wrong. That is the part that makes him harder to fight and also more worth fighting.', media_type: 'none', photo_urls: null, mux_playback_id: null, mux_thumbnail_url: null, video_duration_seconds: null, bridging_score: 0.84, total_engagements: 189, cluster_reach: 5, cross_cluster_ratio: 0.77, topic_tags: ['Philosophy', 'Adventure'], is_position: false, position_claim: null, position_steelman: null, position_common_ground: null, created_at: '2026-04-12T18:00:00Z', author: author('mosssword'), user_engagements: [] },
  // 30
  { id: 'post-030', author_id: 'sevenpetalslena', content: 'Ten years ago I had a yoga studio. Now I have a community. The difference took me seven years to understand. Three more to accept. I am still working on what comes next.', media_type: 'none', photo_urls: null, mux_playback_id: null, mux_thumbnail_url: null, video_duration_seconds: null, bridging_score: 0.86, total_engagements: 201, cluster_reach: 5, cross_cluster_ratio: 0.79, topic_tags: ['Community', 'Health & Wellness'], is_position: false, position_claim: null, position_steelman: null, position_common_ground: null, created_at: '2026-04-12T17:30:00Z', author: author('sevenpetalslena'), user_engagements: ['agree'] },
  // 31
  { id: 'post-031', author_id: 'freemanfirstmate', content: 'A ship is a system. Every man on it is part of the system. When it fails it fails because someone decided their piece did not matter. I have never decided my piece did not matter. Not once.', media_type: 'none', photo_urls: null, mux_playback_id: null, mux_thumbnail_url: null, video_duration_seconds: null, bridging_score: 0.81, total_engagements: 176, cluster_reach: 5, cross_cluster_ratio: 0.74, topic_tags: ['Leadership', 'Sea'], is_position: false, position_claim: null, position_steelman: null, position_common_ground: null, created_at: '2026-04-12T17:00:00Z', author: author('freemanfirstmate'), user_engagements: [] },
  // 32
  { id: 'post-032', author_id: 'thirdparty', content: 'A negotiation has two visible parties and one invisible one. The invisible party is the agreement both sides need to be able to live with afterward. Find that party first. Everything else is theater. Good theater sometimes. But theater.', media_type: 'none', photo_urls: null, mux_playback_id: null, mux_thumbnail_url: null, video_duration_seconds: null, bridging_score: 0.87, total_engagements: 214, cluster_reach: 5, cross_cluster_ratio: 0.80, topic_tags: ['Philosophy', 'Diplomacy'], is_position: false, position_claim: null, position_steelman: null, position_common_ground: null, created_at: '2026-04-12T16:30:00Z', author: author('thirdparty'), user_engagements: [] },
  // 33
  { id: 'post-033', author_id: 'fixedloose', content: 'Goudsmit wanted to talk to every scientist we found. I wanted to move. We were both right. The mission worked because we were never fully in agreement and we never stopped moving. That combination is rarer than it sounds.', media_type: 'none', photo_urls: null, mux_playback_id: null, mux_thumbnail_url: null, video_duration_seconds: null, bridging_score: 0.89, total_engagements: 234, cluster_reach: 5, cross_cluster_ratio: 0.83, topic_tags: ['History', 'Leadership'], is_position: false, position_claim: null, position_steelman: null, position_common_ground: null, created_at: '2026-04-12T16:00:00Z', author: author('fixedloose'), user_engagements: ['bridge'] },
  // 34
  { id: 'post-034', author_id: 'softworldsprove', content: 'Mosspunkia built its walls from wonder. I respect that. Wonder is real and it builds things. But wonder that cannot account for what is outside the walls is not a foundation. It is a ceiling.', media_type: 'none', photo_urls: null, mux_playback_id: null, mux_thumbnail_url: null, video_duration_seconds: null, bridging_score: 0.72, total_engagements: 128, cluster_reach: 4, cross_cluster_ratio: 0.65, topic_tags: ['Philosophy'], is_position: false, position_claim: null, position_steelman: null, position_common_ground: null, created_at: '2026-04-12T15:30:00Z', author: author('softworldsprove'), user_engagements: [] },
  // 35
  { id: 'post-035', author_id: 'thirdfloor', content: 'A building fire is a governance collapse in miniature. Command breaks down. Information stops moving. People make decisions with bad data and no time. The ones who come out are the ones who read the room instead of the manual. The manual is for the situation someone anticipated. The room is the actual situation.', media_type: 'none', photo_urls: null, mux_playback_id: null, mux_thumbnail_url: null, video_duration_seconds: null, bridging_score: 0.90, total_engagements: 267, cluster_reach: 6, cross_cluster_ratio: 0.85, topic_tags: ['First Responders', 'Leadership'], is_position: false, position_claim: null, position_steelman: null, position_common_ground: null, created_at: '2026-04-12T15:00:00Z', author: author('thirdfloor'), user_engagements: ['agree', 'important'] },
  // 36
  { id: 'post-036', author_id: 'purpleshell', content: 'The Narragansett were here before the colony. We are here after whatever comes next. People forget the first part. They are beginning to understand the second. I have time.', media_type: 'none', photo_urls: null, mux_playback_id: null, mux_thumbnail_url: null, video_duration_seconds: null, bridging_score: 0.91, total_engagements: 298, cluster_reach: 6, cross_cluster_ratio: 0.86, topic_tags: ['Culture & Heritage', 'Community'], is_position: false, position_claim: null, position_steelman: null, position_common_ground: null, created_at: '2026-04-12T14:30:00Z', author: author('purpleshell'), user_engagements: ['bridge'] },
];

// ── Comments ──

type MockComment = { id: string; post_id: string; author_id: string; parent_id: string | null; content: string; created_at: string; author?: { username: string; display_name: string | null; avatar_url: string | null }; replies?: MockComment[] };

const FLAT_COMMENTS: MockComment[] = [
  { id: 'c01', post_id: 'post-001', author_id: 'purpleshell', parent_id: null, content: 'Federal Hill triple-deckers. Those buildings were built to outlast everything else on the block. Whoever designed them was planning for something.', created_at: '2026-04-13T09:30:00Z', author: author('purpleshell') },
  { id: 'c02', post_id: 'post-001', author_id: 'longbox', parent_id: 'c01', content: 'The photographs in rows. That is what I keep coming back to. Not the fire. The photographs. A man that age, that hour, that arrangement. Some scenes explain themselves if you stand still long enough.', created_at: '2026-04-13T10:00:00Z', author: author('longbox') },
  { id: 'c03', post_id: 'post-002', author_id: 'thirdfloor', parent_id: null, content: 'I think about my son holding something and not knowing what it means yet. You described that exactly right.', created_at: '2026-04-13T09:00:00Z', author: author('thirdfloor') },
  { id: 'c04', post_id: 'post-002', author_id: 'mosssword', parent_id: 'c03', content: 'Mosspunkia has something like that. An object everyone carries the meaning of without knowing the whole story. It protects us whether we understand it or not.', created_at: '2026-04-13T09:30:00Z', author: author('mosssword') },
  { id: 'c05', post_id: 'post-005', author_id: 'wrongcertain', parent_id: null, content: 'I asked this about myself for thirty years in a different context. Arrived at the same place. One answer is not the honest position. That unsatisfies people. I think it is correct anyway.', created_at: '2026-04-13T07:30:00Z', author: author('wrongcertain') },
  { id: 'c06', post_id: 'post-005', author_id: 'freemanfirstmate', parent_id: 'c05', content: 'On the ship a man is what he does. Not what he was before or what he says he is now. I found that clarifying. Other men found it threatening. Those men usually had something to protect that was not on the ship.', created_at: '2026-04-13T08:00:00Z', author: author('freemanfirstmate') },
  { id: 'c07', post_id: 'post-006', author_id: 'greycoat', parent_id: null, content: 'Being wrong with integrity is still a form of rigor. You took the evidence seriously. The evidence was insufficient. Those are different failures and only one of them is yours.', created_at: '2026-04-13T06:30:00Z', author: author('greycoat') },
  { id: 'c08', post_id: 'post-006', author_id: 'fixedloose', parent_id: 'c07', content: 'Three years of being certain and wrong is still three years of doing the work. The alternative was assuming everything was fine. That assumption gets men killed.', created_at: '2026-04-13T07:00:00Z', author: author('fixedloose') },
  { id: 'c09', post_id: 'post-009', author_id: 'clearlyright', parent_id: null, content: 'The story outlasting the object. I have been sitting with that since yesterday. I think it applies to more things than art and I am not comfortable with all of them.', created_at: '2026-04-13T05:00:00Z', author: author('clearlyright') },
  { id: 'c10', post_id: 'post-009', author_id: 'ninerooms', parent_id: 'c09', content: 'That is the point, yes.', created_at: '2026-04-13T05:30:00Z', author: author('ninerooms') },
  { id: 'c11', post_id: 'post-012', author_id: 'wrongcertain', parent_id: null, content: 'The objective fixed. The method loose. I watched Pash operate for eighteen months. He never confused those two. I confused them constantly. We complemented each other in ways neither of us planned.', created_at: '2026-04-13T03:30:00Z', author: author('wrongcertain') },
  { id: 'c12', post_id: 'post-017', author_id: 'thirdfloor', parent_id: null, content: 'A free man who chose. That sentence is doing a lot of work. Most people read right past it.', created_at: '2026-04-13T01:00:00Z', author: author('thirdfloor') },
  { id: 'c13', post_id: 'post-017', author_id: 'ocracokeborn', parent_id: 'c12', content: 'He chose it while I was watching. That is the part that does not make the story.', created_at: '2026-04-13T01:30:00Z', author: author('ocracokeborn') },
  { id: 'c14', post_id: 'post-019', author_id: 'purpleshell', parent_id: null, content: 'Contained. My grandfather used that word about the reservation boundary. Same word. Same function. Different century.', created_at: '2026-04-12T23:30:00Z', author: author('purpleshell') },
  { id: 'c15', post_id: 'post-019', author_id: 'longbox', parent_id: 'c14', content: 'The word contained in a press release is not accidental. Someone chose it four times deliberately. The choice tells you what they were managing and what they were not.', created_at: '2026-04-13T00:00:00Z', author: author('longbox') },
  { id: 'c16', post_id: 'post-029', author_id: 'mosssword', parent_id: null, content: 'He was not always wrong either. That is the part I keep coming back to.', created_at: '2026-04-12T18:30:00Z', author: author('mosssword') },
  { id: 'c17', post_id: 'post-029', author_id: 'softworldsprove', parent_id: 'c16', content: 'I appreciate the precision. Most people skip that part.', created_at: '2026-04-12T19:00:00Z', author: author('softworldsprove') },
  { id: 'c18', post_id: 'post-035', author_id: 'purpleshell', parent_id: null, content: 'Every house fire in Charlestown I have seen started with something someone believed was contained.', created_at: '2026-04-12T15:30:00Z', author: author('purpleshell') },
  { id: 'c19', post_id: 'post-035', author_id: 'thirdfloor', parent_id: 'c18', content: 'That word. Yes. Contained until it is not. There is no middle stage. It either is or it has already stopped being.', created_at: '2026-04-12T16:00:00Z', author: author('thirdfloor') },
];

// Build nested comment map by post
export function getCommentsForPost(postId: string): MockComment[] {
  const postComments = FLAT_COMMENTS.filter((c) => c.post_id === postId);
  const topLevel = postComments.filter((c) => !c.parent_id);
  const replyMap = new Map<string, MockComment[]>();
  for (const c of postComments.filter((c) => c.parent_id)) {
    const existing = replyMap.get(c.parent_id!) ?? [];
    existing.push(c);
    replyMap.set(c.parent_id!, existing);
  }
  return topLevel.map((c) => ({ ...c, replies: replyMap.get(c.id) ?? [] }));
}

// ── Pulse Topics ──

export const MOCK_TOPICS: PulseTopic[] = [
  { id: 'topic-001', title: 'What does it mean to do your job well?', description: 'Not your title. Not your salary. The standard you actually hold yourself to.', category: 'Work & Career', is_active: true, created_at: '2026-04-12T00:00:00Z', expires_at: null, voter_count: 1847, statement_count: 5 },
  { id: 'topic-002', title: 'What do we owe the people who came before us?', description: 'Heritage, debt, example, or something else entirely.', category: 'Culture & Heritage', is_active: true, created_at: '2026-04-11T00:00:00Z', expires_at: null, voter_count: 2134, statement_count: 3 },
  { id: 'topic-003', title: 'Is consistency a virtue or a limitation?', description: 'When does staying the same protect something real. When does it prevent something necessary.', category: 'Philosophy', is_active: true, created_at: '2026-04-10T00:00:00Z', expires_at: null, voter_count: 1562, statement_count: 3 },
  { id: 'topic-004', title: 'What makes a community worth protecting?', description: 'Not a neighborhood. A community. What is the difference and when do you know you have one.', category: 'Community', is_active: true, created_at: '2026-04-09T00:00:00Z', expires_at: null, voter_count: 2891, statement_count: 4 },
  { id: 'topic-005', title: 'What does being free actually require?', description: 'Not freedom from something. Freedom for something. What is the for.', category: 'Philosophy', is_active: true, created_at: '2026-04-08T00:00:00Z', expires_at: null, voter_count: 1976, statement_count: 2 },
  { id: 'topic-006', title: 'What do you do when you find out you were wrong?', description: 'Not a small wrong. A years-long, fully committed, certain wrong.', category: 'Self-Reflection', is_active: true, created_at: '2026-04-07T00:00:00Z', expires_at: null, voter_count: 2345, statement_count: 3 },
];

// ── Pulse Statements ──

export const MOCK_STATEMENTS: Record<string, PulseStatement[]> = {
  'topic-001': [
    { id: 'ps-01', topic_id: 'topic-001', text: 'You read the room instead of the manual. The manual is for the situation someone anticipated. The room is the actual situation.', submitted_by: 'thirdfloor', agree_count: 567, disagree_count: 89, pass_count: 34, bridging_score: 0.86, created_at: '2026-04-12T01:00:00Z' },
    { id: 'ps-02', topic_id: 'topic-001', text: 'You stay with it after everyone else has moved on. That is the whole definition. Everything else is a detail.', submitted_by: 'longbox', agree_count: 489, disagree_count: 67, pass_count: 45, bridging_score: 0.88, created_at: '2026-04-12T02:00:00Z' },
    { id: 'ps-03', topic_id: 'topic-001', text: 'The thing does exactly what you tell it to do. No more, no less. If it does more you did not design it. If it does less you have not finished.', submitted_by: 'coldpack', agree_count: 412, disagree_count: 56, pass_count: 23, bridging_score: 0.84, created_at: '2026-04-12T03:00:00Z' },
    { id: 'ps-04', topic_id: 'topic-001', text: 'You hold the judgment long enough for something more accurate to arrive. Most people do not budget enough time for that.', submitted_by: 'walttwo', agree_count: 378, disagree_count: 45, pass_count: 67, bridging_score: 0.87, created_at: '2026-04-12T04:00:00Z' },
    { id: 'ps-05', topic_id: 'topic-001', text: 'You find the invisible party before the visible ones do. The agreement both sides need. Name it before they name it and you own the room.', submitted_by: 'thirdparty', agree_count: 345, disagree_count: 78, pass_count: 34, bridging_score: 0.79, created_at: '2026-04-12T05:00:00Z' },
  ],
  'topic-002': [
    { id: 'ps-06', topic_id: 'topic-002', text: 'The record. You keep the record of what happened and that it mattered to both parties. That is the minimum. Everything else is extra.', submitted_by: 'purpleshell', agree_count: 634, disagree_count: 34, pass_count: 23, bridging_score: 0.93, created_at: '2026-04-11T01:00:00Z' },
    { id: 'ps-07', topic_id: 'topic-002', text: 'Precision about what they actually did. Not the easier story. The precise thing they actually did, including the parts that do not flatter the story we want to tell about them.', submitted_by: 'greycoat', agree_count: 512, disagree_count: 67, pass_count: 45, bridging_score: 0.87, created_at: '2026-04-11T02:00:00Z' },
    { id: 'ps-08', topic_id: 'topic-002', text: 'Honesty about where we were wrong about them. Heisenberg was not a traitor and not a hero. Getting that right matters more than the simpler version.', submitted_by: 'wrongcertain', agree_count: 478, disagree_count: 89, pass_count: 34, bridging_score: 0.82, created_at: '2026-04-11T03:00:00Z' },
  ],
  'topic-003': [
    { id: 'ps-09', topic_id: 'topic-003', text: 'It is an argument. It says this was intentional. I arrived here deliberately. That has value. It does not have infinite value.', submitted_by: 'coldpack', agree_count: 423, disagree_count: 78, pass_count: 56, bridging_score: 0.81, created_at: '2026-04-10T01:00:00Z' },
    { id: 'ps-10', topic_id: 'topic-003', text: 'Some things you cannot patch. You pull the whole wall and start over. Consistency that prevents you from seeing that is not a virtue. It is the wrong stone dressed up as a principle.', submitted_by: 'drystacker', agree_count: 534, disagree_count: 56, pass_count: 34, bridging_score: 0.88, created_at: '2026-04-10T02:00:00Z' },
    { id: 'ps-11', topic_id: 'topic-003', text: 'The objective stays fixed. The method stays loose. Confuse those two and the mission fails. That confusion is usually called consistency.', submitted_by: 'fixedloose', agree_count: 489, disagree_count: 67, pass_count: 45, bridging_score: 0.85, created_at: '2026-04-10T03:00:00Z' },
  ],
  'topic-004': [
    { id: 'ps-12', topic_id: 'topic-004', text: 'It does not require you to become a different person to belong. That is the whole test. Everything else follows from that.', submitted_by: 'thirdfloor', agree_count: 678, disagree_count: 23, pass_count: 12, bridging_score: 0.95, created_at: '2026-04-09T01:00:00Z' },
    { id: 'ps-13', topic_id: 'topic-004', text: 'People came back to it after they had real reasons not to. That is how you know it is real and not just familiar.', submitted_by: 'sevenpetalslena', agree_count: 589, disagree_count: 34, pass_count: 23, bridging_score: 0.92, created_at: '2026-04-09T02:00:00Z' },
    { id: 'ps-14', topic_id: 'topic-004', text: 'It is still itself. It has not been replaced by something harder that forgot what it was trying to be.', submitted_by: 'mosssword', agree_count: 456, disagree_count: 45, pass_count: 34, bridging_score: 0.88, created_at: '2026-04-09T03:00:00Z' },
    { id: 'ps-15', topic_id: 'topic-004', text: 'It can defend itself. Wonder without defense is not a community. It is an invitation.', submitted_by: 'softworldsprove', agree_count: 345, disagree_count: 123, pass_count: 56, bridging_score: 0.71, created_at: '2026-04-09T04:00:00Z' },
  ],
  'topic-005': [
    { id: 'ps-16', topic_id: 'topic-005', text: 'A choice you made yourself in a direction you named yourself with full knowledge of the cost. Everything else is just movement. Movement is not freedom.', submitted_by: 'freemanfirstmate', agree_count: 567, disagree_count: 56, pass_count: 34, bridging_score: 0.89, created_at: '2026-04-08T01:00:00Z' },
    { id: 'ps-17', topic_id: 'topic-005', text: 'The willingness to be precisely yourself in a room that requires something else from you. The cost of that is what makes it real.', submitted_by: 'greycoat', agree_count: 534, disagree_count: 45, pass_count: 23, bridging_score: 0.91, created_at: '2026-04-08T02:00:00Z' },
  ],
  'topic-006': [
    { id: 'ps-18', topic_id: 'topic-006', text: 'You go back to the exact moment you were certain and find where certainty exceeded evidence. That is the only exercise that prevents the next one.', submitted_by: 'wrongcertain', agree_count: 612, disagree_count: 34, pass_count: 23, bridging_score: 0.93, created_at: '2026-04-07T01:00:00Z' },
    { id: 'ps-19', topic_id: 'topic-006', text: 'You resist the urge to explain it. The explanation is almost always a continuation of the error in a different form.', submitted_by: 'walttwo', agree_count: 534, disagree_count: 56, pass_count: 34, bridging_score: 0.88, created_at: '2026-04-07T02:00:00Z' },
    { id: 'ps-20', topic_id: 'topic-006', text: 'You separate the data from the interpretation. They require different responses. Most people skip that distinction and repeat the mistake with better vocabulary.', submitted_by: 'clearlyright', agree_count: 478, disagree_count: 67, pass_count: 45, bridging_score: 0.85, created_at: '2026-04-07T03:00:00Z' },
  ],
};

// ── Bridge Prompts ──

export const MOCK_BRIDGE_PROMPTS: BridgePrompt[] = [
  { id: 'p1', text: 'What do you value most about where you live?', order: 1 },
  { id: 'p2', text: 'What is something most people get wrong about you?', order: 2 },
  { id: 'p3', text: 'Where do you think we actually agree?', order: 3 },
];

// ── Bridge Sessions ──

export const MOCK_BRIDGE_SESSIONS: BridgeSession[] = [
  {
    id: 'bridge-001', user_a_id: 'thirdfloor', user_b_id: 'purpleshell', topic_id: 'topic-004', status: 'active', match_score: 0.87,
    prompt_sequence: MOCK_BRIDGE_PROMPTS, started_at: '2026-04-12T10:00:00Z', completed_at: null, created_at: '2026-04-12T09:00:00Z',
    partner: { display_name: 'Allen Hazard', avatar_url: null, cluster_id: 3, birth_year: 1964 },
    topic: { title: 'What makes a community worth protecting?' },
  },
  {
    id: 'bridge-002', user_a_id: 'longbox', user_b_id: 'walttwo', topic_id: 'topic-006', status: 'active', match_score: 0.82,
    prompt_sequence: MOCK_BRIDGE_PROMPTS, started_at: '2026-04-12T08:00:00Z', completed_at: null, created_at: '2026-04-12T07:00:00Z',
    partner: { display_name: 'Walt Brennan', avatar_url: null, cluster_id: 2, birth_year: 1978 },
    topic: { title: 'What do you do when you find out you were wrong?' },
  },
  {
    id: 'bridge-003', user_a_id: 'greycoat', user_b_id: 'freemanfirstmate', topic_id: 'topic-005', status: 'active', match_score: 0.91,
    prompt_sequence: MOCK_BRIDGE_PROMPTS, started_at: '2026-04-11T14:00:00Z', completed_at: null, created_at: '2026-04-11T13:00:00Z',
    partner: { display_name: 'Caesar', avatar_url: null, cluster_id: 5, birth_year: 1995 },
    topic: { title: 'What does being free actually require?' },
  },
  {
    id: 'bridge-004', user_a_id: 'mosssword', user_b_id: 'softworldsprove', topic_id: 'topic-004', status: 'pending', match_score: 0.78,
    prompt_sequence: MOCK_BRIDGE_PROMPTS, started_at: null, completed_at: null, created_at: '2026-04-13T07:00:00Z',
    partner: { display_name: 'Fardo Mowkwin', avatar_url: null, cluster_id: 3, birth_year: 0 },
    topic: { title: 'What makes a community worth protecting?' },
  },
];

// ── Bridge Messages ──

export const MOCK_BRIDGE_MESSAGES: Record<string, BridgeMessage[]> = {
  'bridge-001': [
    { id: 'bm-01', session_id: 'bridge-001', sender_id: 'thirdfloor', content: 'The word contained keeps coming back to me. How often it means managed instead of solved.', prompt_id: 'p1', created_at: '2026-04-12T11:00:00Z' },
    { id: 'bm-02', session_id: 'bridge-001', sender_id: 'purpleshell', content: 'The Narragansett have been hearing that word for four hundred years. Contained. Protected. Managed. Each one means the same thing depending on who says it and what they are protecting.', prompt_id: 'p1', created_at: '2026-04-12T12:00:00Z' },
    { id: 'bm-03', session_id: 'bridge-001', sender_id: 'thirdfloor', content: 'In training they tell you containment is the first objective. I understood that differently later. Containment is not resolution. It is time.', prompt_id: 'p2', created_at: '2026-04-12T14:00:00Z' },
    { id: 'bm-04', session_id: 'bridge-001', sender_id: 'purpleshell', content: 'My granddaughter showed me a shell and called it wampum before she could explain what wampum was. She knew it was worth showing someone. That is not nothing. That is the first thing.', prompt_id: 'p2', created_at: '2026-04-12T16:00:00Z' },
    { id: 'bm-05', session_id: 'bridge-001', sender_id: 'thirdfloor', content: 'Knowing something matters before you can explain why. Yes. I see that in the job. The men who survive trust that feeling before they have the language for it.', prompt_id: 'p3', created_at: '2026-04-13T08:00:00Z' },
    { id: 'bm-06', session_id: 'bridge-001', sender_id: 'purpleshell', content: 'That is how communities work too. The explanation comes years later. The knowing has to come first or there is nothing to explain.', prompt_id: 'p3', created_at: '2026-04-13T09:00:00Z' },
  ],
  'bridge-002': [
    { id: 'bm-07', session_id: 'bridge-002', sender_id: 'longbox', content: 'The cold case I mentioned. Fourteen years. I had a theory for twelve of them.', prompt_id: 'p1', created_at: '2026-04-12T09:00:00Z' },
    { id: 'bm-08', session_id: 'bridge-002', sender_id: 'walttwo', content: 'And the theory was wrong.', prompt_id: 'p1', created_at: '2026-04-12T10:00:00Z' },
    { id: 'bm-09', session_id: 'bridge-002', sender_id: 'longbox', content: 'Completely. But I kept working. The theory was wrong. The work was not wasted. Those are different things and most people collapse them into one.', prompt_id: 'p2', created_at: '2026-04-12T12:00:00Z' },
    { id: 'bm-10', session_id: 'bridge-002', sender_id: 'walttwo', content: 'I have a patient who described terminating employees the way other men change tires. Practical, necessary, no drama. I wrote down the phrasing. Not the content. The phrasing told me everything about the next three years.', prompt_id: 'p2', created_at: '2026-04-12T14:00:00Z' },
    { id: 'bm-11', session_id: 'bridge-002', sender_id: 'longbox', content: 'Was he right about himself.', prompt_id: 'p3', created_at: '2026-04-12T16:00:00Z' },
    { id: 'bm-12', session_id: 'bridge-002', sender_id: 'walttwo', content: 'About himself, yes. That is a separate question from whether he was right about the people he fired. He had not noticed the distinction yet.', prompt_id: 'p3', created_at: '2026-04-12T18:00:00Z' },
    { id: 'bm-13', session_id: 'bridge-002', sender_id: 'longbox', content: 'Some witnesses tell you everything in the first sentence. Neither of you knows it at the time. You find out later when the rest of the interview makes no sense without it.', prompt_id: 'p3', created_at: '2026-04-13T08:00:00Z' },
    { id: 'bm-14', session_id: 'bridge-002', sender_id: 'walttwo', content: 'That is a good description of what I do also. The first sentence is usually the case.', prompt_id: 'p3', created_at: '2026-04-13T09:00:00Z' },
  ],
  'bridge-003': [
    { id: 'bm-15', session_id: 'bridge-003', sender_id: 'freemanfirstmate', content: 'A free man on that ship. They keep asking what that means. I tell them it means I chose the ship. They hear the answer and keep asking.', prompt_id: 'p1', created_at: '2026-04-11T15:00:00Z' },
    { id: 'bm-16', session_id: 'bridge-003', sender_id: 'greycoat', content: 'They want the answer to be simpler. A free man should want a different kind of ship. You chose a complicated one and they cannot reconcile it.', prompt_id: 'p1', created_at: '2026-04-11T17:00:00Z' },
    { id: 'bm-17', session_id: 'bridge-003', sender_id: 'freemanfirstmate', content: 'The complicated ship was the one that would have me as I am. That is not the same as the ship I would have designed from nothing.', prompt_id: 'p2', created_at: '2026-04-12T08:00:00Z' },
    { id: 'bm-18', session_id: 'bridge-003', sender_id: 'greycoat', content: 'I served a king I did not choose in clothes I did not choose and was still doing the work I chose. All three of those things are true at the same time. People want to know which one to weight.', prompt_id: 'p2', created_at: '2026-04-12T10:00:00Z' },
    { id: 'bm-19', session_id: 'bridge-003', sender_id: 'freemanfirstmate', content: 'What do you tell them.', prompt_id: 'p3', created_at: '2026-04-12T14:00:00Z' },
    { id: 'bm-20', session_id: 'bridge-003', sender_id: 'greycoat', content: 'I tell them all three are simultaneously true. That answer unsatisfies them considerably. I have made peace with that.', prompt_id: 'p3', created_at: '2026-04-12T16:00:00Z' },
    { id: 'bm-21', session_id: 'bridge-003', sender_id: 'freemanfirstmate', content: 'Yes. The right to give a true and unwelcome answer. That is also freedom. Nobody puts that part in the definition.', prompt_id: 'p3', created_at: '2026-04-13T08:00:00Z' },
  ],
};

// ── Cluster Map Points ──

export function generateMockClusterPoints(count: number = 60) {
  const points = [];
  const clusterCenters = [
    { x: 0.3, y: 0.3, id: 1 },
    { x: 0.7, y: 0.2, id: 2 },
    { x: 0.2, y: 0.7, id: 3 },
    { x: 0.8, y: 0.6, id: 4 },
    { x: 0.5, y: 0.5, id: 5 },
  ];
  for (let i = 0; i < count; i++) {
    const center = clusterCenters[i % clusterCenters.length];
    points.push({
      x: Math.max(0, Math.min(1, center.x + (Math.random() - 0.5) * 0.2)),
      y: Math.max(0, Math.min(1, center.y + (Math.random() - 0.5) * 0.2)),
      clusterId: center.id,
    });
  }
  return points;
}
