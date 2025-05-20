
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MessageCircle } from "lucide-react"; // Placeholder for WeChat icon

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [redirectPath, setRedirectPath] = useState("/");

  useEffect(() => {
    // Get redirect path from query params
    const queryParams = new URLSearchParams(window.location.search);
    const redirect = queryParams.get("redirect");
    if (redirect) {
      setRedirectPath(redirect);
    }
  }, []);


  useEffect(() => {
    if (!loading && user) {
      router.push(redirectPath);
    }
  }, [user, loading, router, redirectPath]);

  if (loading) {
    return <div className="text-center py-10">加载中...</div>;
  }

  if (user) {
    return null; // Return null while redirecting
  }

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      login(name.trim());
      // useEffect will handle the redirect
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center py-12">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-primary">暗线 登录</CardTitle>
          <CardDescription>登录以加入这场神秘之旅。</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-muted-foreground">请输入您的昵称</Label>
              <Input
                id="name"
                type="text"
                placeholder="例如：暗影神探"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="focus:ring-accent focus:border-accent"
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground transition-transform hover:scale-105 active:scale-95"
              disabled={!name.trim()}
            >
              <MessageCircle className="mr-2 h-5 w-5" /> 使用昵称登录 (模拟)
            </Button>
          </form>
        </CardContent>
        <CardFooter className="text-center">
          {/* Content removed as requested */}
        </CardFooter>
      </Card>
    </div>
  );
}
