
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from 'next/dynamic';
import { useAuth } from "@/contexts/auth-context";
import {
  type GameRoom,
  type Player,
  Role,
  GameRoomStatus,
  type GameRoomPhase,
  type Mission,
  type PlayerVote,
  type MissionCardPlay,
  type MissionOutcome,
  type VoteHistoryEntry,
  type PlayerGameRecord,
  type WinningFactionType,
  type GeneratedFailureReason,
  RoomMode
} from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent } from "@/components/ui/card";

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
import { ManualRoleRevealControls } from "@/components/game-room/ManualRoleRevealControls";
import { Swords, Shield, HelpCircle } from "lucide-react";

import {
  ROLES_CONFIG,
  MISSIONS_CONFIG,
  MIN_PLAYERS_TO_START,
  TOTAL_ROUNDS_PER_GAME,
  MAX_CAPTAIN_CHANGES_PER_ROUND,
  HONOR_OF_KINGS_HERO_NAMES,
  FAILURE_REASONS_LIST_FOR_FALLBACK,
  PRE_GENERATED_AVATARS
} from '@/lib/game-config';


const VoteHistoryAccordion = dynamic(() => import('@/components/game-room/VoteHistoryAccordion').then(mod => mod.VoteHistoryAccordion), {
  loading: () => <p>正在加载投票记录...</p>,
  ssr: false
});

const ROOMS_LOCAL_STORAGE_KEY = "anxian-rooms";

