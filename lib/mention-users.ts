/**
 * User list for @mention autocomplete.
 * In production this would query Supabase.
 * For now, pull from mock data authors.
 */

export interface MentionUser {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

export const MENTION_USERS: MentionUser[] = [
  { username: 'coldpack', display_name: 'Sandy Corvo', avatar_url: 'https://i.pravatar.cc/150?u=coldpack' },
  { username: 'longbox', display_name: 'Vega', avatar_url: 'https://i.pravatar.cc/150?u=longbox' },
  { username: 'walttwo', display_name: 'Walt Brennan', avatar_url: 'https://i.pravatar.cc/150?u=walttwo' },
  { username: 'ninerooms', display_name: 'Nina Calloway', avatar_url: 'https://i.pravatar.cc/150?u=ninerooms' },
  { username: 'drystacker', display_name: 'Mark Dolan', avatar_url: 'https://i.pravatar.cc/150?u=drystacker' },
  { username: 'clearlyright', display_name: 'Pat Reilly', avatar_url: 'https://i.pravatar.cc/150?u=clearlyright' },
  { username: 'sevenpetalslena', display_name: 'Lena Park', avatar_url: 'https://i.pravatar.cc/150?u=sevenpetalslena' },
  { username: 'thirdfloor', display_name: 'Mike Walden', avatar_url: 'https://i.pravatar.cc/150?u=thirdfloor' },
  { username: 'purpleshell', display_name: 'Allen Hazard', avatar_url: 'https://i.pravatar.cc/150?u=purpleshell' },
  { username: 'greycoat', display_name: "Charles d'Eon", avatar_url: 'https://i.pravatar.cc/150?u=greycoat' },
  { username: 'thirdparty', display_name: 'Pierre Beaumarchais', avatar_url: 'https://i.pravatar.cc/150?u=thirdparty' },
  { username: 'wrongcertain', display_name: 'Samuel Goudsmit', avatar_url: 'https://i.pravatar.cc/150?u=wrongcertain' },
  { username: 'fixedloose', display_name: 'Boris Pash', avatar_url: 'https://i.pravatar.cc/150?u=fixedloose' },
  { username: 'ocracokeborn', display_name: 'Mary Ormond', avatar_url: 'https://i.pravatar.cc/150?u=ocracokeborn' },
  { username: 'freemanfirstmate', display_name: 'Caesar', avatar_url: 'https://i.pravatar.cc/150?u=freemanfirstmate' },
  { username: 'notmyalpacas', display_name: 'Dillon Marsh', avatar_url: 'https://i.pravatar.cc/150?u=notmyalpacas' },
  { username: 'mosssword', display_name: 'Jude', avatar_url: 'https://i.pravatar.cc/150?u=mosssword' },
  { username: 'softworldsprove', display_name: 'Fardo Mowkwin', avatar_url: 'https://i.pravatar.cc/150?u=softworldsprove' },
];
