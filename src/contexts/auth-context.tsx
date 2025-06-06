
"use client";

import type { User } from "@/lib/types";
import { useRouter } from "next/navigation";
import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User as FirebaseUser // Alias Firebase's User to avoid naming conflict
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase"; // Ensure auth and db are exported from firebase.ts
import { useToast } from "@/hooks/use-toast";

interface AuthContextType {
  user: User | null;
  login: (nicknameAsEmail: string, password: string) => Promise<void>;
  signup: (nicknameAsEmail: string, password: string) => Promise<void>;
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

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (!auth) {
      console.error("Firebase auth is not initialized. User auth state cannot be tracked.");
      setLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        if (!db) {
          console.error("Firestore db is not initialized. Cannot fetch user profile.");
          setUser(null);
          setLoading(false);
          return;
        }
        const userDocRef = doc(db, "users", firebaseUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          setUser({
            id: firebaseUser.uid,
            name: userData.nickname, 
            avatarUrl: userData.avatarUrl,
            isAdmin: userData.isAdmin || false, // Fetch isAdmin field
          });
        } else {
          console.warn(`User profile not found in Firestore for UID: ${firebaseUser.uid}. Logging out.`);
          await signOut(auth);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [toast]);

  const login = async (nicknameAsEmail: string, password: string) => {
    if (!auth) {
       toast({ title: "登录错误", description: "Firebase服务未初始化。", variant: "destructive" });
       throw new Error("Firebase auth not initialized");
    }
    setLoading(true);
    try {
      const emailToUse = `${nicknameAsEmail}@anxian.game`;
      console.log(`Attempting to sign in with email: ${emailToUse}`);
      await signInWithEmailAndPassword(auth, emailToUse, password);
    } catch (error: any) {
      console.error("Login error:", error);
      let errorMessage = "登录失败，请稍后再试。";
      if (error.code === "auth/invalid-credential" ||
          error.code === "auth/user-not-found" || // Older code, still sometimes used
          error.code === "auth/wrong-password") { // Older code
        errorMessage = "您输入的昵称或密码不正确，请检查后重试。";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "昵称格式无效 (不能用作邮箱)。"
      } else if (error.code === "auth/configuration-not-found") {
        errorMessage = "Firebase认证配置错误。请检查应用的API密钥和项目设置，并确保在Firebase控制台中启用了Email/Password登录方式。";
      }
      toast({ title: "登录失败", description: errorMessage, variant: "destructive" });
      setLoading(false); 
      throw error; 
    }
  };

  const signup = async (nicknameAsEmail: string, password: string) => {
    if (!auth || !db) {
       toast({ title: "注册错误", description: "Firebase服务未初始化。", variant: "destructive" });
       throw new Error("Firebase auth or db not initialized");
    }
    setLoading(true);
    try {
      const emailToUse = `${nicknameAsEmail}@anxian.game`;
      const userCredential = await createUserWithEmailAndPassword(auth, emailToUse, password);
      const firebaseUser = userCredential.user;
      const randomAvatar = PRE_GENERATED_AVATARS[Math.floor(Math.random() * PRE_GENERATED_AVATARS.length)];

      const userDocRef = doc(db, "users", firebaseUser.uid);
      await setDoc(userDocRef, {
        uid: firebaseUser.uid,
        nickname: nicknameAsEmail, 
        avatarUrl: randomAvatar,
        createdAt: new Date().toISOString(),
        isAdmin: false, // Default to not admin
      });
    } catch (error: any) {
      console.error("Signup error:", error);
      let errorMessage = "注册失败，请稍后再试。";
      if (error.code === "auth/email-already-in-use") {
        errorMessage = "此昵称已被注册。";
      } else if (error.code === "auth/weak-password") {
        errorMessage = "密码太弱，请使用更强的密码。";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "昵称格式无效 (不能用作邮箱)。"
      } else if (error.code === "auth/configuration-not-found") {
         errorMessage = "Firebase认证配置错误。请检查应用的API密钥和项目设置。";
      }
      toast({ title: "注册失败", description: errorMessage, variant: "destructive" });
      setLoading(false); 
      throw error; 
    }
  };

  const logout = async () => {
    if (!auth) {
       toast({ title: "登出错误", description: "Firebase服务未初始化。", variant: "destructive" });
       return;
    }
    setLoading(true);
    try {
      await signOut(auth);
      router.push("/");
    } catch (error) {
      console.error("Logout error:", error);
      toast({ title: "登出失败", description: "无法登出，请稍后再试。", variant: "destructive" });
    }
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
