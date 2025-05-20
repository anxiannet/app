
"use client";

import type { User } from "@/lib/types";
import { useRouter } from "next/navigation";
import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface AuthContextType {
  user: User | null;
  login: (name: string) => void;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PRE_GENERATED_AVATARS: string[] = [
  "https://placehold.co/100x100/E6A4B4/white?text=A", // Light Pink
  "https://placehold.co/100x100/99BC85/white?text=B", // Light Green
  "https://placehold.co/100x100/F3B95F/white?text=C", // Light Orange
  "https://placehold.co/100x100/7469B6/white?text=D", // Light Purple
  "https://placehold.co/100x100/FFC0D9/white?text=E", // Lighter Pink
  "https://placehold.co/100x100/86B6F6/white?text=F", // Light Blue
  "https://placehold.co/100x100/D7E4C0/white?text=G", // Pale Green
  "https://placehold.co/100x100/F2C18D/white?text=H", // Pale Orange
  "https://placehold.co/100x100/ADA2FF/white?text=I", // Pale Lavender
  "https://placehold.co/100x100/F99417/white?text=J", // Orange
  "https://placehold.co/100x100/5DEBD7/black?text=K", // Teal
  "https://placehold.co/100x100/C5EBAA/black?text=L", // Lime Green
  "https://placehold.co/100x100/FFB84C/black?text=M", // Bright Orange
  "https://placehold.co/100x100/E1AFD1/black?text=N", // Orchid
  "https://placehold.co/100x100/91C8E4/black?text=P", // Sky Blue
];

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Try to load user from localStorage on initial load
    try {
      const storedUser = localStorage.getItem("anxian-user");
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error("Failed to parse user from localStorage", error);
      localStorage.removeItem("anxian-user");
    }
    setLoading(false);
  }, []);

  const login = (name: string) => {
    const randomAvatar = PRE_GENERATED_AVATARS[Math.floor(Math.random() * PRE_GENERATED_AVATARS.length)];
    const mockUser: User = {
      id: Date.now().toString(), // Simple unique ID
      name: name || "匿名玩家",
      avatarUrl: randomAvatar,
    };
    setUser(mockUser);
    localStorage.setItem("anxian-user", JSON.stringify(mockUser));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("anxian-user");
    router.push("/"); // Redirect to home on logout
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
