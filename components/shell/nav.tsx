import { BookMarked, GitPullRequest, LayoutDashboard, Settings, Workflow } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  /** extra path prefixes that also mark this item active */
  match?: string[];
};

export const WORKSPACE_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  // Cross-repo view — the alternative was opening each repository in turn
  { href: "/pulls", label: "Pull requests", icon: GitPullRequest },
  { href: "/repos", label: "Repositories", icon: BookMarked },
  { href: "/workflow", label: "Workflows", icon: Workflow },
];

export const ACCOUNT_NAV: NavItem[] = [
  { href: "/settings", label: "Settings", icon: Settings },
];

export function isActive(pathname: string, item: NavItem) {
  const prefixes = [item.href, ...(item.match ?? [])];
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
