/**
 * EnsureProfile — makes sure every signed-in person has an nffga_profiles
 * row, however they arrived.
 *
 * Posting and commenting require that row (migration 105). The Join and
 * Sign-in forms create it, but an account that first arrives some other
 * way — the emailed sign-in link, the admin door, a reset link — never
 * passed through them, so its first post was refused with a "permission"
 * error (Cameron, 2026-10-04). This runs once per signed-in user per page
 * load and is a no-op when the row already exists.
 *
 * Renders nothing. Mounted once in app/_layout.tsx.
 */
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/authStore';
import { ensureProfile } from '../../lib/nffga/auth';

export function EnsureProfile() {
  const user = useAuthStore((s) => s.user);
  const done = useRef<string | null>(null);
  const qc = useQueryClient();

  useEffect(() => {
    const id = user?.id;
    if (!id || done.current === id) return;
    done.current = id;
    const name = (user?.user_metadata?.display_name as string | undefined) ?? '';
    void ensureProfile(name).then(() => {
      // Anything that showed "no profile" can refetch now.
      void qc.invalidateQueries();
    });
  }, [user?.id, user?.user_metadata?.display_name, qc]);

  return null;
}
