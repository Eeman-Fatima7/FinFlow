import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { toast } from "sonner";

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
  updateUser: (updates: Partial<UserProfile>) => void;
  resetUser: () => void;
  isAuthenticated: boolean;
}

const defaultUser: UserProfile = {
  fullName: "Alex Johnson",
  email: "alex@example.com",
  phone: "+1 (555) 123-4567",
  location: "San Francisco, CA",
  bio: "Finance enthusiast tracking my journey to financial freedom.",
  avatarUrl: null,
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile>(() => {
    // Check if window is defined (client-side)
    if (typeof window !== "undefined") {
      const storedUser = localStorage.getItem("finflow.user");
      if (storedUser) {
        try {
          return { ...defaultUser, ...JSON.parse(storedUser) };
        } catch (e) {
          console.error("Failed to parse user profile", e);
        }
      }
    }
    return defaultUser;
  });
  
  const [isAuthenticated, setIsAuthenticated] = useState(true);

  const updateUser = (updates: Partial<UserProfile>) => {
    setUser((prev) => {
      const newUser = { ...prev, ...updates };
      localStorage.setItem("finflow.user", JSON.stringify(newUser));
      return newUser;
    });
  };

  const resetUser = () => {
    setUser(defaultUser);
    localStorage.removeItem("finflow.user");
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
