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
  const { login, user } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");

  useEffect(() => {
    if (user) {
      router.push("/"); // Redirect if already logged in
    }
  }, [user, router]);

  if (user) {
    return null; // Return null while redirecting
  }

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      login(name.trim());
      // No need to push here, useEffect will handle it after user state updates
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center py-12">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-primary">暗线 Login</CardTitle>
          <CardDescription>Sign in to join the mystery.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-muted-foreground">Enter Your Nickname</Label>
              <Input
                id="name"
                type="text"
                placeholder="e.g. ShadowSleuth"
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
              <MessageCircle className="mr-2 h-5 w-5" /> Login with Nickname (Simulated)
            </Button>
          </form>
        </CardContent>
        <CardFooter className="text-center">
          <p className="text-xs text-muted-foreground">
            WeChat login is simulated for demonstration.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
