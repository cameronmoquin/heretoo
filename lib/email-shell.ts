/**
 * email-shell — the one branded frame every HereToo email wears.
 *
 * Every outbound email routes through here so they read as one voice:
 * white card on a faint gray canvas, a black "HERETOO" wordmark, a
 * hairline, the content, a single heretoo.social link at the foot.
 * Spare and deadpan on purpose.
 *
 * MONOCHROME (Aug 2026). The dark-and-gold frame was the old brand;
 * the app went stark black-on-white ("the gold is gone" — colors.ts)
 * and the mail follows. `ink` is the only color that isn't a gray.
 *
 * Constraints (email clients are hostile):
 *   - Inline styles only. No <style> block, no external CSS, no SVG.
 *   - The wordmark is TEXT, never an image, so it always renders.
 *   - Table-free layout. Fine for modern clients, which is who we target.
 *
 * Callers build the content slot with the small helpers below
 * (emailEyebrow, emailHeading, emailParagraph, emailButton, emailNote,
 * emailLink) and hand the result to renderEmailHtml / renderEmailText.
 * Anything sourced from user or database text goes through escapeHtml
 * first.
 */

export const EmailBrand = {
  canvas: '#F7F7F7',
  card: '#FFFFFF',
  ink: '#0A0A0A',
  muted: '#6B6B6B',
  hairline: '#E5E5E5',
  cardBorder: '#E5E5E5',
  inset: '#F7F7F7',
  insetBorder: '#E5E5E5',
  display: "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
  serif: "'Source Serif 4',Georgia,serif",
} as const;

const SITE = 'https://heretoo.social';

/** Escape the five HTML-significant characters. Run every value that
 *  began as user or database text through this before it enters markup. */
export function escapeHtml(input: string): string {
  return String(input ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Uppercase eyebrow. The small line above a heading. */
export function emailEyebrow(text: string): string {
  return `<div style="font-family:${EmailBrand.display};font-size:11px;font-weight:700;color:${EmailBrand.muted};text-transform:uppercase;letter-spacing:2px;">${text}</div>`;
}

/** The display heading. One line, large, ink. */
export function emailHeading(text: string): string {
  return `<div style="font-family:${EmailBrand.display};font-size:26px;font-weight:800;color:${EmailBrand.ink};letter-spacing:-0.5px;line-height:1.2;margin-top:8px;">${text}</div>`;
}

/** A body paragraph. */
export function emailParagraph(html: string): string {
  return `<p style="margin:0 0 18px 0;font-size:16px;line-height:1.7;color:${EmailBrand.ink};">${html}</p>`;
}

/** A muted footnote-sized line. Safety lines and secondary links. */
export function emailNote(html: string): string {
  return `<div style="margin-top:16px;font-size:13px;line-height:1.6;color:${EmailBrand.muted};">${html}</div>`;
}

/** The call-to-action button. Ink fill, white label. */
export function emailButton(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;margin:6px 0 4px;padding:13px 24px;background:${EmailBrand.ink};color:#FFFFFF;font-family:${EmailBrand.display};font-size:14px;font-weight:700;text-decoration:none;border-radius:8px;letter-spacing:0.3px;">${label}</a>`;
}

/** An inline link. Underlined, because monochrome carries no other cue. */
export function emailLink(href: string, label: string): string {
  return `<a href="${href}" style="color:${EmailBrand.ink};text-decoration:underline;">${label}</a>`;
}

interface FooterAction {
  href: string;
  label: string;
}

export interface EmailHtmlInput {
  /** Subject line. Doubles as the hidden preheader preview. */
  subject: string;
  /** Content-slot HTML. Caller escapes any user or database text. */
  body: string;
  /** Optional functional link beside heretoo.social — used by the
   *  recurring notification emails for "Manage email settings". */
  footerAction?: FooterAction;
}

/** Wrap content-slot HTML in the full branded document. */
export function renderEmailHtml({ subject, body, footerAction }: EmailHtmlInput): string {
  const preheader = escapeHtml(subject);
  const footerActionHtml = footerAction
    ? ` &nbsp;&middot;&nbsp; <a href="${footerAction.href}" style="color:${EmailBrand.muted};text-decoration:underline;">${escapeHtml(footerAction.label)}</a>`
    : '';
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>${preheader}</title>
  </head>
  <body style="margin:0;padding:0;background:${EmailBrand.canvas};">
    <span style="display:none;max-height:0;overflow:hidden;opacity:0;color:${EmailBrand.canvas};">${preheader}</span>
    <div style="background:${EmailBrand.canvas};padding:32px 16px;font-family:${EmailBrand.display};">
      <div style="max-width:580px;margin:0 auto;background:${EmailBrand.card};border:1px solid ${EmailBrand.cardBorder};border-radius:12px;padding:32px 28px;">
        <div style="font-family:${EmailBrand.display};font-size:13px;font-weight:700;color:${EmailBrand.ink};text-transform:uppercase;letter-spacing:4px;">HERETOO</div>
        <div style="margin:18px 0;height:1px;background:${EmailBrand.hairline};"></div>
        ${body}
      </div>
      <div style="max-width:580px;margin:18px auto 0;text-align:center;font-family:${EmailBrand.display};font-size:11px;letter-spacing:1px;color:${EmailBrand.muted};">
        <a href="${SITE}" style="color:${EmailBrand.muted};text-decoration:none;">heretoo.social</a>${footerActionHtml}
      </div>
    </div>
  </body>
</html>`;
}

export interface EmailTextInput {
  subject: string;
  /** Content-slot plain text. */
  text: string;
  footerAction?: FooterAction;
}

/** The plain-text alternative. Same content, no markup. */
export function renderEmailText({ text, footerAction }: EmailTextInput): string {
  const foot = footerAction ? `\n${footerAction.label}: ${footerAction.href}` : '';
  return `HERETOO\n\n${text.trim()}\n\nheretoo.social${foot}`;
}
