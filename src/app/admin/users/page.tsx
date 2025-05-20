
"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { collection, getDocs, orderBy, query, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
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
import { AlertTriangle, Users, ShieldCheck, Search as SearchIcon, UserCog } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FirestoreUser {
  id: string;
  uid: string;
  nickname: string;
  avatarUrl?: string;
  createdAt: string | Timestamp;
  isAdmin?: boolean;
}

export default function PlayerManagementPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [users, setUsers] = useState<FirestoreUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [updatingAdminStatus, setUpdatingAdminStatus] = useState<string | null>(null); // userId of user being updated

  useEffect(() => {
    if (authLoading) {
      return;
    }
    if (!user) {
      router.push("/login?redirect=/admin/users");
      return;
    }
    if (!user.isAdmin) {
      setAccessDenied(true);
      setIsLoading(false);
      return;
    }
    setAccessDenied(false);

    const fetchUsers = async () => {
      setIsLoading(true);
      setError(null);
      if (!db) {
        setError("Firestore is not initialized. Cannot fetch players.");
        setIsLoading(false);
        return;
      }
      try {
        const usersCollectionRef = collection(db, "users");
        const q = query(usersCollectionRef, orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        const fetchedUsers: FirestoreUser[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          fetchedUsers.push({
            id: doc.id,
            uid: data.uid,
            nickname: data.nickname,
            avatarUrl: data.avatarUrl,
            createdAt: data.createdAt,
            isAdmin: data.isAdmin || false,
          });
        });
        setUsers(fetchedUsers);
      } catch (err) {
        console.error("Error fetching players:", err);
        setError("Failed to fetch players. See console for details.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, [user, authLoading, router]);

  const filteredUsers = useMemo(() => {
    if (!searchTerm) {
      return users;
    }
    return users.filter((u) =>
      u.nickname.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [users, searchTerm]);

  const formatDate = (dateValue: string | Timestamp): string => {
    if (!dateValue) return "N/A";
    try {
      if (typeof dateValue === "string") {
        return new Date(dateValue).toLocaleDateString();
      } else if (dateValue && typeof dateValue.toDate === 'function') {
        return dateValue.toDate().toLocaleDateString();
      }
      return "Invalid Date";
    } catch (e) {
      return "Invalid Date";
    }
  };

  const handleToggleAdminStatus = async (targetUserId: string, currentIsAdmin: boolean) => {
    if (!user?.isAdmin) {
      toast({ title: "权限不足", description: "只有管理员可以修改权限。", variant: "destructive" });
      return;
    }
    if (user.id === targetUserId) {
      toast({ title: "操作无效", description: "不能修改自己的管理员权限。", variant: "destructive" });
      return;
    }

    setUpdatingAdminStatus(targetUserId);
    try {
      // In a real app, the auth token would be sent to verify the CALLER is an admin.
      const response = await fetch('/api/admin/set-admin-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId, makeAdmin: !currentIsAdmin }),
      });

      if (!response.ok) {
        let errorMessage = `Failed to update admin status (${response.status})`;
        try {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const errorData = await response.json();
            errorMessage = errorData.message || errorMessage;
          } else {
            const errorText = await response.text();
            console.error("Server returned non-JSON error response:", errorText);
            // Try to extract a more meaningful message from common HTML error patterns
            if (errorText.includes("The default Firebase app does not exist")) {
                errorMessage = "Server Error: Firebase Admin SDK not initialized. Check server logs and ensure GOOGLE_APPLICATION_CREDENTIALS is set correctly for the server environment.";
            } else if (response.status === 500) {
                errorMessage = "Internal Server Error (500). Please check server logs for more details.";
            } else {
                errorMessage = `API request failed with status ${response.status}.`;
            }
          }
        } catch (parseError) {
          // This catch is for errors during parsing of the error response itself
          console.error("Error parsing the error response:", parseError);
        }
        throw new Error(errorMessage);
      }

      // If response.ok is true, assume success (API route should return 200 on success)
      setUsers(prevUsers =>
        prevUsers.map(u =>
          u.id === targetUserId ? { ...u, isAdmin: !currentIsAdmin } : u
        )
      );
      toast({
        title: "权限已更新",
        description: `玩家 ${users.find(u=>u.id === targetUserId)?.nickname || targetUserId} 的管理员权限已${!currentIsAdmin ? '授予' : '撤销'}。`,
      });
    } catch (err) {
      console.error("Error updating admin status:", err);
      const finalErrorMessage = err instanceof Error ? err.message : "操作失败";
      toast({ title: "更新失败", description: finalErrorMessage, variant: "destructive" });
    } finally {
      setUpdatingAdminStatus(null);
    }
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
          玩家管理
        </h1>
      </header>

      <div className="mb-4">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="search"
            placeholder="搜索玩家昵称..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full md:w-1/3"
          />
        </div>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>玩家列表 ({filteredUsers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4 p-2">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-[200px]" />
                    <Skeleton className="h-3 w-[150px]" />
                  </div>
                </div>
              ))}
            </div>
          )}
          {error && (
            <div className="text-red-500 flex items-center space-x-2 p-4 bg-red-50 border border-red-200 rounded-md">
              <AlertTriangle className="h-5 w-5" />
              <p>{error}</p>
            </div>
          )}
          {!isLoading && !error && filteredUsers.length === 0 && (
            <p className="text-muted-foreground text-center py-4">
              {searchTerm ? `没有找到昵称包含 "${searchTerm}" 的玩家。` : "没有找到玩家。"}
            </p>
          )}
          {!isLoading && !error && filteredUsers.length > 0 && (
            <ScrollArea className="max-h-[60vh] w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">头像</TableHead>
                    <TableHead>昵称</TableHead>
                    <TableHead>权限</TableHead>
                    <TableHead>注册日期</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={u.avatarUrl} alt={u.nickname} data-ai-hint="avatar person" />
                          <AvatarFallback>
                            {u.nickname?.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell className="font-medium">{u.nickname}</TableCell>
                      <TableCell>
                        {u.isAdmin && (
                          <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-300">
                            <ShieldCheck className="mr-1 h-4 w-4" />
                            管理员
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{formatDate(u.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        {user && user.id !== u.id && ( // Admin cannot change their own status here
                          <Button
                            variant={u.isAdmin ? "destructive" : "outline"}
                            size="sm"
                            onClick={() => handleToggleAdminStatus(u.id, u.isAdmin || false)}
                            disabled={updatingAdminStatus === u.id}
                            className="transition-transform hover:scale-105 active:scale-95"
                          >
                            <UserCog className="mr-1 h-4 w-4" />
                            {updatingAdminStatus === u.id
                              ? "更新中..."
                              : u.isAdmin
                              ? "撤销管理员"
                              : "设为管理员"}
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
