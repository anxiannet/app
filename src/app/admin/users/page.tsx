
"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
// Firestore imports might be removed if not fetching users for mock
// import { collection, getDocs, orderBy, query, Timestamp } from "firebase/firestore";
// import { db } from "@/lib/firebase"; // Client SDK for Firestore
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Users, ShieldCheck, Search as SearchIcon, UserCog, Info } from "lucide-react"; // Added Info
import { useToast } from "@/hooks/use-toast";
import type { User as AppUser } from "@/lib/types"; // Renamed to avoid conflict

// Interface for user data to display, can be adapted for mock
interface DisplayUser extends AppUser {
  // Add any additional fields if necessary, e.g., createdAt for mock users could be login time
  createdAt?: string; // Example
}

export default function PlayerManagementPage() {
  const { user: currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [displayUsers, setDisplayUsers] = useState<DisplayUser[]>([]);
  const [isLoading, setIsLoading] = useState(true); // Kept for potential async ops or future enhancements
  const [accessDenied, setAccessDenied] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  // Admin status toggling is problematic with mock auth, keep for UI but functionality will be limited
  const [updatingAdminStatus, setUpdatingAdminStatus] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) {
      return;
    }
    if (!currentUser) {
      router.push("/login?redirect=/admin/users");
      return;
    }
    if (!currentUser.isAdmin) {
      setAccessDenied(true);
      setIsLoading(false);
      return;
    }
    setAccessDenied(false);
    setIsLoading(false); // For mock, no async user fetching here

    // With mock auth, there's no central user list to fetch from Firestore.
    // We could display the current mock admin user, or a placeholder.
    // For now, we'll just indicate that full user management isn't available.
    // If you wanted to list all 'created' mock users, you'd need a different mechanism.
    if (currentUser) {
      setDisplayUsers([{
        ...currentUser,
        createdAt: new Date().toLocaleDateString(), // Example createdAt
      }]);
    }


  }, [currentUser, authLoading, router]);

  const filteredUsers = useMemo(() => {
    // For mock, this will filter the very limited list of users (likely just the current admin)
    if (!searchTerm) {
      return displayUsers;
    }
    return displayUsers.filter((u) =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [displayUsers, searchTerm]);


  const handleToggleAdminStatus = async (targetUserId: string, currentIsAdmin: boolean) => {
    // This function will likely not work as intended with pure mock auth
    // as the API endpoint also needs to understand mock auth or be disabled.
    if (!currentUser?.isAdmin) {
      toast({ title: "权限不足", description: "只有管理员可以修改权限。", variant: "destructive" });
      return;
    }
    if (currentUser.id === targetUserId) {
      toast({ title: "操作无效", description: "不能修改自己的管理员权限。", variant: "destructive" });
      return;
    }

    toast({
      title: "操作受限",
      description: "在模拟登录模式下，通过此API管理管理员状态的功能受限。管理员状态通常在客户端模拟（例如，通过昵称 'admin'）。",
      variant: "default"
    });
    return; // Prevent API call for mock

    // --- Original API call logic (kept for reference, but bypassed above) ---
    // setUpdatingAdminStatus(targetUserId);
    // try {
    //   const response = await fetch('/api/admin/set-admin-status', {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify({ targetUserId, makeAdmin: !currentIsAdmin }),
    //   });
    //   // ... rest of the original error handling and success logic ...
    // } catch (err) {
    //    // ...
    // } finally {
    //   setUpdatingAdminStatus(null);
    // }
  };


  if (authLoading || (isLoading && !accessDenied)) {
    return <div className="text-center py-10">加载中...</div>;
  }

  if (accessDenied) {
    return (
      <div className="container mx-auto py-10 text-center">
        <h1 className="text-2xl font-bold text-destructive">访问被拒绝</h1>
        <p className="text-muted-foreground">您没有权限查看此页面。</p>
        <Button onClick={() => router.push("/")} className="mt-4">返回首页</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-primary flex items-center">
          <Users className="mr-3 h-8 w-8" />
          玩家管理 (模拟模式)
        </h1>
      </header>

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-md text-blue-700 flex items-center gap-2">
        <Info className="h-5 w-5" />
        <span>当前为模拟登录模式。此页面仅显示当前登录的管理员信息。完整的用户列表和管理功能需要 Firebase Authentication。</span>
      </div>

      <div className="mb-4">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="search"
            placeholder="搜索玩家昵称..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full md:w-1/3"
            disabled // Search is not very useful for a single user list
          />
        </div>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>当前管理员信息</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="space-y-2">
              <div className="flex items-center space-x-4 p-2">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-[200px]" />
                  <Skeleton className="h-3 w-[150px]" />
                </div>
              </div>
            </div>
          )}
          
          {!isLoading && filteredUsers.length === 0 && (
            <p className="text-muted-foreground text-center py-4">
              当前无模拟用户信息可显示。
            </p>
          )}
          {!isLoading && filteredUsers.length > 0 && (
            <ScrollArea className="max-h-[60vh] w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">头像</TableHead>
                    <TableHead>昵称</TableHead>
                    <TableHead>权限</TableHead>
                    <TableHead>登录时间 (模拟)</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={u.avatarUrl} alt={u.name} data-ai-hint="avatar person" />
                          <AvatarFallback>
                            {u.name?.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell>
                        {u.isAdmin && (
                          <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-300">
                            <ShieldCheck className="mr-1 h-4 w-4" />
                            管理员
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{u.createdAt || new Date().toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        {currentUser && currentUser.id !== u.id && ( // Admin cannot change their own status here
                          <Button
                            variant={u.isAdmin ? "destructive" : "outline"}
                            size="sm"
                            onClick={() => handleToggleAdminStatus(u.id, u.isAdmin || false)}
                            disabled={updatingAdminStatus === u.id || true} // Disabled for mock
                            className="transition-transform hover:scale-105 active:scale-95"
                            title="在模拟登录模式下此功能受限"
                          >
                            <UserCog className="mr-1 h-4 w-4" />
                            {updatingAdminStatus === u.id
                              ? "更新中..."
                              : u.isAdmin
                              ? "撤销管理员 (模拟)"
                              : "设为管理员 (模拟)"}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
