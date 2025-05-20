
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const { login, signup, user, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [redirectPath, setRedirectPath] = useState("/");

  useEffect(() => {
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

  if (loading && !isSubmitting) { // Show loading only if not triggered by form submission
    return <div className="text-center py-10">加载中...</div>;
  }

  if (user) {
     return null; // Return null while redirecting
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim() || !password.trim()) {
      toast({ title: "信息不完整", description: "请输入昵称和密码。", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      await login(nickname.trim(), password);
      // useEffect will handle redirect on user state change
    } catch (error) {
      // Error toast is handled in auth-context
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim() || !password.trim()) {
      toast({ title: "信息不完整", description: "请输入昵称和密码以完成注册。", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "注册失败", description: "密码至少需要6位字符。", variant: "destructive"});
      return;
    }
    setIsSubmitting(true);
    try {
      await signup(nickname.trim(), password);
      // useEffect will handle redirect on user state change
    } catch (error) {
      // Error toast is handled in auth-context
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center py-12">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-primary">暗线</CardTitle>
          <CardDescription>登录或注册以加入这场神秘之旅。</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="nickname" className="text-muted-foreground">昵称 (将用作登录名)</Label>
              <Input
                id="nickname"
                type="text"
                placeholder="例如：暗影神探"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                required
                className="focus:ring-accent focus:border-accent"
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密码 (至少6位)</Label>
              <Input
                id="password"
                type="password"
                placeholder="请输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="focus:ring-accent focus:border-accent"
                disabled={isSubmitting}
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={handleLogin}
                type="submit"
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground transition-transform hover:scale-105 active:scale-95"
                disabled={!nickname.trim() || !password.trim() || isSubmitting}
              >
                <LogIn className="mr-2 h-5 w-5" /> {isSubmitting ? "登录中..." : "登录"}
              </Button>
              <Button
                onClick={handleSignup}
                type="button" // Important: type="button" to prevent form submission by login
                variant="outline"
                className="w-full transition-transform hover:scale-105 active:scale-95"
                disabled={isSubmitting} // Changed this line
              >
                <UserPlus className="mr-2 h-5 w-5" /> {isSubmitting ? "处理中..." : "注册"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
