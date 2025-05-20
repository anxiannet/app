
"use client";

import Link from "next/link";
import { Zap, Users } from "lucide-react";
import { AuthButton } from "./auth-button";
import { Button } from "./ui/button";
import { useAuth } from "@/contexts/auth-context";

export function SiteHeader() {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 max-w-screen-2xl items-center justify-between">
        <Link href="/" className="flex items-center space-x-2 group">
          <Zap className="h-8 w-8 text-primary transition-transform group-hover:rotate-[-15deg] group-hover:scale-110 duration-300" />
          <span className="text-2xl font-bold text-primary hover:text-primary/90 transition-colors">
            暗线
          </span>
        </Link>
        <nav className="flex items-center space-x-2 sm:space-x-4">
          <Button variant="ghost" asChild>
            <Link href="/">大厅</Link>
          </Button>
          {user?.isAdmin && (
            <Button variant="ghost" asChild>
              <Link href="/admin/users" className="flex items-center">
                <Users className="mr-1 h-4 w-4 sm:mr-2 sm:h-5 sm:w-5" />
                <span className="hidden sm:inline">玩家管理</span>
                <span className="sm:hidden">玩家</span>
              </Link>
            </Button>
          )}
          <AuthButton />
        </nav>
      </div>
    </header>
  );
}
