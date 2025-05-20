
"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, User as UserIcon, History } from "lucide-react"; // Added History icon
import { Skeleton } from "./ui/skeleton";

export function AuthButton() {
  const { user, logout, loading } = useAuth();

  if (loading) {
    return <Skeleton className="h-10 w-20" />;
  }

  if (!user) {
    return (
      <Button asChild className="transition-transform hover:scale-105 active:scale-95">
        <Link href="/login">登录</Link>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0 transition-transform hover:scale-105 active:scale-95">
          <Avatar className="h-10 w-10 border-2 border-primary hover:border-accent transition-colors">
            <AvatarImage src={user.avatarUrl} alt={user.name} data-ai-hint="avatar person" />
            <AvatarFallback>{user.name.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.name}</p>
            {/* Player ID display removed */}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link href="/history">
            <History className="mr-2 h-4 w-4" />
            <span>游戏记录</span>
          </Link>
        </DropdownMenuItem>
        {/* <DropdownMenuItem>
          <UserIcon className="mr-2 h-4 w-4" />
          <span>Profile</span>
        </DropdownMenuItem> */}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          <span>退出登录</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
