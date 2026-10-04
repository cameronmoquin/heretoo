# Disabled server functions (HereToo)

These came with the HereToo fork. They are **not deployed**: Netlify only
deploys `netlify/functions/` (see `netlify.toml`). Moved here on
2026-10-04, before the NFFGA site was given a Supabase service role key.

Why they had to come out first: NFFGA shares the EMSPCR database. Four of
these ran on timers with service-role (RLS-bypassing) access and delete
rows from HereToo-named tables — `cleanup-stale-calls`, `drop-purge`,
`daily-update-digest`, `message-email`. Pointed at a shared database, a
name that happens to exist in EMSPCR or Car56 would have been deleted
from, not just read.

To bring one back for NFFGA: port it to the `nffga_`-prefixed tables,
check every table it touches exists only for NFFGA, then move it into
`netlify/functions/`. `hunt-upload` / `hunt-burn` belong to the geocache
(kept on purpose; it needs an `nffga_` port of its tables first).
`mux-upload-create` is the starting point if Clubhouse video is wanted.
