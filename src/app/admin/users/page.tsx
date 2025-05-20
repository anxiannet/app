
"use client";

import { useEffect, useState } from "react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton"; // For loading state
import { AlertTriangle, Users } from "lucide-react";

interface FirestoreUser {
  id: string; // Document ID, which is the UID
  uid: string;
  nickname: string;
  avatarUrl?: string;
  createdAt: string | Timestamp; // Firestore timestamp or ISO string
}

export default function UserManagementPage() {
  const [users, setUsers] = useState<FirestoreUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      setIsLoading(true);
      setError(null);
      if (!db) {
        setError("Firestore is not initialized. Cannot fetch users.");
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
            createdAt: data.createdAt, // Keep as Firestore Timestamp or ISO string
          });
        });
        setUsers(fetchedUsers);
      } catch (err) {
        console.error("Error fetching users:", err);
        setError("Failed to fetch users. See console for details.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, []);

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

  return (
    <div className="container mx-auto py-8 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-primary flex items-center">
          <Users className="mr-3 h-8 w-8" />
          用户管理
        </h1>
      </header>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>用户列表</CardTitle>
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
              没有找到用户。
            </p>
          )}
          {!isLoading && !error && users.length > 0 && (
            <ScrollArea className="max-h-[60vh] w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">头像</TableHead>
                    <TableHead>昵称</TableHead>
                    <TableHead>用户 ID (UID)</TableHead>
                    <TableHead>注册日期</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={user.avatarUrl} alt={user.nickname} data-ai-hint="avatar person" />
                          <AvatarFallback>
                            {user.nickname?.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell className="font-medium">{user.nickname}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs">
                          {user.uid || user.id}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(user.createdAt)}</TableCell>
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
