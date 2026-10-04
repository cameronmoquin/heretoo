/**
 * copy — editable website text (migration 110, nffga_site_copy).
 *
 * useCopy(key) returns the saved value, or the default from
 * constants/siteCopy.ts when nothing is saved (or the table cannot be
 * read). All rows come in one request, cached for ten minutes and
 * shared by every caller on the page.
 *
 * Writes are for site admins only; the database enforces it.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { SITE_COPY, COPY_MAX_LENGTH, type CopyKey } from '../../constants/siteCopy';

export interface CopyRow {
  key: string;
  value: string;
  updated_at: string;
}

export const copyKeys = { all: ['nffga', 'site-copy'] as const };

function quiet(what: string, e: unknown) {
  // eslint-disable-next-line no-console
  if (__DEV__) console.warn(`[copy] ${what}`, (e as any)?.message ?? e);
}

export async function fetchSiteCopy(): Promise<Record<string, CopyRow>> {
  try {
    const { data, error } = await supabase.from('nffga_site_copy').select('key, value, updated_at');
    if (error) { quiet('load', error); return {}; }
    const out: Record<string, CopyRow> = {};
    for (const r of (data ?? []) as CopyRow[]) out[r.key] = r;
    return out;
  } catch (e) {
    quiet('load', e);
    return {};
  }
}

export function useSiteCopy() {
  return useQuery({
    queryKey: copyKeys.all,
    queryFn: fetchSiteCopy,
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 60,
  });
}

/** The text to show for a key: the saved value, else the default. */
export function useCopy(key: CopyKey): string {
  const q = useSiteCopy();
  const saved = q.data?.[key];
  return saved ? saved.value : SITE_COPY[key].default;
}

/** Site admins: save a key's text. */
export async function saveCopy(key: CopyKey, value: string): Promise<{ ok: boolean; error?: string }> {
  const entry = SITE_COPY[key] as { allowEmpty?: boolean };
  if (!value.trim() && !entry.allowEmpty) {
    return { ok: false, error: 'This line cannot be empty. Use Reset to default instead.' };
  }
  if (value.length > COPY_MAX_LENGTH) return { ok: false, error: `Keep it under ${COPY_MAX_LENGTH} characters.` };
  try {
    const { data, error } = await supabase
      .from('nffga_site_copy')
      .upsert({ key, value }, { onConflict: 'key' })
      .select('key');
    if (error) {
      quiet('save', error);
      return { ok: false, error: String((error as any).code) === '42501' ? 'Only site admins can change website text.' : 'Could not save. Try again.' };
    }
    if (!data || data.length === 0) return { ok: false, error: 'Only site admins can change website text.' };
    return { ok: true };
  } catch (e) {
    quiet('save', e);
    return { ok: false, error: 'Could not save right now. Try again later.' };
  }
}

/** Site admins: drop the saved text so the default shows again. */
export async function resetCopy(key: CopyKey): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await supabase.from('nffga_site_copy').delete().eq('key', key);
    if (error) { quiet('reset', error); return { ok: false, error: 'Could not reset. Try again.' }; }
    return { ok: true };
  } catch (e) {
    quiet('reset', e);
    return { ok: false, error: 'Could not reset right now. Try again later.' };
  }
}
