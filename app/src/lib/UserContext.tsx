import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./api";
import type { UserInfo } from "./permissions";

type UserContextValue = {
  user: UserInfo | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

const UserContext = createContext<UserContextValue>({
  user: null,
  loading: true,
  refresh: async () => {},
});

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchUser() {
    try {
      const data = await api<{
        ok: boolean;
        userId: string;
        name: string;
        email: string;
        accountType?: string;
        role?: string;
        permissions?: Record<string, boolean> | null;
        onboardingCompletedAt: string | null;
      }>("/api/auth/me");

      setUser({
        userId: data.userId,
        name: data.name,
        email: data.email,
        accountType: (data.accountType as "standard" | "dependent") ?? "standard",
        role: data.role ?? "member",
        permissions: data.permissions
          ? {
              can_see_budget: !!data.permissions.can_see_budget,
              can_see_transactions: !!data.permissions.can_see_transactions,
              can_see_bills: !!data.permissions.can_see_bills,
              can_see_debts: !!data.permissions.can_see_debts,
              can_see_goals: !!data.permissions.can_see_goals,
              can_add_chores: !!data.permissions.can_add_chores,
              can_add_grocery: !!data.permissions.can_add_grocery,
              can_add_calendar: !!data.permissions.can_add_calendar,
              can_view_notes: !!data.permissions.can_view_notes,
              can_post_notes: !!data.permissions.can_post_notes,
            }
          : null,
        onboardingCompletedAt: data.onboardingCompletedAt,
      });
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUser();
  }, []);

  return (
    <UserContext.Provider value={{ user, loading, refresh: fetchUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
