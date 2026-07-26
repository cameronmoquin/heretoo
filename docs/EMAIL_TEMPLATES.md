# Supabase Auth Email Templates

Two of HereToo's emails are still rendered by Supabase's own template
engine, not by our Netlify functions. There is no API to set them, so
they live in the dashboard and the owner pastes them by hand.

Everything else (letters, digest, subject-post, password reset) now runs
through `lib/email-shell.ts` and Resend. These two match that frame:
same dark canvas, same gold `HERETOO` wordmark, same hairline. The
wordmark is text, so it renders even when images are blocked.

The button target is Supabase's `{{ .ConfirmationURL }}` variable. Leave
it exactly as written; Supabase fills it in at send time.

Where each goes: **Supabase Dashboard → Authentication → Email Templates**.
Pick the template from the list, paste the HTML into the message body,
save. Set the subject line in the same screen.

---

## Confirm signup

Dashboard template: **Confirm signup**. Suggested subject:
`Confirm your HereToo email`.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark" />
    <title>Confirm your HereToo email</title>
  </head>
  <body style="margin:0;padding:0;background:#0A0A0F;">
    <span style="display:none;max-height:0;overflow:hidden;opacity:0;color:#0A0A0F;">Confirm your HereToo email</span>
    <div style="background:#0A0A0F;padding:32px 16px;font-family:'Source Serif 4',Georgia,serif;">
      <div style="max-width:580px;margin:0 auto;background:#16161D;border:1px solid rgba(201,161,75,0.55);border-radius:12px;padding:32px 28px;">
        <div style="font-family:'Syne','Inter',sans-serif;font-size:13px;font-weight:700;color:#C9A14B;text-transform:uppercase;letter-spacing:4px;">HERETOO</div>
        <div style="margin:18px 0;height:1px;background:rgba(201,161,75,0.25);"></div>
        <div style="font-family:'Syne','Inter',sans-serif;font-size:11px;font-weight:700;color:#C9A14B;text-transform:uppercase;letter-spacing:2px;">Confirm your email</div>
        <div style="font-family:'Syne','Inter',sans-serif;font-size:26px;font-weight:800;color:#F4F1E8;letter-spacing:-0.5px;line-height:1.2;margin-top:8px;">Confirm your email</div>
        <div style="margin-top:18px;">
          <p style="margin:0 0 18px 0;font-size:16px;line-height:1.7;color:#F4F1E8;">Confirm your email to finish setting up your HereToo account.</p>
          <a href="{{ .ConfirmationURL }}" style="display:inline-block;margin:6px 0 4px;padding:13px 24px;background:#C9A14B;color:#0A0A0F;font-family:'Syne','Inter',sans-serif;font-size:14px;font-weight:700;text-decoration:none;border-radius:8px;letter-spacing:0.3px;">Confirm email</a>
          <div style="margin-top:16px;font-size:13px;line-height:1.6;color:#8A8377;">If you did not create a HereToo account, ignore this email.</div>
        </div>
      </div>
      <div style="max-width:580px;margin:18px auto 0;text-align:center;font-family:'Syne','Inter',sans-serif;font-size:11px;letter-spacing:1px;color:#8A8377;">
        <a href="https://heretoo.social" style="color:#8A8377;text-decoration:none;">heretoo.social</a>
      </div>
    </div>
  </body>
</html>
```

---

## Magic Link

Dashboard template: **Magic Link**. Suggested subject:
`Your HereToo sign-in link`.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark" />
    <title>Your HereToo sign-in link</title>
  </head>
  <body style="margin:0;padding:0;background:#0A0A0F;">
    <span style="display:none;max-height:0;overflow:hidden;opacity:0;color:#0A0A0F;">Your HereToo sign-in link</span>
    <div style="background:#0A0A0F;padding:32px 16px;font-family:'Source Serif 4',Georgia,serif;">
      <div style="max-width:580px;margin:0 auto;background:#16161D;border:1px solid rgba(201,161,75,0.55);border-radius:12px;padding:32px 28px;">
        <div style="font-family:'Syne','Inter',sans-serif;font-size:13px;font-weight:700;color:#C9A14B;text-transform:uppercase;letter-spacing:4px;">HERETOO</div>
        <div style="margin:18px 0;height:1px;background:rgba(201,161,75,0.25);"></div>
        <div style="font-family:'Syne','Inter',sans-serif;font-size:11px;font-weight:700;color:#C9A14B;text-transform:uppercase;letter-spacing:2px;">Sign-in link</div>
        <div style="font-family:'Syne','Inter',sans-serif;font-size:26px;font-weight:800;color:#F4F1E8;letter-spacing:-0.5px;line-height:1.2;margin-top:8px;">Your sign-in link</div>
        <div style="margin-top:18px;">
          <p style="margin:0 0 18px 0;font-size:16px;line-height:1.7;color:#F4F1E8;">Sign in to HereToo from the button below. This link works once.</p>
          <a href="{{ .ConfirmationURL }}" style="display:inline-block;margin:6px 0 4px;padding:13px 24px;background:#C9A14B;color:#0A0A0F;font-family:'Syne','Inter',sans-serif;font-size:14px;font-weight:700;text-decoration:none;border-radius:8px;letter-spacing:0.3px;">Sign in</a>
          <div style="margin-top:16px;font-size:13px;line-height:1.6;color:#8A8377;">If you did not ask to sign in, ignore this email.</div>
        </div>
      </div>
      <div style="max-width:580px;margin:18px auto 0;text-align:center;font-family:'Syne','Inter',sans-serif;font-size:11px;letter-spacing:1px;color:#8A8377;">
        <a href="https://heretoo.social" style="color:#8A8377;text-decoration:none;">heretoo.social</a>
      </div>
    </div>
  </body>
</html>
```
