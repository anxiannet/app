
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { type GameRoom, type Player, Role, GameRoomStatus, type GameRoomPhase, type Mission, type PlayerVote, type MissionCardPlay, type MissionOutcome } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Crown, Users, Play, Info, Swords, Shield, HelpCircle, UserPlus, Eye, Repeat, UsersRound, ListChecks, Vote, ShieldCheck, ShieldX, ThumbsUp, ThumbsDown, CheckCircle2, XCircle, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const ROLES_CONFIG: { [key: number]: { [Role.Undercover]: number, [Role.Coach]: number, [Role.TeamMember]: number } } = {
  5: { [Role.Undercover]: 2, [Role.Coach]: 1, [Role.TeamMember]: 2 },
  6: { [Role.Undercover]: 2, [Role.Coach]: 1, [Role.TeamMember]: 3 },
  7: { [Role.Undercover]: 3, [Role.Coach]: 1, [Role.TeamMember]: 3 },
  8: { [Role.Undercover]: 3, [Role.Coach]: 1, [Role.TeamMember]: 4 },
  9: { [Role.Undercover]: 3, [Role.Coach]: 1, [Role.TeamMember]: 5 },
  10: { [Role.Undercover]: 4, [Role.Coach]: 1, [Role.TeamMember]: 5 },
};

