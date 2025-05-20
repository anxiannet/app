
"use client";

import Link from "next/link";
import { Zap } from "lucide-react"; // Using Zap as a placeholder for app icon
import { AuthButton } from "./auth-button";
import { Button } from "./ui/button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 max-w-screen-2xl items-center justify-between">
        <Link href="/" className="flex items-center space-x-2 group">
          <Zap className="h-8 w-8 text-primary transition-transform group-hover:rotate-[-15deg] group-hover:scale-110 duration-300" />
          <span className="text-2xl font-bold text-primary hover:text-primary/90 transition-colors">
            暗线
          </span>
        </Link>
        <nav className="flex items-center space-x-4">
          <Button variant="ghost" asChild>
            <Link href="/">大厅</Link>
          </Button>
          {/* Add other navigation links here if needed */}
          <AuthButton />
        </nav>
      </div>
    </header>
  );
}
