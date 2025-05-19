
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { type GameRoom, type Player, Role, GameRoomStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Crown, Users, Play, Info, Swords, Shield, HelpCircle, UserPlus, Eye, Repeat, UsersRound } from "lucide-react";
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
const TOTAL_ROUNDS_PER_GAME = 5;
const MAX_CAPTAIN_CHANGES_PER_ROUND = 5;

const COMMON_CHINESE_NAMES = [
  "李明", "王伟", "张芳", "刘秀英", "陈静", "杨勇", "赵敏", "黄强", "周杰", "吴秀兰",
  "徐雷", "孙艳", "胡波", "朱琳", "高翔", "林娜", "郑军", "何平", "马超", "宋丹",
  "小红", "大山", "思思", "阿强", "文文", "乐乐", "聪聪", "萌萌", "飞飞", "静静",
  "李娜", "张伟", "王芳", "刘洋", "陈勇", "杨静", "赵强", "黄秀英", "周敏", "吴雷",
  "徐艳", "孙波", "胡琳", "朱翔", "高娜", "林军", "郑平", "何超", "马丹", "宋杰"
];

export default function GameRoomPage() {
  const params = useParams();
  const router = useRouter();
  const { roomId } = params;
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [room, setRoom] = useState<GameRoom | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [localPlayers, setLocalPlayers] = useState<Player[]>([]);

  const updateLocalStorageRooms = useCallback((updatedRoom: GameRoom | null) => {
    if (!updatedRoom) return;
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
           // updateLocalStorageRooms is called by setRoom's effect
        } else if (!playerExists && currentRoom.status !== GameRoomStatus.Waiting) {
          toast({ title: "Game in Progress or Finished", description: "Cannot join a game that has already started or is finished.", variant: "destructive" });
          router.push("/");
          return;
        } else if (!playerExists && currentRoom.players.length >= currentRoom.maxPlayers) {
          toast({ title: "Room Full", description: "This room is already full.", variant: "destructive" });
          router.push("/");
          return;
        }
        
        setRoom(prevRoom => ({ ...prevRoom, ...currentRoom }));
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
  }, [roomId, user, authLoading, router, toast]);

  useEffect(() => {
    updateLocalStorageRooms(room);
  }, [room, updateLocalStorageRooms]);


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
        rolesToAssign.push(Role.TeamMember); 
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

    setRoom(prevRoom => {
      if (!prevRoom) return null;
      const updatedRoom = {
        ...prevRoom,
        players: updatedPlayers,
        status: GameRoomStatus.InProgress,
        currentCaptainId: updatedPlayers[firstCaptainIndex].id,
        currentRound: 1,
        totalRounds: TOTAL_ROUNDS_PER_GAME,
        captainChangesThisRound: 0,
        maxCaptainChangesPerRound: MAX_CAPTAIN_CHANGES_PER_ROUND,
      };
      setLocalPlayers(updatedPlayers);
      return updatedRoom;
    });
    toast({ title: "Game Started!", description: `Roles assigned. Round 1 begins. ${updatedPlayers[firstCaptainIndex].name} is the first captain.` });
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

    const existingVirtualPlayerNames = localPlayers.filter(p => p.id.startsWith("virtual_")).map(p => p.name);
    const availableNames = COMMON_CHINESE_NAMES.filter(name => !existingVirtualPlayerNames.includes(name));

    if (availableNames.length === 0) {
      toast({ title: "Error", description: "No more unique virtual player names available.", variant: "destructive" });
      return;
    }
    
    const virtualPlayerName = availableNames[Math.floor(Math.random() * availableNames.length)];
    const virtualPlayerId = `virtual_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    
    const newVirtualPlayer: Player = {
      id: virtualPlayerId,
      name: virtualPlayerName,
      avatarUrl: `https://placehold.co/100x100.png?text=${encodeURIComponent(virtualPlayerName.charAt(0))}`,
      isCaptain: false,
    };

    const updatedPlayers = [...localPlayers, newVirtualPlayer];
    setRoom(prevRoom => {
      if (!prevRoom) return null;
      const updatedRoom = { ...prevRoom, players: updatedPlayers };
      setLocalPlayers(updatedPlayers);
      return updatedRoom;
    });
    toast({ title: "Virtual Player Added", description: `${virtualPlayerName} has joined the room.` });
  };

  const handleNextTurn = () => {
    if (!room || !room.currentCaptainId || room.status !== GameRoomStatus.InProgress || !room.players || !user) return;
    if (user.id !== room.currentCaptainId && user.id !== room.hostId) {
      // Allowing host to advance turn for simulation purposes, or if captain is stuck
      // In a real game, only current captain might do this, or a voting system.
      // For now, this also allows host to cycle through for testing.
       // toast({ title: "Not Your Turn", description: "Only the current captain or host can advance the turn.", variant: "destructive" });
       // return;
    }


    setRoom(prevRoom => {
      if (!prevRoom || !prevRoom.players || prevRoom.currentCaptainId === undefined || prevRoom.captainChangesThisRound === undefined || prevRoom.currentRound === undefined || prevRoom.maxCaptainChangesPerRound === undefined || prevRoom.totalRounds === undefined) return prevRoom;

      let newCaptainChangesThisRound = prevRoom.captainChangesThisRound + 1;
      let newCurrentRound = prevRoom.currentRound;
      let gameFinished = false;
      let newStatus = prevRoom.status;
      let toastMessage = "";

      const currentPlayers = prevRoom.players;
      let currentPlayerIndex = currentPlayers.findIndex(p => p.id === prevRoom.currentCaptainId);
      if (currentPlayerIndex === -1) currentPlayerIndex = 0; // Should not happen

      let nextCaptainIndex = (currentPlayerIndex + 1) % currentPlayers.length;
      
      if (newCaptainChangesThisRound >= prevRoom.maxCaptainChangesPerRound) {
        // Max captain changes reached for this round
        if (newCurrentRound >= prevRoom.totalRounds) {
          // Game over
          gameFinished = true;
          newStatus = GameRoomStatus.Finished;
          toastMessage = "Game Over! All rounds completed.";
          toast({ title: "Game Over", description: "All rounds completed." });
        } else {
          // Next round
          newCurrentRound++;
          newCaptainChangesThisRound = 0; // Reset for new round
          // Captain continues from next player in sequence for the new round
          toastMessage = `Round ${newCurrentRound} started! ${currentPlayers[nextCaptainIndex].name} is the new captain.`;
          toast({ title: `Round ${newCurrentRound} Started!`, description: `${currentPlayers[nextCaptainIndex].name} is the captain.` });
        }
      } else {
        // Continue current round, just change captain
        toastMessage = `${currentPlayers[nextCaptainIndex].name} is now the captain.`;
        toast({ title: "Next Captain", description: `${currentPlayers[nextCaptainIndex].name} is now the captain.`});
      }

      const updatedPlayers = currentPlayers.map((p, index) => ({
        ...p,
        isCaptain: !gameFinished && index === nextCaptainIndex,
      }));
      
      const updatedRoomState: GameRoom = {
        ...prevRoom,
        players: updatedPlayers,
        status: newStatus,
        currentCaptainId: gameFinished ? undefined : updatedPlayers[nextCaptainIndex].id,
        currentRound: newCurrentRound,
        captainChangesThisRound: newCaptainChangesThisRound,
      };
      setLocalPlayers(updatedPlayers);
      return updatedRoomState;
    });
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

  const knownUndercoversByCoach = currentUserRole === Role.Coach && room.status === GameRoomStatus.InProgress
    ? localPlayers.filter(p => p.role === Role.Undercover) 
    : [];
  const fellowUndercovers = currentUserRole === Role.Undercover && room.status === GameRoomStatus.InProgress
    ? localPlayers.filter(p => p.role === Role.Undercover && p.id !== user.id) 
    : [];
  const isSoleUndercover = currentUserRole === Role.Undercover && room.status === GameRoomStatus.InProgress && localPlayers.filter(p => p.role === Role.Undercover).length === 1;

  return (
    <div className="space-y-6">
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-3xl text-primary flex items-center">
                {room.name}
              </CardTitle>
              <CardDescription>Room ID: {room.id} | Host: {localPlayers.find(p=>p.id === room.hostId)?.name || 'Unknown'}</CardDescription>
            </div>
            <Badge variant={room.status === GameRoomStatus.Waiting ? "outline" : "default"} className={`ml-auto ${room.status === GameRoomStatus.Waiting ? "border-yellow-500 text-yellow-500" : room.status === GameRoomStatus.InProgress ? "bg-green-500 text-white" : "bg-gray-500 text-white"}`}>
              {room.status.toUpperCase()}
            </Badge>
          </div>
           {room.status === GameRoomStatus.InProgress && room.currentRound !== undefined && room.totalRounds !== undefined && room.captainChangesThisRound !== undefined && room.maxCaptainChangesPerRound !== undefined && (
            <div className="mt-2 text-sm text-muted-foreground space-y-1">
              <div className="flex items-center"><Repeat className="mr-2 h-4 w-4 text-blue-500" /> Round: {room.currentRound} / {room.totalRounds}</div>
              <div className="flex items-center"><UsersRound className="mr-2 h-4 w-4 text-orange-500" /> Captain Changes: {room.captainChangesThisRound} / {room.maxCaptainChangesPerRound}</div>
            </div>
          )}
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

      {room.status === GameRoomStatus.InProgress && currentUserRole === Role.Coach && knownUndercoversByCoach.length > 0 && (
        <Alert variant="default" className="bg-primary/10 border-primary/30 text-primary mt-4">
          <Eye className="h-5 w-5 text-primary" />
          <AlertTitle className="font-semibold">你知道的卧底</AlertTitle>
          <AlertDescription>
            作为教练，你已洞察到以下玩家是卧底: {knownUndercoversByCoach.map(u => u.name).join(', ')}。
          </AlertDescription>
        </Alert>
      )}

      {room.status === GameRoomStatus.InProgress && currentUserRole === Role.Undercover && (
        <>
          {fellowUndercovers.length > 0 && (
            <Alert variant="default" className="bg-destructive/10 border-destructive/30 text-destructive-foreground mt-4">
              <Users className="h-5 w-5 text-destructive" />
              <AlertTitle className="font-semibold">你的卧底同伙</AlertTitle>
              <AlertDescription>
                你的卧底同伙是: {fellowUndercovers.map(u => u.name).join(', ')}。
              </AlertDescription>
            </Alert>
          )}
          {isSoleUndercover && (
             <Alert variant="default" className="bg-destructive/10 border-destructive/30 text-destructive-foreground mt-4">
              <Info className="h-5 w-5 text-destructive" />
              <AlertTitle className="font-semibold">孤军奋战</AlertTitle>
              <AlertDescription>你是场上唯一的卧底。</AlertDescription>
            </Alert>
          )}
        </>
      )}
      
      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center"><Users className="mr-2 h-6 w-6 text-primary" /> 玩家 ({localPlayers.length}/{room.maxPlayers})</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {localPlayers.map((p) => {
                const isCurrentUser = p.id === user.id;
                return (
                  <li key={p.id} className="flex items-center justify-between p-3 bg-secondary/50 rounded-md shadow-sm">
                    <div className="flex items-center">
                      <Avatar className="h-10 w-10 mr-3 border-2 border-primary/50">
                        <AvatarImage src={p.avatarUrl} alt={p.name} data-ai-hint="avatar person"/>
                        <AvatarFallback>{p.name.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{p.name} {isCurrentUser && "(You)"}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      {room.status === GameRoomStatus.InProgress && p.role && (
                        <>
                          {isCurrentUser && (
                            <Badge variant="secondary" className="flex items-center gap-1">
                              {getRoleIcon(p.role)} {p.role}
                            </Badge>
                          )}
                          {!isCurrentUser && currentUserRole === Role.Coach && p.role === Role.Undercover && (
                            <Badge variant="destructive" className="flex items-center gap-1">
                              <Eye className="h-4 w-4" /> 卧底
                            </Badge>
                          )}
                          {!isCurrentUser && currentUserRole === Role.Undercover && p.role === Role.Undercover && (
                            <Badge variant="outline" className="flex items-center gap-1 border-destructive text-destructive">
                              <Users className="h-4 w-4" /> 卧底队友
                            </Badge>
                          )}
                        </>
                      )}
                      {p.isCaptain && <Crown className="h-5 w-5 text-yellow-500" title="Captain" />}
                    </div>
                  </li>
                );
              })}
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
                {/* 
                  // Placeholder for captain-specific actions
                  {user.id === room.currentCaptainId && (
                  <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">执行队长行动 (占位)</Button>
                )} 
                */}
                <Button 
                  onClick={handleNextTurn}
                  variant="outline" 
                  className="w-full transition-transform hover:scale-105 active:scale-95"
                  //  Allow host to advance for easier testing/simulation
                  //  disabled={user.id !== room.currentCaptainId && !isHost}
                >
                  下一回合 / 移交队长 (模拟)
                </Button>
              </>
            )}
            {room.status === GameRoomStatus.Finished && (
              <div className="text-center p-6 bg-green-100 dark:bg-green-900 rounded-lg shadow">
                <h3 className="text-2xl font-bold text-green-700 dark:text-green-300">游戏结束!</h3>
                <p className="text-muted-foreground mt-2">所有回合已完成。感谢您的参与！</p>
              </div>
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

