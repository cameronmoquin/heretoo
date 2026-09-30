/**
 * The default participation waiver.
 *
 * ────────────────────────────────────────────────────────────────────
 * DRAFT. NOT REVIEWED BY COUNSEL. Do not run a real event on it.
 *
 * This is the text a new tournament starts with (tournaments.waiver_text).
 * An organizer may edit it per event. Whatever text a player signs is
 * frozen into tournament_waiver_signatures with its SHA-256, so editing
 * this file never changes what anyone already agreed to.
 *
 * Placeholders in [brackets] are filled by the app from the tournament
 * row before the text is shown or signed. Every one of them must be
 * resolved; an unresolved bracket is a bug, not a blank.
 * ────────────────────────────────────────────────────────────────────
 */

import { SITE_LONG_NAME } from './site';

export const WAIVER_PLACEHOLDERS = [
  'EVENT_NAME',
  'EVENT_DATE',
  'COURSE_NAME',
  'HOST_ORGANIZATION',
] as const;

export type WaiverPlaceholder = (typeof WAIVER_PLACEHOLDERS)[number];

export const DEFAULT_WAIVER_TEXT = `PARTICIPATION AGREEMENT, ASSUMPTION OF RISK, AND RELEASE OF LIABILITY

Event: [EVENT_NAME]
Date: [EVENT_DATE]
Course: [COURSE_NAME]
Host: [HOST_ORGANIZATION]

In consideration of being permitted to participate in the event named above (the "Event"), I agree as follows.

1. Voluntary participation. I am taking part in the Event voluntarily. I am in adequate physical condition to play golf and to be outdoors for the duration of the Event, including in heat, cold, and wet conditions.

2. Assumption of risk. I understand that golf and attendance at a golf event involve risks that cannot be eliminated, including without limitation: being struck by a golf ball or club; injury from golf carts, whether driven by me or by others; slips, trips, and falls on uneven ground, stairs, and wet surfaces; lightning and severe weather; heat- and cold-related illness; insect and animal encounters; the consumption of food and beverages; and the acts or omissions of other participants, spectators, volunteers, and course staff. I knowingly and freely assume all such risks, both known and unknown, even if arising from the negligence of the parties released below, and I accept full responsibility for my participation.

3. Release. To the fullest extent permitted by law, I release, waive, and discharge the ${SITE_LONG_NAME}, [HOST_ORGANIZATION], [COURSE_NAME], and each of their officers, directors, members, volunteers, employees, sponsors, and agents (together, the "Released Parties") from any and all claims, demands, and causes of action arising out of or related to any loss, damage, injury, or death that may be sustained by me, or to any property belonging to me, while participating in or traveling to or from the Event, whether caused by the negligence of the Released Parties or otherwise.

4. Indemnity. I agree to indemnify and hold harmless the Released Parties from any loss, liability, damage, or cost, including attorney fees, that they may incur because of my participation in the Event, whether caused by my negligence or otherwise.

5. Medical treatment. I consent to receive medical treatment that may be deemed advisable in the event of injury, accident, or illness during the Event. I understand that I am responsible for the cost of any such treatment and that the Released Parties do not provide medical insurance for participants. I have listed any medical conditions and allergies that emergency responders should know about on my registration.

6. Conduct and rules. I will follow the rules of golf as applied by the Event, the rules of the course, all safety instructions given by Event staff and course staff, and all applicable laws regarding alcohol and the operation of golf carts. I understand that I may be removed from the Event without refund for unsafe or unsporting conduct.

7. Photographs and recordings. I grant the ${SITE_LONG_NAME} and [HOST_ORGANIZATION] permission to photograph and record me at the Event and to use those images and recordings, and my name, in connection with the Event and with the promotion of the association, without compensation.

8. Fees. I understand that the entry fee is [non-refundable except as stated by the organizer] and that the Event may be postponed, shortened, or cancelled because of weather or other conditions beyond the organizer's control.

9. Severability and governing law. If any part of this agreement is held invalid, the rest remains in effect. This agreement is governed by the laws of the state in which the Event is held.

10. Acknowledgement. I have read this agreement, I understand that by signing it I am giving up substantial rights, including the right to sue, and I sign it voluntarily. I am at least 18 years of age. If I am under 18, my parent or legal guardian has read and signed this agreement on my behalf.

Typing my full name below is my electronic signature and has the same effect as a handwritten signature.`;

/** Fill the bracketed placeholders. Throws on any left unresolved. */
export function renderWaiver(
  text: string,
  values: Record<WaiverPlaceholder, string>,
): string {
  let out = text;
  for (const key of WAIVER_PLACEHOLDERS) {
    out = out.split(`[${key}]`).join(values[key] ?? '');
  }
  const leftover = out.match(/\[(EVENT_NAME|EVENT_DATE|COURSE_NAME|HOST_ORGANIZATION)\]/);
  if (leftover) throw new Error(`waiver placeholder unresolved: ${leftover[0]}`);
  return out;
}
