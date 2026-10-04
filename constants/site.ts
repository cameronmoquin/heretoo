/**
 * Site — the one place the product's name and addresses live.
 *
 * NFFGA is a fork of the HereToo platform. HereToo hard-coded its name
 * and heretoo.social in some sixty places; this file is where they all
 * moved to. Nothing else in the codebase should spell out a domain.
 *
 * The web app lives on the emspcr.app domain beside Car56
 * (car56.emspcr.app). Override SITE_URL with EXPO_PUBLIC_SITE_URL if
 * the deployed address differs; the same value must be set as
 * SITE_URL on Netlify for the functions, which build outside Expo.
 */

export const SITE_NAME = 'NFFGA';
export const SITE_LONG_NAME = 'National Fire Fighters Golf Association';

export const SITE_URL: string =
  (typeof process !== 'undefined'
    && (process.env.EXPO_PUBLIC_SITE_URL || process.env.SITE_URL))
  || 'https://nffga.emspcr.app';

/** The deep-link scheme registered in app.json. */
export const APP_SCHEME = 'nffga';

/**
 * Outbound mail. The sending domain has to be verified in Resend
 * (DKIM + SPF in Cloudflare) before any of this delivers; until then
 * the functions log and return without sending.
 */
export const EMAIL_FROM = `${SITE_NAME} <notifications@nffga.emspcr.app>`;
export const EMAIL_NOREPLY = 'noreply@nffga.emspcr.app';

/**
 * Member sign-up is OPEN (Cameron, 2026-10-04): anyone who scans the QR
 * code can look around without an account and create one at /join to
 * post, offer, register or message. Admins use the admin door at
 * /(auth)/welcome, reached from /admin.
 */
export const MEMBER_SIGNUP_OPEN = true;

/**
 * Sister products on the same domain. Car56 is the fire-investigation
 * report tool; the association links to it from the navigation.
 */
export const CAR56_URL = 'https://car56.emspcr.app';
export const CAR56_NAME = 'Car56 Fire Investigation';
