import { Redirect } from 'expo-router';

/**
 * The standalone vertical home is gone — family groups are the product
 * surface, not a separate brand. Anyone landing on /candon goes straight
 * to the family list.
 */
export default function CandonHome() {
  return <Redirect href="/candon/family" />;
}
