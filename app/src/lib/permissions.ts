export type UserPermissions = {
  finances_enabled: boolean;
  can_see_budget: boolean;
  can_see_transactions: boolean;
  can_see_bills: boolean;
  can_see_debts: boolean;
  can_see_spending: boolean;
  can_see_goals: boolean;
  can_add_chores: boolean;
  can_add_grocery: boolean;
  can_add_calendar: boolean;
  can_view_notes: boolean;
  can_post_notes: boolean;
  can_see_recipes: boolean;
  can_see_meals: boolean;
  can_see_todo: boolean;
  can_see_allowance: boolean;
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
  finances_enabled: true,
  can_see_budget: true,
  can_see_transactions: true,
  can_see_bills: true,
  can_see_debts: true,
  can_see_spending: true,
  can_see_goals: true,
  can_add_chores: true,
  can_add_grocery: true,
  can_add_calendar: true,
  can_view_notes: true,
  can_post_notes: true,
  can_see_recipes: true,
  can_see_meals: true,
  can_see_todo: true,
  can_see_allowance: false,
};

// Financial permissions that are blocked when finances_enabled = false
const FINANCE_PERMS = new Set<keyof UserPermissions>([
  "can_see_budget", "can_see_transactions", "can_see_bills",
  "can_see_debts", "can_see_spending",
]);

export function isDependent(user: UserInfo | null): boolean {
  return user?.accountType === "dependent";
}

export function isAdminOrPrimary(user: UserInfo | null): boolean {
  return user?.role === "admin" || user?.role === "primary";
}

/** True when the user can see the Finances section at all. */
export function financesEnabled(user: UserInfo | null): boolean {
  if (!user || user.accountType !== "dependent") return true;
  const perms = user.permissions ?? OPEN_PERMISSIONS;
  return perms.finances_enabled !== false;
}

/**
 * Check if user has a given permission.
 * Standard/admin accounts always return true.
 * Dependents with finances_enabled=false are blocked from all finance permissions.
 */
export function canAccess(user: UserInfo | null, permission: keyof UserPermissions): boolean {
  if (!user) return true;
  if (user.accountType !== "dependent") return true;
  const perms = user.permissions ?? OPEN_PERMISSIONS;
  if (FINANCE_PERMS.has(permission) && !perms.finances_enabled) return false;
  return perms[permission] === true;
}