const MISSIONS_CONFIG: { [playerCount: number]: number[] } = {
  5: [2, 3, 2, 3, 3],
  6: [2, 3, 4, 3, 4],
  7: [2, 3, 3, 4, 4], // For 7+ players, Round 4 needs 2 fail cards to fail mission
  8: [3, 4, 4, 5, 5], // For 7+ players, Round 4 needs 2 fail cards to fail mission
  9: [3, 4, 4, 5, 5], // For 7+ players, Round 4 needs 2 fail cards to fail mission
  10: [3, 4, 4, 5, 5], // For 7+ players, Round 4 needs 2 fail cards to fail mission
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
  const [selectedMissionTeam, setSelectedMissionTeam] = useState<string[]>([]);
  const [humanUndercoverCardChoice, setHumanUndercoverCardChoice] = useState<'success' | 'fail' | null>(null);

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
          teamVotes: currentRoom.teamVotes || [], 
          missionCardPlaysForCurrentMission: currentRoom.missionCardPlaysForCurrentMission || [],
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

  // Simplified Virtual Captain team proposal (non-AI)
  useEffect(() => {
    if (!room || !user || room.status !== GameRoomStatus.InProgress || room.currentPhase !== 'team_selection') {
      return;
    }
    const currentCaptain = localPlayers.find(p => p.id === room.currentCaptainId);
    if (currentCaptain && currentCaptain.id.startsWith("virtual_")) {
      const performVirtualCaptainTeamProposal = () => {
        toast({ title: "虚拟队长行动中", description: `${currentCaptain.name} 正在选择队伍...` });
        if (!room.currentRound || !room.missionPlayerCounts) return;
        
        const requiredPlayers = room.missionPlayerCounts[room.currentRound -1];
        let proposedTeamIds: string[] = [currentCaptain.id];
        const otherPlayers = localPlayers.filter(p => p.id !== currentCaptain.id);
        const shuffledOtherPlayers = otherPlayers.sort(() => 0.5 - Math.random());
        for (let i = 0; proposedTeamIds.length < requiredPlayers && i < shuffledOtherPlayers.length; i++) {
            proposedTeamIds.push(shuffledOtherPlayers[i].id);
        }
        if (proposedTeamIds.length < requiredPlayers) { // Fallback
            const allPlayerIds = localPlayers.map(p => p.id).sort(() => 0.5 - Math.random());
            proposedTeamIds = allPlayerIds.slice(0, requiredPlayers);
        }
        proposedTeamIds = proposedTeamIds.slice(0, requiredPlayers);

        const proposedTeamNames = proposedTeamIds.map(id => localPlayers.find(p=>p.id === id)?.name || 'Unknown').join(', ');
        setRoom(prevRoom => {
          if (!prevRoom) return null;
          return {
            ...prevRoom,
            selectedTeamForMission: proposedTeamIds,
            currentPhase: 'team_voting',
            teamVotes: [],
          };
        });
        toast({ title: "虚拟队伍已提议", description: `${currentCaptain.name} 提议: ${proposedTeamNames}` });
      };
      const timer = setTimeout(performVirtualCaptainTeamProposal, 1500);
      return () => clearTimeout(timer);
    }
  }, [room, user, localPlayers, toast]);


  // Effect to process mission actions once all human players on mission have acted
  useEffect(() => {
    if (!room || room.status !== GameRoomStatus.InProgress || room.currentPhase !== 'mission_execution' || !user) {
      return;
    }

    const missionTeamPlayerIds = room.selectedTeamForMission || [];
    const humanPlayersOnMission = missionTeamPlayerIds.filter(playerId => {
      const player = localPlayers.find(p => p.id === playerId);
      return player && !player.id.startsWith("virtual_");
    });

    if (humanPlayersOnMission.length === 0 && missionTeamPlayerIds.length > 0) { // Only AI on mission
      const timer = setTimeout(() => finalizeAndRevealMissionOutcome(), 1000); // Simulate AI acting
      return () => clearTimeout(timer);
    }
    
    const humanActionsRecorded = room.missionCardPlaysForCurrentMission?.filter(play => humanPlayersOnMission.includes(play.playerId)).length || 0;

    if (humanActionsRecorded === humanPlayersOnMission.length && humanPlayersOnMission.length > 0) {
      finalizeAndRevealMissionOutcome();
    }
  }, [room, localPlayers, user]);


  const assignRolesAndCaptain = () => {
    if (!room || localPlayers.length < MIN_PLAYERS_TO_START) return;

    const playerCount = localPlayers.length;
    const config = ROLES_CONFIG[playerCount] || ROLES_CONFIG[Math.max(...Object.keys(ROLES_CONFIG).map(Number))]; 
    let rolesToAssign: Role[] = [];
    Object.entries(config).forEach(([role, count]) => {
      for (let i = 0; i < count; i++) rolesToAssign.push(role as Role);
    });
    while(rolesToAssign.length < playerCount) rolesToAssign.push(Role.TeamMember); 
    rolesToAssign = rolesToAssign.slice(0, playerCount).sort(() => Math.random() - 0.5); 

    const updatedPlayers = localPlayers.map((player, index) => ({
      ...player, role: rolesToAssign[index], isCaptain: false,
    }));
    const firstCaptainIndex = Math.floor(Math.random() * updatedPlayers.length);
    updatedPlayers[firstCaptainIndex].isCaptain = true;
    const missionPlayerCounts = MISSIONS_CONFIG[playerCount] || MISSIONS_CONFIG[Object.keys(MISSIONS_CONFIG).map(Number).sort((a,b)=> a-b)[0]];

    setRoom(prevRoom => {
      if (!prevRoom) return null;
      const updatedRoomData: GameRoom = {
        ...prevRoom, players: updatedPlayers, status: GameRoomStatus.InProgress,
        currentCaptainId: updatedPlayers[firstCaptainIndex].id, currentRound: 1, totalRounds: TOTAL_ROUNDS_PER_GAME,
        captainChangesThisRound: 0, maxCaptainChangesPerRound: MAX_CAPTAIN_CHANGES_PER_ROUND,
        currentPhase: 'team_selection', selectedTeamForMission: [], teamVotes: [],
        missionCardPlaysForCurrentMission: [], missionOutcomeForDisplay: undefined, failCardsPlayedForDisplay: undefined,
        teamScores: { teamMemberWins: 0, undercoverWins: 0 }, missionHistory: [], missionPlayerCounts: missionPlayerCounts,
      };
      setLocalPlayers(updatedPlayers);
      setSelectedMissionTeam([]);
      setHumanUndercoverCardChoice(null);
      return updatedRoomData;
    });
    toast({ title: "游戏开始!", description: `角色已分配。第 1 轮，队伍组建阶段。 ${updatedPlayers[firstCaptainIndex].name} 是首任队长。` });
  };
  
  const handleStartGame = () => {
    if (!room || !user || room.hostId !== user.id) {
      toast({ title: "未授权", description: "只有主持人可以开始游戏。", variant: "destructive" }); return;
    }
    if (localPlayers.length < MIN_PLAYERS_TO_START) {
      toast({ title: "玩家数量不足", description: `至少需要 ${MIN_PLAYERS_TO_START} 名玩家才能开始。当前 ${localPlayers.length} 名。`, variant: "destructive" }); return;
    }
    if (localPlayers.length > room.maxPlayers) {
      toast({ title: "玩家数量过多", description: `此房间最大支持 ${room.maxPlayers} 名玩家。当前 ${localPlayers.length} 名。`, variant: "destructive" }); return;
    }
    assignRolesAndCaptain();
  };

  const handleAddVirtualPlayer = () => {
    if (!room || !user || room.hostId !== user.id || room.status !== GameRoomStatus.Waiting) {
      toast({ title: "未授权", description: "只有主持人在等待阶段可以添加虚拟玩家。", variant: "destructive" }); return;
    }
    if (localPlayers.length >= room.maxPlayers) {
      toast({ title: "房间已满", description: "无法添加更多玩家，房间已满。", variant: "destructive" }); return;
    }
    const existingVirtualPlayerNames = localPlayers.filter(p => p.id.startsWith("virtual_")).map(p => p.name);
    const availableNames = COMMON_CHINESE_NAMES.filter(name => !existingVirtualPlayerNames.includes(name));
    if (availableNames.length === 0) {
      toast({ title: "错误", description: "没有更多可用的虚拟玩家名称。", variant: "destructive" }); return;
    }
    const virtualPlayerName = availableNames[Math.floor(Math.random() * availableNames.length)];
    const virtualPlayerId = `virtual_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const newVirtualPlayer: Player = {
      id: virtualPlayerId, name: virtualPlayerName,
      avatarUrl: `https://placehold.co/100x100.png?text=${encodeURIComponent(virtualPlayerName.charAt(0))}`,
      isCaptain: false,
    };
    const updatedPlayers = [...localPlayers, newVirtualPlayer];
    setRoom(prevRoom => {
      if (!prevRoom) return null;
      const updatedRoomData = { ...prevRoom, players: updatedPlayers };
      setLocalPlayers(updatedPlayers);
      return updatedRoomData;
    });
    toast({ title: "虚拟玩家已添加", description: `${virtualPlayerName} 已加入房间。` });
  };

  const handleHumanProposeTeam = () => {
    if (!room || !user || room.currentCaptainId !== user.id || room.currentPhase !== 'team_selection' || !room.missionPlayerCounts || room.currentRound === undefined) {
      toast({ title: "错误", description: "当前无法提议队伍。", variant: "destructive" }); return;
    }
    const requiredPlayers = room.missionPlayerCounts[room.currentRound - 1];
    if (selectedMissionTeam.length !== requiredPlayers) {
      toast({ title: "队伍人数无效", description: `此任务请选择 ${requiredPlayers} 名玩家。`, variant: "destructive" }); return;
    }
    setRoom(prevRoom => {
      if (!prevRoom) return null;
      return { ...prevRoom, selectedTeamForMission: [...selectedMissionTeam], currentPhase: 'team_voting', teamVotes: [] };
    });
    toast({ title: "队伍已提议", description: "玩家现在将对提议的队伍进行投票。" });
  };

  const handlePlayerSelectionForMission = (playerId: string, checked: boolean) => {
    setSelectedMissionTeam(prevSelected => checked ? [...prevSelected, playerId] : prevSelected.filter(id => id !== playerId));
  };

  const processTeamVotes = (currentVotes: PlayerVote[]) => {
    if (!room || !user || !room.players || !room.teamScores) return;
    const approveVotes = currentVotes.filter(v => v.vote === 'approve').length;
    const rejectVotes = currentVotes.filter(v => v.vote === 'reject').length;

    if (approveVotes > rejectVotes) {
      toast({ title: "队伍已批准!", description: "进入任务执行阶段。" });
      setRoom(prevRoom => {
        if (!prevRoom) return null;
        return {
          ...prevRoom, currentPhase: 'mission_execution', teamVotes: currentVotes, // Keep votes for record
          captainChangesThisRound: 0, // Reset as team was approved
          missionCardPlaysForCurrentMission: [], // Initialize for new mission
          humanUndercoverCardChoice: null,
        };
      });
      setHumanUndercoverCardChoice(null); // Reset local state for human undercover
       // Auto-add success cards for human TeamMembers/Coaches on mission
      const currentSelectedTeam = room.selectedTeamForMission || [];
      const autoPlays: MissionCardPlay[] = [];
      currentSelectedTeam.forEach(playerId => {
        const player = localPlayers.find(p => p.id === playerId);
        if (player && !player.id.startsWith("virtual_") && (player.role === Role.TeamMember || player.role === Role.Coach)) {
          autoPlays.push({ playerId: player.id, card: 'success' });
        }
      });
      if (autoPlays.length > 0) {
        setRoom(prev => prev ? {...prev, missionCardPlaysForCurrentMission: [...(prev.missionCardPlaysForCurrentMission || []), ...autoPlays]} : null);
      }


    } else {
      let newCaptainChangesThisRound = (room.captainChangesThisRound || 0) + 1;
      if (newCaptainChangesThisRound >= (room.maxCaptainChangesPerRound || MAX_CAPTAIN_CHANGES_PER_ROUND)) {
        toast({ title: "队伍被拒绝5次!", description: "卧底阵营获胜!", variant: "destructive" });
        setRoom(prevRoom => {
          if (!prevRoom || !prevRoom.teamScores) return prevRoom;
          return {
            ...prevRoom, status: GameRoomStatus.Finished, currentPhase: 'game_over',
            teamScores: { ...prevRoom.teamScores, undercoverWins: prevRoom.totalRounds || TOTAL_ROUNDS_PER_GAME },
            teamVotes: currentVotes,
          };
        });
      } else {
        const currentCaptainIndex = room.players.findIndex(p => p.id === room.currentCaptainId);
        const nextCaptainIndex = (currentCaptainIndex + 1) % room.players.length;
        const newCaptainId = room.players[nextCaptainIndex].id;
        const newCaptainName = room.players[nextCaptainIndex].name;
        toast({ title: "队伍被拒绝!", description: `队长顺位传给 ${newCaptainName}。` });
        setRoom(prevRoom => {
          if (!prevRoom) return null;
          const updatedPlayersData = prevRoom.players.map(p => ({ ...p, isCaptain: p.id === newCaptainId }));
          setLocalPlayers(updatedPlayersData);
          return {
            ...prevRoom, players: updatedPlayersData, currentCaptainId: newCaptainId,
            captainChangesThisRound: newCaptainChangesThisRound, currentPhase: 'team_selection',
            selectedTeamForMission: [], teamVotes: [],
          };
        });
        setSelectedMissionTeam([]);
      }
    }
  };
  
 const handlePlayerVote = (vote: 'approve' | 'reject') => {
    if (!room || !user || room.currentPhase !== 'team_voting' || !room.players) {
      toast({ title: "错误", description: "当前无法投票。", variant: "destructive" }); return;
    }
    const existingVote = room.teamVotes?.find(v => v.playerId === user.id);
    if (existingVote) {
      toast({ title: "已投票", description: "您已对该队伍投过票。", variant: "destructive" }); return;
    }
    const newVote: PlayerVote = { playerId: user.id, vote };
    let updatedVotes = [...(room.teamVotes || []), newVote];
    setRoom(prevRoom => prevRoom ? {...prevRoom, teamVotes: updatedVotes} : null);
    toast({title: "投票已提交", description: `您投了 ${vote === 'approve' ? '同意' : '拒绝'}。等待其他玩家...`});

    const realPlayers = room.players.filter(p => !p.id.startsWith("virtual_"));
    const realPlayersWhoVotedIds = new Set(updatedVotes.filter(v => realPlayers.some(rp => rp.id === v.playerId)).map(v => v.playerId));
    if (realPlayersWhoVotedIds.size === realPlayers.length) {
      const virtualPlayers = room.players.filter(p => p.id.startsWith("virtual_"));
      const virtualPlayerVotes: PlayerVote[] = virtualPlayers.map(vp => ({ playerId: vp.id, vote: 'approve' })); // Simplified: AI always approves
      updatedVotes = [...updatedVotes, ...virtualPlayerVotes];
      setRoom(prevRoom => prevRoom ? {...prevRoom, teamVotes: updatedVotes} : null);
      processTeamVotes(updatedVotes);
    }
  };

  const handleHumanUndercoverPlayCard = (card: 'success' | 'fail') => {
    if (!room || !user || room.currentPhase !== 'mission_execution' || !currentUserIsUndercoverOnMission) {
      toast({ title: "错误", description: "当前无法打出任务牌。", variant: "destructive" });
      return;
    }
    const existingPlay = room.missionCardPlaysForCurrentMission?.find(p => p.playerId === user.id);
    if (existingPlay) {
        toast({ title: "已行动", description: "您已在此任务中行动过。", variant: "destructive" });
        return;
    }
    setHumanUndercoverCardChoice(card); // For UI feedback
    setRoom(prev => {
        if (!prev) return null;
        const newPlay: MissionCardPlay = { playerId: user.id, card };
        return {
            ...prev,
            missionCardPlaysForCurrentMission: [...(prev.missionCardPlaysForCurrentMission || []), newPlay]
        }
    });
     toast({ title: "任务牌已打出", description: `您打出了【${card === 'success' ? '成功' : '破坏'}】。` });
  };

  const finalizeAndRevealMissionOutcome = useCallback(() => {
    if (!room || !room.selectedTeamForMission || !room.players || !room.teamScores || room.currentRound === undefined) return;

    let finalPlays: MissionCardPlay[] = [...(room.missionCardPlaysForCurrentMission || [])];
    
    // Simulate virtual player actions
    room.selectedTeamForMission.forEach(playerId => {
      const player = localPlayers.find(p => p.id === playerId);
      if (player && player.id.startsWith("virtual_") && !finalPlays.some(fp => fp.playerId === playerId)) {
        const cardToPlay: 'success' | 'fail' = player.role === Role.Undercover ? 'fail' : 'success';
        finalPlays.push({ playerId: player.id, card: cardToPlay });
      }
    });

    const failCardsPlayed = finalPlays.filter(p => p.card === 'fail').length;
    let missionSuccessful: boolean;

    if (room.players.length >= 7 && room.currentRound === 4) {
      missionSuccessful = failCardsPlayed < 2;
    } else {
      missionSuccessful = failCardsPlayed < 1;
    }
    
    const outcome: MissionOutcome = missionSuccessful ? 'success' : 'fail';
    const newTeamScores = { ...room.teamScores };
    if (missionSuccessful) newTeamScores.teamMemberWins++;
    else newTeamScores.undercoverWins++;

    const missionRecord: Mission = {
      round: room.currentRound,
      captainId: room.currentCaptainId || "unknown",
      teamPlayerIds: room.selectedTeamForMission,
      outcome: outcome,
      failCardsPlayed: failCardsPlayed,
    };
    
    setRoom(prev => {
      if (!prev) return null;
      return {
        ...prev,
        teamScores: newTeamScores,
        missionHistory: [...(prev.missionHistory || []), missionRecord],
        currentPhase: 'mission_reveal',
        missionOutcomeForDisplay: outcome,
        failCardsPlayedForDisplay: failCardsPlayed,
      };
    });
    toast({ title: `第 ${room.currentRound} 轮任务结束`, description: `结果: ${outcome === 'success' ? '成功' : '失败'} (${failCardsPlayed} 张破坏牌)`});

  }, [room, localPlayers, toast]);


  const handleProceedToNextRoundOrGameOver = () => {
    if (!room || !room.teamScores || room.currentRound === undefined || room.totalRounds === undefined) return;

    if (room.teamScores.teamMemberWins >= 3 || room.teamScores.undercoverWins >= 3 || room.currentRound >= room.totalRounds) {
      setRoom(prev => prev ? { ...prev, status: GameRoomStatus.Finished, currentPhase: 'game_over' } : null);
      toast({ title: "游戏结束!", description: `${room.teamScores.teamMemberWins >= 3 ? '队员' : '卧底'}阵营获胜!` });
    } else {
      const nextRound = room.currentRound + 1;
      const currentCaptainIndex = localPlayers.findIndex(p => p.id === room.currentCaptainId);
      const nextCaptainIndex = (currentCaptainIndex + 1) % localPlayers.length;
      const newCaptainId = localPlayers[nextCaptainIndex].id;
      
      const updatedPlayers = localPlayers.map(p => ({ ...p, isCaptain: p.id === newCaptainId }));
      setLocalPlayers(updatedPlayers);

      setRoom(prev => {
        if (!prev) return null;
        return {
          ...prev,
          players: updatedPlayers,
          currentRound: nextRound,
          currentCaptainId: newCaptainId,
          captainChangesThisRound: 0,
          currentPhase: 'team_selection',
          selectedTeamForMission: [],
          teamVotes: [],
          missionCardPlaysForCurrentMission: [],
          missionOutcomeForDisplay: undefined,
          failCardsPlayedForDisplay: undefined,
        };
      });
      setSelectedMissionTeam([]);
      setHumanUndercoverCardChoice(null);
      toast({ title: `第 ${nextRound} 轮开始`, description: `队长是 ${localPlayers.find(p=>p.id === newCaptainId)?.name}` });
    }
  };


  if (isLoading || authLoading) return <div className="text-center py-10">载入房间...</div>;
  if (!room || !user) return <div className="text-center py-10 text-destructive">载入房间错误或用户未验证。</div>;

  const currentUserInRoom = localPlayers.find(p => p.id === user.id);
  const currentUserRole = currentUserInRoom?.role;
  const isHumanCaptain = user.id === room.currentCaptainId && !user.id.startsWith("virtual_");
  const isVirtualCaptain = room.currentCaptainId?.startsWith("virtual_") ?? false;
  const hasUserVotedOnCurrentTeam = room.teamVotes?.some(v => v.playerId === user.id);
  
  const missionTeamPlayerObjects = room.selectedTeamForMission?.map(id => localPlayers.find(p => p.id === id)).filter(Boolean) as Player[] || [];
  const currentUserIsOnMission = !!room.selectedTeamForMission?.includes(user.id);
  const currentUserIsUndercoverOnMission = currentUserIsOnMission && currentUserRole === Role.Undercover;
  const currentUserHasPlayedMissionCard = room.missionCardPlaysForCurrentMission?.some(p => p.playerId === user.id);


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

  const knownUndercoversByCoach = currentUserRole === Role.Coach && room.status === GameRoomStatus.InProgress ? localPlayers.filter(p => p.role === Role.Undercover) : [];
  const fellowUndercovers = currentUserRole === Role.Undercover && room.status === GameRoomStatus.InProgress ? localPlayers.filter(p => p.role === Role.Undercover && p.id !== user.id) : [];
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
              <CardTitle className="text-3xl text-primary flex items-center">{room.name}</CardTitle>
              <CardDescription>房间 ID: {room.id} | 主持人: {localPlayers.find(p=>p.id === room.hostId)?.name || '未知'}</CardDescription>
            </div>
            <Badge variant={room.status === GameRoomStatus.Waiting ? "outline" : "default"} className={`ml-auto ${room.status === GameRoomStatus.Waiting ? "border-yellow-500 text-yellow-500" : room.status === GameRoomStatus.InProgress ? "bg-green-500 text-white" : "bg-gray-500 text-white"}`}>{room.status.toUpperCase()}</Badge>
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
          <Eye className="h-5 w-5 text-primary" /><AlertTitle className="font-semibold">你知道的卧底</AlertTitle>
          <AlertDescription>作为教练，你已洞察到以下玩家是卧底: {knownUndercoversByCoach.map(u => u.name).join(', ')}。</AlertDescription>
        </Alert>
      )}
      {room.status === GameRoomStatus.InProgress && currentUserRole === Role.Undercover && (
        <>{fellowUndercovers.length > 0 && (
            <Alert variant="default" className="bg-destructive/10 border-destructive/30 text-destructive-foreground mt-4">
              <Users className="h-5 w-5 text-destructive" /><AlertTitle className="font-semibold">你的卧底同伙</AlertTitle>
              <AlertDescription>你的卧底同伙是: {fellowUndercovers.map(u => u.name).join(', ')}。</AlertDescription>
            </Alert>
          )}
          {isSoleUndercover && ( <Alert variant="default" className="bg-destructive/10 border-destructive/30 text-destructive-foreground mt-4">
              <Info className="h-5 w-5 text-destructive" /><AlertTitle className="font-semibold">孤军奋战</AlertTitle><AlertDescription>你是场上唯一的卧底。</AlertDescription></Alert>
          )}</>
      )}
      
      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader><CardTitle className="flex items-center"><Users className="mr-2 h-6 w-6 text-primary" /> 玩家 ({localPlayers.length}/{room.maxPlayers})</CardTitle></CardHeader>
          <CardContent><ul className="space-y-3">
              {localPlayers.map((p) => {
                const isCurrentUser = p.id === user.id;
                const playerVote = (room.currentPhase === 'team_voting' || room.currentPhase === 'mission_execution' || room.currentPhase === 'game_over' || room.currentPhase === 'mission_reveal') ? votesToDisplay.find(v => v.playerId === p.id)?.vote : undefined;
                const missionCardPlay = room.currentPhase === 'mission_reveal' && room.missionCardPlaysForCurrentMission?.find(play => play.playerId === p.id)?.card;
                return (
                  <li key={p.id} className="flex items-center justify-between p-3 bg-secondary/50 rounded-md shadow-sm">
                    <div className="flex items-center">
                      <Avatar className="h-10 w-10 mr-3 border-2 border-primary/50">
                        <AvatarImage src={p.avatarUrl} alt={p.name} data-ai-hint="avatar person"/>
                        <AvatarFallback>{p.name.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{p.name} {isCurrentUser && "(你)"} {p.id.startsWith("virtual_") && <span className="text-xs text-blue-400">(虚拟)</span>}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                       {playerVote && (
                        <Badge className={cn("px-1.5 py-0.5 text-xs", playerVote === 'approve' ? "bg-green-500 hover:bg-green-600 text-white" : "bg-red-500 hover:bg-red-600 text-white")}>
                          {playerVote === 'approve' ? <ThumbsUp className="h-3 w-3" /> : <ThumbsDown className="h-3 w-3" />}
                        </Badge>
                      )}
                      {missionCardPlay && (
                        <Badge className={cn("px-1.5 py-0.5 text-xs", missionCardPlay === 'success' ? "bg-blue-500 text-white" : "bg-orange-500 text-white")}>
                           {missionCardPlay === 'success' ? <ShieldCheck className="h-3 w-3" /> : <ShieldX className="h-3 w-3" />}
                        </Badge>
                      )}
                      {room.status === GameRoomStatus.InProgress && p.role && (<>
                          {isCurrentUser && (<Badge variant="secondary" className="flex items-center gap-1">{getRoleIcon(p.role)} {p.role}</Badge>)}
                          {!isCurrentUser && currentUserRole === Role.Coach && p.role === Role.Undercover && (<Badge variant="destructive" className="flex items-center gap-1"><Eye className="h-4 w-4" /> 卧底</Badge>)}
                          {!isCurrentUser && currentUserRole === Role.Undercover && p.role === Role.Undercover && (<Badge variant="outline" className="flex items-center gap-1 border-destructive text-destructive"><Users className="h-4 w-4" /> 卧底队友</Badge>)}
                        </>)}
                      {p.id === room.currentCaptainId && <Crown className="h-5 w-5 text-yellow-500" title="Captain" />}
                    </div>
                  </li>);})}</ul></CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader><CardTitle className="text-primary">游戏控制 / 状态</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {room.status === GameRoomStatus.Waiting && (<>
                <p className="text-muted-foreground">等待主持人开始游戏...</p>
                {isHost && (<div className="space-y-2">
                    <Button onClick={handleStartGame} disabled={!canStartGame} className="w-full bg-green-500 hover:bg-green-600 text-white transition-transform hover:scale-105 active:scale-95"><Play className="mr-2 h-5 w-5" /> 开始游戏</Button>
                    {!canStartGame && (localPlayers.length < MIN_PLAYERS_TO_START || localPlayers.length > room.maxPlayers) && (<p className="text-sm text-destructive text-center">需要 {MIN_PLAYERS_TO_START}-{room.maxPlayers} 名玩家才能开始. 当前 {localPlayers.length} 名.</p>)}
                     <Button onClick={handleAddVirtualPlayer} disabled={!canAddVirtualPlayer} variant="outline" className="w-full transition-transform hover:scale-105 active:scale-95"><UserPlus className="mr-2 h-5 w-5" /> 添加虚拟玩家</Button>
                    {!canAddVirtualPlayer && localPlayers.length >= room.maxPlayers && (<p className="text-sm text-destructive text-center">房间已满.</p>)}</div>)}</>)}
            
            {room.status === GameRoomStatus.InProgress && (<>
                <div className="text-center p-4 bg-secondary/30 rounded-md">
                  <p className="text-lg font-semibold">当前队长:</p><p className="text-2xl text-accent">{localPlayers.find(p => p.id === room.currentCaptainId)?.name || "Unknown"}</p>
                </div>

                {room.currentPhase === 'team_selection' && isVirtualCaptain && (<div className="text-center p-4"><p className="text-lg font-semibold text-blue-500 flex items-center justify-center">{localPlayers.find(p => p.id === room.currentCaptainId)?.name} 正在选择队伍...</p></div>)}

                {room.currentPhase === 'team_selection' && !isVirtualCaptain && (
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-center">组建任务队伍 (回合 {room.currentRound})</h3>
                    <p className="text-center text-muted-foreground">本回合任务需要 <span className="font-bold text-primary">{requiredPlayersForCurrentMission}</span> 名玩家。{isHumanCaptain ? "请选择队员：" : "等待队长选择队员..."}</p>
                    {isHumanCaptain && (<div className="space-y-2 max-h-60 overflow-y-auto p-2 border rounded-md">
                        {localPlayers.map(p => (<div key={p.id} className="flex items-center space-x-2 p-2 hover:bg-muted/50 rounded">
                            <Checkbox id={`player-select-${p.id}`} checked={selectedMissionTeam.includes(p.id)} onCheckedChange={(checked) => handlePlayerSelectionForMission(p.id, !!checked)} disabled={selectedMissionTeam.length >= requiredPlayersForCurrentMission && !selectedMissionTeam.includes(p.id)}/>
                            <Label htmlFor={`player-select-${p.id}`} className="flex-grow cursor-pointer">{p.name}</Label></div>))}</div>)}
                     {isHumanCaptain && (<Button onClick={handleHumanProposeTeam} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={selectedMissionTeam.length !== requiredPlayersForCurrentMission}><UsersRound className="mr-2 h-5 w-5" /> 提交队伍 ({selectedMissionTeam.length}/{requiredPlayersForCurrentMission})</Button>)}
                  </div>)}

                {room.currentPhase === 'team_voting' && (
                    <div className="space-y-3">
                        <h3 className="text-lg font-semibold text-center">为队伍投票 (回合 {room.currentRound})</h3>
                        <p className="text-center text-muted-foreground">队长 <span className="font-bold text-accent">{localPlayers.find(p=>p.id === room.currentCaptainId)?.name}</span> 提议以下队伍执行任务:</p>
                        <ul className="text-center font-medium list-disc list-inside bg-muted/30 p-2 rounded-md">{(room.selectedTeamForMission || []).map(playerId => localPlayers.find(p=>p.id === playerId)?.name || '未知玩家').join(', ')}</ul>
                        {votesToDisplay.length > 0 && (<p className="text-xs text-center text-muted-foreground">已投票: {votesToDisplay.filter(v => v.vote === 'approve').length} 同意, {votesToDisplay.filter(v => v.vote === 'reject').length} 拒绝. ({localPlayers.filter(p => !votesToDisplay.some(v => v.playerId === p.id)).length} 人未投票)</p>)}
                        {!hasUserVotedOnCurrentTeam && !user.id.startsWith("virtual_") ? (<div className="flex gap-4 justify-center">
                                <Button onClick={() => handlePlayerVote('approve')} className="bg-green-500 hover:bg-green-600 text-white"><ThumbsUp className="mr-2 h-5 w-5"/> 同意</Button>
                                <Button onClick={() => handlePlayerVote('reject')} variant="destructive"><ThumbsDown className="mr-2 h-5 w-5"/> 拒绝</Button></div>
                        ) : (!user.id.startsWith("virtual_") && <p className="text-center text-green-600 font-semibold">你已投票: {room.teamVotes?.find(v=>v.playerId === user.id)?.vote === 'approve' ? '同意' : '拒绝'}</p>)}
                         {realPlayersVotedCount < realPlayersCount && <p className="text-sm text-center text-muted-foreground">等待其他真实玩家投票...</p>}
                    </div>)}

                {room.currentPhase === 'mission_execution' && (
                     <div className="space-y-3">
                        <h3 className="text-lg font-semibold text-center">任务执行中 (回合 {room.currentRound})</h3>
                        <p className="text-center text-muted-foreground">出战队伍: { missionTeamPlayerObjects.map(p => p.name).join(', ') }</p>
                        {currentUserIsOnMission ? (
                            currentUserRole === Role.Undercover ? (
                                !currentUserHasPlayedMissionCard ? (
                                    <div className="text-center space-y-2">
                                        <p className="font-semibold">选择你的行动：</p>
                                        <div className="flex gap-4 justify-center">
                                            <Button onClick={() => handleHumanUndercoverPlayCard('success')} className="bg-blue-500 hover:bg-blue-600 text-white"><ShieldCheck className="mr-2 h-5 w-5"/> 打出【成功】</Button>
                                            <Button onClick={() => handleHumanUndercoverPlayCard('fail')} variant="destructive" className="bg-orange-500 hover:bg-orange-600"><ShieldX className="mr-2 h-5 w-5"/> 打出【破坏】</Button>
                                        </div>
                                    </div>
                                ) : (<p className="text-center text-green-600 font-semibold">你已选择: 打出【{humanUndercoverCardChoice === 'success' ? '成功' : '破坏'}】</p>)
                            ) : (<p className="text-center text-blue-600 font-semibold">你自动打出【成功】牌。</p>)
                        ) : (<p className="text-center text-muted-foreground">等待任务队伍行动...</p>)}
                    </div>
                )}
                
                {room.currentPhase === 'mission_reveal' && (
                     <div className="space-y-3 text-center">
                        <h3 className="text-lg font-semibold">第 {room.currentRound} 轮任务结果揭晓!</h3>
                        {room.missionOutcomeForDisplay === 'success' ? 
                            <p className="text-2xl font-bold text-green-500 flex items-center justify-center"><CheckCircle2 className="mr-2 h-8 w-8"/> 任务成功!</p> :
                            <p className="text-2xl font-bold text-destructive flex items-center justify-center"><XCircle className="mr-2 h-8 w-8"/> 任务失败!</p>
                        }
                        <p className="text-muted-foreground">破坏牌数量: {room.failCardsPlayedForDisplay}</p>
                        <Button onClick={handleProceedToNextRoundOrGameOver} className="mt-2">继续</Button>
                    </div>
                )}
              </>)}
            {room.status === GameRoomStatus.Finished && (
              <div className="text-center p-6 bg-green-100 dark:bg-green-900 rounded-lg shadow">
                <h3 className="text-2xl font-bold text-green-700 dark:text-green-300">游戏结束!</h3>
                 {room.teamScores && (<p className="text-lg mt-2">
                        {room.teamScores.teamMemberWins > room.teamScores.undercoverWins ? <span className="text-green-600">队员阵营胜利!</span> 
                            : room.teamScores.undercoverWins > room.teamScores.teamMemberWins ? <span className="text-destructive">卧底阵营胜利!</span> 
                                : <span className="text-foreground">平局!</span>}
                    </p>)}
                <div className="flex items-center gap-4 justify-center mt-2">
                  <span className="flex items-center"><ShieldCheck className="mr-1 h-4 w-4 text-green-500" /> 队员胜场: {room.teamScores?.teamMemberWins || 0}</span>
                  <span className="flex items-center"><ShieldX className="mr-1 h-4 w-4 text-destructive" /> 卧底胜场: {room.teamScores?.undercoverWins || 0}</span>
                </div>
                <p className="text-muted-foreground mt-2">感谢您的参与！</p>
                 <Button variant="outline" onClick={() => router.push('/')} className="w-full mt-4">返回大厅</Button>
              </div>)}
            {room.status === GameRoomStatus.Waiting && (
              <Button variant="outline" onClick={() => router.push('/')} className="w-full mt-4">返回大厅</Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

