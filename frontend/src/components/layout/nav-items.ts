export type NavItem = {
  href: string;
  label: string;
};

/** Only implemented routes are listed; do not link to unfinished pages. */
export const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/applications', label: 'Applications' },
];
