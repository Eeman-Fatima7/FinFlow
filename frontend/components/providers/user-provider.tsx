"use client";

import { createContext, useContext, useState, ReactNode, useEffect, useCallback } from "react";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/components/providers/auth-provider";

export interface UserProfile {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  bio: string;
  avatarUrl: string | null;
}

interface UserContextType {
  user: UserProfile;
  updateUser: (updates: Partial<UserProfile>) => Promise<void>;
  resetUser: () => void;
  isAuthenticated: boolean;
}

const defaultUser: UserProfile = {
  fullName: "",
  email: "",
  phone: "",
  location: "",
  bio: "",
  avatarUrl: null,
};

const UserContext = createContext<UserContextType | undefined>(undefined);

const getInitialUser = (): UserProfile => {
  if (typeof window === "undefined") {
    return defaultUser;
  }

  const token = localStorage.getItem("financeadvisor.token");
  if (!token) {
    return defaultUser;
  }

  const storedUser = localStorage.getItem("finflow.user");
  if (storedUser) {
    try {
      return { ...defaultUser, ...JSON.parse(storedUser) };
    } catch (e) {
      console.error("Failed to parse user profile", e);
    }
  }

  return defaultUser;
};

const getInitialAuthState = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }

  return Boolean(localStorage.getItem("financeadvisor.token"));
};

export function UserProvider({ children }: { children: ReactNode }) {
  const { user: authUser, isAuthenticated: authIsAuthenticated, refreshUser } = useAuth();

  const [user, setUser] = useState<UserProfile>(() => getInitialUser());
  const [isAuthenticated, setIsAuthenticated] = useState(() => getInitialAuthState());

  useEffect(() => {
    setIsAuthenticated(authIsAuthenticated);
  }, [authIsAuthenticated]);

  useEffect(() => {
    if (!authUser) {
      return;
    }

    setUser((prev) => {
      const next: UserProfile = {
        ...prev,
        fullName: authUser.name || prev.fullName,
        email: authUser.email || prev.email,
        phone: authUser.phone ?? "",
        location: authUser.city ?? "",
        bio: authUser.bio ?? "",
        avatarUrl: authUser.avatar_url ?? null,
      };

      const unchanged =
        prev.fullName === next.fullName &&
        prev.email === next.email &&
        prev.phone === next.phone &&
        prev.location === next.location &&
        prev.bio === next.bio &&
        prev.avatarUrl === next.avatarUrl;

      if (unchanged) {
        return prev;
      }

      localStorage.setItem("finflow.user", JSON.stringify(next));
      return next;
    });

  }, [authUser]);

  const updateUser = useCallback(async (updates: Partial<UserProfile>) => {
    const nextUser = { ...user, ...updates };

    if (nextUser.fullName && nextUser.email) {
      await apiRequest<{ message: string; user: unknown }>("/auth/me", {
        method: "PUT",
        auth: true,
        body: JSON.stringify({
          name: nextUser.fullName,
          email: nextUser.email,
          city: nextUser.location,
          phone: nextUser.phone,
          bio: nextUser.bio,
          avatar_url: nextUser.avatarUrl,
        }),
      });

      await refreshUser();
      setIsAuthenticated(true);
      return;
    }

    setUser((prev) => {
      const merged = { ...prev, ...updates };
      const unchanged =
        prev.fullName === merged.fullName &&
        prev.email === merged.email &&
        prev.phone === merged.phone &&
        prev.location === merged.location &&
        prev.bio === merged.bio &&
        prev.avatarUrl === merged.avatarUrl;

      if (unchanged) {
        return prev;
      }

      localStorage.setItem("finflow.user", JSON.stringify(merged));
      return merged;
    });
    setIsAuthenticated(true);
  }, [refreshUser, user]);

  const resetUser = () => {
    setUser(defaultUser);
    localStorage.removeItem("finflow.user");
    localStorage.removeItem("finflow.app-user");
    setIsAuthenticated(false);
  };


  return (
    <UserContext.Provider value={{ user, updateUser, resetUser, isAuthenticated }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}
