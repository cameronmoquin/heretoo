import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import type { Profile } from '../stores/authStore';

export function useAuth() {
  const { session, user, profile, isLoading, hasCompletedSetup, setSession, setProfile, setLoading } =
    useAuthStore();

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        if (session?.user) {
          fetchProfile(session.user.id);
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (data) {
      setProfile(data as Profile);
    }
    setLoading(false);
  }

  async function signInWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: 'heretoo://auth/callback' },
    });
    if (error) throw error;
    return data;
  }

  async function signInWithApple(identityToken: string) {
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: identityToken,
    });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    await supabase.auth.signOut();
    useAuthStore.getState().reset();
  }

  async function updateProfile(updates: Partial<Profile>) {
    if (!user) throw new Error('Not authenticated');
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();
    if (error) throw error;
    setProfile(data as Profile);
    return data;
  }

  async function createProfile(profileData: {
    username: string;
    display_name: string;
    birth_year: number;
    location_region: string;
    cluster_id: number;
    cluster_confidence: number;
    origin_story?: string;
  }) {
    if (!user) throw new Error('Not authenticated');
    const { data, error } = await supabase
      .from('profiles')
      .insert({ id: user.id, ...profileData })
      .select()
      .single();
    if (error) throw error;
    setProfile(data as Profile);
    return data;
  }

  return {
    session,
    user,
    profile,
    isLoading,
    hasCompletedSetup,
    signInWithGoogle,
    signInWithApple,
    signOut,
    updateProfile,
    createProfile,
  };
}
