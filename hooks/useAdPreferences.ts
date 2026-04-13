import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { DEV_MODE } from '../lib/dev-mode';
import { useAuthStore } from '../stores/authStore';

interface AdPreference {
  category_id: string;
  subcategory_id: string | null;
}

export function useAdPreferences() {
  const userId = useAuthStore((s) => s.user?.id) ?? 'user-001';
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['ad-preferences', userId],
    queryFn: async () => {
      if (DEV_MODE) return [] as AdPreference[];

      const { data, error } = await supabase
        .from('user_ad_preferences')
        .select('category_id, subcategory_id')
        .eq('user_id', userId);
      if (error) throw error;
      return data as AdPreference[];
    },
    enabled: !!userId,
  });

  const savePreferences = useMutation({
    mutationFn: async (preferences: AdPreference[]) => {
      if (DEV_MODE) return preferences;

      // Delete existing then insert new
      await supabase
        .from('user_ad_preferences')
        .delete()
        .eq('user_id', userId);

      if (preferences.length > 0) {
        const rows = preferences.map((p) => ({
          user_id: userId,
          category_id: p.category_id,
          subcategory_id: p.subcategory_id,
        }));

        const { error } = await supabase
          .from('user_ad_preferences')
          .insert(rows);
        if (error) throw error;
      }

      // Mark preferences as set on profile
      await supabase
        .from('profiles')
        .update({ ad_preferences_set: true })
        .eq('id', userId);

      return preferences;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ad-preferences', userId] });
    },
  });

  const goAdFree = useMutation({
    mutationFn: async (backgroundId: string) => {
      if (DEV_MODE) return { backgroundId };

      const { error } = await supabase
        .from('profiles')
        .update({ is_ad_free: true, ad_free_background: backgroundId })
        .eq('id', userId);
      if (error) throw error;
      return { backgroundId };
    },
  });

  // Get selected category IDs (top-level)
  const selectedCategoryIds = new Set(
    (query.data ?? []).map((p) => p.category_id)
  );

  // Get selected subcategory IDs
  const selectedSubcategoryIds = new Set(
    (query.data ?? [])
      .filter((p) => p.subcategory_id)
      .map((p) => p.subcategory_id!)
  );

  return {
    preferences: query.data ?? [],
    selectedCategoryIds,
    selectedSubcategoryIds,
    isLoading: query.isLoading,
    savePreferences,
    goAdFree,
  };
}
