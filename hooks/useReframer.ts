/**
 * useReframer — opt-in conflict mediation drawer.
 *
 * Source of Truth, Milestone 8. Detects (client-side) when a draft
 * may be escalating, exposes an eye icon, and on tap opens a drawer
 * with three calm paragraphs from /api/reframer.
 *
 * Privacy by construction:
 *   - Detection runs locally; no draft leaves the device until the
 *     user explicitly taps the eye.
 *   - Tap fires the LLM call AND inserts a metadata-only reframer_events
 *     row (draft hash, never content).
 *   - The recipient never sees that the reframer was used.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

export type ReframerSurface = 'dm' | 'family_chat';

export interface ReframerContextMessage {
  from: 'me' | 'them';
  body: string;
}

export interface ReframerResult {
  readingTheirs: string;
  readingYours: string;
  alternative: string;
}

// ── Local trigger heuristic ─────────────────────────────────────────

/** Returns true when a draft looks like it might land harder than the
 *  author intended. Cheap, regex-based, runs on every keystroke. */
export function looksEscalating(
  draft: string,
  precedingFromThem?: string,
): boolean {
  const t = (draft ?? '').trim();
  if (t.length < 25) return false;       // too short to escalate

  // 1. ALL-CAPS shouting (3+ letter all-caps words).
  const capsWords = (t.match(/\b[A-Z]{3,}\b/g) ?? []).length;
  if (capsWords >= 2) return true;

  // 2. Repeated exclamation or question marks.
  if (/!{2,}|\?{2,}/.test(t)) return true;

  // 3. Accusatory or absolutist pronouns / phrases.
  const accusatory = /\b(you always|you never|you people|every time you|always do this|never listen|how dare you)\b/i;
  if (accusatory.test(t)) return true;

  // 4. Charged topics (politics, money, parenting choices).
  const charged = /\b(politic|election|trump|biden|abortion|vaccine|covid|money you|inheritance|will leave|divorce|custody|drugs?|alcoholic|drunk)\b/i;
  if (charged.test(t)) return true;

  // 5. Reciprocity — the previous message has any of these markers,
  // and the draft itself is at all heated (length-thresholded charge).
  if (precedingFromThem) {
    const prevHot =
      capsWords > 0
      || /!{1,}/.test(precedingFromThem)
      || accusatory.test(precedingFromThem);
    if (prevHot && t.length > 80) return true;
  }

  return false;
}

// ── Cheap SHA-256 for the draft hash ────────────────────────────────

async function sha256(input: string): Promise<string> {
  if (typeof crypto === 'undefined' || !(crypto as any)?.subtle) {
    // Native fallback: cheap djb2-ish; adequate for a privacy hash
    // (we never need to verify, only de-dup).
    let h = 5381;
    for (let i = 0; i < input.length; i++) h = ((h << 5) + h) ^ input.charCodeAt(i);
    return `naive-${(h >>> 0).toString(16)}`;
  }
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  const arr = Array.from(new Uint8Array(buf));
  return arr.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ── Hook ────────────────────────────────────────────────────────────

export function useReframer(opts: {
  surface: ReframerSurface;
  draft: string;
  /** Up to 3 most recent messages, oldest first. */
  context: ReframerContextMessage[];
}) {
  const userId = useAuthStore((s) => s.user?.id);
  const [eyeVisible, setEyeVisible] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReframerResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Track which draft-hash we already emitted an event for, so we
  // don't insert a new row on every keystroke that keeps escalating.
  const lastEmittedHash = useRef<string | null>(null);
  const eventIdRef = useRef<string | null>(null);
  const dismissTimer = useRef<any>(null);

  // Most recent message FROM THEM, used by the heuristic for
  // reciprocity checks.
  const lastFromThem = useMemo(() => {
    for (let i = opts.context.length - 1; i >= 0; i--) {
      if (opts.context[i].from === 'them') return opts.context[i].body;
    }
    return undefined;
  }, [opts.context]);

  // Detect & maybe show the eye. Auto-dismiss after 4 seconds if the
  // user doesn't act on it (per spec — "it does not nag").
  useEffect(() => {
    const should = looksEscalating(opts.draft, lastFromThem);
    if (should && !eyeVisible) {
      setEyeVisible(true);
      // 4s auto-dismiss timer
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
      dismissTimer.current = setTimeout(() => setEyeVisible(false), 4000);
    } else if (!should && eyeVisible && !drawerOpen) {
      // Draft cooled off — pull the eye away.
      setEyeVisible(false);
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    }
    return () => {
      // Cleanup on unmount only — we want the timer to keep running
      // across keystrokes within the same "hot" period.
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.draft, lastFromThem, drawerOpen]);

  // When the eye is tapped: open the drawer, fetch the reframe, and
  // insert a (metadata-only) reframer_events row.
  const open = async () => {
    if (!userId) return;
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    setDrawerOpen(true);
    setLoading(true);
    setError(null);
    setResult(null);

    const hash = await sha256(opts.draft);
    // Only emit a new event row if this is a different draft.
    if (lastEmittedHash.current !== hash) {
      lastEmittedHash.current = hash;
      try {
        const { data } = await supabase
          .from('reframer_events')
          .insert({
            user_id: userId,
            draft_hash: hash,
            was_opened: true,
            surface: opts.surface,
          } as any)
          .select('id')
          .single();
        eventIdRef.current = (data as any)?.id ?? null;
      } catch {
        // Non-fatal; the reframe still works.
      }
    } else if (eventIdRef.current) {
      // Same draft, second open — flip was_opened (idempotent).
      try {
        await supabase
          .from('reframer_events')
          .update({ was_opened: true } as any)
          .eq('id', eventIdRef.current);
      } catch {}
    }

    try {
      const res = await fetch('/api/reframer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draft: opts.draft,
          context: opts.context.slice(-3),
          surface: opts.surface,
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e?.error ?? `Reframer failed (${res.status})`);
      }
      const j = (await res.json()) as ReframerResult;
      setResult(j);
    } catch (e: any) {
      setError(e?.message ?? 'Reframer service error');
    } finally {
      setLoading(false);
    }
  };

  const close = () => {
    setDrawerOpen(false);
    setEyeVisible(false);
  };

  const markAccepted = async () => {
    if (!eventIdRef.current) return;
    try {
      await supabase
        .from('reframer_events')
        .update({ was_accepted: true } as any)
        .eq('id', eventIdRef.current);
    } catch {}
  };

  const markEdited = async () => {
    if (!eventIdRef.current) return;
    try {
      await supabase
        .from('reframer_events')
        .update({ was_edited: true } as any)
        .eq('id', eventIdRef.current);
    } catch {}
  };

  return {
    eyeVisible,
    drawerOpen,
    loading,
    result,
    error,
    open,
    close,
    markAccepted,
    markEdited,
  };
}
