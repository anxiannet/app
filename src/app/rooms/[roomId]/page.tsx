
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { type GameRoom, type Player, Role, GameRoomStatus, type GameRoomPhase, type Mission, type PlayerVote } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Crown, Users, Play, Info, Swords, Shield, HelpCircle, UserPlus, Eye, Repeat, UsersRound, ListChecks, Vote, ShieldCheck, ShieldX, ThumbsUp, ThumbsDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

const ROLES_CONFIG: { [key: number]: { [Role.Undercover]: number, [Role.Coach]: number, [Role.TeamMember]: number } } = {
  5: { [Role.Undercover]: 2, [Role.Coach]: 1, [Role.TeamMember]: 2 },
  6: { [Role.Undercover]: 2, [Role.Coach]: 1, [Role.TeamMember]: 3 },
  7: { [Role.Undercover]: 3, [Role.Coach]: 1, [Role.TeamMember]: 3 },
  8: { [Role.Undercover]: 3, [Role.Coach]: 1, [Role.TeamMember]: 4 },
  9: { [Role.Undercover]: 3, [Role.Coach]: 1, [Role.TeamMember]: 5 },
  10: { [Role.Undercover]: 4, [Role.Coach]: 1, [Role.TeamMember]: 5 },
};

// Mission player counts: [Round1, Round2, Round3, Round4, Round5]
const MISSIONS_CONFIG: { [playerCount: number]: number[] } = {
  5: [2, 3, 2, 3, 3],
  6: [2, 3, 4, 3, 4],
  7: [2, 3, 3, 4, 4],
  8: [3, 4, 4, 5, 5],
  9: [3, 4, 4, 5, 5],
  10: [3, 4, 4, 5, 5],
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
  const [selectedMissionTeam, setSelectedMissionTeam] = useState<string[]>([]); // IDs of players selected by captain

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
        } else if (!playerExists && currentRoom.status !== GameRoomStatus.Waiting) {
          toast({ title: "Game in Progress or Finished", description: "Cannot join a game that has already started or is finished.", variant: "destructive" });
          router.push("/");
          return;
        } else if (!playerExists && currentRoom.players.length >= currentRoom.maxPlayers) {
          toast({ title: "Room Full", description: "This room is already full.", variant: "destructive" });
          router.push("/");
          return;
        }
        
        setRoom(prevRoom => ({ 
          ...prevRoom, 
          ...currentRoom,
          teamVotes: currentRoom.teamVotes || [], // Ensure teamVotes is initialized
        }));
        setLocalPlayers(currentRoom.players);
        if (currentRoom.selectedTeamForMission) {
            setSelectedMissionTeam(currentRoom.selectedTeamForMission);
        }
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

    const missionPlayerCounts = MISSIONS_CONFIG[playerCount] || MISSIONS_CONFIG[Object.keys(MISSIONS_CONFIG).map(Number).sort((a,b)=> a-b)[0]];


    setRoom(prevRoom => {
      if (!prevRoom) return null;
      const updatedRoom: GameRoom = {
        ...prevRoom,
        players: updatedPlayers,
        status: GameRoomStatus.InProgress,
        currentCaptainId: updatedPlayers[firstCaptainIndex].id,
        currentRound: 1,
        totalRounds: TOTAL_ROUNDS_PER_GAME,
        captainChangesThisRound: 0,
        maxCaptainChangesPerRound: MAX_CAPTAIN_CHANGES_PER_ROUND,
        currentPhase: 'team_selection',
        selectedTeamForMission: [],
        teamVotes: [],
        teamScores: { teamMemberWins: 0, undercoverWins: 0 },
        missionHistory: [],
        missionPlayerCounts: missionPlayerCounts,
      };
      setLocalPlayers(updatedPlayers);
      setSelectedMissionTeam([]);
      return updatedRoom;
    });
    toast({ title: "Game Started!", description: `Roles assigned. Round 1, Team Selection. ${updatedPlayers[firstCaptainIndex].name} is the first captain.` });
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

  const handleProposeTeam = () => {
    if (!room || !user || room.currentCaptainId !== user.id || room.currentPhase !== 'team_selection' || !room.missionPlayerCounts || room.currentRound === undefined) {
      toast({ title: "Error", description: "Cannot propose team at this time.", variant: "destructive" });
      return;
    }
    const requiredPlayers = room.missionPlayerCounts[room.currentRound - 1];
    if (selectedMissionTeam.length !== requiredPlayers) {
      toast({ title: "Invalid Team Size", description: `Please select exactly ${requiredPlayers} players for this mission.`, variant: "destructive" });
      return;
    }

    setRoom(prevRoom => {
      if (!prevRoom) return null;
      return {
        ...prevRoom,
        selectedTeamForMission: [...selectedMissionTeam],
        currentPhase: 'team_voting',
        teamVotes: [], // Reset votes for the new proposal
      };
    });
    toast({ title: "Team Proposed", description: "Players will now vote on the proposed team." });
  };

  const handlePlayerSelectionForMission = (playerId: string, checked: boolean) => {
    setSelectedMissionTeam(prevSelected => {
      if (checked) {
        return [...prevSelected, playerId];
      } else {
        return prevSelected.filter(id => id !== playerId);
      }
    });
  };

  const processTeamVotes = (currentVotes: PlayerVote[]) => {
    if (!room || !user || !room.players || !room.teamScores) return;

    const approveVotes = currentVotes.filter(v => v.vote === 'approve').length;
    const rejectVotes = currentVotes.filter(v => v.vote === 'reject').length;

    if (approveVotes > rejectVotes) { // Team Approved
      toast({ title: "Team Approved!", description: "Proceeding to mission execution." });
      setRoom(prevRoom => {
        if (!prevRoom) return null;
        return {
          ...prevRoom,
          currentPhase: 'mission_execution',
          teamVotes: [], 
          // captainChangesThisRound: 0, // Captain successfully formed a team for this attempt
        };
      });
    } else { // Team Rejected
      let newCaptainChangesThisRound = (room.captainChangesThisRound || 0) + 1;
      
      if (newCaptainChangesThisRound >= (room.maxCaptainChangesPerRound || MAX_CAPTAIN_CHANGES_PER_ROUND)) {
        // Max rejections reached, Undercover team wins
        toast({ title: "Team Rejected 5 Times!", description: "Undercover team wins the game!", variant: "destructive" });
        setRoom(prevRoom => {
          if (!prevRoom || !prevRoom.teamScores) return prevRoom;
          return {
            ...prevRoom,
            status: GameRoomStatus.Finished,
            currentPhase: 'game_over',
            teamScores: {
              ...prevRoom.teamScores,
              undercoverWins: prevRoom.totalRounds || TOTAL_ROUNDS_PER_GAME, // Undercover wins all rounds
            },
            teamVotes: [],
          };
        });
      } else {
        // Pass captaincy
        const currentCaptainIndex = room.players.findIndex(p => p.id === room.currentCaptainId);
        const nextCaptainIndex = (currentCaptainIndex + 1) % room.players.length;
        const newCaptainId = room.players[nextCaptainIndex].id;
        const newCaptainName = room.players[nextCaptainIndex].name;

        toast({ title: "Team Rejected!", description: `Passing captaincy to ${newCaptainName}.` });
        setRoom(prevRoom => {
          if (!prevRoom) return null;
          const updatedPlayers = prevRoom.players.map(p => ({
            ...p,
            isCaptain: p.id === newCaptainId,
          }));
          setLocalPlayers(updatedPlayers);
          return {
            ...prevRoom,
            players: updatedPlayers,
            currentCaptainId: newCaptainId,
            captainChangesThisRound: newCaptainChangesThisRound,
            currentPhase: 'team_selection',
            selectedTeamForMission: [],
            teamVotes: [],
          };
        });
        setSelectedMissionTeam([]);
      }
    }
  };
  
  const handlePlayerVote = (vote: 'approve' | 'reject') => {
    if (!room || !user || room.currentPhase !== 'team_voting' || !room.players) {
      toast({ title: "Error", description: "Cannot vote at this time.", variant: "destructive" });
      return;
    }

    const existingVote = room.teamVotes?.find(v => v.playerId === user.id);
    if (existingVote) {
      toast({ title: "Already Voted", description: "You have already voted on this team.", variant: "destructive" });
      return;
    }

    const newVote: PlayerVote = { playerId: user.id, vote };
    let updatedVotes = [...(room.teamVotes || []), newVote];

    // Simulate virtual player votes if this is the last real player voting
    const realPlayers = room.players.filter(p => !p.id.startsWith("virtual_"));
    const realPlayersWhoVoted = updatedVotes.filter(v => realPlayers.some(rp => rp.id === v.playerId));

    if (realPlayersWhoVoted.length === realPlayers.length) {
      const virtualPlayers = room.players.filter(p => p.id.startsWith("virtual_"));
      virtualPlayers.forEach(vp => {
        if (!updatedVotes.some(v => v.playerId === vp.id)) {
          updatedVotes.push({ playerId: vp.id, vote: 'approve' }); // Virtual players always approve for now
        }
      });
      setRoom(prevRoom => ({ ...prevRoom, teamVotes: updatedVotes } as GameRoom)); // Update state to show virtual votes if needed
      processTeamVotes(updatedVotes);
    } else {
       setRoom(prevRoom => ({ ...prevRoom, teamVotes: updatedVotes } as GameRoom));
       toast({title: "Vote Cast", description: `You voted to ${vote}. Waiting for other players.`})
    }
  };


  if (isLoading || authLoading) {
    return <div className="text-center py-10">Loading room...</div>;
  }

  if (!room || !user) {
    return <div className="text-center py-10 text-destructive">Error loading room or user not authenticated.</div>;
  }

  const currentUserInRoom = localPlayers.find(p => p.id === user.id);
  const currentUserRole = currentUserInRoom?.role;
  const isCaptain = user.id === room.currentCaptainId;
  const hasUserVotedOnCurrentTeam = room.teamVotes?.some(v => v.playerId === user.id);

  const getRoleIcon = (role?: Role) => {
    switch (role) {
      case Role.Undercover: return <Swords className="h-4 w-4 text-destructive" />;
      case Role.TeamMember: return <Shield className="h-4 w-4 text-green-500" />;
      case Role.Coach: return <HelpCircle className="h-4 w-4 text-yellow-500" />;
      default: return null;
    }
  };
  
  const requiredPlayersForCurrentMission = room.missionPlayerCounts && room.currentRound !== undefined && room.missionPlayerCounts.length > room.currentRound -1  ? room.missionPlayerCounts[room.currentRound -1] : 0;

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

  const getPhaseDescription = (phase?: GameRoomPhase) => {
    switch(phase) {
        case 'team_selection': return "队伍组建阶段";
        case 'team_voting': return "队伍投票阶段";
        case 'mission_execution': return "任务执行阶段";
        case 'mission_reveal': return "任务结果揭晓";
        case 'game_over': return "游戏结束";
        default: return "未知阶段";
    }
  }
  
  const realPlayersCount = localPlayers.filter(p => !p.id.startsWith("virtual_")).length;
  const realPlayersVotedCount = room.teamVotes?.filter(v => localPlayers.find(p => p.id === v.playerId && !p.id.startsWith("virtual_"))).length || 0;
  const votesToDisplay = room.teamVotes || [];

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
           {room.status === GameRoomStatus.InProgress && (
            <div className="mt-2 text-sm text-muted-foreground space-y-1">
              {room.currentRound !== undefined && room.totalRounds !== undefined && <div className="flex items-center"><Repeat className="mr-2 h-4 w-4 text-blue-500" /> 比赛场次: {room.currentRound} / {room.totalRounds}</div>}
              {room.captainChangesThisRound !== undefined && room.maxCaptainChangesPerRound !== undefined && <div className="flex items-center"><UsersRound className="mr-2 h-4 w-4 text-orange-500" /> 本轮队长: {room.captainChangesThisRound + 1} / {room.maxCaptainChangesPerRound}</div>}
              {room.currentPhase && <div className="flex items-center"><ListChecks className="mr-2 h-4 w-4 text-purple-500" /> 当前阶段: {getPhaseDescription(room.currentPhase)}</div>}
               {room.teamScores && (
                <div className="flex items-center gap-4">
                  <span className="flex items-center"><ShieldCheck className="mr-1 h-4 w-4 text-green-500" /> 队员胜场: {room.teamScores.teamMemberWins}</span>
                  <span className="flex items-center"><ShieldX className="mr-1 h-4 w-4 text-destructive" /> 卧底胜场: {room.teamScores.undercoverWins}</span>
                </div>
              )}
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
                const playerVote = room.currentPhase === 'team_voting' ? room.teamVotes?.find(v => v.playerId === p.id)?.vote : undefined;
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
                       {playerVote && (
                        <Badge variant={playerVote === 'approve' ? 'default' : 'destructive'} className="bg-opacity-70">
                          {playerVote === 'approve' ? <ThumbsUp className="h-3 w-3" /> : <ThumbsDown className="h-3 w-3" />}
                        </Badge>
                      )}
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
            <CardTitle className="text-primary">游戏控制 / 状态</CardTitle>
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

                {room.currentPhase === 'team_selection' && (
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-center">组建任务队伍 (回合 {room.currentRound})</h3>
                    <p className="text-center text-muted-foreground">
                      本回合任务需要 <span className="font-bold text-primary">{requiredPlayersForCurrentMission}</span> 名玩家。
                      {isCaptain ? "请选择队员：" : "等待队长选择队员..."}
                    </p>
                    {isCaptain && (
                      <div className="space-y-2 max-h-60 overflow-y-auto p-2 border rounded-md">
                        {localPlayers.map(p => (
                          <div key={p.id} className="flex items-center space-x-2 p-2 hover:bg-muted/50 rounded">
                            <Checkbox
                              id={`player-select-${p.id}`}
                              checked={selectedMissionTeam.includes(p.id)}
                              onCheckedChange={(checked) => handlePlayerSelectionForMission(p.id, !!checked)}
                              disabled={selectedMissionTeam.length >= requiredPlayersForCurrentMission && !selectedMissionTeam.includes(p.id)}
                            />
                            <Label htmlFor={`player-select-${p.id}`} className="flex-grow cursor-pointer">
                              {p.name}
                            </Label>
                          </div>
                        ))}
                      </div>
                    )}
                     {isCaptain && (
                      <Button 
                        onClick={handleProposeTeam} 
                        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                        disabled={selectedMissionTeam.length !== requiredPlayersForCurrentMission}
                      >
                        <UsersRound className="mr-2 h-5 w-5" /> 提交队伍 ({selectedMissionTeam.length}/{requiredPlayersForCurrentMission})
                      </Button>
                     )}
                  </div>
                )}

                {room.currentPhase === 'team_voting' && (
                    <div className="space-y-3">
                        <h3 className="text-lg font-semibold text-center">为队伍投票 (回合 {room.currentRound})</h3>
                        <p className="text-center text-muted-foreground">队长 <span className="font-bold text-accent">{localPlayers.find(p=>p.id === room.currentCaptainId)?.name}</span> 提议以下队伍执行任务:</p>
                        <ul className="text-center font-medium list-disc list-inside bg-muted/30 p-2 rounded-md">
                           {(room.selectedTeamForMission || []).map(playerId => localPlayers.find(p=>p.id === playerId)?.name || '未知玩家').join(', ')}
                        </ul>
                        {votesToDisplay.length > 0 && (
                            <p className="text-xs text-center text-muted-foreground">
                                已投票: {votesToDisplay.filter(v => v.vote === 'approve').length} 同意, {votesToDisplay.filter(v => v.vote === 'reject').length} 拒绝.
                                ({localPlayers.length - votesToDisplay.length} 人未投票)
                            </p>
                        )}

                        {!hasUserVotedOnCurrentTeam && !user.id.startsWith("virtual_") ? (
                            <div className="flex gap-4 justify-center">
                                <Button onClick={() => handlePlayerVote('approve')} className="bg-green-500 hover:bg-green-600 text-white">
                                    <ThumbsUp className="mr-2 h-5 w-5"/> 同意
                                </Button>
                                <Button onClick={() => handlePlayerVote('reject')} variant="destructive">
                                    <ThumbsDown className="mr-2 h-5 w-5"/> 拒绝
                                </Button>
                            </div>
                        ) : (
                           !user.id.startsWith("virtual_") && <p className="text-center text-green-600 font-semibold">你已投票: {room.teamVotes?.find(v=>v.playerId === user.id)?.vote === 'approve' ? '同意' : '拒绝'}</p>
                        )}
                         {realPlayersVotedCount < realPlayersCount && <p className="text-sm text-center text-muted-foreground">等待其他玩家投票...</p>}
                    </div>
                )}

                {room.currentPhase === 'mission_execution' && (
                     <div className="space-y-3">
                        <h3 className="text-lg font-semibold text-center">任务执行中 (回合 {room.currentRound})</h3>
                        <p className="text-center text-muted-foreground">
                            队伍成员: { (room.selectedTeamForMission || []).map(playerId => localPlayers.find(p=>p.id === playerId)?.name || '未知玩家').join(', ')}
                        </p>
                        <p className="text-center text-muted-foreground">等待任务结果...</p>
                        <p className="text-xs text-center text-muted-foreground">(任务卡牌功能待实现)</p>
                    </div>
                )}
                
                {room.currentPhase === 'mission_reveal' && (
                     <div className="space-y-3">
                        <h3 className="text-lg font-semibold text-center">任务结果 (回合 {room.currentRound})</h3>
                         <p className="text-center text-muted-foreground">等待结果揭晓...</p>
                        <p className="text-xs text-center text-muted-foreground">(结果展示待实现)</p>
                    </div>
                )}
              </>
            )}
            {room.status === GameRoomStatus.Finished && (
              <div className="text-center p-6 bg-green-100 dark:bg-green-900 rounded-lg shadow">
                <h3 className="text-2xl font-bold text-green-700 dark:text-green-300">游戏结束!</h3>
                 {room.teamScores && (
                    <p className="text-lg mt-2">
                        {room.teamScores.teamMemberWins > room.teamScores.undercoverWins 
                            ? <span className="text-green-600">队员阵营胜利!</span> 
                            : room.teamScores.undercoverWins > room.teamScores.teamMemberWins 
                                ? <span className="text-destructive">卧底阵营胜利!</span> 
                                : <span className="text-foreground">平局!</span>}
                    </p>
                )}
                <div className="flex items-center gap-4 justify-center mt-2">
                  <span className="flex items-center"><ShieldCheck className="mr-1 h-4 w-4 text-green-500" /> 队员胜场: {room.teamScores?.teamMemberWins || 0}</span>
                  <span className="flex items-center"><ShieldX className="mr-1 h-4 w-4 text-destructive" /> 卧底胜场: {room.teamScores?.undercoverWins || 0}</span>
                </div>
                <p className="text-muted-foreground mt-2">感谢您的参与！</p>
              </div>
            )}
            {room.status === GameRoomStatus.Waiting && (
              <Button variant="outline" onClick={() => router.push('/')} className="w-full mt-4">
                  返回大厅
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

