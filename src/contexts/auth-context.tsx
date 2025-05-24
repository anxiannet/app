
"use client";

import type { User } from "@/lib/types";
import { useRouter } from "next/navigation";
import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useToast } from "@/hooks/use-toast";
import { PRE_GENERATED_AVATARS } from "@/lib/game-config";

interface AuthContextType {
  user: User | null;
  login: (nickname: string) => Promise<void>;
  // signup: (nickname: string) => Promise<void>; // Signup is same as login for mock
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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
      localStorage.removeItem(MOCK_USER_STORAGE_KEY);
    }
    setLoading(false);
  }, []);

  const createMockUser = (nickname: string): User => {
    const randomAvatarIndex = Math.floor(Math.random() * PRE_GENERATED_AVATARS.length);
    const randomAvatar = PRE_GENERATED_AVATARS[randomAvatarIndex];
    // const isAdmin = nickname.toLowerCase() === "admin"; // isAdmin logic removed
    return {
      id: nickname, // Using nickname as ID for mock
      name: nickname,
      avatarUrl: randomAvatar,
      // isAdmin: isAdmin, // isAdmin logic removed
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

  // Signup is effectively the same as login in this mock system
  // const signup = async (nickname: string) => {
  //   await login(nickname);
  // };

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
    router.push("/");
  };

  return (
    <AuthContext.Provider value={{ user, login, /*signup,*/ logout, loading }}>
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
