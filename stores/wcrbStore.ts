/**
 * Back-compat shim — `useWCRB` was the original radio singleton when
 * we only shipped one station. The full multi-station radio now lives
 * in `radioStore`; this re-export keeps existing callers working
 * unchanged while we sweep them across.
 *
 * New code should import `useRadio` (and `STATIONS`, `useActiveStation`)
 * from `radioStore` directly.
 */
export { useRadio as useWCRB } from './radioStore';
