
"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function PlayerManagementPageDisabled() {
  const router = useRouter();

  return (
    <div className="container mx-auto py-10 text-center">
      <h1 className="text-2xl font-bold text-muted-foreground">玩家管理功能已移除</h1>
      <p className="text-muted-foreground mt-2">此功能当前不可用。</p>
      <Button onClick={() => router.push("/")} className="mt-4">
        返回首页
      </Button>
    </div>
  );
}
