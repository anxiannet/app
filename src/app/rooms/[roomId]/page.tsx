
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { type GameRoom, type Player, Role, GameRoomStatus, type GameRoomPhase, type Mission, type PlayerVote, type MissionCardPlay, type MissionOutcome, type VoteHistoryEntry } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Crown, Users, Play, Info, Swords, Shield, HelpCircle, UserPlus, Eye, UsersRound, ListChecks, Vote, ShieldCheck, ShieldX, ThumbsUp, ThumbsDown, CheckCircle2, XCircle, Zap, Target, History, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// New Component Imports
import { RoomHeader } from "@/components/game-room/RoomHeader";
import { PlayerListPanel } from "@/components/game-room/PlayerListPanel";
import { RoleAlerts } from "@/components/game-room/RoleAlerts";
import { WaitingPhaseActions } from "@/components/game-room/WaitingPhaseActions";
import { TeamSelectionControls } from "@/components/game-room/TeamSelectionControls";
import { TeamVotingControls } from "@/components/game-room/TeamVotingControls";
import { MissionExecutionDisplay } from "@/components/game-room/MissionExecutionDisplay";
import { MissionRevealDisplay } from "@/components/game-room/MissionRevealDisplay";
import { CoachAssassinationControls } from "@/components/game-room/CoachAssassinationControls";
import { GameOverSummary } from "@/components/game-room/GameOverSummary";
import { VoteHistoryAccordion } from "@/components/game-room/VoteHistoryAccordion";


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
  7: [2, 3, 3, 4, 4], 
  8: [3, 4, 4, 5, 5], 
  9: [3, 4, 4, 5, 5], 
  10: [3, 4, 4, 5, 5], 
};

const MIN_PLAYERS_TO_START = 5;
const TOTAL_ROUNDS_PER_GAME = 5;
const MAX_CAPTAIN_CHANGES_PER_ROUND = 5;

