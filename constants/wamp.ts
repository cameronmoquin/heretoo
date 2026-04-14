/**
 * WAMP token economy.
 *
 * Earn rates — designed so an active member earns ~1 invite token per week.
 * Invite costs 1.0 WAMP.
 * New members get a genesis grant of 0.5 (not enough to invite yet — earn it).
 */

export const WAMP = {
  // Earning
  EARN_VOTE: 0.02,               // per Pulse vote
  EARN_BRIDGE_COMPLETE: 0.25,     // completed a Bridge conversation
  EARN_POST_BRIDGING: 0.10,       // post reached 3+ clusters
  EARN_COMMENT: 0.01,             // posted a comment
  EARN_DAILY_LOGIN: 0.05,         // showed up today
  EARN_INVITE_ACCEPTED: 0.20,     // someone you invited joined
  GENESIS_GRANT: 0.50,            // new member starter

  // Spending
  INVITE_COST: 1.0,               // cost to generate an invite code

  // Transfer
  MIN_TRANSFER: 0.01,
  MAX_TRANSFER_PER_DAY: 5.0,

  // Display
  SYMBOL: 'W',
  NAME: 'WAMP',
  DECIMALS: 2,
} as const;

/**
 * Format WAMP amount for display.
 */
export function formatWamp(amount: number): string {
  return `${amount.toFixed(WAMP.DECIMALS)} ${WAMP.SYMBOL}`;
}
