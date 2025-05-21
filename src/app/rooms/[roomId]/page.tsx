
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
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
  type GeneratedFailureReason
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
import { Card, CardHeader, CardContent } from "@/components/ui/card"; // Added Card, CardHeader, CardContent

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
import { Swords, Shield, HelpCircle } from "lucide-react";

import { db } from "@/lib/firebase";
import { doc, updateDoc, arrayUnion, arrayRemove, serverTimestamp, Timestamp, deleteField, deleteDoc } from "firebase/firestore";
import { generateFailureReason } from "@/ai/flows/generate-failure-reason-flow";
import {
  ROLES_CONFIG,
  MISSIONS_CONFIG,
  MIN_PLAYERS_TO_START,
  TOTAL_ROUNDS_PER_GAME,
  MAX_CAPTAIN_CHANGES_PER_ROUND,
  HONOR_OF_KINGS_HERO_NAMES,
  FAILURE_REASONS_LIST_FOR_FALLBACK
} from '@/lib/game-config';
import { useGameRoom } from '@/hooks/use-game-room';


export default function GameRoomPage() {
  const params = useParams();
  const router = useRouter();
  const { roomId: rawRoomId } = params;
  const roomId = Array.isArray(rawRoomId) ? rawRoomId[0] : rawRoomId;

  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const { room, isLoading } = useGameRoom(roomId, user, authLoading);

  const [selectedMissionTeam, setSelectedMissionTeam] = useState<string[]>([]);
  const [humanUndercoverCardChoice, setHumanUndercoverCardChoice] = useState<'success' | 'fail' | null>(null);
  const [selectedCoachCandidate, setSelectedCoachCandidate] = useState<string | null>(null);
  const [showTerminateConfirmDialog, setShowTerminateConfirmDialog] = useState(false);


  const updateFirestoreRoom = useCallback(async (rawUpdatedFields: Partial<GameRoom>) => {
    if (!roomId || typeof roomId !== 'string') return;
    const roomRef = doc(db, "rooms", roomId);

    const cleanedUpdates: { [key: string]: any } = {};

    for (const key in rawUpdatedFields) {
      if (Object.prototype.hasOwnProperty.call(rawUpdatedFields, key)) {
        const value = rawUpdatedFields[key as keyof GameRoom];
        if (value === undefined && !(value && typeof value === 'object' && '_methodName' in (value as any) && (value as any)._methodName === 'FieldValue.delete')) {
          // Skip undefined values unless they are FieldValue.delete()
          continue;
        }
        cleanedUpdates[key as keyof GameRoom] = value;
      }
    }
    
    if (Object.keys(cleanedUpdates).length === 0) {
      console.warn("updateFirestoreRoom called with no actual changes (after undefined cleanup). Skipping update. Original updates:", rawUpdatedFields);
      return;
    }

    try {
      await updateDoc(roomRef, cleanedUpdates);
    } catch (error) {
      console.error("Error updating room in Firestore:", error, "Attempted (cleaned) updates:", cleanedUpdates, "Original updates:", rawUpdatedFields);
      toast({ title: "更新房间失败", description: `无法在服务器上更新房间状态。Error: ${(error as Error).message}`, variant: "destructive" });
    }
  }, [roomId, toast]);

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
        winningFaction = 'Draw'; // Default if no clear winner by other conditions
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

    // Simulate virtual player card plays for those on the mission
    room.selectedTeamForMission.forEach(playerId => {
      const player = playersInRoom.find(p => p.id === playerId);
      if (player && player.id.startsWith("virtual_") && !finalPlays.some(fp => fp.playerId === playerId)) {
        const cardToPlay: 'success' | 'fail' = player.role === Role.Undercover ? 'fail' : 'success';
        finalPlays.push({ playerId: player.id, card: cardToPlay });
      }
    });

    const failCardsPlayed = finalPlays.filter(p => p.card === 'fail').length;
    let missionSuccessful: boolean;

    // Rule: 7+ players, round 4, needs 2 fail cards to fail the mission
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
        aiGeneratedFailureReason = await generateFailureReason({ failCardCount: failCardsPlayed });
      } catch (e) {
        console.error("Error calling generateFailureReason flow:", e);
        const defaultReasonsCount = Math.min(failCardsPlayed, FAILURE_REASONS_LIST_FOR_FALLBACK.length, 3);
        const defaultReasons = FAILURE_REASONS_LIST_FOR_FALLBACK.slice(0, defaultReasonsCount);
        aiGeneratedFailureReason = {
          selectedReasons: defaultReasons,
          narrativeSummary: `比赛失利，可能原因是：${defaultReasons.join("，")}。`,
        };
      }
    }

    const missionRecordData: Omit<Mission, 'generatedFailureReason'> & { cardPlays: MissionCardPlay[], generatedFailureReason?: GeneratedFailureReason } = {
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


    await updateFirestoreRoom({
      teamScores: newTeamScores,
      missionHistory: arrayUnion(missionRecordData) as any,
      currentPhase: 'mission_reveal',
      missionOutcomeForDisplay: outcome,
      failCardsPlayedForDisplay: failCardsPlayed,
      generatedFailureReason: aiGeneratedFailureReason || deleteField(),
    });
    toast({ title: `第 ${room.currentRound} 场比赛结束`, description: `结果: ${outcome === 'success' ? '成功' : '失败'}${outcome === 'fail' && aiGeneratedFailureReason ? ` (${aiGeneratedFailureReason.narrativeSummary})` : ''}` });
  }, [room, toast, updateFirestoreRoom]);

  useEffect(() => {
    if (!room || room.status !== GameRoomStatus.InProgress || room.currentPhase !== 'mission_execution' || !user) {
      return;
    }
    const missionTeamPlayerIds = room.selectedTeamForMission || [];
    const playersInRoom = room.players || [];
    const humanPlayersOnMission = missionTeamPlayerIds.filter(playerId => {
      const player = playersInRoom.find(p => p.id === playerId);
      return player && !player.id.startsWith("virtual_");
    });

    // If no human players are on the mission, and the mission team is not empty, finalize immediately.
    // (This implies only virtual players are on the mission)
    if (humanPlayersOnMission.length === 0 && missionTeamPlayerIds.length > 0) { 
      const timer = setTimeout(() => finalizeAndRevealMissionOutcome(), 1000); // Small delay for effect
      return () => clearTimeout(timer);
    }

    // Check if all human players on the mission have recorded their actions
    const humanActionsRecorded = room.missionCardPlaysForCurrentMission?.filter(play => humanPlayersOnMission.includes(play.playerId)).length || 0;

    if (humanActionsRecorded === humanPlayersOnMission.length && humanPlayersOnMission.length > 0) { 
      // All human players on mission have acted, proceed to finalize.
      finalizeAndRevealMissionOutcome();
    }
  }, [room, user, finalizeAndRevealMissionOutcome]); 


  useEffect(() => {
    if (!room || !user || room.status !== GameRoomStatus.InProgress || room.currentPhase !== 'team_selection' || !(room.players?.length)) {
      return;
    }
    const playersInRoom = room.players;
    const currentCaptain = playersInRoom.find(p => p.id === room.currentCaptainId);

    if (currentCaptain && currentCaptain.id.startsWith("virtual_")) {
      const performVirtualCaptainTeamProposal = async () => {
        if (!room.currentRound || !room.missionPlayerCounts || !playersInRoom.length || (room.captainChangesThisRound || 0) >= (room.maxCaptainChangesPerRound || MAX_CAPTAIN_CHANGES_PER_ROUND) || !currentCaptain.role) return;
        
        toast({ description: `${currentCaptain.name} (虚拟玩家) 正在选择队伍...` });

        // Simplified random team proposal for virtual captains
        const requiredPlayers = room.missionPlayerCounts[room.currentRound - 1];
        let proposedTeamIds = [currentCaptain.id]; // Captain includes self
        const otherPlayerIds = playersInRoom
            .filter(p => p.id !== currentCaptain.id)
            .map(p => p.id);

        const shuffledOtherPlayers = [...otherPlayerIds].sort(() => 0.5 - Math.random());

        while (proposedTeamIds.length < requiredPlayers && shuffledOtherPlayers.length > 0) {
            proposedTeamIds.push(shuffledOtherPlayers.shift()!);
        }
        // Ensure uniqueness (though shuffling and pushing should handle it if IDs are unique)
        proposedTeamIds = Array.from(new Set(proposedTeamIds));
         // If still not enough players (e.g., very few players total), fill with any available
         while (proposedTeamIds.length < requiredPlayers && playersInRoom.length > proposedTeamIds.length) {
            const availablePlayers = playersInRoom.filter(p => !proposedTeamIds.includes(p.id));
            if (availablePlayers.length > 0) {
                proposedTeamIds.push(availablePlayers[Math.floor(Math.random() * availablePlayers.length)].id);
            } else {
                break; // No more unique players to add
            }
        }
        // Final trim to ensure exact count
        proposedTeamIds = proposedTeamIds.slice(0, requiredPlayers);


        await updateFirestoreRoom({
            selectedTeamForMission: proposedTeamIds,
            currentPhase: 'team_voting',
            teamVotes: [], // Reset votes for the new proposal
        });
        toast({ title: "虚拟队长已提议", description: `${currentCaptain.name} 提议队伍: ${proposedTeamIds.map(id => playersInRoom.find(p => p.id === id)?.name).join(', ')}.` });
        setSelectedMissionTeam([]); // Clear local selection if any
      };
      const timer = setTimeout(performVirtualCaptainTeamProposal, 1500 + Math.random() * 1500); // Simulate thinking time
      return () => clearTimeout(timer);
    }
  }, [room, user, toast, updateFirestoreRoom]);


  // Game initialization logic
  const assignRolesAndCaptain = async () => {
    if (!room || !(room.players?.length) || room.players.length < MIN_PLAYERS_TO_START) return;
    const currentPlayers = room.players;
    const playerCount = currentPlayers.length;
    const config = ROLES_CONFIG[playerCount] || ROLES_CONFIG[Math.max(...Object.keys(ROLES_CONFIG).map(Number).filter(k => !isNaN(k)))];
    let rolesToAssign: Role[] = [];
    Object.entries(config).forEach(([role, count]) => {
      for (let i = 0; i < count; i++) rolesToAssign.push(role as Role);
    });
    while (rolesToAssign.length < playerCount) rolesToAssign.push(Role.TeamMember); // Fill remaining with TeamMember
    rolesToAssign = rolesToAssign.slice(0, playerCount).sort(() => Math.random() - 0.5); // Shuffle roles

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
    const missionPlayerCounts = MISSIONS_CONFIG[playerCount] || MISSIONS_CONFIG[Object.keys(MISSIONS_CONFIG).map(Number).sort((a, b) => a - b)[0]];
    const newGameInstanceId = `gameinst_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const updatedRoomData: Partial<GameRoom> = {
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
      missionPlayerCounts: missionPlayerCounts,
      fullVoteHistory: [],
      currentGameInstanceId: newGameInstanceId,
      missionOutcomeForDisplay: deleteField() as unknown as MissionOutcome,
      failCardsPlayedForDisplay: deleteField() as unknown as number,
      coachCandidateId: deleteField() as unknown as string,
      generatedFailureReason: deleteField() as unknown as GeneratedFailureReason,
    };
    await updateFirestoreRoom(updatedRoomData);
    setSelectedMissionTeam([]);
    setHumanUndercoverCardChoice(null);
    setSelectedCoachCandidate(null);
    toast({ title: "游戏开始!", description: `角色已分配。第 1 场比赛，队伍组建阶段。 ${updatedPlayers[firstCaptainIndex].name} 是首任队长。` });
  };

  const handleStartGame = async () => {
    if (!room || !user || room.hostId !== user.id) {
      toast({ title: "未授权", description: "只有主持人可以开始游戏。", variant: "destructive" }); return;
    }
    if (!room.players || room.players.length < MIN_PLAYERS_TO_START) {
      toast({ title: "玩家数量不足", description: `至少需要 ${MIN_PLAYERS_TO_START} 名玩家才能开始。当前 ${room.players?.length || 0} 名。`, variant: "destructive" }); return;
    }
    if (room.players.length > room.maxPlayers) {
      toast({ title: "玩家数量过多", description: `此房间最大支持 ${room.maxPlayers} 名玩家。当前 ${room.players.length} 名。`, variant: "destructive" }); return;
    }
    await assignRolesAndCaptain();
  };

  const handleAddVirtualPlayer = async () => {
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
      avatarUrl: `https://placehold.co/100x100.png?text=${encodeURIComponent(virtualPlayerName.charAt(0))}`,
    };
    await updateFirestoreRoom({ players: arrayUnion(newVirtualPlayer) as any });
    toast({ title: "虚拟玩家已添加", description: `${virtualPlayerName} 已加入房间。` });
  };

  // Human captain proposes a team
  const handleHumanProposeTeam = async () => {
    if (!room || !user || room.currentCaptainId !== user.id || room.currentPhase !== 'team_selection' || !room.missionPlayerCounts || room.currentRound === undefined) {
      toast({ title: "错误", description: "当前无法提议队伍。", variant: "destructive" }); return;
    }
    const requiredPlayers = room.missionPlayerCounts[room.currentRound - 1];
    if (selectedMissionTeam.length !== requiredPlayers) {
      toast({ title: "队伍人数无效", description: `此比赛请选择 ${requiredPlayers} 名玩家。`, variant: "destructive" }); return;
    }
    await updateFirestoreRoom({ selectedTeamForMission: [...selectedMissionTeam], currentPhase: 'team_voting', teamVotes: [] });
  };

  const handlePlayerSelectionForMission = (playerId: string) => {
    if (!room || !user || room.currentCaptainId !== user.id || room.currentPhase !== 'team_selection' || !room.missionPlayerCounts || room.currentRound === undefined) {
      return;
    }
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

  // Process team votes
  const processTeamVotes = useCallback(async (currentVotes: PlayerVote[]) => {
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
      votes: [...currentVotes], // Store a copy of the votes
      outcome: voteOutcome,
    };
    // Use Firestore arrayUnion to add the new log entry
    const updatedFullVoteHistoryFirestore = arrayUnion(newVoteLogEntry);

    if (voteOutcome === 'approved') {
      const currentSelectedTeam = room.selectedTeamForMission || [];
      const autoPlays: MissionCardPlay[] = []; // For human TeamMembers/Coaches
      currentSelectedTeam.forEach(playerId => {
        const player = playersInRoom.find(p => p.id === playerId);
        if (player && !player.id.startsWith("virtual_") && (player.role === Role.TeamMember || player.role === Role.Coach)) {
          // Ensure this player hasn't already had a card recorded (e.g., if logic changes)
          if (!room.missionCardPlaysForCurrentMission?.some(p => p.playerId === playerId)) {
            autoPlays.push({ playerId: player.id, card: 'success' });
          }
        }
      });

      await updateFirestoreRoom({
        currentPhase: 'mission_execution',
        teamVotes: currentVotes, // Persist votes for this approved team
        missionCardPlaysForCurrentMission: autoPlays,
        fullVoteHistory: updatedFullVoteHistoryFirestore as any,
        captainChangesThisRound: 0, // Reset captain changes on successful team approval
      });
      setHumanUndercoverCardChoice(null); // Reset local state for human undercover

    } else { // Team Rejected
      let newCaptainChangesThisRound = (room.captainChangesThisRound || 0) + 1;
      if (newCaptainChangesThisRound >= (room.maxCaptainChangesPerRound || MAX_CAPTAIN_CHANGES_PER_ROUND)) {
        // Undercover team wins due to max rejections
        const finalTeamScores = { ...(room.teamScores || { teamMemberWins: 0, undercoverWins: 0 }), undercoverWins: room.totalRounds || TOTAL_ROUNDS_PER_GAME };

        const finalRoomStateForRecord: GameRoom = {
          ...room,
          status: GameRoomStatus.Finished,
          currentPhase: 'game_over' as GameRoomPhase,
          teamScores: finalTeamScores,
          teamVotes: currentVotes, // Persist final votes
          fullVoteHistory: [...(room.fullVoteHistory || []), newVoteLogEntry],
          captainChangesThisRound: newCaptainChangesThisRound,
        };
        saveGameRecordForAllPlayers(finalRoomStateForRecord);

        toast({ title: "队伍被拒绝5次!", description: "卧底阵营获胜!", variant: "destructive" });
        await updateFirestoreRoom({
          status: GameRoomStatus.Finished,
          currentPhase: 'game_over',
          teamScores: finalTeamScores,
          teamVotes: currentVotes, // Persist final votes
          fullVoteHistory: updatedFullVoteHistoryFirestore as any,
          captainChangesThisRound: newCaptainChangesThisRound,
        });
      } else {
        const currentCaptainIndex = playersInRoom.findIndex(p => p.id === room.currentCaptainId);
        const nextCaptainIndex = (currentCaptainIndex + 1) % playersInRoom.length;
        const newCaptainId = playersInRoom[nextCaptainIndex].id;
        await updateFirestoreRoom({
          currentCaptainId: newCaptainId,
          captainChangesThisRound: newCaptainChangesThisRound,
          currentPhase: 'team_selection',
          selectedTeamForMission: [], // Clear selected team
          teamVotes: [], // Clear votes for next proposal
          fullVoteHistory: updatedFullVoteHistoryFirestore as any,
        });
        setSelectedMissionTeam([]); // Clear local selection
      }
    }
  }, [room, user, toast, saveGameRecordForAllPlayers, updateFirestoreRoom]);

  // Player casts a vote
  const handlePlayerVote = async (vote: 'approve' | 'reject') => {
    if (!room || !user || room.currentPhase !== 'team_voting' || !(room.players?.length)) {
      toast({ title: "错误", description: "当前无法投票。", variant: "destructive" }); return;
    }
    const existingVote = room.teamVotes?.find(v => v.playerId === user.id);
    if (existingVote) {
      toast({ title: "已投票", description: "您已对当前队伍投过票。", variant: "default" });
      return;
    }

    const newVote: PlayerVote = { playerId: user.id, vote };
    await updateFirestoreRoom({ teamVotes: arrayUnion(newVote) as any });
  };


  // Effect for virtual player voting (after all humans have voted)
  useEffect(() => {
    if (!room || !user || room.status !== GameRoomStatus.InProgress || room.currentPhase !== 'team_voting' || !(room.players?.length)) {
      return;
    }
    const playersInRoom = room.players;
    const realPlayers = playersInRoom.filter(p => !p.id.startsWith("virtual_"));
    const currentVotes = room.teamVotes || [];
    const realPlayersWhoVotedIds = new Set(currentVotes.filter(v => realPlayers.some(rp => rp.id === v.playerId)).map(v => v.playerId));

    // Check if all real players have voted
    if (realPlayersWhoVotedIds.size === realPlayers.length) {
      const virtualPlayers = playersInRoom.filter(p => p.id.startsWith("virtual_"));
      const virtualPlayersWhoHaventVoted = virtualPlayers.filter(vp => !currentVotes.some(v => v.playerId === vp.id));

      if (virtualPlayersWhoHaventVoted.length > 0) { 
        const performVirtualPlayerVoting = async () => {
          toast({ description: "虚拟玩家正在投票..." });
          let aiVotesBatch: PlayerVote[] = [];

          for (const vp of virtualPlayersWhoHaventVoted) {
            // Simplified: Virtual players always approve for now
            aiVotesBatch.push({ playerId: vp.id, vote: 'approve' });
          }
          if (aiVotesBatch.length > 0) {
            await updateFirestoreRoom({ teamVotes: arrayUnion(...aiVotesBatch) as any });
          }
        };
        // Introduce a small delay before virtual players vote to make it feel more natural
        // and to ensure human votes are processed first by Firestore if there's any race condition.
        const timer = setTimeout(performVirtualPlayerVoting, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [room, user, toast, updateFirestoreRoom]); 


  // Effect to process votes once all players have voted
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (
      room?.currentPhase === 'team_voting' &&
      room.teamVotes &&
      room.players &&
      room.teamVotes.length === room.players.length &&
      room.players.length > 0 // Ensure players array is populated
    ) {
      // All votes are in, wait a bit for players to see results, then process
      timer = setTimeout(() => {
        // Double check the condition in case of rapid state changes
        if (room?.currentPhase === 'team_voting' && room.teamVotes && room.players && room.teamVotes.length === room.players.length) {
          processTeamVotes(room.teamVotes);
        }
      }, 3000); // 3 seconds delay
    }
    return () => clearTimeout(timer);
  }, [room?.teamVotes, room?.currentPhase, room?.players, processTeamVotes, room]); // Added room to dependencies as room.players.length is used


  // Human Undercover plays a mission card
  const handleHumanUndercoverPlayCard = async (card: 'success' | 'fail') => {
    if (!room || !user || room.currentPhase !== 'mission_execution' || !currentUserIsOnMission || currentUserRole !== Role.Undercover) {
      toast({ title: "错误", description: "当前无法打出比赛牌。", variant: "destructive" });
      return;
    }
    const existingPlay = room.missionCardPlaysForCurrentMission?.find(p => p.playerId === user.id);
    if (existingPlay) {
      toast({ title: "已行动", description: "您已在本轮比赛中行动过。", variant: "default" });
      return;
    }
    setHumanUndercoverCardChoice(card); // Update local state for immediate UI feedback
    const newPlay: MissionCardPlay = { playerId: user.id, card };
    await updateFirestoreRoom({
      missionCardPlaysForCurrentMission: arrayUnion(newPlay) as any
    });
    toast({ title: "比赛牌已打出", description: `你打出了【${card === 'success' ? '成功' : '破坏'}】。` });
  };

  // Proceed to next round or game over after mission reveal
  const handleProceedToNextRoundOrGameOver = async () => {
    if (!room || !room.teamScores || room.currentRound === undefined || room.totalRounds === undefined || !(room.players?.length)) return;
    const playersInRoom = room.players;
    let updates: Partial<GameRoom> = {};
    let gameIsOver = false;
    let nextPhase: GameRoomPhase = 'team_selection'; // Default next phase

    // Check for game end conditions based on mission wins
    if (room.teamScores.teamMemberWins >= 3 && room.teamScores.teamMemberWins > room.teamScores.undercoverWins) {
      const humanUndercovers = playersInRoom.filter(p => p.role === Role.Undercover && !p.id.startsWith("virtual_"));
      if (humanUndercovers.length > 0 && room.players.some(p => p.role === Role.Coach)) { // Coach assassination only if Coach role exists
        nextPhase = 'coach_assassination';
        toast({ title: "战队方胜利在望!", description: "卧底现在有一次指认教练的机会来反败为胜。" });
      } else {
        gameIsOver = true;
        nextPhase = 'game_over';
        toast({ title: "战队方获胜!", description: "卧底方无力回天或无教练可指认。" });
      }
    } else if (room.teamScores.undercoverWins >= 3 && room.teamScores.undercoverWins > room.teamScores.teamMemberWins) {
      gameIsOver = true;
      nextPhase = 'game_over';
      toast({ title: "卧底方获胜!", description: "卧底方已完成3场比赛。" });
    } else if (room.currentRound >= room.totalRounds) { // All rounds completed
      gameIsOver = true;
      nextPhase = 'game_over';
      toast({ title: "所有比赛结束!", description: "根据胜场决定最终胜负。" });
    }

    if (gameIsOver) {
      updates = {
        status: GameRoomStatus.Finished,
        currentPhase: 'game_over',
        missionOutcomeForDisplay: deleteField() as unknown as MissionOutcome,
        failCardsPlayedForDisplay: deleteField() as unknown as number,
        generatedFailureReason: deleteField() as unknown as GeneratedFailureReason,
        teamVotes: room.teamVotes, // Persist last team votes
      };
      const finalRoomState = { ...room, ...updates, currentPhase: nextPhase } as GameRoom;
      saveGameRecordForAllPlayers(finalRoomState);
      await updateFirestoreRoom(updates);
    } else if (nextPhase === 'coach_assassination') {
      await updateFirestoreRoom({
        currentPhase: 'coach_assassination',
        missionOutcomeForDisplay: deleteField() as unknown as MissionOutcome,
        failCardsPlayedForDisplay: deleteField() as unknown as number,
        generatedFailureReason: deleteField() as unknown as GeneratedFailureReason,
        teamVotes: room.teamVotes, // Persist last team votes
      });
    } else { // Proceed to next round
      const nextRoundNumber = room.currentRound + 1;
      const currentCaptainIndex = playersInRoom.findIndex(p => p.id === room.currentCaptainId);
      const nextCaptainIndex = (currentCaptainIndex + 1) % playersInRoom.length;
      const newCaptainId = playersInRoom[nextCaptainIndex].id;

      updates = {
        currentRound: nextRoundNumber,
        currentCaptainId: newCaptainId,
        captainChangesThisRound: 0,
        currentPhase: 'team_selection',
        selectedTeamForMission: [],
        teamVotes: [], // Clear votes for new round
        missionCardPlaysForCurrentMission: [],
        missionOutcomeForDisplay: deleteField() as unknown as MissionOutcome,
        failCardsPlayedForDisplay: deleteField() as unknown as number,
        generatedFailureReason: deleteField() as unknown as GeneratedFailureReason,
      };
      await updateFirestoreRoom(updates);
      setSelectedMissionTeam([]);
      setHumanUndercoverCardChoice(null);
      setSelectedCoachCandidate(null);
      toast({ title: `第 ${nextRoundNumber} 场比赛开始`, description: `队长是 ${playersInRoom.find(p => p.id === newCaptainId)?.name}` });
    }
  };

  // Confirm coach assassination attempt
  const handleConfirmCoachAssassination = async () => {
    if (!room || !user || !selectedCoachCandidate || currentUserRole !== Role.Undercover || room.currentPhase !== 'coach_assassination' || !(room.players?.length)) {
      toast({ title: "错误", description: "无法确认指认。", variant: "destructive" });
      return;
    }
    const playersInRoom = room.players;
    const actualCoach = playersInRoom.find(p => p.role === Role.Coach);
    if (!actualCoach) {
      toast({ title: "游戏错误", description: "未找到教练角色。", variant: "destructive" });
      const finalRoomStateForError: Partial<GameRoom> = { status: GameRoomStatus.Finished, currentPhase: 'game_over', teamScores: room.teamScores };
      saveGameRecordForAllPlayers({ ...room, ...finalRoomStateForError } as GameRoom);
      await updateFirestoreRoom(finalRoomStateForError);
      return;
    }

    let toastTitle = "";
    let toastDescription = "";
    let finalTeamScores = { ...(room.teamScores || { teamMemberWins: 0, undercoverWins: 0 }) };

    if (selectedCoachCandidate === actualCoach.id) {
      toastTitle = "指认成功！卧底方反败为胜！";
      toastDescription = `${playersInRoom.find(p => p.id === actualCoach.id)?.name || '教练'} 是教练！`;
      // Undercover wins, TeamMember score should not reflect a win if they had 3
      if (finalTeamScores.teamMemberWins >=3) finalTeamScores.teamMemberWins = 2; 
      // Undercover score remains as is based on missions, the win is by assassination.
    } else {
      toastTitle = "指认失败！战队方获胜！";
      toastDescription = `${playersInRoom.find(p => p.id === selectedCoachCandidate)?.name || '目标'} 不是教练。实际教练是 ${actualCoach.name}。`;
      // TeamMember win is confirmed by failed assassination
    }

    const finalUpdates: Partial<GameRoom> = {
      status: GameRoomStatus.Finished,
      currentPhase: 'game_over',
      coachCandidateId: selectedCoachCandidate,
      teamScores: finalTeamScores,
      teamVotes: room.teamVotes, // Persist last team votes
    };
    saveGameRecordForAllPlayers({ ...room, ...finalUpdates } as GameRoom);
    await updateFirestoreRoom(finalUpdates);
    toast({ title: toastTitle, description: toastDescription, duration: 5000 });
    setSelectedCoachCandidate(null);
  };

  const handleReturnToLobbyAndLeaveRoom = useCallback(async () => {
    if (!user) {
      router.push("/");
      return;
    }
    const currentRoomId = typeof roomId === 'string' ? roomId : null;
    const currentRoomName = room?.name || "一个房间";

    if (currentRoomId && room && db) {
      const roomRef = doc(db, "rooms", currentRoomId);
      if (user.id === room.hostId && room.status === GameRoomStatus.Waiting) {
        try {
          await deleteDoc(roomRef);
          toast({ title: "房间已关闭", description: `您作为主持人已离开并关闭了等待中的房间 ${currentRoomName}。` });
        } catch (e) {
          console.error("Failed to delete room:", e);
          toast({ title: "关闭房间失败", description: `无法关闭房间 ${currentRoomName}。`, variant: "destructive" });
        }
      } else if (room.players.some(p => p.id === user.id)) {
        const playerObjectInRoom = room.players.find(p => p.id === user.id);
        if (playerObjectInRoom) {
          const cleanedPlayerObject: Partial<Player> = {
            id: playerObjectInRoom.id,
            name: playerObjectInRoom.name,
          };
          if (playerObjectInRoom.avatarUrl) cleanedPlayerObject.avatarUrl = playerObjectInRoom.avatarUrl;
          if (playerObjectInRoom.role) cleanedPlayerObject.role = playerObjectInRoom.role;

          try {
            await updateDoc(roomRef, {
              players: arrayRemove(cleanedPlayerObject)
            });
            toast({ title: "已离开房间", description: `您已离开房间 ${currentRoomName}。` });
          } catch (e) {
            console.error("Failed to update Firestore on leave:", e, "Attempted to remove:", cleanedPlayerObject);
            toast({ title: "离开房间失败", description: `无法从房间 ${currentRoomName} 移除您。`, variant: "destructive" });
          }
        }
      }
    }
    router.push("/");
  }, [room, user, router, toast, roomId]);

  const handleRestartGame = async () => {
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
      const playerObject: Partial<Player> = {
        id: p.id,
        name: p.name,
      };
      if (p.avatarUrl) playerObject.avatarUrl = p.avatarUrl;
      // Role is intentionally omitted to be reassigned
      return playerObject as Player; // Cast as Player, role will be undefined
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
      currentCaptainId: deleteField() as unknown as string,
      currentRound: deleteField() as unknown as number,
      captainChangesThisRound: deleteField() as unknown as number,
      currentPhase: deleteField() as unknown as GameRoomPhase,
      missionOutcomeForDisplay: deleteField() as unknown as MissionOutcome,
      failCardsPlayedForDisplay: deleteField() as unknown as number,
      coachCandidateId: deleteField() as unknown as string,
      generatedFailureReason: deleteField() as unknown as GeneratedFailureReason,
    };
    await updateFirestoreRoom(updates);
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

  const handleForceEndGame = async () => {
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
      teamVotes: room.teamVotes, // Persist current votes
    };
    const finalRoomState = { ...room, ...finalUpdates, currentPhase: 'game_over' } as GameRoom;
    saveGameRecordForAllPlayers(finalRoomState);
    await updateFirestoreRoom(finalUpdates);
    toast({ title: "游戏已结束", description: "主持人已强制结束本场游戏。" });
    setShowTerminateConfirmDialog(false);
  };

  const handleRemoveVirtualPlayer = async (virtualPlayerId: string) => {
    if (!room || !user || room.hostId !== user.id || room.status !== GameRoomStatus.Waiting) {
      toast({ title: "操作无效", description: "当前无法移除虚拟玩家。", variant: "destructive" });
      return;
    }
    const playerToRemove = room.players.find(p => p.id === virtualPlayerId);
    if (!playerToRemove || !playerToRemove.id.startsWith("virtual_")) {
      toast({ title: "错误", description: "未找到指定的虚拟玩家。", variant: "destructive" });
      return;
    }

    // Construct the object to remove, ensuring only defined properties are included
    const objectToRemove: Partial<Player> = { id: playerToRemove.id, name: playerToRemove.name };
    if (playerToRemove.avatarUrl) objectToRemove.avatarUrl = playerToRemove.avatarUrl;
    // Role is typically not set in waiting phase, but include if present
    if (playerToRemove.role) objectToRemove.role = playerToRemove.role;


    await updateFirestoreRoom({ players: arrayRemove(objectToRemove) as any });
    toast({ title: "虚拟玩家已移除", description: `${playerToRemove.name} 已被移除出房间。` });
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
    switch (phase) {
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
  if (!room || !user) return <div className="text-center py-10 text-destructive">载入房间错误或用户未验证。请尝试返回大厅。</div>;

  const currentUserInRoom = room.players.find(p => p.id === user.id);
  const currentUserRole = currentUserInRoom?.role;
  const isHumanCaptain = user.id === room.currentCaptainId && !user.id.startsWith("virtual_");
  const hasUserVotedOnCurrentTeam = room.teamVotes?.some(v => v.playerId === user.id);

  const missionTeamPlayerObjects = room.selectedTeamForMission?.map(id => room.players.find(p => p.id === id)).filter(Boolean) as Player[] || [];
  const currentUserIsOnMission = !!room.selectedTeamForMission?.includes(user.id);
  const currentUserHasPlayedMissionCard = room.missionCardPlaysForCurrentMission?.some(p => p.playerId === user.id);
  const requiredPlayersForCurrentMission = room.missionPlayerCounts && room.currentRound !== undefined && room.currentRound > 0 && room.missionPlayerCounts.length >= room.currentRound ? room.missionPlayerCounts[room.currentRound - 1] : 0;
  const isHost = user.id === room.hostId;
  const canAddVirtualPlayer = isHost && room.status === GameRoomStatus.Waiting && room.players.length < room.maxPlayers;
  const canStartGame = isHost && room.status === GameRoomStatus.Waiting && room.players.length >= MIN_PLAYERS_TO_START && room.players.length <= room.maxPlayers;

  const knownUndercoversByCoach = (currentUserRole === Role.Coach && room.status === GameRoomStatus.InProgress) ? room.players.filter(p => p.role === Role.Undercover) : [];
  const fellowUndercovers = (currentUserRole === Role.Undercover && room.status === GameRoomStatus.InProgress) ? room.players.filter(p => p.role === Role.Undercover && p.id !== user.id) : [];
  const isSoleUndercover = currentUserRole === Role.Undercover && room.status === GameRoomStatus.InProgress && room.players.filter(p => p.role === Role.Undercover).length === 1;

  const votesToDisplay = room.teamVotes || [];
  const missionPlaysToDisplay = room.missionCardPlaysForCurrentMission || [];

  let assassinationTargetOptions: Player[] = [];
  if (room.status === GameRoomStatus.InProgress && room.currentPhase === 'coach_assassination' && currentUserRole === Role.Undercover) {
    const successfulCaptainIds = new Set(
      (room.missionHistory || [])
        .filter(mission => mission.outcome === 'success')
        .map(mission => mission.captainId)
    );

    assassinationTargetOptions = room.players.filter(p => {
      if (!successfulCaptainIds.has(p.id)) return false; // Must have been a captain of a successful mission
      if (p.id === user.id) return false; // Cannot target self
      if (p.role === Role.Undercover) return false; // Cannot target other undercovers
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
    } else if (room.currentRound && room.totalRounds && room.currentRound > room.totalRounds) { // All rounds done, decide by score
      if (undercoverMissionWins > teamMemberMissionWins) {
        gameOverMessageNode = <span className="text-destructive">卧底阵营胜利! (比赛结束时胜场较多)</span>;
      } else if (teamMemberMissionWins > undercoverMissionWins) {
        gameOverMessageNode = <span className="text-green-600">战队阵营胜利! (比赛结束时胜场较多)</span>;
      } else {
        gameOverMessageNode = <span className="text-foreground">游戏平局! (比分 {teamMemberMissionWins} : {undercoverMissionWins})</span>;
      }
    } else { // Should ideally not be reached if other conditions are comprehensive
      gameOverMessageNode = <span className="text-foreground">游戏已结束. (最终比分 战队 {teamMemberMissionWins} : 卧底 {undercoverMissionWins})</span>;
    }
  }

  const totalHumanPlayersInRoom = room.players.filter(p => !p.id.startsWith("virtual_")).length;


  return (
    <div className="space-y-6">
      <RoomHeader
        room={room}
        localPlayers={room.players}
        getPhaseDescription={getPhaseDescription}
        isHost={isHost}
        onPromptTerminateGame={requestForceEndGame}
      />

      <RoleAlerts
        currentUserRole={currentUserRole}
        roomStatus={room.status}
        knownUndercoversByCoach={knownUndercoversByCoach}
        fellowUndercovers={fellowUndercovers}
        isSoleUndercover={isSoleUndercover}
      />

      <div className="grid md:grid-cols-3 gap-6">
        <PlayerListPanel
          localPlayers={room.players}
          user={user}
          room={room}
          currentUserRole={currentUserRole}
          votesToDisplay={votesToDisplay}
          missionPlaysToDisplay={missionPlaysToDisplay}
          getRoleIcon={getRoleIcon}
          fellowUndercovers={fellowUndercovers}
          knownUndercoversByCoach={knownUndercoversByCoach}
          isSelectionModeActive={room.currentPhase === 'team_selection' && isHumanCaptain}
          selectedPlayersForMission={selectedMissionTeam}
          onTogglePlayerForMission={handlePlayerSelectionForMission}
          selectionLimitForMission={requiredPlayersForCurrentMission}
          isCoachAssassinationModeActive={room.currentPhase === 'coach_assassination' && currentUserRole === Role.Undercover}
          selectedCoachCandidateId={selectedCoachCandidate}
          onSelectCoachCandidate={setSelectedCoachCandidate}
          assassinationTargetOptionsPlayerIds={assassinationTargetOptions.map(p => p.id)}
          onRemoveVirtualPlayer={isHost ? handleRemoveVirtualPlayer : undefined}
        />

        <div className="md:col-span-2 space-y-4"> 
            {room.status === GameRoomStatus.InProgress && room.currentPhase && (
            <Card className="shadow-md">
              <CardHeader>
                 {/* Removed round/captain attempt display from here */}
              </CardHeader>
              <CardContent className="pt-6">
                {room.currentPhase === 'team_selection' && (
                  <TeamSelectionControls
                    isHumanCaptain={isHumanCaptain}
                    currentCaptainName={room.players.find(p => p.id === room.currentCaptainId)?.name}
                    requiredPlayersForCurrentMission={requiredPlayersForCurrentMission}
                    selectedMissionTeamLength={selectedMissionTeam.length}
                    onHumanProposeTeam={handleHumanProposeTeam}
                  />
                )}

                {room.currentPhase === 'team_voting' && (
                  <TeamVotingControls
                    votesToDisplay={votesToDisplay}
                    hasUserVotedOnCurrentTeam={hasUserVotedOnCurrentTeam}
                    isCurrentUserVirtual={user.id.startsWith("virtual_")}
                    onPlayerVote={handlePlayerVote}
                    userVote={room.teamVotes?.find(v => v.playerId === user.id)?.vote}
                    totalPlayerCountInRoom={room.players.length}
                    totalHumanPlayersInRoom={totalHumanPlayersInRoom}
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
                    generatedFailureReason={room.generatedFailureReason}
                    onProceedToNextRoundOrGameOver={handleProceedToNextRoundOrGameOver}
                  />
                )}

                {room.currentPhase === 'coach_assassination' && (
                  <CoachAssassinationControls
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
                    isHost={isHost}
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
              isHost={isHost}
              onRestartGame={handleRestartGame}
            />
          )}

          { (room.status === GameRoomStatus.InProgress || room.status === GameRoomStatus.Finished) &&
            room.fullVoteHistory && room.fullVoteHistory.length > 0 && (
              <VoteHistoryAccordion
                room={room}
                localPlayers={room.players}
                getRoleIcon={getRoleIcon}
                totalRounds={TOTAL_ROUNDS_PER_GAME}
              />
            )}
        </div>
      </div>
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
