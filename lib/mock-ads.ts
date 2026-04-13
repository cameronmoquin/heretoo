/**
 * Mock advertisements for development.
 * These appear between posts in the feed.
 */

export interface MockAd {
  id: string;
  advertiser: string;
  headline: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  imageUrl?: string;
  category: string;
  badgeText?: string;
}

export const MOCK_ADS: MockAd[] = [
  {
    id: 'ad-001',
    advertiser: 'WAMP Token',
    headline: 'WAMP',
    body: 'The token that powers real community. Built different.',
    ctaLabel: 'Learn more',
    ctaUrl: 'https://wamptoken.com',
    category: 'Tech & Gadgets',
    badgeText: 'Crypto',
  },
  {
    id: 'ad-002',
    advertiser: 'Cameron Moquin',
    headline: 'Cameron Moquin for office',
    body: 'Real solutions. Real people. No corporate PAC money.',
    ctaLabel: 'Visit',
    ctaUrl: 'https://cameronmoquin.com',
    category: 'Local Community',
    badgeText: 'Local',
  },
  {
    id: 'ad-003',
    advertiser: 'Billing Therapy',
    headline: 'Medical billing is broken. We fix it.',
    body: 'Stop overpaying. We negotiate your medical bills and fight denied claims so you do not have to.',
    ctaLabel: 'Get help',
    ctaUrl: 'https://billing-therapy.com',
    category: 'Health & Wellness',
  },
  {
    id: 'ad-004',
    advertiser: 'StoryPath',
    headline: 'Your story. Your choices.',
    body: 'A choose your own adventure app where every decision matters. Hundreds of paths. No two playthroughs the same.',
    ctaLabel: 'Play now',
    ctaUrl: 'https://storypath.app',
    category: 'Entertainment',
    badgeText: 'New',
  },
];

/**
 * Get a mock ad to show at a given position in the feed.
 * Shows one ad every 3 posts.
 */
export function getAdForPosition(postIndex: number): MockAd | null {
  if (postIndex > 0 && postIndex % 3 === 2) {
    const adIndex = Math.floor(postIndex / 3) % MOCK_ADS.length;
    return MOCK_ADS[adIndex];
  }
  return null;
}
