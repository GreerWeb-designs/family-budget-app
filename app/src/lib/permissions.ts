export type UserPermissions = {
  can_see_budget: boolean;
  can_see_transactions: boolean;
  can_see_bills: boolean;
  can_see_debts: boolean;
  can_see_goals: boolean;
  can_add_chores: boolean;
  can_add_grocery: boolean;
  can_add_calendar: boolean;
  can_view_notes: boolean;
  can_post_notes: boolean;
};

export type UserInfo = {
  userId: string;
  name: string;
  email: string;
  accountType: "standard" | "dependent";
  role: string; // "admin" | "primary" | "member"
  permissions: UserPermissions | null; // only set for dependents
  onboardingCompletedAt: string | null;
};

// Default open permissions — used for standard/admin accounts and as fallback
const OPEN_PERMISSIONS: UserPermissions = {
  can_see_budget: true,
  can_see_transactions: true,
  can_see_bills: true,
  can_see_debts: true,
  can_see_goals: true,
  can_add_chores: true,
  can_add_grocery: true,
  can_add_calendar: true,
  can_view_notes: true,
  can_post_notes: true,
};

export function isDependent(user: UserInfo | null): boolean {
  return user?.accountType === "dependent";
}

export function isAdminOrPrimary(user: UserInfo | null): boolean {
  return user?.role === "admin" || user?.role === "primary";
}

/**
 * Check if user has a given permission. Fails OPEN for standard accounts —
 * i.e. if user is not a dependent, they have full access.
 */
export function canAccess(user: UserInfo | null, permission: keyof UserPermissions): boolean {
  if (!user) return true; // not loaded yet → don't block
  if (user.accountType !== "dependent") return true; // standard/admin → full access
  const perms = user.permissions ?? OPEN_PERMISSIONS;
  return perms[permission] === true;
}
