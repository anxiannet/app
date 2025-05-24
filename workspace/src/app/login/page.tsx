
"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function LoginContent() {
  const { login, signup, user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [redirectPath, setRedirectPath] = useState("/");

  useEffect(() => {
    const redirect = searchParams.get("redirect");
    if (redirect) {
      setRedirectPath(redirect);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!loading && user && !isSubmitting) {
      router.push(redirectPath);
    }
  }, [user, loading, router, redirectPath, isSubmitting]);

  if (loading && !isSubmitting) {
    return (
      <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center py-12">
        <div className="text-center py-10">加载中...</div>
      </div>
    );
  }

  if (user && !isSubmitting) {
    return (
      <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center py-12">
        <div className="text-center py-10">已登录，正在跳转...</div>
      </div>
    );
  }

  const handleAuthAction = async (action: "login" | "signup") => {
    if (!nickname.trim()) {
      toast({
        title: "信息不完整",
        description: "请输入昵称。",
        variant: "destructive",
      });
      return;
    }
    if (action === "signup" && !password.trim()) {
      toast({
        title: "信息不完整",
        description: "注册时请输入密码。",
        variant: "destructive",
      });
      return;
    }
     if (action === "login" && !password.trim()) {
      toast({
        title: "信息不完整",
        description: "登录时请输入密码。",
        variant: "destructive",
      });
      return;
    }


    setIsSubmitting(true);
    try {
      if (action === "login") {
        await login(nickname.trim(), password);
      } else {
        await signup(nickname.trim(), password);
      }
      // useEffect will handle redirect on user state change
    } catch (error) {
      // Error handling is now more specific in auth-context
      // console.error(`${action} error:`, error);
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center py-12">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-primary">暗线</CardTitle>
          <CardDescription>
            输入昵称和密码以开始游戏
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); handleAuthAction("login");}}>
            <div className="space-y-2">
              <Label htmlFor="nickname" className="text-muted-foreground">
                昵称 (将作为登录邮箱前缀)
              </Label>
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
            <div className="space-y-2">
              <Label htmlFor="password" className="text-muted-foreground">
                密码
              </Label>
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
                    type="submit"
                    className="w-full flex-1 bg-primary hover:bg-primary/90 text-primary-foreground transition-transform hover:scale-105 active:scale-95"
                    disabled={!nickname.trim() || !password.trim() || isSubmitting}
                >
                    <LogIn className="mr-2 h-5 w-5" /> {isSubmitting ? "处理中..." : "登录"}
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleAuthAction("signup")}
                    className="w-full flex-1 transition-transform hover:scale-105 active:scale-95"
                    disabled={!nickname.trim() || !password.trim() || isSubmitting}
                >
                    {isSubmitting ? "处理中..." : "注册"}
                </Button>
            </div>
          </form>
        </CardContent>
        {/* <CardFooter className="text-center text-xs text-muted-foreground">
          
        </CardFooter> */}
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center py-12">
        <div className="text-center py-10">载入登录页面...</div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
