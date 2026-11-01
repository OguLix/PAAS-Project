import { redirect } from 'next/navigation';

/**
 * The workspace root has no content of its own. The dashboard guard sends an
 * anonymous visitor to the sign in page, so there is one extra hop on a cold
 * load and no duplicated routing rule here.
 */
export default function HomePage() {
  redirect('/dashboard');
}
