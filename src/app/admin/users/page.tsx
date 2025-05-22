
"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
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
import { AlertTriangle, Users, ShieldCheck, Search as SearchIcon, UserCog, Info } from "lucide-react"; 
import { useToast } from "@/hooks/use-toast";
import type { User as AppUser } from "@/lib/types"; 

interface DisplayUser extends AppUser {
  createdAt?: string; 
}

export default function PlayerManagementPage() {
  const { user: currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [displayUsers, setDisplayUsers] = useState<DisplayUser[]>([]);
  const [isLoading, setIsLoading] = useState(true); 
  const [accessDenied, setAccessDenied] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
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
    setIsLoading(false); 

    // With mock auth and Firestore removed, we only display the current mock admin.
    if (currentUser) {
      setDisplayUsers([{
        ...currentUser,
        createdAt: new Date().toLocaleDateString(), 
      }]);
    }

  }, [currentUser, authLoading, router]);

  const filteredUsers = useMemo(() => {
    if (!searchTerm) {
      return displayUsers;
    }
    return displayUsers.filter((u) =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [displayUsers, searchTerm]);


  const handleToggleAdminStatus = async (targetUserId: string, currentIsAdmin: boolean) => {
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
      description: "在模拟登录模式下，管理管理员状态的功能受限。管理员状态通过昵称 'admin' 模拟。",
      variant: "default"
    });
    // API call removed as Firestore is no longer used for this.
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
        <span>当前为模拟登录模式。此页面仅显示当前登录的管理员信息。完整的用户列表和管理功能已移除（因Firestore移除）。</span>
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
            disabled 
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
                        {currentUser && currentUser.id !== u.id && ( 
                          <Button
                            variant={u.isAdmin ? "destructive" : "outline"}
                            size="sm"
                            onClick={() => handleToggleAdminStatus(u.id, u.isAdmin || false)}
                            disabled={updatingAdminStatus === u.id || true} 
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
