/**
 * Alert helpers — used to be window.alert / window.confirm wrappers.
 * Those produced the "<domain> says" browser dialog, which is jarring
 * and adds an extra mandatory tap.
 *
 * Now they route through the in-app Toast and ConfirmSheet hosts so:
 *   - Errors and informational notices appear as a non-modal toast
 *     pinned at the top of the screen, auto-dismissing after a
 *     few seconds.
 *   - Confirmations open a centered card with a single destructive
 *     button — tap once, action runs immediately.
 *
 * The old function signatures are preserved for backwards compat so
 * we don't have to sweep every caller in this commit.
 */

import { toastError, toastInfo } from '../components/shared/Toast';
import { confirm as confirmSheet } from '../components/shared/ConfirmSheet';

export function showAlert(title: string, message?: string) {
  // Errors: anything with the words "error", "fail", or "could not"
  // routes to the error variant; otherwise informational tone.
  const text = message ? `${title} — ${message}` : title;
  const lower = text.toLowerCase();
  const isError = /(error|fail|could not|cannot|invalid|missing|denied|expired)/.test(lower);
  if (isError) toastError(text);
  else toastInfo(text);
}

export function showConfirm(
  title: string,
  message: string,
  onConfirm: () => void,
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
) {
  // Detect destructive intent from the label so confirm sheets show
  // the red button automatically without changing every call site.
  const destructive = /delete|remove|leave|forget|destroy|forever/i.test(confirmLabel);
  confirmSheet({
    title,
    message,
    confirmLabel,
    cancelLabel,
    destructive,
    onConfirm,
  });
}
