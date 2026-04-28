/**
 * Mock data — kept minimal post-rewrite. DEV_MODE = false in production
 * so most of this is unreferenced; we keep stub exports so imports don't
 * break anything still depending on them.
 */

import type { Profile } from '../stores/authStore';
import type { Post } from '../stores/feedStore';

export const MOCK_USER: Profile = {
  id: 'user-001',
  handle: 'cameron',
  display_name: 'Cameron',
  bio: null,
  avatar_path: null,
  phone_e164: null,
  phone_verified: false,
  created_at: '',
  updated_at: '',
};

export const MOCK_POSTS: Post[] = [];
