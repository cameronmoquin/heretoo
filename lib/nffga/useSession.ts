/**
 * useSession — the signed-in state for NFFGA screens.
 *
 * Reads the shared auth store that hooks/useAuth.ts keeps in sync with
 * Supabase. Signed-out is a normal, fully supported state: every public
 * screen renders for it.
 */
import { useAuthStore } from '../../stores/authStore';

export function useSession() {
  const session = useAuthStore((s) => s.session);
  const loading = useAuthStore((s) => s.isLoading);
  return { session, userId: session?.user?.id ?? null, email: session?.user?.email ?? null, loading };
}
