export type NavItem = {
  href: string;
  label: string;
};

/**
 * Only routes that exist are listed. Frontend B adds the application,
 * deployment, log and node entries when those pages land; a navigation entry
 * must never point at a page that does not exist (antislop R-24).
 *
 * The shell renders this list in a top bar. When the list grows past a handful
 * of entries, moving it into a sidebar is a change to `topbar.tsx` only.
 */
export const navItems: NavItem[] = [{ href: '/dashboard', label: 'Dashboard' }];
