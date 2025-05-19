"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import type { GameRoom, Player, Role } from "@/lib/types";
import { GameRoomStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Crown, Users, Play, Info, Swords, Shield, HelpCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const ROLES_CONFIG: { [key: number]: { [Role.Undercover]: number, [Role.Blank]: number, [Role.Civilian]: number } } = {
  3: { [Role.Undercover]: 1, [Role.Blank]: 0, [Role.Civilian]: 2 },
  4: { [Role.Undercover]: 1, [Role.Blank]: 0, [Role.Civilian]: 3 },
  5: { [Role.Undercover]: 1, [Role.Blank]: 1, [Role.Civilian]: 3 },
  6: { [Role.Undercover]: 2, [Role.Blank]: 1, [Role.Civilian]: 3 },
  7: { [Role.Undercover]: 2, [Role.Blank]: 1, [Role.Civilian]: 4 },
  8: { [Role.Undercover]: 2, [Role.Blank]: 2, [Role.Civilian]: 4 },
};

const MIN_PLAYERS_TO_START = 3;

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
        // Ensure user is part of the room players if not already
        let playerExists = currentRoom.players.some(p => p.id === user.id);
        if (!playerExists && currentRoom.players.length < currentRoom.maxPlayers && currentRoom.status === GameRoomStatus.Waiting) {
           const newPlayer: Player = { ...user, isCaptain: false };
           currentRoom.players.push(newPlayer);
           playerExists = true;
           updateLocalStorageRooms(currentRoom); // Save updated room
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
    if (!room || room.players.length < MIN_PLAYERS_TO_START) return;

    const playerCount = room.players.length;
    const config = ROLES_CONFIG[playerCount] || ROLES_CONFIG[Math.max(...Object.keys(ROLES_CONFIG).map(Number))]; // Fallback to largest config

    let rolesToAssign: Role[] = [];
    Object.entries(config).forEach(([role, count]) => {
      for (let i = 0; i < count; i++) {
        rolesToAssign.push(role as Role);
      }
    });
    // Fill remaining with Civilian if not enough roles defined (e.g. playerCount > 8 and no specific config)
    while(rolesToAssign.length < playerCount) {
        rolesToAssign.push(Role.Civilian);
    }

    rolesToAssign = rolesToAssign.sort(() => Math.random() - 0.5); // Shuffle roles

    const updatedPlayers = room.players.map((player, index) => ({
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
    if (room.players.length < MIN_PLAYERS_TO_START) {
      toast({ title: "Not Enough Players", description: `Need at least ${MIN_PLAYERS_TO_START} players to start. Currently ${room.players.length}.`, variant: "destructive" });
      return;
    }
    assignRolesAndCaptain();
  };

  const handleNextTurn = () => {
    if (!room || !room.currentCaptainId || room.status !== GameRoomStatus.InProgress) return;

    const currentPlayerIndex = room.players.findIndex(p => p.id === room.currentCaptainId);
    if (currentPlayerIndex === -1) return;

    const updatedPlayers = room.players.map(p => ({ ...p, isCaptain: false }));
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
      case Role.Civilian: return <Shield className="h-4 w-4 text-green-500" />;
      case Role.Blank: return <HelpCircle className="h-4 w-4 text-yellow-500" />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-3xl text-primary flex items-center justify-between">
            {room.name}
            <Badge variant={room.status === "waiting" ? "outline" : "default"} className={room.status === "waiting" ? "border-yellow-500 text-yellow-500" : room.status === "in-progress" ? "bg-green-500" : "bg-gray-500"}>
              {room.status.toUpperCase()}
            </Badge>
          </CardTitle>
          <CardDescription>Room ID: {room.id} | Host: {room.players.find(p=>p.id === room.hostId)?.name || 'Unknown'}</CardDescription>
        </CardHeader>
      </Card>

      {currentUserRole && room.status === GameRoomStatus.InProgress && (
        <Alert variant="default" className="bg-accent/20 border-accent text-accent-foreground">
          <Info className="h-5 w-5 text-accent" />
          <AlertTitle className="font-semibold">Your Role: {currentUserRole}</AlertTitle>
          <AlertDescription>
            {currentUserRole === Role.Undercover && "Your mission is to deceive others and achieve your secret objective."}
            {currentUserRole === Role.Civilian && "Work with fellow civilians to identify the undercover agents."}
            {currentUserRole === Role.Blank && "You have no specific information. Try to figure out what's happening!"}
          </AlertDescription>
        </Alert>
      )}
      
      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center"><Users className="mr-2 h-6 w-6 text-primary" /> Players ({localPlayers.length}/{room.maxPlayers})</CardTitle>
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
            <CardTitle className="text-primary">Game Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {room.status === GameRoomStatus.Waiting && (
              <>
                <p className="text-muted-foreground">Waiting for the host to start the game...</p>
                {user.id === room.hostId && (
                  <Button 
                    onClick={handleStartGame} 
                    disabled={localPlayers.length < MIN_PLAYERS_TO_START}
                    className="w-full bg-green-500 hover:bg-green-600 text-white transition-transform hover:scale-105 active:scale-95"
                  >
                    <Play className="mr-2 h-5 w-5" /> Start Game
                  </Button>
                )}
                {localPlayers.length < MIN_PLAYERS_TO_START && (
                    <p className="text-sm text-destructive">Need at least {MIN_PLAYERS_TO_START} players to start. Currently {localPlayers.length}.</p>
                )}
              </>
            )}
            {room.status === GameRoomStatus.InProgress && (
              <>
                <div className="text-center p-4 bg-secondary/30 rounded-md">
                  <p className="text-lg font-semibold">Current Captain:</p>
                  <p className="text-2xl text-accent">
                    {localPlayers.find(p => p.id === room.currentCaptainId)?.name || "Unknown"}
                  </p>
                </div>
                <p className="text-muted-foreground">Game is in progress. Follow captain's instructions or perform actions.</p>
                {user.id === room.currentCaptainId && (
                  <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">Perform Captain Action (Placeholder)</Button>
                )}
                <Button 
                  onClick={handleNextTurn}
                  variant="outline" 
                  className="w-full transition-transform hover:scale-105 active:scale-95"
                >
                  Next Turn (Simulate)
                </Button>
              </>
            )}
            {room.status === GameRoomStatus.Finished && (
              <p className="text-lg font-semibold text-center text-green-600">Game Finished! (Placeholder)</p>
            )}
             <Button variant="outline" onClick={() => router.push('/')} className="w-full mt-4">
                Back to Lobby
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
