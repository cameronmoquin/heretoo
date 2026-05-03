import { create } from 'zustand';

export type FeedTab = 'for_you' | 'connections';

/** Public feed post shape (matches new schema). */
export interface PostMedia {
  id: string;
  post_id: string;
  storage_path: string;
  media_type: 'image' | 'video' | 'audio';
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  alt_text: string | null;
  position: number;
  created_at: string;
}

export interface Post {
  id: string;
  author_id: string;
  body: string | null;
  /**
   * Optional small attribution line — shown bottom-right on the
   * PostCard. Used by Shakespeare bot posts ("— Hamlet · Hamlet · III.i")
   * and could be used for any post that wants a citation/credit.
   */
  slugline: string | null;
  visibility: 'public' | 'connections' | 'family' | 'private';
  family_id: string | null;
  heart_count: number;
  boost_count: number;
  comment_count: number;
  created_at: string;
  // Joined
  author?: {
    id: string;
    handle: string;
    display_name: string | null;
    avatar_path: string | null;
  };
  media?: PostMedia[];
  viewer_hearted?: boolean;
}

interface FeedState {
  activeTab: FeedTab;
  setActiveTab: (tab: FeedTab) => void;
}

export const useFeedStore = create<FeedState>((set) => ({
  activeTab: 'for_you',
  setActiveTab: (activeTab) => set({ activeTab }),
}));
