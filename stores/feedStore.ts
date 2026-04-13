import { create } from 'zustand';

export type FeedTab = 'for_you' | 'bridging';

export interface Post {
  id: string;
  author_id: string;
  content: string | null;
  media_type: 'none' | 'photo' | 'video';
  photo_urls: string[] | null;
  mux_playback_id: string | null;
  mux_thumbnail_url: string | null;
  video_duration_seconds: number | null;
  bridging_score: number;
  total_engagements: number;
  cluster_reach: number;
  cross_cluster_ratio: number;
  topic_tags: string[] | null;
  is_position: boolean;
  position_claim: string | null;
  position_steelman: string | null;
  position_common_ground: string | null;
  created_at: string;
  // Joined
  author?: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    cluster_id: number;
  };
  user_engagements?: string[]; // engagement types the current user has made
}

export type EngagementType = 'agree' | 'disagree' | 'important' | 'share' | 'bridge';

interface FeedState {
  activeTab: FeedTab;
  posts: Post[];
  isRefreshing: boolean;

  setActiveTab: (tab: FeedTab) => void;
  setPosts: (posts: Post[]) => void;
  appendPosts: (posts: Post[]) => void;
  updatePost: (postId: string, updates: Partial<Post>) => void;
  setRefreshing: (refreshing: boolean) => void;
}

export const useFeedStore = create<FeedState>((set) => ({
  activeTab: 'for_you',
  posts: [],
  isRefreshing: false,

  setActiveTab: (activeTab) => set({ activeTab }),
  setPosts: (posts) => set({ posts }),
  appendPosts: (newPosts) =>
    set((state) => ({ posts: [...state.posts, ...newPosts] })),
  updatePost: (postId, updates) =>
    set((state) => ({
      posts: state.posts.map((p) =>
        p.id === postId ? { ...p, ...updates } : p
      ),
    })),
  setRefreshing: (isRefreshing) => set({ isRefreshing }),
}));
