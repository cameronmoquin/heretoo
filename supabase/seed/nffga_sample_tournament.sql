-- ════════════════════════════════════════════════════════════════════════
-- NFFGA — SAMPLE DATA: one sample tournament at Triggs Memorial Golf Course
-- ════════════════════════════════════════════════════════════════════════
-- THIS IS SAMPLE DATA, NOT A REAL EVENT. It exists so the tournament page
-- can be previewed with every section filled. Its name ends in "(Sample)"
-- and its description starts with "Sample event for preview".
--
-- Course facts (name, address, phone, website) are from the course's own
-- site, https://www.triggs.us/ (checked 2026-10-04). The city's page
-- gives 1553 Chalkstone Ave and another directory gives ZIP 02908; the
-- course's own site (1533, 02909) is used. Fees, packages, contests,
-- schedule and policies are illustrative, not agreed with the course.
-- Contacts are deliberately empty. organizer_id is null: created by NFFGA.
--
-- Requires migration 107. Idempotent: inserts nothing if a tournament
-- with this exact name already exists.
--
-- TO DELETE IT (SQL editor, project avepftawrkwytlohobjh):
--   delete from public.nffga_tournaments
--    where name = 'NFFGA Spring Scramble at Triggs (Sample)';
-- That works while nobody has registered. Once anyone has signed its
-- waiver, signatures are append-only evidence (migration 104) and block
-- the delete; cancel it instead:
--   update public.nffga_tournaments set status = 'cancelled'
--    where name = 'NFFGA Spring Scramble at Triggs (Sample)';
-- ════════════════════════════════════════════════════════════════════════

insert into public.nffga_tournaments (
  organizer_id, status, name, description,
  format, format_notes, team_size, holes, handicap_required,
  course_name, course_address, course_city, course_state, course_postal, course_phone, course_url,
  timezone, starts_at, ends_at, check_in_at, start_type,
  registration_opens_at, registration_closes_at, rain_date, rain_policy,
  max_players, max_teams, waitlist_enabled,
  entry_mode, entry_fee_cents, team_fee_cents, currency, fee_includes, payment_instructions,
  dress_code, cart_policy, mulligans_policy, alcohol_policy, meal_included, meal_notes, prizes,
  schedule, packages, contests, host_department, sanctioned,
  contact_name, contact_email, contact_phone,
  waiver_required, waiver_text
)
select
  null, 'registration_open', 'NFFGA Spring Scramble at Triggs (Sample)', 'Sample event for preview — not a real tournament.

This page shows what a full NFFGA tournament listing looks like: a 4-person scramble with a shotgun start, entry for single golfers or full foursomes, sponsorship packages and on-course contests. Single golfers are placed in a foursome.',
  'scramble', '4-person scramble, 18 holes, shotgun start. Single golfers are placed in a foursome.', 4, 18, false,
  'Triggs Memorial Golf Course', '1533 Chalkstone Avenue', 'Providence', 'RI', '02909', '401-521-8460', 'https://www.triggs.us/',
  'America/New_York', '2027-04-01 08:00-04', '2027-04-01 14:00-04', '2027-04-01 07:00-04', 'shotgun',
  null, '2027-03-25 23:59-04', '2027-04-08',
  'Rain or shine. If the course closes for weather, the event moves to the rain date. Entry fees are not refunded after registration closes.',
  144, 36, true,
  'both', 12500, 46000, 'USD',
  '18 holes with cart, range balls, breakfast, lunch, a gift bag and entry into every contest.',
  'Pay at check-in by cash or check. Nothing is paid on this site.',
  'Golf attire: collared shirts, no denim, no tank tops, soft spikes only.',
  'Carts are included, two players per cart. Follow the course''s cart rules for the day.',
  'Mulligan packages are sold at registration: two mulligans and one throw per player.',
  'No outside alcohol. Beverages from the clubhouse and the beverage cart only.',
  true, 'Breakfast at registration. Lunch and awards after play.',
  'Awards for the top three teams, plus the contest prizes listed below.',
  '[{"at":"7:00 AM","what":"Registration, breakfast and range open"},{"at":"7:45 AM","what":"Rules briefing and cart assignments"},{"at":"8:00 AM","what":"Shotgun start"},{"at":"12:30 PM","what":"Lunch, awards and raffle"}]'::jsonb,
  '[{"name":"Title sponsor","price_cents":250000,"description":"One foursome, logo on the event banner and scorecards, and recognition at the awards lunch.","quantity_available":1},{"name":"Beverage cart sponsor","price_cents":50000,"description":"Signage on the beverage cart for the day.","quantity_available":1},{"name":"Hole sponsor","price_cents":25000,"description":"A sign with your name or logo at one tee box.","quantity_available":18},{"name":"Mulligan package","price_cents":2000,"description":"Per player: two mulligans and one throw. Sold at registration.","quantity_available":null}]'::jsonb,
  '[{"name":"Closest to the pin","hole":"Par 3s","prize":"Prize on each par 3","sponsor":null},{"name":"Longest drive","hole":null,"prize":"Prize at the awards lunch","sponsor":null},{"name":"Hole-in-one","hole":null,"prize":"Hole-in-one prize","sponsor":null},{"name":"Putting contest","hole":"Practice green","prize":"Prize at the awards lunch","sponsor":null}]'::jsonb,
  null, true,
  null, null, null,
  true, $waiver$PARTICIPATION AGREEMENT, ASSUMPTION OF RISK, AND RELEASE OF LIABILITY

