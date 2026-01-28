"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserNav } from "@/components/user-nav";

export default function Navbar() {
  const { data: session } = useSession();

  return (
    <nav className="border-b bg-background">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href={session ? "/dashboard" : "/"} className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-xl">A</span>
          </div>
          <span className="font-semibold text-xl">Autozynq</span>
        </Link>

        {/* Navigation Links - Only when logged in */}
        {session && (
          <div className="hidden md:flex items-center gap-6">
            <Link 
              href="/workflows" 
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Workflows
            </Link>
            <Link 
              href="/connections" 
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Connections
            </Link>
            <Link 
              href="/executions" 
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Executions
            </Link>
          </div>
        )}

        {/* Right Side Actions */}
        <div className="flex items-center gap-4">
          <ThemeToggle />
          {session ? (
            <UserNav />
          ) : (
            <Button asChild>
              <Link href="/auth/signin">Sign In</Link>
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}
