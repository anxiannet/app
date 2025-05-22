
"use client";

import type { User } from "@/lib/types";
import { useRouter } from "next/navigation";
import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useToast } from "@/hooks/use-toast";

interface AuthContextType {
  user: User | null;
  login: (nickname: string) => Promise<void>;
  signup: (nickname: string) => Promise<void>; // For mock, signup can be same as login
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PRE_GENERATED_AVATARS: string[] = [
  "https://placehold.co/100x100/E6A4B4/white?text=A",
  "https://placehold.co/100x100/99BC85/white?text=B",
  "https://placehold.co/100x100/F3B95F/white?text=C",
  "https://placehold.co/100x100/7469B6/white?text=D",
  "https://placehold.co/100x100/FFC0D9/white?text=E",
  "https://placehold.co/100x100/86B6F6/white?text=F",
  "https://placehold.co/100x100/D7E4C0/white?text=G",
  "https://placehold.co/100x100/F2C18D/white?text=H",
  "https://placehold.co/100x100/ADA2FF/white?text=I",
  "https://placehold.co/100x100/F99417/white?text=J",
  "https://placehold.co/100x100/5DEBD7/black?text=K",
  "https://placehold.co/100x100/C5EBAA/black?text=L",
  "https://placehold.co/100x100/FFB84C/black?text=M",
  "https://placehold.co/100x100/E1AFD1/black?text=N",
  "https://placehold.co/100x100/91C8E4/black?text=P",
];

const MOCK_USER_STORAGE_KEY = "anxian-mock-user";

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    setLoading(true);
    try {
      const storedUserRaw = localStorage.getItem(MOCK_USER_STORAGE_KEY);
      if (storedUserRaw) {
        const storedUser = JSON.parse(storedUserRaw) as User;
        setUser(storedUser);
      }
    } catch (e) {
      console.error("Failed to load mock user from localStorage:", e);
      localStorage.removeItem(MOCK_USER_STORAGE_KEY); // Clear corrupted data
    }
    setLoading(false);
  }, []);

  const createMockUser = (nickname: string): User => {
    const randomAvatar = PRE_GENERATED_AVATARS[Math.floor(Math.random() * PRE_GENERATED_AVATARS.length)];
    // Simulate admin status for a specific nickname
    const isAdmin = nickname.toLowerCase() === "admin";
    return {
      id: nickname, // Use nickname as ID for mock
      name: nickname,
      avatarUrl: randomAvatar,
      isAdmin: isAdmin,
    };
  };

  const login = async (nickname: string) => {
    setLoading(true);
    if (!nickname || nickname.trim().length === 0) {
      toast({ title: "登录失败", description: "昵称不能为空。", variant: "destructive" });
      setLoading(false);
      return;
    }
    const mockUser = createMockUser(nickname.trim());
    setUser(mockUser);
    try {
      localStorage.setItem(MOCK_USER_STORAGE_KEY, JSON.stringify(mockUser));
    } catch (e) {
      console.error("Failed to save mock user to localStorage:", e);
    }
    toast({ title: "登录成功", description: `欢迎回来, ${mockUser.name}!` });
    setLoading(false);
  };

  const signup = async (nickname: string) => {
    // For mock login, signup is the same as login
    await login(nickname);
  };

  const logout = async () => {
    setLoading(true);
    setUser(null);
    try {
      localStorage.removeItem(MOCK_USER_STORAGE_KEY);
    } catch (e) {
      console.error("Failed to remove mock user from localStorage:", e);
    }
    toast({ title: "已登出" });
    setLoading(false);
    router.push("/"); // Navigate to home after logout
  };

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, loading }}>
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
