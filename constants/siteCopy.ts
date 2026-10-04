/**
 * siteCopy — the website text site admins can change from /admin → Copy.
 *
 * Each key has a label, where it shows, and its DEFAULT: the exact text
 * the site carried before the dashboard existed, so nothing changes
 * until an admin saves something. A saved value lives in
 * nffga_site_copy (migration 110); "Reset to default" deletes the row.
 *
 * allowEmpty: the line may be saved empty, which hides it. Lines without
 * it must have words; to undo an edit, reset to the default instead.
 *
 * Adding a key: add it here, then read it with useCopy('the.key')
 * (lib/nffga/copy.ts) where it shows. Keys match ^[a-z0-9_.]{1,80}$.
 */
import { SITE_LONG_NAME, SITE_NAME } from './site';

export interface CopyEntry {
  label: string;
  where: string;
  default: string;
  allowEmpty?: boolean;
  multiline?: boolean;
}

export const SITE_COPY = {
  'home.tagline': {
    label: 'Home tagline',
    where: 'Home page, the line under the association’s full name. Hidden when empty.',
    default: '',
    allowEmpty: true,
  },
  'join.subtitle': {
    label: 'Join page subtitle',
    where: 'Create-account page (/join), under “Create your account”. Hidden when empty.',
    default: '',
    allowEmpty: true,
    multiline: true,
  },
  'signin.subtitle': {
    label: 'Sign-in page subtitle',
    where: 'Sign-in page (/signin), under “Sign in”. Hidden when empty.',
    default: '',
    allowEmpty: true,
    multiline: true,
  },
  'clubhouse.empty': {
    label: 'Clubhouse empty-state line',
    where: 'Clubhouse page and the home feed, when there are no posts yet.',
    default: 'No posts yet.',
  },
  'gear.intro': {
    label: 'Gear trade intro',
    where: 'Gear trade page (/gear), under the title. Hidden when empty.',
    default: 'Buy, sell, trade and give away golf gear with other members. Payment is arranged between members.',
    allowEmpty: true,
    multiline: true,
  },
  'tournaments.intro': {
    label: 'Tournaments intro',
    where: 'Tournaments page (/tournaments), under the title. Hidden when empty.',
    default: '',
    allowEmpty: true,
    multiline: true,
  },
  'host.intro': {
    label: 'Host-an-event intro',
    where: 'Host an event page (/tournaments/host), above the request form. Hidden when empty.',
    default: `Fire departments can propose a regional golf event to be officiated by ${SITE_NAME}. Send the details below and an officer will review the request and follow up.`,
    allowEmpty: true,
    multiline: true,
  },
  'contact.intro': {
    label: 'Contact page intro',
    where: 'Contact us page (/contact), above the form. Hidden when empty.',
    default: `Questions about ${SITE_NAME}, a tournament or this site? Send a message and an admin will reply by email.`,
    allowEmpty: true,
    multiline: true,
  },
  'footer.line': {
    label: 'Footer line',
    where: 'The foot of public pages, above the links. Hidden when empty.',
    default: SITE_LONG_NAME,
    allowEmpty: true,
  },
} satisfies Record<string, CopyEntry>;

export type CopyKey = keyof typeof SITE_COPY;

export const COPY_KEYS = Object.keys(SITE_COPY) as CopyKey[];

/** Longest text a copy value may hold (matches the database check). */
export const COPY_MAX_LENGTH = 4000;
