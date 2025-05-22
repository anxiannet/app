
"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation"; // useSearchParams for redirect
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const { login, user, loading } = useAuth(); // Removed signup as it's same as login for mock
  const router = useRouter();
  const searchParams = useSearchParams(); // Get search params
  const { toast } = useToast();

  const [nickname, setNickname] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [redirectPath, setRedirectPath] = useState("/");

  useEffect(() => {
    const redirect = searchParams.get("redirect");
    if (redirect) {
      setRedirectPath(redirect);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!loading && user) {
      router.push(redirectPath);
    }
  }, [user, loading, router, redirectPath]);

  if (loading && !isSubmitting) {
    return <div className="text-center py-10">加载中...</div>;
  }

  if (user && !isSubmitting) {
     return null; // Return null while redirecting
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) {
      toast({ title: "信息不完整", description: "请输入昵称。", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      await login(nickname.trim());
      // useEffect will handle redirect on user state change
    } catch (error) {
      // Error toast would be handled in auth-context if it threw, but mock login is simple
      console.error("Mock login error (should not happen with current mock):", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center py-12">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-primary">暗线</CardTitle>
          <CardDescription>输入昵称以开始游戏 (模拟登录)</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={handleLogin}>
            <div className="space-y-2">
              <Label htmlFor="nickname" className="text-muted-foreground">昵称</Label>
              <Input
                id="nickname"
                type="text"
                placeholder="例如：暗影神探 (输入 'admin' 尝试管理员权限)"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                required
                className="focus:ring-accent focus:border-accent"
                disabled={isSubmitting}
              />
            </div>
            <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground transition-transform hover:scale-105 active:scale-95"
                disabled={!nickname.trim() || isSubmitting}
            >
                <LogIn className="mr-2 h-5 w-5" /> {isSubmitting ? "登录中..." : "登录 / 开始"}
            </Button>
          </form>
        </CardContent>
        {/* Footer can be removed or simplified for mock login */}
      </Card>
    </div>
  );
}
