
"use client";

import { useEffect, useState } from "react";
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
import { Button } from "@/components/ui/button"; // Added import
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Users, ShieldCheck } from "lucide-react";

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
  const [users, setUsers] = useState<FirestoreUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    if (authLoading) {
      return;
    }
    if (!user) {
      router.push("/login?redirect=/admin/users");
      return;
    }
    // Check for isAdmin after user is confirmed to be loaded and non-null
    if (!user.isAdmin) {
      setAccessDenied(true);
      setIsLoading(false); // Stop loading as access is denied
      return;
    }
    setAccessDenied(false); // Explicitly set to false if user is admin

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

  if (authLoading || (isLoading && !accessDenied)) {
    return <div className="text-center py-10">加载中...</div>;
  }

  if (accessDenied) {
    return (
      <div className="text-center py-10">
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

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>玩家列表</CardTitle>
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
          {!isLoading && !error && users.length === 0 && (
            <p className="text-muted-foreground text-center py-4">
              没有找到玩家。
            </p>
          )}
          {!isLoading && !error && users.length > 0 && (
            <ScrollArea className="max-h-[60vh] w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">头像</TableHead>
                    <TableHead>昵称</TableHead>
                    <TableHead>玩家 ID (UID)</TableHead>
                    <TableHead>权限</TableHead>
                    <TableHead>注册日期</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
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
                        <Badge variant="outline" className="font-mono text-xs">
                          {u.uid || u.id}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {u.isAdmin && (
                          <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-300">
                            <ShieldCheck className="mr-1 h-4 w-4" />
                            管理员
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{formatDate(u.createdAt)}</TableCell>
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