export default function GameRoomPage() {
  const params = useParams();
  const router = useRouter();
  const { roomId: rawRoomId } = params;
  const roomId = Array.isArray(rawRoomId) ? rawRoomId[0] : rawRoomId;

  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [room, setRoom] = useState<GameRoom | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedMissionTeam, setSelectedMissionTeam] = useState<string[]>([]);
  const [humanUndercoverCardChoice, setHumanUndercoverCardChoice] = useState<'success' | 'fail' | null>(null);
  const [selectedCoachCandidate, setSelectedCoachCandidate] = useState<string | null>(null);
  const [showTerminateConfirmDialog, setShowTerminateConfirmDialog] = useState(false);

  // State for manual role reveal
  const [manualRoleRevealIndex, setManualRoleRevealIndex] = useState<number | null>(null);
  const [isManualRoleVisible, setIsManualRoleVisible] = useState<boolean>(false);
  const [manualRoleRevealCompleted, setManualRoleRevealCompleted] = useState<boolean>(false);


  useEffect(() => {
    if (authLoading || !user || typeof roomId !== 'string') {
      if (!authLoading && !user && typeof roomId === 'string' && roomId) {
        router.push(`/login?redirect=/rooms/${roomId}`);
      }
      if (!roomId && !authLoading) setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const storedRoomsRaw = localStorage.getItem(ROOMS_LOCAL_STORAGE_KEY);
      const allRooms: GameRoom[] = storedRoomsRaw ? JSON.parse(storedRoomsRaw) : [];
      let currentRoomData = allRooms.find(r => r.id === roomId);

      if (currentRoomData) {
        if (!currentRoomData.mode) {
            currentRoomData.mode = RoomMode.Online;
        }

        const playerExists = currentRoomData.players.some(p => p.id === user.id);
        if (!playerExists && currentRoomData.status === GameRoomStatus.Waiting && currentRoomData.players.length < currentRoomData.maxPlayers) {
          const newPlayer: Player = { id: user.id, name: user.name };
          if (user.avatarUrl) newPlayer.avatarUrl = user.avatarUrl;
          currentRoomData.players.push(newPlayer);
          localStorage.setItem(ROOMS_LOCAL_STORAGE_KEY, JSON.stringify(allRooms));
        } else if (!playerExists && currentRoomData.status !== GameRoomStatus.Waiting) {
          toast({ title: "游戏已开始或结束", description: "无法加入已开始或结束的游戏。", variant: "destructive" });
          router.push("/");
          return;
        } else if (!playerExists && currentRoomData.players.length >= currentRoomData.maxPlayers) {
           toast({ title: "房间已满", description: "此房间已满。", variant: "destructive" });
           router.push("/");
           return;
        }
        setRoom(currentRoomData);
        // Initialize manual role reveal state if game just started in manual mode
        if (currentRoomData.status === GameRoomStatus.InProgress &&
            currentRoomData.mode === RoomMode.ManualInput &&
            currentRoomData.players.every(p => p.role) && // Ensure roles are assigned
            manualRoleRevealIndex === null && !manualRoleRevealCompleted) {
          setManualRoleRevealIndex(0);
          setIsManualRoleVisible(false);
        }

      } else {
        toast({ title: "房间未找到", description: "请求的房间不存在。", variant: "destructive" });
        router.push("/");
      }
    } catch (e) {
      console.error("Error loading room from localStorage:", e);
      toast({ title: "加载房间失败", variant: "destructive" });
      router.push("/");
    }
    setIsLoading(false);
  }, [roomId, user, authLoading, router, toast, manualRoleRevealIndex, manualRoleRevealCompleted]);

  const updateLocalStorageRoom = useCallback((updatedRoomData: GameRoom | null) => {
    if (!updatedRoomData) return;
    try {
      const storedRoomsRaw = localStorage.getItem(ROOMS_LOCAL_STORAGE_KEY);
      let allRooms: GameRoom[] = storedRoomsRaw ? JSON.parse(storedRoomsRaw) : [];
      const roomIndex = allRooms.findIndex(r => r.id === updatedRoomData.id);
      if (roomIndex !== -1) {
        allRooms[roomIndex] = updatedRoomData;
      } else {
        allRooms.push(updatedRoomData);
      }
      localStorage.setItem(ROOMS_LOCAL_STORAGE_KEY, JSON.stringify(allRooms));
    } catch (e) {
      console.error("Error saving room to localStorage:", e);
    }
  }, []);

  useEffect(() => {
    if (room) {
      updateLocalStorageRoom(room);
    }
  }, [room, updateLocalStorageRoom]);

  useEffect(() => {
    if (room?.selectedTeamForMission) {
      setSelectedMissionTeam(room.selectedTeamForMission);
    } else {
      setSelectedMissionTeam([]);
    }
  }, [room?.selectedTeamForMission]);

  const saveGameRecordForAllPlayers = useCallback((finalRoomState: GameRoom) => {
    if (typeof window === "undefined" || finalRoomState.status !== GameRoomStatus.Finished || !finalRoomState.currentGameInstanceId) return;
    const allPlayersInGame = finalRoomState.players;
    let winningFaction: WinningFactionType = null;
    let gameSummaryMessage = "游戏结束!";

    const actualCoach = allPlayersInGame.find(p => p.role === Role.Coach);
    const teamMemberMissionWins = finalRoomState.teamScores?.teamMemberWins || 0;
    const undercoverMissionWins = finalRoomState.teamScores?.undercoverWins || 0;

    if (finalRoomState.coachCandidateId && actualCoach) {
      if (finalRoomState.coachCandidateId === actualCoach.id) {
        winningFaction = Role.Undercover;
        gameSummaryMessage = `卧底阵营胜利! (通过指认教练)`;
      } else {
        winningFaction = Role.TeamMember;
        gameSummaryMessage = `指认失败，战队方获胜`;
      }
    } else if (undercoverMissionWins >= 3 && undercoverMissionWins > teamMemberMissionWins) {
      winningFaction = Role.Undercover;
      gameSummaryMessage = "卧底阵营胜利! (通过完成比赛)";
    } else if (teamMemberMissionWins >= 3 && teamMemberMissionWins > undercoverMissionWins) {
      winningFaction = Role.TeamMember;
      gameSummaryMessage = `战队阵营胜利! (通过完成比赛)`;
    } else {
      if (finalRoomState.captainChangesThisRound && finalRoomState.maxCaptainChangesPerRound && finalRoomState.captainChangesThisRound >= finalRoomState.maxCaptainChangesPerRound) {
        winningFaction = Role.Undercover;
        gameSummaryMessage = "卧底阵营胜利! (由于队伍连续5次组队失败)";
      } else if (finalRoomState.currentRound && finalRoomState.totalRounds && finalRoomState.currentRound > finalRoomState.totalRounds) {
        if (undercoverMissionWins > teamMemberMissionWins) {
          winningFaction = Role.Undercover;
          gameSummaryMessage = "卧底阵营胜利! (比赛结束时胜场较多)";
        } else if (teamMemberMissionWins > undercoverMissionWins) {
          winningFaction = Role.TeamMember;
          gameSummaryMessage = `战队阵营胜利! (比赛结束时胜场较多)`;
        } else {
          winningFaction = 'Draw';
          gameSummaryMessage = "游戏平局!";
        }
      } else {
        winningFaction = 'Draw';
        gameSummaryMessage = "游戏平局! (未知原因)";
      }
    }

    allPlayersInGame.forEach(player => {
      if (!player.role) return;

      let playerOutcome: 'win' | 'loss' | 'draw' = 'loss';
      if (winningFaction === 'Draw') {
        playerOutcome = 'draw';
      } else if (winningFaction === Role.TeamMember && (player.role === Role.TeamMember || player.role === Role.Coach)) {
        playerOutcome = 'win';
      } else if (winningFaction === Role.Undercover && player.role === Role.Undercover) {
        playerOutcome = 'win';
      }

      const record: PlayerGameRecord = {
        gameInstanceId: finalRoomState.currentGameInstanceId!,
        roomId: finalRoomState.id,
        roomName: finalRoomState.name,
        playedAt: new Date().toISOString(),
        myRole: player.role,
        gameOutcome: playerOutcome,
        winningFaction: winningFaction,
        gameSummaryMessage: gameSummaryMessage,
        finalScores: { ...(finalRoomState.teamScores || { teamMemberWins: 0, undercoverWins: 0 }) },
        playersInGame: allPlayersInGame.map(p => {
          const playerDetail: { id: string; name: string; role: Role; avatarUrl?: string } = {
            id: p.id,
            name: p.name,
            role: p.role || Role.TeamMember,
          };
          if (p.avatarUrl) playerDetail.avatarUrl = p.avatarUrl;
          return playerDetail;
        }),
        coachAssassinationAttempt: finalRoomState.coachCandidateId && actualCoach ? {
          targetPlayerId: finalRoomState.coachCandidateId,
          targetPlayerName: allPlayersInGame.find(p => p.id === finalRoomState.coachCandidateId)?.name || '未知',
          wasTargetCoach: finalRoomState.coachCandidateId === actualCoach.id,
          assassinationSucceeded: finalRoomState.coachCandidateId === actualCoach.id,
        } : undefined,
        fullVoteHistory: finalRoomState.fullVoteHistory ? [...finalRoomState.fullVoteHistory] : [],
        missionHistory: finalRoomState.missionHistory ? [...finalRoomState.missionHistory] : [],
      };

      try {
        const historyKey = `anxian-history-${player.id}`;
        const existingHistoryRaw = localStorage.getItem(historyKey);
        let playerHistory: PlayerGameRecord[] = [];
        if (existingHistoryRaw) {
          playerHistory = JSON.parse(existingHistoryRaw);
        }
        playerHistory = playerHistory.filter(r => r.gameInstanceId !== record.gameInstanceId);
        playerHistory.unshift(record);
        localStorage.setItem(historyKey, JSON.stringify(playerHistory.slice(0, 50)));
      } catch (e) {
        console.error(`Failed to save game record for player ${player.id}:`, e);
      }
    });
  }, []);

  const finalizeAndRevealMissionOutcome = useCallback(async () => {
    if (!room || !room.selectedTeamForMission || !room.players || !room.teamScores || room.currentRound === undefined) return;
    let finalPlays: MissionCardPlay[] = [...(room.missionCardPlaysForCurrentMission || [])];
    const playersInRoom = room.players;

    if (room.mode === RoomMode.Online) { // Only auto-play for virtual players in Online mode
        room.selectedTeamForMission.forEach(playerId => {
        const player = playersInRoom.find(p => p.id === playerId);
        if (player && player.id.startsWith("virtual_") && !finalPlays.some(fp => fp.playerId === playerId)) {
            const cardToPlay: 'success' | 'fail' = player.role === Role.Undercover ? 'fail' : 'success';
            finalPlays.push({ playerId: player.id, card: cardToPlay });
        }
        });
    }

    const failCardsPlayed = finalPlays.filter(p => p.card === 'fail').length;
    let missionSuccessful: boolean;

    if (playersInRoom.length >= 7 && room.currentRound === 4) {
      missionSuccessful = failCardsPlayed < 2;
    } else {
      missionSuccessful = failCardsPlayed < 1;
    }

    const outcome: MissionOutcome = missionSuccessful ? 'success' : 'fail';
    const newTeamScores = { ...room.teamScores };
    if (missionSuccessful) newTeamScores.teamMemberWins++;
    else newTeamScores.undercoverWins++;

    let aiGeneratedFailureReason: GeneratedFailureReason | undefined = undefined;
    if (outcome === 'fail' && failCardsPlayed > 0) {
        try {
            const defaultReasonsCount = Math.min(failCardsPlayed, FAILURE_REASONS_LIST_FOR_FALLBACK.length, 3);
            const defaultReasons = FAILURE_REASONS_LIST_FOR_FALLBACK.slice(0, defaultReasonsCount);
            aiGeneratedFailureReason = {
              selectedReasons: defaultReasons,
              narrativeSummary: `比赛失利，主要原因是：${defaultReasons.join("，")}。`,
            };
        } catch (e) {
            console.error("Error generating fallback failure reason:", e);
             const defaultReasonsCount = Math.min(failCardsPlayed, FAILURE_REASONS_LIST_FOR_FALLBACK.length, 3);
            const defaultReasons = FAILURE_REASONS_LIST_FOR_FALLBACK.slice(0, defaultReasonsCount);
            aiGeneratedFailureReason = {
              selectedReasons: defaultReasons,
              narrativeSummary: `比赛失利，主要原因是：${defaultReasons.join("，")}。`,
            };
        }
    }

    const missionRecordData: Mission = {
      round: room.currentRound,
      captainId: room.currentCaptainId || "unknown_captain",
      teamPlayerIds: [...room.selectedTeamForMission],
      outcome: outcome,
      failCardsPlayed: failCardsPlayed,
      cardPlays: finalPlays,
    };
    if (aiGeneratedFailureReason) {
      missionRecordData.generatedFailureReason = aiGeneratedFailureReason;
    }

    setRoom(prevRoom => prevRoom ? {
        ...prevRoom,
        teamScores: newTeamScores,
        missionHistory: [...(prevRoom.missionHistory || []), missionRecordData],
        currentPhase: 'mission_reveal',
        missionOutcomeForDisplay: outcome,
        failCardsPlayedForDisplay: failCardsPlayed,
        generatedFailureReason: aiGeneratedFailureReason,
    } : null);

    toast({ title: `第 ${room.currentRound} 场比赛结束`, description: `结果: ${outcome === 'success' ? '成功' : '失败'}${outcome === 'fail' && aiGeneratedFailureReason ? ` (${aiGeneratedFailureReason.narrativeSummary})` : ''}` });
  }, [room, toast]);

  useEffect(() => {
    if (!room || room.status !== GameRoomStatus.InProgress || room.currentPhase !== 'mission_execution' || !user) {
      return;
    }
    if (room.mode === RoomMode.ManualInput) { // In Manual mode, host confirms all plays
        return;
    }
    const missionTeamPlayerIds = room.selectedTeamForMission || [];
    const playersInRoom = room.players || [];
    const humanPlayersOnMission = missionTeamPlayerIds.filter(playerId => {
      const player = playersInRoom.find(p => p.id === playerId);
      return player && !player.id.startsWith("virtual_");
    });

    if (humanPlayersOnMission.length === 0 && missionTeamPlayerIds.length > 0) { // All virtual players
      const timer = setTimeout(() => finalizeAndRevealMissionOutcome(), 1000);
      return () => clearTimeout(timer);
    }

    const humanActionsRecorded = room.missionCardPlaysForCurrentMission?.filter(play => humanPlayersOnMission.includes(play.playerId)).length || 0;

    if (humanActionsRecorded === humanPlayersOnMission.length && humanPlayersOnMission.length > 0) {
      finalizeAndRevealMissionOutcome();
    }
  }, [room, user, finalizeAndRevealMissionOutcome]);

  const assignRolesAndCaptain = () => {
    if (!room || !(room.players?.length) || room.players.length < MIN_PLAYERS_TO_START) return;
    const currentPlayers = room.players;
    const playerCount = currentPlayers.length;

    const configKey = Math.max(...Object.keys(ROLES_CONFIG).map(Number).filter(k => k <= playerCount)) || MIN_PLAYERS_TO_START;
    const config = ROLES_CONFIG[configKey] || ROLES_CONFIG[MIN_PLAYERS_TO_START];

    let rolesToAssign: Role[] = [];
    Object.entries(config).forEach(([role, count]) => {
      for (let i = 0; i < count; i++) rolesToAssign.push(role as Role);
    });
    while (rolesToAssign.length < playerCount) rolesToAssign.push(Role.TeamMember);
    rolesToAssign = rolesToAssign.slice(0, playerCount).sort(() => Math.random() - 0.5);

    const updatedPlayers = currentPlayers.map((playerData, index) => {
      const newPlayer: Player = {
        id: playerData.id,
        name: playerData.name,
        role: rolesToAssign[index],
      };
      if (playerData.avatarUrl) newPlayer.avatarUrl = playerData.avatarUrl;
      return newPlayer;
    });

    const firstCaptainIndex = Math.floor(Math.random() * updatedPlayers.length);
    const missionConfigKey = Math.max(...Object.keys(MISSIONS_CONFIG).map(Number).filter(k => k <= playerCount)) || MIN_PLAYERS_TO_START;
    const missionPlayerCounts = MISSIONS_CONFIG[missionConfigKey] || MISSIONS_CONFIG[MIN_PLAYERS_TO_START];
    const newGameInstanceId = `gameinst_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const initialRoomData: Partial<GameRoom> = {
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
      missionCardPlaysForCurrentMission: [],
      teamScores: { teamMemberWins: 0, undercoverWins: 0 },
      missionHistory: [],
      fullVoteHistory: [],
      missionPlayerCounts: missionPlayerCounts,
      currentGameInstanceId: newGameInstanceId,
      missionOutcomeForDisplay: undefined,
      failCardsPlayedForDisplay: undefined,
      coachCandidateId: undefined,
      generatedFailureReason: undefined,
    };

    setRoom(prevRoom => prevRoom ? { ...prevRoom, ...initialRoomData } : null);
    setSelectedMissionTeam([]);
    setHumanUndercoverCardChoice(null);
    setSelectedCoachCandidate(null);

    if (room?.mode === RoomMode.ManualInput) {
      setManualRoleRevealIndex(0);
      setIsManualRoleVisible(false);
      setManualRoleRevealCompleted(false);
    }

    toast({ title: "游戏开始!", description: `角色已分配。第 1 场比赛，队伍组建阶段。 ${updatedPlayers[firstCaptainIndex].name} 是首任队长。` });
  };

  const handleStartGame = () => {
    if (!room || !user || room.hostId !== user.id) {
      toast({ title: "未授权", description: "只有主持人可以开始游戏。", variant: "destructive" }); return;
    }
    if (!room.players || room.players.length < MIN_PLAYERS_TO_START) {
      toast({ title: "玩家数量不足", description: `至少需要 ${MIN_PLAYERS_TO_START} 名玩家才能开始。当前 ${room.players?.length || 0} 名。`, variant: "destructive" }); return;
    }
    if (room.players.length > room.maxPlayers) {
      toast({ title: "玩家数量过多", description: `此房间最大支持 ${room.maxPlayers} 名玩家。当前 ${room.players.length} 名。`, variant: "destructive" }); return;
    }
    assignRolesAndCaptain();
  };

  const handleAddVirtualPlayer = () => {
    if (!room || !user || room.hostId !== user.id || room.status !== GameRoomStatus.Waiting) {
      toast({ title: "未授权", description: "只有主持人在等待阶段可以添加虚拟玩家。", variant: "destructive" }); return;
    }
    const currentPlayers = room.players || [];
    if (currentPlayers.length >= room.maxPlayers) {
      toast({ title: "房间已满", description: "无法添加更多玩家，房间已满。", variant: "destructive" }); return;
    }
    const existingVirtualPlayerNames = currentPlayers.filter(p => p.id.startsWith("virtual_")).map(p => p.name);
    const availableNames = HONOR_OF_KINGS_HERO_NAMES.filter(name => !existingVirtualPlayerNames.includes(name));
    if (availableNames.length === 0) {
      toast({ title: "错误", description: "没有更多可用的虚拟玩家名称。", variant: "destructive" }); return;
    }
    const virtualPlayerName = availableNames[Math.floor(Math.random() * availableNames.length)];
    const virtualPlayerId = `virtual_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

    const newVirtualPlayer: Player = {
      id: virtualPlayerId,
      name: virtualPlayerName,
      avatarUrl: PRE_GENERATED_AVATARS[Math.floor(Math.random() * PRE_GENERATED_AVATARS.length)],
    };

    setRoom(prevRoom => prevRoom ? { ...prevRoom, players: [...(prevRoom.players || []), newVirtualPlayer] } : null);
    toast({ title: "虚拟玩家已添加", description: `${virtualPlayerName} 已加入房间。` });
  };

  const handleHumanProposeTeam = () => {
    if (!room || !user || room.currentPhase !== 'team_selection' || !room.missionPlayerCounts || room.currentRound === undefined) {
      toast({ title: "错误", description: "当前无法提议队伍。", variant: "destructive" }); return;
    }
    // In Online mode, only the captain can propose. In Manual mode, host proposes.
    if (room.mode === RoomMode.Online && room.currentCaptainId !== user.id) {
        toast({ title: "错误", description: "只有当前队长可以提议队伍。", variant: "destructive" }); return;
    }
    if (room.mode === RoomMode.ManualInput && room.hostId !== user.id) {
        toast({ title: "错误", description: "只有主持人可以在手动模式下提议队伍。", variant: "destructive" }); return;
    }

    const requiredPlayers = room.missionPlayerCounts[room.currentRound - 1];
    if (selectedMissionTeam.length !== requiredPlayers) {
      toast({ title: "队伍人数无效", description: `此比赛请选择 ${requiredPlayers} 名玩家。`, variant: "destructive" }); return;
    }

    setRoom(prevRoom => prevRoom ? {
        ...prevRoom,
        selectedTeamForMission: [...selectedMissionTeam],
        currentPhase: 'team_voting',
        teamVotes: [],
    } : null);
  };

  const handlePlayerSelectionForMission = (playerId: string) => {
    if (!room || !user || room.currentPhase !== 'team_selection' || !room.missionPlayerCounts || room.currentRound === undefined) {
      return;
    }
     // In Online mode, only the captain can select. In Manual mode, host selects.
    if (room.mode === RoomMode.Online && room.currentCaptainId !== user.id) return;
    if (room.mode === RoomMode.ManualInput && room.hostId !== user.id) return;


    const requiredPlayers = room.missionPlayerCounts[room.currentRound - 1];
    setSelectedMissionTeam(prevSelected => {
      const isSelected = prevSelected.includes(playerId);
      if (isSelected) {
        return prevSelected.filter(id => id !== playerId);
      } else {
        if (prevSelected.length < requiredPlayers) {
          return [...prevSelected, playerId];
        }
        toast({ title: "人数已达上限", description: `本轮比赛只需要 ${requiredPlayers} 名玩家。`, variant: "default" });
        return prevSelected;
      }
    });
  };

  const processTeamVotes = useCallback((currentVotes: PlayerVote[]) => {
    if (!room || !user || !(room.players?.length) || !room.teamScores || room.currentRound === undefined || room.currentCaptainId === undefined) return;
    const playersInRoom = room.players;
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
      const currentSelectedTeam = room.selectedTeamForMission || [];
      let autoPlays: MissionCardPlay[] = [];

      if (room.mode === RoomMode.Online) { // Auto-plays for human TeamMembers/Coach only in Online mode
        currentSelectedTeam.forEach(playerId => {
          const player = playersInRoom.find(p => p.id === playerId);
          if (player && !player.id.startsWith("virtual_") && (player.role === Role.TeamMember || player.role === Role.Coach)) {
            if (!room.missionCardPlaysForCurrentMission?.some(p => p.playerId === playerId)) {
              autoPlays.push({ playerId: player.id, card: 'success' });
            }
          }
        });
      } // In Manual Mode, all mission card plays are manual.

      setRoom(prevRoom => prevRoom ? {
        ...prevRoom,
        currentPhase: 'mission_execution',
        missionCardPlaysForCurrentMission: autoPlays, // Will be empty in Manual mode
        fullVoteHistory: updatedFullVoteHistory,
        captainChangesThisRound: 0,
        teamVotes: currentVotes, // Keep votes for display
      } : null);
      setHumanUndercoverCardChoice(null);

    } else {
      let newCaptainChangesThisRound = (room.captainChangesThisRound || 0) + 1;
      if (newCaptainChangesThisRound >= (room.maxCaptainChangesPerRound || MAX_CAPTAIN_CHANGES_PER_ROUND)) {
        const finalTeamScores = { ...(room.teamScores || { teamMemberWins: 0, undercoverWins: 0 }), undercoverWins: room.totalRounds || TOTAL_ROUNDS_PER_GAME };

        const finalRoomStateForRecord: GameRoom = {
          ...room,
          status: GameRoomStatus.Finished,
          currentPhase: 'game_over' as GameRoomPhase,
          teamScores: finalTeamScores,
          teamVotes: currentVotes,
          fullVoteHistory: updatedFullVoteHistory,
          captainChangesThisRound: newCaptainChangesThisRound,
        };
        saveGameRecordForAllPlayers(finalRoomStateForRecord);

        toast({ title: "队伍被拒绝5次!", description: "卧底阵营获胜!", variant: "destructive" });
        setRoom(prevRoom => prevRoom ? {
          ...prevRoom,
          status: GameRoomStatus.Finished,
          currentPhase: 'game_over',
          teamScores: finalTeamScores,
          fullVoteHistory: updatedFullVoteHistory,
          captainChangesThisRound: newCaptainChangesThisRound,
          teamVotes: currentVotes, // Keep votes for display
        } : null);
      } else {
        const currentCaptainIndex = playersInRoom.findIndex(p => p.id === room.currentCaptainId);
        const nextCaptainIndex = (currentCaptainIndex + 1) % playersInRoom.length;
        const newCaptainId = playersInRoom[nextCaptainIndex].id;
        setRoom(prevRoom => prevRoom ? {
          ...prevRoom,
          currentCaptainId: newCaptainId,
          captainChangesThisRound: newCaptainChangesThisRound,
          currentPhase: 'team_selection',
          selectedTeamForMission: [], // Clear for new proposal
          teamVotes: [], // Clear for new vote
          fullVoteHistory: updatedFullVoteHistory,
        } : null);
        setSelectedMissionTeam([]); // Clear local selection state
      }
    }
  }, [room, user, toast, saveGameRecordForAllPlayers]);


  // ONLINE MODE: Virtual Player Team Proposal
  useEffect(() => {
    if (!room || !user || room.mode !== RoomMode.Online || room.status !== GameRoomStatus.InProgress || room.currentPhase !== 'team_selection' || !room.players || room.players.length === 0) {
      return;
    }
    const playersInRoom = room.players;
    const currentCaptain = playersInRoom.find(p => p.id === room.currentCaptainId);

    if (currentCaptain && currentCaptain.id.startsWith("virtual_")) {
      const performVirtualCaptainTeamProposal = () => {
        if (!room.currentRound || !room.missionPlayerCounts || playersInRoom.length === 0 || (room.captainChangesThisRound || 0) >= (room.maxCaptainChangesPerRound || MAX_CAPTAIN_CHANGES_PER_ROUND)) return;

        toast({ description: `${currentCaptain.name} (虚拟玩家) 正在选择队伍...`, duration: 1500 });
        const requiredPlayers = room.missionPlayerCounts[room.currentRound - 1];
        let proposedTeamIds = [currentCaptain.id];
        const otherPlayerIds = playersInRoom
            .filter(p => p.id !== currentCaptain.id)
            .map(p => p.id);

        const shuffledOtherPlayers = [...otherPlayerIds].sort(() => 0.5 - Math.random());

        while (proposedTeamIds.length < requiredPlayers && shuffledOtherPlayers.length > 0) {
            proposedTeamIds.push(shuffledOtherPlayers.shift()!);
        }
        proposedTeamIds = Array.from(new Set(proposedTeamIds));
         while (proposedTeamIds.length < requiredPlayers && playersInRoom.length > proposedTeamIds.length) {
            const availablePlayers = playersInRoom.filter(p => !proposedTeamIds.includes(p.id));
            if (availablePlayers.length > 0) {
                proposedTeamIds.push(availablePlayers[Math.floor(Math.random() * availablePlayers.length)].id);
            } else {
                break;
            }
        }
        proposedTeamIds = proposedTeamIds.slice(0, requiredPlayers);

        setRoom(prevRoom => prevRoom ? {
            ...prevRoom,
            selectedTeamForMission: proposedTeamIds,
            currentPhase: 'team_voting',
            teamVotes: [],
        } : null);
        toast({ title: "虚拟队长已提议", description: `${currentCaptain.name} 提议队伍: ${proposedTeamIds.map(id => playersInRoom.find(p => p.id === id)?.name).join(', ')}.`, duration: 2000 });
        setSelectedMissionTeam([]);
      };
      const timer = setTimeout(performVirtualCaptainTeamProposal, 1500 + Math.random() * 1500);
      return () => clearTimeout(timer);
    }
  }, [room?.currentPhase, room?.currentCaptainId, room?.status, room?.currentRound, room?.players, room?.missionPlayerCounts, room?.captainChangesThisRound, room?.maxCaptainChangesPerRound, user, toast, setRoom, setSelectedMissionTeam, room?.mode]);

  // ONLINE MODE: Individual Player Voting
  const handlePlayerVote = (vote: 'approve' | 'reject') => {
    if (!room || !user || room.mode !== RoomMode.Online || room.currentPhase !== 'team_voting' || !(room.players?.length)) {
      toast({ title: "错误", description: "当前无法投票。", variant: "destructive" }); return;
    }
    const existingVote = room.teamVotes?.find(v => v.playerId === user.id);
    if (existingVote) {
      toast({ title: "已投票", description: "您已对当前队伍投过票。", variant: "default" });
      return;
    }

    const newVote: PlayerVote = { playerId: user.id, vote };
    setRoom(prevRoom => {
      if (!prevRoom) return null;
      const updatedVotes = [...(prevRoom.teamVotes || []), newVote];
      return { ...prevRoom, teamVotes: updatedVotes };
    });
  };

  // ONLINE MODE: Virtual Player Voting (after human votes)
  useEffect(() => {
    if (!room || !user || room.mode !== RoomMode.Online || room.status !== GameRoomStatus.InProgress || room.currentPhase !== 'team_voting' || !room.players || room.players.length === 0) {
      return;
    }

    const playersInRoom = room.players;
    const currentVotes = room.teamVotes || [];
    const humanPlayers = playersInRoom.filter(p => !p.id.startsWith("virtual_"));
    const humanPlayersWhoVotedIds = new Set(currentVotes.filter(v => humanPlayers.some(hp => hp.id === v.playerId)).map(v => v.playerId));

    // Check if all human players have voted
    if (humanPlayersWhoVotedIds.size === humanPlayers.length) {
      const virtualPlayers = playersInRoom.filter(p => p.id.startsWith("virtual_"));
      const virtualPlayersWhoHaventVoted = virtualPlayers.filter(vp => !currentVotes.some(v => v.playerId === vp.id));

      if (virtualPlayersWhoHaventVoted.length > 0) {
        toast({ description: "虚拟玩家正在投票..." });
        let aiVotesBatch: PlayerVote[] = [];
        for (const vp of virtualPlayersWhoHaventVoted) {
          aiVotesBatch.push({ playerId: vp.id, vote: 'approve' }); // Simple auto-approve for virtual players
        }

        const finalVotesWithAI = [...currentVotes, ...aiVotesBatch];
        setRoom(prevRoom => prevRoom ? { ...prevRoom, teamVotes: finalVotesWithAI } : null);
        // The useEffect below will now pick up that all votes are in and call processTeamVotes
      }
    }
  }, [room?.teamVotes, room?.players, room?.currentPhase, room?.status, room?.mode, user, toast, setRoom]);


  // MANUAL MODE: Bulk Vote Submission (called from TeamVotingControls)
  const handleBulkSubmitVotes = (submittedVotes: PlayerVote[]) => {
    if (!room || room.mode !== RoomMode.ManualInput || room.currentPhase !== 'team_voting') {
        toast({ title: "错误", description: "当前无法提交投票。", variant: "destructive" });
        return;
    }
    setRoom(prevRoom => prevRoom ? { ...prevRoom, teamVotes: submittedVotes } : null);
    // The useEffect below will now pick up that all votes are in and call processTeamVotes
  };

  // Process team votes once all players have voted (for both Online and Manual modes)
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (
      room?.currentPhase === 'team_voting' &&
      room.teamVotes &&
      room.players &&
      room.teamVotes.length === room.players.length && // All votes are in
      room.players.length > 0
    ) {
      // Delay before processing to allow players to see the votes
      timer = setTimeout(() => {
        // Double check the condition inside the timeout in case state changed rapidly
        if (room?.currentPhase === 'team_voting' && room.teamVotes && room.players && room.teamVotes.length === room.players.length) {
          processTeamVotes(room.teamVotes);
        }
      }, 3000); // 3-second delay
    }
    return () => clearTimeout(timer);
  }, [room?.teamVotes, room?.currentPhase, room?.players, processTeamVotes, room]); // Added room dependency


  const handleHumanUndercoverPlayCard = (card: 'success' | 'fail') => {
    if (!room || !user || room.currentPhase !== 'mission_execution' || !currentUserIsOnMission || currentUserRole !== Role.Undercover) {
      toast({ title: "错误", description: "当前无法打出比赛牌。", variant: "destructive" });
      return;
    }
     if (room.mode === RoomMode.ManualInput && user.id !== room.hostId) {
        toast({ title: "错误", description: "手动模式下只有主持人可以输入比赛牌。", variant: "destructive" });
        return;
    }
    const existingPlay = room.missionCardPlaysForCurrentMission?.find(p => p.playerId === user.id);
    if (existingPlay && room.mode === RoomMode.Online) { // Online mode, one play per user
      toast({ title: "已行动", description: "您已在本轮比赛中行动过。", variant: "default" });
      return;
    }

    setHumanUndercoverCardChoice(card); // For UI feedback if needed
    const newPlay: MissionCardPlay = { playerId: user.id, card };

    setRoom(prevRoom => prevRoom ? {
        ...prevRoom,
        missionCardPlaysForCurrentMission: [...(prevRoom.missionCardPlaysForCurrentMission || []), newPlay]
    } : null);
    toast({ title: "比赛牌已打出", description: `你打出了【${card === 'success' ? '成功' : '破坏'}】。` });
  };

  const handleProceedToNextRoundOrGameOver = () => {
    if (!room || !room.teamScores || room.currentRound === undefined || room.totalRounds === undefined || !(room.players?.length)) return;
    const playersInRoom = room.players;
    let updates: Partial<GameRoom> = {};
    let gameIsOver = false;
    let nextPhase: GameRoomPhase = 'team_selection';

    if (room.teamScores.teamMemberWins >= 3 && room.teamScores.teamMemberWins > room.teamScores.undercoverWins) {
      const humanUndercovers = playersInRoom.filter(p => p.role === Role.Undercover && !p.id.startsWith("virtual_"));
      if (humanUndercovers.length > 0 && room.players.some(p => p.role === Role.Coach)) {
        nextPhase = 'coach_assassination';
        toast({ title: "战队方胜利在望!", description: "卧底现在有一次指认教练的机会来反败为胜。" });
      } else {
        gameIsOver = true;
        nextPhase = 'game_over';
        toast({ title: "战队阵营胜利!", description: "卧底方无力回天或无教练可指认。" });
      }
    } else if (room.teamScores.undercoverWins >= 3 && room.teamScores.undercoverWins > room.teamScores.teamMemberWins) {
      gameIsOver = true;
      nextPhase = 'game_over';
      toast({ title: "卧底阵营胜利!", description: "卧底方已完成3场比赛。" });
    } else if (room.currentRound >= room.totalRounds) {
      gameIsOver = true;
      nextPhase = 'game_over';
      toast({ title: "所有比赛结束!", description: "根据胜场决定最终胜负。" });
    }

    if (gameIsOver) {
      updates = {
        status: GameRoomStatus.Finished,
        missionOutcomeForDisplay: undefined,
        failCardsPlayedForDisplay: undefined,
        generatedFailureReason: undefined,
      };
      const finalRoomState = { ...room, ...updates, currentPhase: nextPhase } as GameRoom;
      saveGameRecordForAllPlayers(finalRoomState);
       setRoom(prevRoom => prevRoom ? { ...prevRoom, ...updates, currentPhase: nextPhase } : null);
    } else if (nextPhase === 'coach_assassination') {
       setRoom(prevRoom => prevRoom ? {
        ...prevRoom,
        currentPhase: 'coach_assassination',
        missionOutcomeForDisplay: undefined,
        failCardsPlayedForDisplay: undefined,
        generatedFailureReason: undefined,
      } : null);
    } else {
      const nextRoundNumber = room.currentRound + 1;
      const currentCaptainIndex = playersInRoom.findIndex(p => p.id === room.currentCaptainId);
      const nextCaptainIndex = (currentCaptainIndex + 1) % playersInRoom.length;
      const newCaptainId = playersInRoom[nextCaptainIndex].id;

      const newRoomState: Partial<GameRoom> = {
        currentRound: nextRoundNumber,
        currentCaptainId: newCaptainId,
        captainChangesThisRound: 0,
        currentPhase: 'team_selection',
        selectedTeamForMission: [],
        teamVotes: [],
        missionCardPlaysForCurrentMission: [],
        missionOutcomeForDisplay: undefined,
        failCardsPlayedForDisplay: undefined,
        generatedFailureReason: undefined,
      };

      if (room?.mode === RoomMode.ManualInput) {
        setManualRoleRevealIndex(0); // Restart role reveal for next round if needed
        setIsManualRoleVisible(false);
        setManualRoleRevealCompleted(false);
      }

      setRoom(prevRoom => prevRoom ? { ...prevRoom, ...newRoomState } : null);
      setSelectedMissionTeam([]);
      setHumanUndercoverCardChoice(null);
      setSelectedCoachCandidate(null);
      toast({ title: `第 ${nextRoundNumber} 场比赛开始`, description: `队长是 ${playersInRoom.find(p => p.id === newCaptainId)?.name}` });
    }
  };

  const handleConfirmCoachAssassination = () => {
    if (!room || !user || !selectedCoachCandidate || currentUserRole !== Role.Undercover || room.currentPhase !== 'coach_assassination' || !(room.players?.length)) {
      toast({ title: "错误", description: "无法确认指认。", variant: "destructive" });
      return;
    }
    if (room.mode === RoomMode.ManualInput && user.id !== room.hostId) {
      toast({ title: "错误", description: "手动模式下只有主持人可以确认指认。", variant: "destructive" });
      return;
    }
    const playersInRoom = room.players;
    const actualCoach = playersInRoom.find(p => p.role === Role.Coach);
    if (!actualCoach) {
      toast({ title: "游戏错误", description: "未找到教练角色。", variant: "destructive" });
      const finalRoomStateForError: Partial<GameRoom> = { status: GameRoomStatus.Finished, currentPhase: 'game_over', teamScores: room.teamScores };
      saveGameRecordForAllPlayers({ ...room, ...finalRoomStateForError } as GameRoom);
      setRoom(prevRoom => prevRoom ? { ...prevRoom, ...finalRoomStateForError } : null);
      return;
    }

    let toastTitle = "";
    let toastDescription = "";
    let finalTeamScores = { ...(room.teamScores || { teamMemberWins: 0, undercoverWins: 0 }) };

    if (selectedCoachCandidate === actualCoach.id) {
      toastTitle = "指认成功！卧底方反败为胜！";
      toastDescription = `${playersInRoom.find(p => p.id === actualCoach.id)?.name || '教练'} 是教练！`;
      if (finalTeamScores.teamMemberWins >=3) finalTeamScores.teamMemberWins = 2;
    } else {
      toastTitle = "指认失败！战队方获胜！";
      toastDescription = `${playersInRoom.find(p => p.id === selectedCoachCandidate)?.name || '目标'} 不是教练。实际教练是 ${actualCoach.name}。`;
    }

    const finalUpdates: Partial<GameRoom> = {
      status: GameRoomStatus.Finished,
      currentPhase: 'game_over',
      coachCandidateId: selectedCoachCandidate,
      teamScores: finalTeamScores,
    };
    saveGameRecordForAllPlayers({ ...room, ...finalUpdates } as GameRoom);
    setRoom(prevRoom => prevRoom ? { ...prevRoom, ...finalUpdates } : null);
    toast({ title: toastTitle, description: toastDescription, duration: 5000 });
    setSelectedCoachCandidate(null);
  };

  const handleReturnToLobbyAndLeaveRoom = useCallback(() => {
    if (!user || !room) {
      router.push("/");
      return;
    }
    const currentRoomId = roomId;
    const currentRoomName = room.name || "一个房间";
    let updatedRooms: GameRoom[] = [];

    try {
      const storedRoomsRaw = localStorage.getItem(ROOMS_LOCAL_STORAGE_KEY);
      updatedRooms = storedRoomsRaw ? JSON.parse(storedRoomsRaw) : [];

      if (user.id === room.hostId && room.status === GameRoomStatus.Waiting) {
        updatedRooms = updatedRooms.filter(r => r.id !== currentRoomId);
        toast({ title: "房间已关闭", description: `您作为主持人已离开并关闭了等待中的房间 ${currentRoomName}。` });
      } else {
        const roomIndex = updatedRooms.findIndex(r => r.id === currentRoomId);
        if (roomIndex !== -1) {
          updatedRooms[roomIndex].players = updatedRooms[roomIndex].players.filter(p => p.id !== user.id);
           if (updatedRooms[roomIndex].players.length === 0) {
             updatedRooms = updatedRooms.filter(r => r.id !== currentRoomId);
           }
        }
        toast({ title: "已离开房间", description: `您已离开房间 ${currentRoomName}。` });
      }
      localStorage.setItem(ROOMS_LOCAL_STORAGE_KEY, JSON.stringify(updatedRooms));
    } catch (e) {
      console.error("Error updating localStorage on leave:", e);
      toast({ title: "离开房间失败", description: "无法更新房间列表。", variant: "destructive" });
    }
    router.push("/");
  }, [room, user, router, toast, roomId]);

  const handleRestartGame = () => {
    if (!room || !user || room.hostId !== user.id) {
      toast({ title: "错误", description: "只有主持人可以重置游戏。", variant: "destructive" });
      return;
    }
    if (room.status !== GameRoomStatus.Finished) {
      toast({ title: "错误", description: "游戏尚未结束，无法重置。", variant: "destructive" });
      return;
    }
    const newGameInstanceId = `gameinst_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const currentPlayersWithResetRoles = room.players.map(p => {
      const playerObject: Player = {
        id: p.id,
        name: p.name,
      };
      if (p.avatarUrl) playerObject.avatarUrl = p.avatarUrl;
      return playerObject;
    });

    const updates: Partial<GameRoom> = {
      players: currentPlayersWithResetRoles,
      status: GameRoomStatus.Waiting,
      teamScores: { teamMemberWins: 0, undercoverWins: 0 },
      missionHistory: [],
      fullVoteHistory: [],
      selectedTeamForMission: [],
      teamVotes: [],
      missionCardPlaysForCurrentMission: [],
      currentGameInstanceId: newGameInstanceId,
      currentCaptainId: undefined,
      currentRound: undefined,
      captainChangesThisRound: undefined,
      currentPhase: undefined,
      missionOutcomeForDisplay: undefined,
      failCardsPlayedForDisplay: undefined,
      coachCandidateId: undefined,
      generatedFailureReason: undefined,
    };

    setRoom(prevRoom => prevRoom ? { ...prevRoom, ...updates } : null);
    // Reset local manual reveal states for new game
    setManualRoleRevealIndex(null);
    setIsManualRoleVisible(false);
    setManualRoleRevealCompleted(false);

    setSelectedMissionTeam([]);
    setHumanUndercoverCardChoice(null);
    setSelectedCoachCandidate(null);
    toast({ title: "游戏已重置", description: "房间已重置为等待状态。主持人可以开始新游戏。" });
  };

  const requestForceEndGame = () => {
    if (!room || !user || room.hostId !== user.id || room.status !== GameRoomStatus.InProgress) {
      toast({ title: "错误", description: "当前无法终止游戏。", variant: "destructive" });
      return;
    }
    setShowTerminateConfirmDialog(true);
  };

  const handleForceEndGame = () => {
    if (!room || !user || room.hostId !== user.id) {
      toast({ title: "错误", description: "只有主持人可以强制结束游戏。", variant: "destructive" });
      setShowTerminateConfirmDialog(false);
      return;
    }
    if (room.status !== GameRoomStatus.InProgress) {
      toast({ title: "错误", description: "游戏不在进行中，无法强制结束。", variant: "destructive" });
      setShowTerminateConfirmDialog(false);
      return;
    }
    const finalUpdates: Partial<GameRoom> = {
      status: GameRoomStatus.Finished,
      currentPhase: 'game_over',
      teamScores: room.teamScores || { teamMemberWins: 0, undercoverWins: 0 },
    };
    const finalRoomState = { ...room, ...finalUpdates, currentPhase: 'game_over' } as GameRoom;
    saveGameRecordForAllPlayers(finalRoomState);
    setRoom(prevRoom => prevRoom ? { ...prevRoom, ...finalUpdates } : null);
    toast({ title: "游戏已结束", description: "主持人已强制结束本场游戏。" });
    setShowTerminateConfirmDialog(false);
  };

  const handleRemoveVirtualPlayer = (virtualPlayerId: string) => {
    if (!room || !user || room.hostId !== user.id || room.status !== GameRoomStatus.Waiting) {
      toast({ title: "操作无效", description: "当前无法移除虚拟玩家。", variant: "destructive" });
      return;
    }
    const playerToRemove = room.players.find(p => p.id === virtualPlayerId);
    if (!playerToRemove || !playerToRemove.id.startsWith("virtual_")) {
      toast({ title: "错误", description: "未找到指定的虚拟玩家。", variant: "destructive" });
      return;
    }
    const updatedPlayers = room.players.filter(p => p.id !== virtualPlayerId);

    setRoom(prevRoom => prevRoom ? {
        ...prevRoom,
        players: updatedPlayers
    } : null);
    toast({ title: "虚拟玩家已移除", description: `${playerToRemove.name} 已被移除出房间。` });
  };

  const handleShowMyRoleManual = () => {
    setIsManualRoleVisible(true);
  };

  const handleNextPlayerForRoleReveal = () => {
    setIsManualRoleVisible(false);
    if (room && manualRoleRevealIndex !== null && manualRoleRevealIndex < room.players.length - 1) {
      setManualRoleRevealIndex(manualRoleRevealIndex + 1);
    } else {
      setManualRoleRevealIndex(null); // All players have seen their roles
      setManualRoleRevealCompleted(true); // Mark reveal as completed
    }
  };

  if (isLoading || authLoading) return <div className="text-center py-10">载入房间...</div>;
  if (!room || !user) return <div className="text-center py-10 text-destructive">载入房间错误或用户未验证。请尝试返回大厅。</div>;

  const currentUserInRoom = room.players.find(p => p.id === user.id);
  const currentUserRole = currentUserInRoom?.role;

  const isHostCurrentUser = user.id === room.hostId;
  const isDesignatedCaptainTheCurrentUser = user.id === room.currentCaptainId;


  const missionTeamPlayerObjects = room.selectedTeamForMission?.map(id => room.players.find(p => p.id === id)).filter(Boolean) as Player[] || [];
  const currentUserIsOnMission = !!room.selectedTeamForMission?.includes(user.id);
  const currentUserHasPlayedMissionCard = room.missionCardPlaysForCurrentMission?.some(p => p.playerId === user.id);
  const requiredPlayersForCurrentMission = room.missionPlayerCounts && room.currentRound !== undefined && room.currentRound > 0 && room.missionPlayerCounts.length >= room.currentRound ? room.missionPlayerCounts[room.currentRound - 1] : 0;
  const canAddVirtualPlayer = isHostCurrentUser && room.status === GameRoomStatus.Waiting && room.players.length < room.maxPlayers;
  const canStartGame = isHostCurrentUser && room.status === GameRoomStatus.Waiting && room.players.length >= MIN_PLAYERS_TO_START && room.players.length <= room.maxPlayers;

  const knownUndercoversByCoach = (currentUserRole === Role.Coach && room.status === GameRoomStatus.InProgress) ? room.players.filter(p => p.role === Role.Undercover) : [];
  const fellowUndercovers = (currentUserRole === Role.Undercover && room.status === GameRoomStatus.InProgress) ? room.players.filter(p => p.role === Role.Undercover && p.id !== user.id) : [];
  const isSoleUndercover = currentUserRole === Role.Undercover && room.status === GameRoomStatus.InProgress && room.players.filter(p => p.role === Role.Undercover).length === 1;

  const votesToDisplay = room.teamVotes || [];

  let assassinationTargetOptions: Player[] = [];
  if (room.status === GameRoomStatus.InProgress && room.currentPhase === 'coach_assassination' && currentUserRole === Role.Undercover) {
    const successfulCaptainIds = new Set(
      (room.missionHistory || [])
        .filter(mission => mission.outcome === 'success')
        .map(mission => mission.captainId)
    );

    assassinationTargetOptions = room.players.filter(p => {
      if (!successfulCaptainIds.has(p.id)) return false;
      if (p.id === user.id) return false;
      if (p.role === Role.Undercover) return false;
      return true;
    });
  }

  let gameOverMessageNode: React.ReactNode = "游戏结束!";
  if (room.status === GameRoomStatus.Finished) {
    const teamMemberMissionWins = room.teamScores?.teamMemberWins || 0;
    const undercoverMissionWins = room.teamScores?.undercoverWins || 0;

    if (room.coachCandidateId) {
        const actualCoach = room.players.find(p => p.role === Role.Coach);
        if (actualCoach && room.coachCandidateId === actualCoach.id) {
             gameOverMessageNode = <span className="text-destructive">卧底阵营胜利! (通过指认教练)</span>;
        } else {
             gameOverMessageNode = <span className="text-green-600">指认失败，战队方获胜</span>;
        }
    } else if (undercoverMissionWins >= 3 && undercoverMissionWins > teamMemberMissionWins) {
      gameOverMessageNode = <span className="text-destructive">卧底阵营胜利! (通过完成比赛)</span>;
    } else if (teamMemberMissionWins >= 3 && teamMemberMissionWins > undercoverMissionWins) {
      gameOverMessageNode = <span className="text-green-600">战队阵营胜利! (通过完成比赛)</span>;
    } else if (room.captainChangesThisRound && room.maxCaptainChangesPerRound && room.captainChangesThisRound >= room.maxCaptainChangesPerRound) {
      gameOverMessageNode = <span className="text-destructive">卧底阵营胜利! (由于队伍连续5次组队失败)</span>;
    } else if (room.currentRound && room.totalRounds && room.currentRound > room.totalRounds) {
      if (undercoverMissionWins > teamMemberMissionWins) {
        gameOverMessageNode = <span className="text-destructive">卧底阵营胜利! (比赛结束时胜场较多)</span>;
      } else if (teamMemberMissionWins > undercoverMissionWins) {
        gameOverMessageNode = <span className="text-green-600">战队阵营胜利! (比赛结束时胜场较多)</span>;
      } else {
        gameOverMessageNode = <span className="text-foreground">游戏平局! (比分 {teamMemberMissionWins} : {undercoverMissionWins})</span>;
      }
    } else {
      gameOverMessageNode = <span className="text-foreground">游戏已结束. (最终比分 战队 {teamMemberMissionWins} : 卧底 {undercoverMissionWins})</span>;
    }
  }

  const totalHumanPlayersInRoom = room.players.filter(p => !p.id.startsWith("virtual_")).length;

  const playerForManualReveal = (manualRoleRevealIndex !== null && room.players && manualRoleRevealIndex < room.players.length)
    ? room.players[manualRoleRevealIndex]
    : undefined;

  const isLastPlayerForManualReveal = manualRoleRevealIndex !== null && room.players ? manualRoleRevealIndex === room.players.length - 1 : false;

  const showManualRoleRevealUI = room.mode === RoomMode.ManualInput &&
                                 room.status === GameRoomStatus.InProgress &&
                                 !manualRoleRevealCompleted &&
                                 manualRoleRevealIndex !== null;

  const enableSelectionInterfaceForPlayerList =
       room.status === GameRoomStatus.InProgress &&
       room.currentPhase === 'team_selection' &&
       (
         (room.mode === RoomMode.Online && isDesignatedCaptainTheCurrentUser) ||
         (room.mode === RoomMode.ManualInput && isHostCurrentUser) // Host inputs in manual mode
       );

  const showActiveTeamSelectionControls =
    room.status === GameRoomStatus.InProgress &&
    room.currentPhase === 'team_selection' &&
    (
      (room.mode === RoomMode.Online && isDesignatedCaptainTheCurrentUser) ||
      (room.mode === RoomMode.ManualInput && isHostCurrentUser)
    );


  return (
    <div className="space-y-6">
      <RoomHeader
        room={room}
        isHost={isHostCurrentUser}
        onPromptTerminateGame={requestForceEndGame}
      />

      {!showManualRoleRevealUI && room.status === GameRoomStatus.InProgress && (
          <RoleAlerts
            currentUserRole={currentUserRole}
            roomStatus={room.status}
            knownUndercoversByCoach={knownUndercoversByCoach}
            fellowUndercovers={fellowUndercovers}
            isSoleUndercover={isSoleUndercover}
          />
      )}

      {showManualRoleRevealUI && playerForManualReveal ? (
        <Card className="shadow-lg">
          <CardContent className="pt-6">
            <ManualRoleRevealControls
                playerToReveal={playerForManualReveal}
                allPlayersInRoom={room.players}
                isRoleVisible={isManualRoleVisible}
                onShowRole={handleShowMyRoleManual}
                onNextOrComplete={handleNextPlayerForRoleReveal}
                isLastPlayer={isLastPlayerForManualReveal}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-3 gap-6">
          <PlayerListPanel
            localPlayers={room.players}
            user={user}
            room={room}
            currentUserRole={currentUserRole}
            votesToDisplay={votesToDisplay}
            fellowUndercovers={fellowUndercovers}
            knownUndercoversByCoach={knownUndercoversByCoach}
            isSelectionModeActive={enableSelectionInterfaceForPlayerList}
            selectedPlayersForMission={selectedMissionTeam}
            onTogglePlayerForMission={handlePlayerSelectionForMission}
            selectionLimitForMission={requiredPlayersForCurrentMission}
            isCoachAssassinationModeActive={room.currentPhase === 'coach_assassination' && currentUserRole === Role.Undercover && (room.mode === RoomMode.Online || (room.mode === RoomMode.ManualInput && isHostCurrentUser)) }
            selectedCoachCandidateId={selectedCoachCandidate}
            onSelectCoachCandidate={setSelectedCoachCandidate}
            assassinationTargetOptionsPlayerIds={assassinationTargetOptions.map(p => p.id)}
            onRemoveVirtualPlayer={isHostCurrentUser ? handleRemoveVirtualPlayer : undefined}
          />

          <div className="md:col-span-2 space-y-4">
            {room.status === GameRoomStatus.InProgress && room.currentPhase && (
              <Card className="shadow-md">
                <CardContent className="pt-6">
                  {room.currentPhase === 'team_selection' && (
                    <TeamSelectionControls
                      roomMode={room.mode}
                      isHostCurrentUser={isHostCurrentUser}
                      isDesignatedCaptainTheCurrentUser={isDesignatedCaptainTheCurrentUser}
                      showActiveControls={showActiveTeamSelectionControls}
                      currentCaptainName={room.players.find(p => p.id === room.currentCaptainId)?.name}
                      requiredPlayersForCurrentMission={requiredPlayersForCurrentMission}
                      selectedMissionTeamLength={selectedMissionTeam.length}
                      onHumanProposeTeam={handleHumanProposeTeam}
                    />
                  )}

                  {room.currentPhase === 'team_voting' && (
                    <TeamVotingControls
                      roomMode={room.mode}
                      allPlayersInRoom={room.players}
                      currentUser={user}
                      votesToDisplay={votesToDisplay}
                      onPlayerVote={handlePlayerVote} // Online mode
                      onBulkSubmitVotes={handleBulkSubmitVotes} // Manual mode
                      currentPhase={room.currentPhase} // For resetting manual votes
                      totalPlayerCountInRoom={room.players.length}
                      totalHumanPlayersInRoom={totalHumanPlayersInRoom}
                    />
                  )}

                  {room.currentPhase === 'mission_execution' && (
                    <MissionExecutionDisplay
                      roomMode={room.mode}
                      isHostCurrentUser={isHostCurrentUser}
                      currentRound={room.currentRound}
                      missionTeamPlayerIds={room.selectedTeamForMission || []}
                      missionTeamPlayerNames={missionTeamPlayerObjects.map(p => p.name)}
                      currentUserIsOnMission={currentUserIsOnMission}
                      currentUserRole={currentUserRole}
                      currentUserHasPlayedMissionCard={currentUserHasPlayedMissionCard}
                      humanUndercoverCardChoice={humanUndercoverCardChoice}
                      onHumanUndercoverPlayCard={handleHumanUndercoverPlayCard}
                      onFinalizeMissionManually={finalizeAndRevealMissionOutcome} // For manual mode
                      missionCardPlaysForCurrentMission={room.missionCardPlaysForCurrentMission || []}
                    />
                  )}

                  {room.currentPhase === 'mission_reveal' && (
                    <MissionRevealDisplay
                      currentRound={room.currentRound}
                      missionOutcomeForDisplay={room.missionOutcomeForDisplay}
                      failCardsPlayedForDisplay={room.failCardsPlayedForDisplay}
                      generatedFailureReason={room.generatedFailureReason}
                      missionTeamPlayerNames={missionTeamPlayerObjects.map(p => p.name)}
                      onProceedToNextRoundOrGameOver={handleProceedToNextRoundOrGameOver}
                    />
                  )}

                  {room.currentPhase === 'coach_assassination' && (
                    <CoachAssassinationControls
                      roomMode={room.mode}
                      isHostCurrentUser={isHostCurrentUser}
                      currentUserRole={currentUserRole}
                      selectedCoachCandidateId={selectedCoachCandidate}
                      onConfirmCoachAssassination={handleConfirmCoachAssassination}
                    />
                  )}
                </CardContent>
              </Card>
            )}

            {room.status === GameRoomStatus.Waiting && (
              <Card><CardContent className="pt-6">
                  <WaitingPhaseActions
                      isHost={isHostCurrentUser}
                      canStartGame={canStartGame}
                      localPlayersLength={room.players.length}
                      minPlayersToStart={MIN_PLAYERS_TO_START}
                      maxPlayers={room.maxPlayers}
                      onStartGame={handleStartGame}
                      canAddVirtualPlayer={canAddVirtualPlayer}
                      onAddVirtualPlayer={handleAddVirtualPlayer}
                      onReturnToLobby={handleReturnToLobbyAndLeaveRoom}
                  />
              </CardContent></Card>
            )}

            {room.status === GameRoomStatus.Finished && (
              <GameOverSummary
                room={room}
                localPlayers={room.players}
                gameOverMessage={gameOverMessageNode}
                onReturnToLobby={handleReturnToLobbyAndLeaveRoom}
                isHost={isHostCurrentUser}
                onRestartGame={handleRestartGame}
              />
            )}

            { (room.status === GameRoomStatus.InProgress || room.status === GameRoomStatus.Finished) &&
              room.fullVoteHistory && room.fullVoteHistory.length > 0 && (
                <VoteHistoryAccordion
                  room={room}
                  localPlayers={room.players}
                  totalRounds={TOTAL_ROUNDS_PER_GAME}
                />
              )}
          </div>
        </div>
      )}
      <AlertDialog open={showTerminateConfirmDialog} onOpenChange={setShowTerminateConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>终止游戏确认</AlertDialogTitle>
            <AlertDialogDescription>
              您确定要终止当前游戏吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowTerminateConfirmDialog(false)}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleForceEndGame} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">确认</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