const HONOR_OF_KINGS_HERO_NAMES = [
  "亚瑟", "安琪拉", "白起", "不知火舞", "妲己", "狄仁杰", "典韦", "貂蝉", "东皇太一", "盾山",
  "伽罗", "关羽", "后羿", "花木兰", "黄忠", "铠", "兰陵王", "老夫子", "廉颇", "刘邦",
  "刘备", "刘禅", "鲁班七号", "吕布", "马可波罗", "芈月", "米莱狄", "明世隐", "墨子", "哪吒",
  "娜可露露", "盘古", "裴擒虎", "公孙离", "上官婉儿", "沈梦溪", "孙膑", "孙尚香", "孙悟空", "王昭君",
  "夏侯惇", "项羽", "小乔", "杨戬", "杨玉环", "瑶", "弈星", "虞姬", "元歌", "云中君",
  "张飞", "张良", "赵云", "甄姬", "钟馗", "钟无艳", "周瑜", "庄周", "诸葛亮", "阿轲"
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
  const [selectedCoachCandidate, setSelectedCoachCandidate] = useState<string | null>(null);


  const updateLocalStorageRooms = useCallback((updatedRoom: GameRoom | null) => {
    if (typeof window === "undefined" || !updatedRoom) return;
    const storedRoomsRaw = localStorage.getItem("anxian-rooms");
    if (storedRoomsRaw) {
      try {
        const storedRooms: GameRoom[] = JSON.parse(storedRoomsRaw);
        const roomIndex = storedRooms.findIndex(r => r.id === updatedRoom.id);
        if (roomIndex !== -1) {
          storedRooms[roomIndex] = updatedRoom;
          localStorage.setItem("anxian-rooms", JSON.stringify(storedRooms));
        } else {
          // If room not found, add it (e.g. if it's a new room not yet in localStorage from lobby)
          // This case might be less common here, more relevant when creating rooms
          localStorage.setItem("anxian-rooms", JSON.stringify([...storedRooms, updatedRoom]));
        }
      } catch (e) {
        console.error("Failed to update localStorage rooms:", e);
      }
    } else {
        // If no rooms data exists, create it with the current room
        localStorage.setItem("anxian-rooms", JSON.stringify([updatedRoom]));
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
      try {
        const storedRooms: GameRoom[] = JSON.parse(storedRoomsRaw);
        let currentRoom = storedRooms.find(r => r.id === roomId);

        if (currentRoom) {
          let playerExists = currentRoom.players.some(p => p.id === user.id);
          
          if (!playerExists && currentRoom.status === GameRoomStatus.Waiting && currentRoom.players.length < currentRoom.maxPlayers) {
            const newPlayer: Player = { ...user, isCaptain: false };
            currentRoom.players.push(newPlayer);
            const roomIndex = storedRooms.findIndex(r => r.id === currentRoom!.id);
            if (roomIndex !== -1) {
                storedRooms[roomIndex] = currentRoom;
            } else { // Should ideally not happen if currentRoom was found
                storedRooms.push(currentRoom);
            }
            if (typeof window !== "undefined") {
              localStorage.setItem("anxian-rooms", JSON.stringify(storedRooms));
            }
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
          
          const validatedRoom: GameRoom = {
            ...currentRoom,
            players: currentRoom.players || [],
            teamVotes: currentRoom.teamVotes || [],
            missionCardPlaysForCurrentMission: currentRoom.missionCardPlaysForCurrentMission || [],
            missionHistory: currentRoom.missionHistory || [],
            fullVoteHistory: currentRoom.fullVoteHistory || [],
            teamScores: currentRoom.teamScores || { teamMemberWins: 0, undercoverWins: 0 },
            missionPlayerCounts: currentRoom.missionPlayerCounts || MISSIONS_CONFIG[currentRoom.players.length] || MISSIONS_CONFIG[5],
            totalRounds: currentRoom.totalRounds || TOTAL_ROUNDS_PER_GAME,
            maxCaptainChangesPerRound: currentRoom.maxCaptainChangesPerRound || MAX_CAPTAIN_CHANGES_PER_ROUND,
          };

          setRoom(validatedRoom);
          setLocalPlayers(validatedRoom.players);
          if (validatedRoom.selectedTeamForMission) {
              setSelectedMissionTeam(validatedRoom.selectedTeamForMission);
          }
        } else {
          toast({ title: "Room not found", description: "The requested game room does not exist.", variant: "destructive" });
          router.push("/");
        }
      } catch (e) {
          console.error("Failed to parse rooms from localStorage on room page:", e);
          toast({ title: "Error", description: "Could not load room data due to parsing error.", variant: "destructive" });
          router.push("/");
      }
    } else {
      toast({ title: "Error", description: "Could not load room data.", variant: "destructive" });
      router.push("/");
    }
    setIsLoading(false);
  }, [roomId, user, authLoading, router, toast]);

  useEffect(() => {
    if (room) { 
        updateLocalStorageRooms(room);
    }
  }, [room, updateLocalStorageRooms]);

  const finalizeAndRevealMissionOutcome = useCallback(() => {
    if (!room || !room.selectedTeamForMission || !localPlayers || !room.teamScores || room.currentRound === undefined) return;

    let finalPlays: MissionCardPlay[] = [...(room.missionCardPlaysForCurrentMission || [])];

    room.selectedTeamForMission.forEach(playerId => {
      const player = localPlayers.find(p => p.id === playerId);
      if (player && player.id.startsWith("virtual_") && !finalPlays.some(fp => fp.playerId === playerId)) {
        const cardToPlay: 'success' | 'fail' = player.role === Role.Undercover ? 'fail' : 'success';
        finalPlays.push({ playerId: player.id, card: cardToPlay });
      }
    });

    const failCardsPlayed = finalPlays.filter(p => p.card === 'fail').length;
    let missionSuccessful: boolean;

    if (localPlayers.length >= 7 && room.currentRound === 4) { 
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
      teamPlayerIds: [...room.selectedTeamForMission],
      outcome: outcome,
      failCardsPlayed: failCardsPlayed,
      cardPlays: [...finalPlays],
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
        missionCardPlaysForCurrentMission: finalPlays, 
      };
    });
    toast({ title: `第 ${room.currentRound} 轮比赛结束`, description: `结果: ${outcome === 'success' ? '成功' : '失败'} (${failCardsPlayed} 张破坏牌)`});

  }, [room, localPlayers, toast]); 

  useEffect(() => {
    if (!room || room.status !== GameRoomStatus.InProgress || room.currentPhase !== 'mission_execution' || !user) {
      return;
    }

    const missionTeamPlayerIds = room.selectedTeamForMission || [];
    const humanPlayersOnMission = missionTeamPlayerIds.filter(playerId => {
      const player = localPlayers.find(p => p.id === playerId);
      return player && !player.id.startsWith("virtual_");
    });

    if (humanPlayersOnMission.length === 0 && missionTeamPlayerIds.length > 0) { 
      const timer = setTimeout(() => finalizeAndRevealMissionOutcome(), 1000); 
      return () => clearTimeout(timer);
    }
    
    const humanActionsRecorded = room.missionCardPlaysForCurrentMission?.filter(play => humanPlayersOnMission.includes(play.playerId)).length || 0;

    if (humanActionsRecorded === humanPlayersOnMission.length && humanPlayersOnMission.length > 0) {
      finalizeAndRevealMissionOutcome();
    }
  }, [room, localPlayers, user, finalizeAndRevealMissionOutcome]);


  useEffect(() => {
    if (!room || !user || room.status !== GameRoomStatus.InProgress || room.currentPhase !== 'team_selection' || !localPlayers.length) {
      return;
    }
    const currentCaptain = localPlayers.find(p => p.id === room.currentCaptainId);
    if (currentCaptain && currentCaptain.id.startsWith("virtual_")) {
      const performVirtualCaptainTeamProposal = () => {
        if (!room.currentRound || !room.missionPlayerCounts || !localPlayers.length) return;

        const requiredPlayers = room.missionPlayerCounts[room.currentRound -1];
        let proposedTeamIds: string[] = []; 
        
        if (requiredPlayers > 0 && localPlayers.length > 0) { // Ensure localPlayers is not empty
            // Try to include the captain first
            if (localPlayers.some(p => p.id === currentCaptain.id)) { // check if captain is in localPlayers
                 proposedTeamIds.push(currentCaptain.id);
            }
        }

        const otherPlayers = localPlayers.filter(p => p.id !== currentCaptain.id);
        
        const shuffledOtherPlayers = [...otherPlayers].sort(() => 0.5 - Math.random()); 
        for (let i = 0; proposedTeamIds.length < requiredPlayers && i < shuffledOtherPlayers.length; i++) {
            proposedTeamIds.push(shuffledOtherPlayers[i].id);
        }
        
        // If not enough players still, fill with any available players (should not happen if logic is correct)
        if (proposedTeamIds.length < requiredPlayers) {
            const allPlayerIds = localPlayers.map(p => p.id);
            const remainingNeeded = requiredPlayers - proposedTeamIds.length;
            const availableToPick = allPlayerIds.filter(id => !proposedTeamIds.includes(id));
            const shuffledAvailable = availableToPick.sort(() => 0.5 - Math.random());
            proposedTeamIds.push(...shuffledAvailable.slice(0, remainingNeeded));
        }
        // Ensure exactly the required number of players, trimming if somehow over-selected
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
        coachCandidateId: undefined,
        fullVoteHistory: [], 
      };
      setLocalPlayers(updatedPlayers); 
      setSelectedMissionTeam([]);
      setHumanUndercoverCardChoice(null);
      setSelectedCoachCandidate(null);
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
    const availableNames = HONOR_OF_KINGS_HERO_NAMES.filter(name => !existingVirtualPlayerNames.includes(name));
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
      toast({ title: "队伍人数无效", description: `此比赛请选择 ${requiredPlayers} 名玩家。`, variant: "destructive" }); return;
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

  const processTeamVotes = useCallback((currentVotes: PlayerVote[]) => {
    if (!room || !user || !localPlayers.length || !room.teamScores || room.currentRound === undefined || room.currentCaptainId === undefined) return;

    const approveVotes = currentVotes.filter(v => v.vote === 'approve').length;
    const rejectVotes = currentVotes.filter(v => v.vote === 'reject').length;
    const voteOutcome: 'approved' | 'rejected' = approveVotes > rejectVotes ? 'approved' : 'rejected';

    const newVoteLogEntry: VoteHistoryEntry = {
        round: room.currentRound,
        captainId: room.currentCaptainId,
        attemptNumberInRound: (room.captainChangesThisRound || 0) + 1,
        proposedTeamIds: [...(room.selectedTeamForMission || [])],
        votes: [...currentVotes], 
        outcome: voteOutcome,
    };
    const updatedFullVoteHistory = [...(room.fullVoteHistory || []), newVoteLogEntry];

    if (voteOutcome === 'approved') {
      toast({ title: "队伍已批准!", description: "进入比赛执行阶段。" });
      setRoom(prevRoom => {
        if (!prevRoom) return null;
        return {
          ...prevRoom, currentPhase: 'mission_execution', teamVotes: currentVotes, 
          captainChangesThisRound: 0, 
          missionCardPlaysForCurrentMission: [], 
          humanUndercoverCardChoice: null, 
          fullVoteHistory: updatedFullVoteHistory,
        };
      });
      setHumanUndercoverCardChoice(null); 

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
            fullVoteHistory: updatedFullVoteHistory,
          };
        });
      } else {
        const currentCaptainIndex = localPlayers.findIndex(p => p.id === room.currentCaptainId);
        const nextCaptainIndex = (currentCaptainIndex + 1) % localPlayers.length;
        const newCaptainId = localPlayers[nextCaptainIndex].id;
        const newCaptainName = localPlayers[nextCaptainIndex].name;
        toast({ title: "队伍被拒绝!", description: `队长顺位传给 ${newCaptainName}。` });
        setRoom(prevRoom => {
          if (!prevRoom) return null;
          const updatedPlayersData = prevRoom.players.map(p => ({ ...p, isCaptain: p.id === newCaptainId }));
          setLocalPlayers(updatedPlayersData); 
          return {
            ...prevRoom, players: updatedPlayersData, currentCaptainId: newCaptainId,
            captainChangesThisRound: newCaptainChangesThisRound, currentPhase: 'team_selection',
            selectedTeamForMission: [], teamVotes: [], 
            fullVoteHistory: updatedFullVoteHistory,
          };
        });
        setSelectedMissionTeam([]); 
      }
    }
  }, [room, user, localPlayers, toast]); 

 const handlePlayerVote = (vote: 'approve' | 'reject') => {
    if (!room || !user || room.currentPhase !== 'team_voting' || !localPlayers.length) {
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

    const realPlayers = localPlayers.filter(p => !p.id.startsWith("virtual_"));
    const realPlayersWhoVotedIds = new Set(updatedVotes.filter(v => realPlayers.some(rp => rp.id === v.playerId)).map(v => v.playerId));

    if (realPlayersWhoVotedIds.size === realPlayers.length) {
      const virtualPlayers = localPlayers.filter(p => p.id.startsWith("virtual_"));
      const virtualPlayerVotes: PlayerVote[] = virtualPlayers.map(vp => {
        return { playerId: vp.id, vote: 'approve' }; // Simple AI: always approve
      });
      updatedVotes = [...updatedVotes, ...virtualPlayerVotes];
      setRoom(prevRoom => prevRoom ? {...prevRoom, teamVotes: updatedVotes} : null); 
      processTeamVotes(updatedVotes); 
    }
  };

  const handleHumanUndercoverPlayCard = (card: 'success' | 'fail') => {
    if (!room || !user || room.currentPhase !== 'mission_execution' || !currentUserIsUndercoverOnMission) {
      toast({ title: "错误", description: "当前无法打出比赛牌。", variant: "destructive" });
      return;
    }
    const existingPlay = room.missionCardPlaysForCurrentMission?.find(p => p.playerId === user.id);
    if (existingPlay) {
        toast({ title: "已行动", description: "您已在此比赛中行动过。", variant: "destructive" });
        return;
    }
    setHumanUndercoverCardChoice(card); 
    setRoom(prev => {
        if (!prev) return null;
        const newPlay: MissionCardPlay = { playerId: user.id, card };
        return {
            ...prev,
            missionCardPlaysForCurrentMission: [...(prev.missionCardPlaysForCurrentMission || []), newPlay]
        }
    });
     toast({ title: "比赛牌已打出", description: `您打出了【${card === 'success' ? '成功' : '破坏'}】。` });
  };

  const handleProceedToNextRoundOrGameOver = () => {
    if (!room || !room.teamScores || room.currentRound === undefined || room.totalRounds === undefined || !localPlayers.length) return;

    if (room.currentPhase === 'coach_assassination') {
      // Logic handled by handleConfirmCoachAssassination
    }

    if (room.teamScores.teamMemberWins >= 3 && room.teamScores.undercoverWins < 3 && room.currentRound <= room.totalRounds) { 
      const humanUndercovers = localPlayers.filter(p => p.role === Role.Undercover && !p.id.startsWith("virtual_"));
      if (humanUndercovers.length > 0) { 
        setRoom(prev => prev ? { ...prev, currentPhase: 'coach_assassination' } : null);
        toast({ title: "战队方胜利在望!", description: "卧底现在有一次指认教练的机会来反败为胜。" });
        return;
      } else { 
        toast({ title: "战队方获胜!", description: "卧底方无力回天。" });
        setRoom(prev => prev ? { ...prev, status: GameRoomStatus.Finished, currentPhase: 'game_over' } : null);
        return;
      }
    }

    if (room.teamScores.undercoverWins >= 3 || room.currentRound >= room.totalRounds) { 
      setRoom(prev => prev ? { ...prev, status: GameRoomStatus.Finished, currentPhase: 'game_over' } : null);
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
      setSelectedCoachCandidate(null); 
      toast({ title: `第 ${nextRound} 轮开始`, description: `队长是 ${localPlayers.find(p=>p.id === newCaptainId)?.name}` });
    }
  };

  const handleConfirmCoachAssassination = () => {
    if (!room || !user || !selectedCoachCandidate || currentUserRole !== Role.Undercover || room.currentPhase !== 'coach_assassination' || !localPlayers.length) {
        toast({title: "错误", description: "无法确认指认。", variant: "destructive"});
        return;
    }

    const actualCoach = localPlayers.find(p => p.role === Role.Coach);
    if (!actualCoach) {
      toast({ title: "游戏错误", description: "未找到教练角色。", variant: "destructive" });
      setRoom(prev => prev ? { ...prev, status: GameRoomStatus.Finished, currentPhase: 'game_over' } : null);
      return;
    }

    let finalTeamScores = { ...(room.teamScores!) };
    let toastTitle = "";
    let toastDescription = "";

    if (selectedCoachCandidate === actualCoach.id) {
      finalTeamScores.teamMemberWins = Math.min(finalTeamScores.teamMemberWins, (Math.ceil((room.totalRounds || TOTAL_ROUNDS_PER_GAME)/2))-1 ); 
      toastTitle = "指认成功！卧底方反败为胜！";
      toastDescription = `${actualCoach.name} 是教练！`;
    } else {
      toastTitle = "指认失败！战队方获胜！";
      const wronglyAccusedPlayer = localPlayers.find(p => p.id === selectedCoachCandidate);
      toastDescription = `${wronglyAccusedPlayer?.name || '被指认者'} 不是教练。`;
    }

    setRoom(prev => {
      if (!prev) return null;
      return {
        ...prev,
        status: GameRoomStatus.Finished,
        currentPhase: 'game_over',
        teamScores: finalTeamScores,
        coachCandidateId: selectedCoachCandidate, 
      };
    });
    toast({ title: toastTitle, description: toastDescription, duration: 5000 });
    setSelectedCoachCandidate(null); 
  };
  
  const handleReturnToLobbyAndLeaveRoom = useCallback(() => {
    if (!room || !user) {
      router.push("/");
      return;
    }

    const roomNameForToast = room.name;
    const isPlayerInRoom = room.players.some(p => p.id === user.id);
    const isUserHost = room.hostId === user.id;

    if (isPlayerInRoom && !isUserHost) {
      const updatedPlayersList = room.players.filter(p => p.id !== user.id);
      
      setRoom(prevRoom => {
        if (!prevRoom) return null;
        return { ...prevRoom, players: updatedPlayersList };
      });
      setLocalPlayers(updatedPlayersList); 

      toast({ title: "已离开房间", description: `您已离开房间 ${roomNameForToast}。` });
    }
    
    router.push("/");
  }, [room, user, router, toast, setRoom, setLocalPlayers]);

  const handleRestartGame = () => {
    if (!room || !user || room.hostId !== user.id) {
      toast({ title: "错误", description: "只有主持人可以重置游戏。", variant: "destructive" });
      return;
    }
    if (room.status !== GameRoomStatus.Finished) {
      toast({ title: "错误", description: "游戏尚未结束，无法重置。", variant: "destructive" });
      return;
    }

    setRoom(prevRoom => {
      if (!prevRoom) return null;
      const currentPlayersWithResetRoles = prevRoom.players.map(p => ({...p, role: undefined, isCaptain: false }));
      setLocalPlayers(currentPlayersWithResetRoles);

      return {
        ...prevRoom,
        players: currentPlayersWithResetRoles,
        status: GameRoomStatus.Waiting,
        currentCaptainId: undefined,
        currentRound: undefined,
        captainChangesThisRound: undefined,
        currentPhase: undefined, 
        selectedTeamForMission: [],
        teamVotes: [],
        missionCardPlaysForCurrentMission: [],
        missionOutcomeForDisplay: undefined,
        failCardsPlayedForDisplay: undefined,
        teamScores: { teamMemberWins: 0, undercoverWins: 0 },
        missionHistory: [],
        fullVoteHistory: [],
        coachCandidateId: undefined,
      };
    });
    setSelectedMissionTeam([]);
    setHumanUndercoverCardChoice(null);
    setSelectedCoachCandidate(null);

    toast({ title: "游戏已重置", description: "房间已重置为等待状态。主持人可以开始新游戏。" });
  };

  const getRoleIcon = (role?: Role) => {
    switch (role) {
      case Role.Undercover: return <Swords className="h-4 w-4 text-destructive" />;
      case Role.TeamMember: return <Shield className="h-4 w-4 text-green-500" />;
      case Role.Coach: return <HelpCircle className="h-4 w-4 text-yellow-500" />;
      default: return null;
    }
  };
  
  const getPhaseDescription = (phase?: GameRoomPhase) => {
    switch(phase) {
        case 'team_selection': return "队伍组建阶段";
        case 'team_voting': return "队伍投票阶段";
        case 'mission_execution': return "比赛执行阶段";
        case 'mission_reveal': return "比赛结果揭晓";
        case 'coach_assassination': return "卧底指认教练阶段";
        case 'game_over': return "游戏结束";
        default: return "未知阶段";
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
  const requiredPlayersForCurrentMission = room.missionPlayerCounts && room.currentRound !== undefined && room.missionPlayerCounts.length > room.currentRound -1  ? room.missionPlayerCounts[room.currentRound -1] : 0;
  const isHost = user.id === room.hostId;
  const canAddVirtualPlayer = isHost && room.status === GameRoomStatus.Waiting && localPlayers.length < room.maxPlayers;
  const canStartGame = isHost && room.status === GameRoomStatus.Waiting && localPlayers.length >= MIN_PLAYERS_TO_START && localPlayers.length <= room.maxPlayers;

  const knownUndercoversByCoach = currentUserRole === Role.Coach && room.status === GameRoomStatus.InProgress ? localPlayers.filter(p => p.role === Role.Undercover) : [];
  const fellowUndercovers = currentUserRole === Role.Undercover && room.status === GameRoomStatus.InProgress ? localPlayers.filter(p => p.role === Role.Undercover && p.id !== user.id) : [];
  const isSoleUndercover = currentUserRole === Role.Undercover && room.status === GameRoomStatus.InProgress && localPlayers.filter(p => p.role === Role.Undercover).length === 1;
  
  const realPlayersCount = localPlayers.filter(p => !p.id.startsWith("virtual_")).length;
  const realPlayersVotedCount = room.teamVotes?.filter(v => localPlayers.find(p => p.id === v.playerId && !p.id.startsWith("virtual_"))).length || 0;
  const votesToDisplay = room.teamVotes || []; 
  const missionPlaysToDisplay = room.missionCardPlaysForCurrentMission || []; 
  const assassinationTargetOptions = localPlayers.filter(p => {
    if (currentUserRole !== Role.Undercover) return false; 
    if (p.id === user.id) return false; 
    if (fellowUndercovers.some(fu => fu.id === p.id)) return false;
    return true;
  });

  let gameOverMessage;
  if (room.status === GameRoomStatus.Finished) {
    const actualCoachWasIdentified = room.coachCandidateId && localPlayers.find(p => p.id === room.coachCandidateId && p.role === Role.Coach);
    const coachIdentificationAttempted = !!room.coachCandidateId;
    const teamMemberMissionWins = room.teamScores?.teamMemberWins || 0;
    const undercoverMissionWins = room.teamScores?.undercoverWins || 0;

    if (actualCoachWasIdentified) {
      gameOverMessage = <span className="text-destructive">卧底阵营胜利! (通过指认教练)</span>;
    } else if (undercoverMissionWins >= 3 && undercoverMissionWins > teamMemberMissionWins) { 
        gameOverMessage = <span className="text-destructive">卧底阵营胜利!</span>;
    } else if (teamMemberMissionWins >=3 && (!coachIdentificationAttempted || (coachIdentificationAttempted && !actualCoachWasIdentified))) {
        gameOverMessage = <span className="text-green-600">战队阵营胜利!</span>; 
        if (coachIdentificationAttempted && !actualCoachWasIdentified) { 
            gameOverMessage = <span className="text-green-600">战队阵营胜利! (指认失败)</span>;
        }
    }
     else { 
      if (undercoverMissionWins > teamMemberMissionWins) {
        gameOverMessage = <span className="text-destructive">卧底阵营胜利! (比赛结束)</span>;
      } else if (teamMemberMissionWins > undercoverMissionWins) {
        gameOverMessage = <span className="text-green-600">战队阵营胜利! (比赛结束)</span>;
      } else { 
        gameOverMessage = <span className="text-foreground">游戏结束! (比分 {teamMemberMissionWins} : {undercoverMissionWins})</span>;
      }
    }
  }

  return (
    <div className="space-y-6">
      <RoomHeader room={room} localPlayers={localPlayers} getPhaseDescription={getPhaseDescription} />
      
      <RoleAlerts 
        currentUserRole={currentUserRole} 
        roomStatus={room.status}
        knownUndercoversByCoach={knownUndercoversByCoach}
        fellowUndercovers={fellowUndercovers}
        isSoleUndercover={isSoleUndercover}
      />

      <div className="grid md:grid-cols-3 gap-6">
        <PlayerListPanel 
            localPlayers={localPlayers}
            user={user}
            room={room}
            currentUserRole={currentUserRole}
            votesToDisplay={votesToDisplay}
            missionPlaysToDisplay={missionPlaysToDisplay}
            getRoleIcon={getRoleIcon}
            fellowUndercovers={fellowUndercovers}
            knownUndercoversByCoach={knownUndercoversByCoach}
        />

        <Card className="md:col-span-2">
          <CardHeader><CardTitle className="text-primary">游戏控制 / 状态</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {room.status === GameRoomStatus.Waiting && (
                <WaitingPhaseActions
                    isHost={isHost}
                    canStartGame={canStartGame}
                    localPlayersLength={localPlayers.length}
                    minPlayersToStart={MIN_PLAYERS_TO_START}
                    maxPlayers={room.maxPlayers}
                    onStartGame={handleStartGame}
                    canAddVirtualPlayer={canAddVirtualPlayer}
                    onAddVirtualPlayer={handleAddVirtualPlayer}
                    onReturnToLobby={handleReturnToLobbyAndLeaveRoom}
                />
            )}
            
            {room.status === GameRoomStatus.InProgress && (
              <>
                <div className="text-center p-4 bg-secondary/30 rounded-md">
                  {room.currentRound !== undefined && room.captainChangesThisRound !== undefined && (
                     <p className="text-md font-semibold">第 {room.currentRound} 场比赛，第 {room.captainChangesThisRound + 1} 次组队</p>
                  )}
                  <p className="text-lg ">当前队长:</p><p className="text-2xl text-accent">{localPlayers.find(p => p.id === room.currentCaptainId)?.name || "Unknown"}</p>
                </div>

                {room.currentPhase === 'team_selection' && (
                    <TeamSelectionControls
                        isVirtualCaptain={isVirtualCaptain}
                        currentCaptainName={localPlayers.find(p => p.id === room.currentCaptainId)?.name}
                        isHumanCaptain={isHumanCaptain}
                        requiredPlayersForCurrentMission={requiredPlayersForCurrentMission}
                        localPlayers={localPlayers}
                        selectedMissionTeam={selectedMissionTeam}
                        onPlayerSelectionForMission={handlePlayerSelectionForMission}
                        onHumanProposeTeam={handleHumanProposeTeam}
                    />
                )}

                {room.currentPhase === 'team_voting' && (
                    <TeamVotingControls
                        currentRound={room.currentRound}
                        captainChangesThisRound={room.captainChangesThisRound}
                        currentCaptainName={localPlayers.find(p=>p.id === room.currentCaptainId)?.name}
                        proposedTeamNames={(room.selectedTeamForMission || []).map(playerId => localPlayers.find(p=>p.id === playerId)?.name || '未知玩家')}
                        votesToDisplay={votesToDisplay}
                        realPlayersVotedCount={realPlayersVotedCount}
                        realPlayersCount={realPlayersCount}
                        hasUserVotedOnCurrentTeam={hasUserVotedOnCurrentTeam}
                        isCurrentUserVirtual={user.id.startsWith("virtual_")}
                        onPlayerVote={handlePlayerVote}
                        userVote={room.teamVotes?.find(v=>v.playerId === user.id)?.vote}
                    />
                )}

                {room.currentPhase === 'mission_execution' && (
                    <MissionExecutionDisplay
                        currentRound={room.currentRound}
                        missionTeamPlayerNames={missionTeamPlayerObjects.map(p => p.name)}
                        currentUserIsOnMission={currentUserIsOnMission}
                        currentUserRole={currentUserRole}
                        currentUserHasPlayedMissionCard={currentUserHasPlayedMissionCard}
                        humanUndercoverCardChoice={humanUndercoverCardChoice}
                        onHumanUndercoverPlayCard={handleHumanUndercoverPlayCard}
                    />
                )}

                {room.currentPhase === 'mission_reveal' && (
                     <MissionRevealDisplay
                        currentRound={room.currentRound}
                        missionOutcomeForDisplay={room.missionOutcomeForDisplay}
                        failCardsPlayedForDisplay={room.failCardsPlayedForDisplay}
                        onProceedToNextRoundOrGameOver={handleProceedToNextRoundOrGameOver}
                     />
                )}

                {room.currentPhase === 'coach_assassination' && (
                    <CoachAssassinationControls
                        currentUserRole={currentUserRole}
                        selectedCoachCandidate={selectedCoachCandidate}
                        onSetSelectedCoachCandidate={setSelectedCoachCandidate}
                        assassinationTargetOptions={assassinationTargetOptions}
                        onConfirmCoachAssassination={handleConfirmCoachAssassination}
                    />
                )}
              </>
            )}

            {room.status === GameRoomStatus.Finished && (
                <GameOverSummary 
                    room={room}
                    localPlayers={localPlayers}
                    gameOverMessage={gameOverMessage}
                    onReturnToLobby={handleReturnToLobbyAndLeaveRoom}
                    isHost={isHost}
                    onRestartGame={handleRestartGame}
                />
            )}
            
            <VoteHistoryAccordion 
                room={room}
                localPlayers={localPlayers}
                getRoleIcon={getRoleIcon}
                totalRounds={TOTAL_ROUNDS_PER_GAME}
            />

          </CardContent>
        </Card>
      </div>
    </div>
  );
}

