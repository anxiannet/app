
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { type GameRoom, type Player, Role, GameRoomStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Crown, Users, Play, Info, Swords, Shield, HelpCircle, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const ROLES_CONFIG: { [key: number]: { [Role.Undercover]: number, [Role.Coach]: number, [Role.TeamMember]: number } } = {
  5: { [Role.Undercover]: 2, [Role.Coach]: 1, [Role.TeamMember]: 2 },
  6: { [Role.Undercover]: 2, [Role.Coach]: 1, [Role.TeamMember]: 3 },
  7: { [Role.Undercover]: 3, [Role.Coach]: 1, [Role.TeamMember]: 3 },
  8: { [Role.Undercover]: 3, [Role.Coach]: 1, [Role.TeamMember]: 4 },
  9: { [Role.Undercover]: 3, [Role.Coach]: 1, [Role.TeamMember]: 5 },
  10: { [Role.Undercover]: 4, [Role.Coach]: 1, [Role.TeamMember]: 5 },
};

const MIN_PLAYERS_TO_START = 5;

export default function GameRoomPage() {
  const params = useParams();
  const router = useRouter();
  const { roomId } = params;
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [room, setRoom] = useState<GameRoom | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [localPlayers, setLocalPlayers] = useState<Player[]>([]);

  const updateLocalStorageRooms = useCallback((updatedRoom: GameRoom) => {
    const storedRoomsRaw = localStorage.getItem("anxian-rooms");
    if (storedRoomsRaw) {
      const storedRooms: GameRoom[] = JSON.parse(storedRoomsRaw);
      const roomIndex = storedRooms.findIndex(r => r.id === updatedRoom.id);
      if (roomIndex !== -1) {
        storedRooms[roomIndex] = updatedRoom;
        localStorage.setItem("anxian-rooms", JSON.stringify(storedRooms));
      }
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      toast({ title: "Login Required", description: "Please log in to access rooms.", variant: "destructive" });
      router.push(`/login?redirect=/rooms/${roomId}`);
      return;
    }

    const storedRoomsRaw = localStorage.getItem("anxian-rooms");
    if (storedRoomsRaw) {
      const storedRooms: GameRoom[] = JSON.parse(storedRoomsRaw);
      const currentRoom = storedRooms.find(r => r.id === roomId);

      if (currentRoom) {
        let playerExists = currentRoom.players.some(p => p.id === user.id);
        if (!playerExists && currentRoom.players.length < currentRoom.maxPlayers && currentRoom.status === GameRoomStatus.Waiting) {
           const newPlayer: Player = { ...user, isCaptain: false };
           currentRoom.players.push(newPlayer);
           playerExists = true;
           updateLocalStorageRooms(currentRoom); 
        } else if (!playerExists && currentRoom.status !== GameRoomStatus.Waiting) {
          toast({ title: "Game in Progress", description: "Cannot join a game that has already started or is finished.", variant: "destructive" });
          router.push("/");
          return;
        } else if (!playerExists && currentRoom.players.length >= currentRoom.maxPlayers) {
          toast({ title: "Room Full", description: "This room is already full.", variant: "destructive" });
          router.push("/");
          return;
        }
        
        setRoom(currentRoom);
        setLocalPlayers(currentRoom.players);
      } else {
        toast({ title: "Room not found", description: "The requested game room does not exist.", variant: "destructive" });
        router.push("/");
      }
    } else {
      toast({ title: "Error", description: "Could not load room data.", variant: "destructive" });
      router.push("/");
    }
    setIsLoading(false);
  }, [roomId, user, authLoading, router, toast, updateLocalStorageRooms]);

  const assignRolesAndCaptain = () => {
    if (!room || localPlayers.length < MIN_PLAYERS_TO_START) return;

    const playerCount = localPlayers.length;
    const config = ROLES_CONFIG[playerCount] || ROLES_CONFIG[Math.max(...Object.keys(ROLES_CONFIG).map(Number))]; 

    let rolesToAssign: Role[] = [];
    Object.entries(config).forEach(([role, count]) => {
      for (let i = 0; i < count; i++) {
        rolesToAssign.push(role as Role);
      }
    });
    
    while(rolesToAssign.length < playerCount) {
        rolesToAssign.push(Role.TeamMember); // Default fill with TeamMember
    }
    
    rolesToAssign = rolesToAssign.slice(0, playerCount);


    rolesToAssign = rolesToAssign.sort(() => Math.random() - 0.5); 

    const updatedPlayers = localPlayers.map((player, index) => ({
      ...player,
      role: rolesToAssign[index],
      isCaptain: false,
    }));

    const firstCaptainIndex = Math.floor(Math.random() * updatedPlayers.length);
    updatedPlayers[firstCaptainIndex].isCaptain = true;

    const updatedRoom = {
      ...room,
      players: updatedPlayers,
      status: GameRoomStatus.InProgress,
      currentCaptainId: updatedPlayers[firstCaptainIndex].id,
    };
    setRoom(updatedRoom);
    setLocalPlayers(updatedPlayers);
    updateLocalStorageRooms(updatedRoom);
    toast({ title: "Game Started!", description: "Roles assigned and first captain selected." });
  };
  
  const handleStartGame = () => {
    if (!room || !user || room.hostId !== user.id) {
      toast({ title: "Not Authorized", description: "Only the host can start the game.", variant: "destructive" });
      return;
    }
    if (localPlayers.length < MIN_PLAYERS_TO_START) {
      toast({ title: "Not Enough Players", description: `Need at least ${MIN_PLAYERS_TO_START} players to start. Currently ${localPlayers.length}.`, variant: "destructive" });
      return;
    }
    if (localPlayers.length > room.maxPlayers) {
      toast({ title: "Too Many Players", description: `This room is configured for a maximum of ${room.maxPlayers} players. Currently ${localPlayers.length}.`, variant: "destructive" });
      return;
    }
    assignRolesAndCaptain();
  };

  const handleAddVirtualPlayer = () => {
    if (!room || !user || room.hostId !== user.id || room.status !== GameRoomStatus.Waiting) {
      toast({ title: "Not Authorized", description: "Only the host can add virtual players while waiting.", variant: "destructive" });
      return;
    }
    if (localPlayers.length >= room.maxPlayers) {
      toast({ title: "Room Full", description: "Cannot add more players, room is full.", variant: "destructive" });
      return;
    }

    const virtualPlayerCount = localPlayers.filter(p => p.name.startsWith("Virtual Player")).length;
    const virtualPlayerName = `Virtual Player ${virtualPlayerCount + 1}`;
    const virtualPlayerId = `virtual_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    
    const newVirtualPlayer: Player = {
      id: virtualPlayerId,
      name: virtualPlayerName,
      avatarUrl: `https://placehold.co/100x100.png?text=V${virtualPlayerCount + 1}`,
      isCaptain: false,
    };

    const updatedPlayers = [...localPlayers, newVirtualPlayer];
    const updatedRoom = {
      ...room,
      players: updatedPlayers,
    };

    setRoom(updatedRoom);
    setLocalPlayers(updatedPlayers);
    updateLocalStorageRooms(updatedRoom);
    toast({ title: "Virtual Player Added", description: `${virtualPlayerName} has joined the room.` });
  };

  const handleNextTurn = () => {
    if (!room || !room.currentCaptainId || room.status !== GameRoomStatus.InProgress || !room.players) return;

    const currentPlayers = room.players;
    const currentPlayerIndex = currentPlayers.findIndex(p => p.id === room.currentCaptainId);
    if (currentPlayerIndex === -1) return;

    const updatedPlayers = currentPlayers.map(p => ({ ...p, isCaptain: false }));
    const nextCaptainIndex = (currentPlayerIndex + 1) % updatedPlayers.length;
    updatedPlayers[nextCaptainIndex].isCaptain = true;
    
    const updatedRoom = {
      ...room,
      players: updatedPlayers,
      currentCaptainId: updatedPlayers[nextCaptainIndex].id,
    };
    setRoom(updatedRoom);
    setLocalPlayers(updatedPlayers);
    updateLocalStorageRooms(updatedRoom);
    toast({ title: "Next Turn", description: `${updatedPlayers[nextCaptainIndex].name} is now the captain.`});
  };

  if (isLoading || authLoading) {
    return <div className="text-center py-10">Loading room...</div>;
  }

  if (!room || !user) {
    return <div className="text-center py-10 text-destructive">Error loading room or user not authenticated.</div>;
  }

  const currentUserInRoom = localPlayers.find(p => p.id === user.id);
  const currentUserRole = currentUserInRoom?.role;

  const getRoleIcon = (role?: Role) => {
    switch (role) {
      case Role.Undercover: return <Swords className="h-4 w-4 text-destructive" />;
      case Role.TeamMember: return <Shield className="h-4 w-4 text-green-500" />;
      case Role.Coach: return <HelpCircle className="h-4 w-4 text-yellow-500" />;
      default: return null;
    }
  };

  const isHost = user.id === room.hostId;
  const canAddVirtualPlayer = isHost && room.status === GameRoomStatus.Waiting && localPlayers.length < room.maxPlayers;
  const canStartGame = isHost && room.status === GameRoomStatus.Waiting && localPlayers.length >= MIN_PLAYERS_TO_START && localPlayers.length <= room.maxPlayers;


  return (
    <div className="space-y-6">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-3xl text-primary flex items-center justify-between">
            {room.name}
            <Badge variant={room.status === GameRoomStatus.Waiting ? "outline" : "default"} className={room.status === GameRoomStatus.Waiting ? "border-yellow-500 text-yellow-500" : room.status === GameRoomStatus.InProgress ? "bg-green-500" : "bg-gray-500"}>
              {room.status.toUpperCase()}
            </Badge>
          </CardTitle>
          <CardDescription>Room ID: {room.id} | Host: {localPlayers.find(p=>p.id === room.hostId)?.name || 'Unknown'}</CardDescription>
        </CardHeader>
      </Card>

      {currentUserRole && room.status === GameRoomStatus.InProgress && (
        <Alert variant="default" className="bg-accent/20 border-accent text-accent-foreground">
          <Info className="h-5 w-5 text-accent" />
          <AlertTitle className="font-semibold">你的角色: {currentUserRole}</AlertTitle>
          <AlertDescription>
            {currentUserRole === Role.Undercover && "你的任务是隐藏自己的身份，误导其他队员，并达成秘密目标。"}
            {currentUserRole === Role.TeamMember && "作为一名普通队员，你需要找出队伍中的卧底，并完成队伍的目标。"}
            {currentUserRole === Role.Coach && "作为教练，你并不清楚自己的词语，但你需要通过观察和引导，帮助队员找出卧底。"}
          </AlertDescription>
        </Alert>
      )}
      
      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center"><Users className="mr-2 h-6 w-6 text-primary" /> 玩家 ({localPlayers.length}/{room.maxPlayers})</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {localPlayers.map((p) => (
                <li key={p.id} className="flex items-center justify-between p-3 bg-secondary/50 rounded-md shadow-sm">
                  <div className="flex items-center">
                    <Avatar className="h-10 w-10 mr-3 border-2 border-primary/50">
                      <AvatarImage src={p.avatarUrl} alt={p.name} data-ai-hint="avatar person"/>
                      <AvatarFallback>{p.name.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{p.name} {p.id === user.id && "(You)"}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    {room.status === GameRoomStatus.InProgress && p.id === user.id && p.role && (
                      <Badge variant="secondary" className="flex items-center gap-1">
                        {getRoleIcon(p.role)} {p.role}
                      </Badge>
                    )}
                    {p.isCaptain && <Crown className="h-5 w-5 text-yellow-500" title="Captain" />}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-primary">游戏控制</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {room.status === GameRoomStatus.Waiting && (
              <>
                <p className="text-muted-foreground">等待主持人开始游戏...</p>
                {isHost && (
                  <div className="space-y-2">
                    <Button 
                      onClick={handleStartGame} 
                      disabled={!canStartGame}
                      className="w-full bg-green-500 hover:bg-green-600 text-white transition-transform hover:scale-105 active:scale-95"
                    >
                      <Play className="mr-2 h-5 w-5" /> 开始游戏
                    </Button>
                    {!canStartGame && (localPlayers.length < MIN_PLAYERS_TO_START || localPlayers.length > room.maxPlayers) && (
                      <p className="text-sm text-destructive text-center">
                        需要 {MIN_PLAYERS_TO_START}-{room.maxPlayers} 名玩家才能开始. 当前 {localPlayers.length} 名.
                      </p>
                    )}
                     <Button 
                      onClick={handleAddVirtualPlayer} 
                      disabled={!canAddVirtualPlayer}
                      variant="outline"
                      className="w-full transition-transform hover:scale-105 active:scale-95"
                    >
                      <UserPlus className="mr-2 h-5 w-5" /> 添加虚拟玩家
                    </Button>
                    {!canAddVirtualPlayer && localPlayers.length >= room.maxPlayers && (
                         <p className="text-sm text-destructive text-center">房间已满.</p>
                    )}
                  </div>
                )}
              </>
            )}
            {room.status === GameRoomStatus.InProgress && (
              <>
                <div className="text-center p-4 bg-secondary/30 rounded-md">
                  <p className="text-lg font-semibold">当前队长:</p>
                  <p className="text-2xl text-accent">
                    {localPlayers.find(p => p.id === room.currentCaptainId)?.name || "Unknown"}
                  </p>
                </div>
                <p className="text-muted-foreground">游戏进行中。听从队长指示或执行行动。</p>
                {user.id === room.currentCaptainId && (
                  <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">执行队长行动 (占位)</Button>
                )}
                <Button 
                  onClick={handleNextTurn}
                  variant="outline" 
                  className="w-full transition-transform hover:scale-105 active:scale-95"
                >
                  下一回合 (模拟)
                </Button>
              </>
            )}
            {room.status === GameRoomStatus.Finished && (
              <p className="text-lg font-semibold text-center text-green-600">游戏结束! (占位)</p>
            )}
             <Button variant="outline" onClick={() => router.push('/')} className="w-full mt-4">
                返回大厅
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
