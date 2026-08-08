/**
 * Auth state — reads from supabase, syncs into the Zustand store.
 * Profile shape matches the new schema (handle, display_name, bio, avatar_path).
 */

import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { registerPushToken, unregisterPushToken } from '../lib/push';
import { hardSignOutAndRedirect } from '../lib/auth-recovery';
import { DEV_MODE } from '../lib/dev-mode';
import { MOCK_USER } from '../lib/mock-data';
import { useAuthStore } from '../stores/authStore';
import type { Profile } from '../stores/authStore';

export function useAuth() {
  const {
    session, user, profile, isLoading, hasCompletedSetup,
    setSession, setProfile, setLoading,
  } = useAuthStore();

  useEffect(() => {
    if (DEV_MODE) {
      setProfile(MOCK_USER);
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        // Best-effort, never awaited into the boot path.
        void registerPushToken(session.user.id);
        fetchProfile(session.user.id);

        // THE ZOMBIE GUARD. getSession() restores from storage without
        // asking the server, so a revoked refresh token boots a UI that
        // looks signed in and detonates on the first data tap
        // ("Something broke", then the sign-in screen the long way).
        // One background round-trip settles it: if the server refuses
        // the session, sign out clean NOW and boot onto sign-in with a
        // working screen instead of a minefield.
        void supabase.auth.getUser().then(({ error }) => {
          const status = (error as any)?.status;
          if (error && (status === 401 || status === 403)) {
            void hardSignOutAndRedirect();
          }
        }).catch(() => {
          // Network blip — not evidence of a dead session. Leave it.
        });
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        if (session?.user) {
          void registerPushToken(session.user.id);
          fetchProfile(session.user.id);
        } else {
          setProfile(null);
          setLoading(false);
        }
      },
    );

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (data) setProfile(data as Profile);
    setLoading(false);

    // Silent timezone backfill — runs once per session, on first
    // profile fetch. The daily-digest scheduled function reads this
    // to send the email at noon in the user's local zone. We only
    // write if the value is missing so a user-set choice in
    // /profile/notifications isn't clobbered.
    if (data && !(data as any).timezone) {
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (tz) {
          await supabase
            .from('profiles')
            .update({ timezone: tz })
            .eq('id', userId);
        }
      } catch {}
    }
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
    if (DEV_MODE) {
      useAuthStore.getState().reset();
      return;
    }
    // Before signOut, while the session can still satisfy RLS on the delete.
    await unregisterPushToken();
    await supabase.auth.signOut();
    useAuthStore.getState().reset();
  }

  async function updateProfile(updates: Partial<Profile>) {
    if (DEV_MODE) {
      setProfile({ ...MOCK_USER, ...updates });
      return { ...MOCK_USER, ...updates };
    }
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

  return {
    session,
    user,
    profile: DEV_MODE ? (profile ?? MOCK_USER) : profile,
    isLoading,
    hasCompletedSetup: DEV_MODE ? true : hasCompletedSetup,
    signInWithApple,
    signOut,
    updateProfile,
  };
}