Event: NFFGA Spring Scramble at Triggs (Sample)
Date: Thursday, April 1, 2027
Course: Triggs Memorial Golf Course
Host: National Fire Fighters Golf Association

In consideration of being permitted to participate in the event named above (the "Event"), I agree as follows.

1. Voluntary participation. I am taking part in the Event voluntarily. I am in adequate physical condition to play golf and to be outdoors for the duration of the Event, including in heat, cold, and wet conditions.

2. Assumption of risk. I understand that golf and attendance at a golf event involve risks that cannot be eliminated, including without limitation: being struck by a golf ball or club; injury from golf carts, whether driven by me or by others; slips, trips, and falls on uneven ground, stairs, and wet surfaces; lightning and severe weather; heat- and cold-related illness; insect and animal encounters; the consumption of food and beverages; and the acts or omissions of other participants, spectators, volunteers, and course staff. I knowingly and freely assume all such risks, both known and unknown, even if arising from the negligence of the parties released below, and I accept full responsibility for my participation.

3. Release. To the fullest extent permitted by law, I release, waive, and discharge the National Fire Fighters Golf Association, National Fire Fighters Golf Association, Triggs Memorial Golf Course, and each of their officers, directors, members, volunteers, employees, sponsors, and agents (together, the "Released Parties") from any and all claims, demands, and causes of action arising out of or related to any loss, damage, injury, or death that may be sustained by me, or to any property belonging to me, while participating in or traveling to or from the Event, whether caused by the negligence of the Released Parties or otherwise.

4. Indemnity. I agree to indemnify and hold harmless the Released Parties from any loss, liability, damage, or cost, including attorney fees, that they may incur because of my participation in the Event, whether caused by my negligence or otherwise.

5. Medical treatment. I consent to receive medical treatment that may be deemed advisable in the event of injury, accident, or illness during the Event. I understand that I am responsible for the cost of any such treatment and that the Released Parties do not provide medical insurance for participants. I have listed any medical conditions and allergies that emergency responders should know about on my registration.

6. Conduct and rules. I will follow the rules of golf as applied by the Event, the rules of the course, all safety instructions given by Event staff and course staff, and all applicable laws regarding alcohol and the operation of golf carts. I understand that I may be removed from the Event without refund for unsafe or unsporting conduct.

7. Photographs and recordings. I grant the National Fire Fighters Golf Association and National Fire Fighters Golf Association permission to photograph and record me at the Event and to use those images and recordings, and my name, in connection with the Event and with the promotion of the association, without compensation.

8. Fees. I understand that the entry fee is non-refundable unless the organizer states otherwise, and that the Event may be postponed, shortened, or cancelled because of weather or other conditions beyond the organizer's control.

9. Severability and governing law. If any part of this agreement is held invalid, the rest remains in effect. This agreement is governed by the laws of the state in which the Event is held.

10. Acknowledgement. I have read this agreement, I understand that by signing it I am giving up substantial rights, including the right to sue, and I sign it voluntarily. I am at least 18 years of age. If I am under 18, my parent or legal guardian has read and signed this agreement on my behalf.

Typing my full name below is my electronic signature and has the same effect as a handwritten signature.$waiver$
where not exists (
  select 1 from public.nffga_tournaments where name = 'NFFGA Spring Scramble at Triggs (Sample)'
)
returning id, name, status, starts_at;
