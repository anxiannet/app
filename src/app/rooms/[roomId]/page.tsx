
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
import { Crown, Users, Play, Info, Swords, Shield, HelpCircle, UserPlus, Eye, UsersRound, ListChecks, Vote, ShieldCheck, ShieldX, ThumbsUp, ThumbsDown, CheckCircle2, XCircle, Zap, Target, History, RotateCcw, XOctagon, LogOut, Brain } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
import { Card, CardContent, CardHeader } from "@/components/ui/card";

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

import { db } from "@/lib/firebase";
import { doc, updateDoc, arrayUnion, arrayRemove, serverTimestamp, Timestamp, deleteField, deleteDoc } from "firebase/firestore";
import { generateFailureReason } from "@/ai/flows/generate-failure-reason-flow";
import { decideVirtualPlayerVote, type VirtualPlayerVoteInput } from "@/ai/flows/decide-virtual-player-action-flow";
import { decideAiTeamProposal, type AiProposeTeamInput } from "@/ai/flows/propose-team-flow";
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
  const [isAiActing, setIsAiActing] = useState(false);


  const updateFirestoreRoom = useCallback(async (rawUpdatedFields: Partial<GameRoom>) => {
    if (!roomId || typeof roomId !== 'string') return;
    const roomRef = doc(db, "rooms", roomId);
  
    const cleanedUpdates: {[key: string]: any} = {};
    for (const key in rawUpdatedFields) {
      if (Object.prototype.hasOwnProperty.call(rawUpdatedFields, key)) {
        const value = rawUpdatedFields[key as keyof GameRoom];
        if (value !== undefined) { 
           cleanedUpdates[key as keyof GameRoom] = value;
        }
      }
    }
      
    if (Object.keys(cleanedUpdates).length === 0) {
        const hasDeleteField = Object.values(rawUpdatedFields).some(val => 
            val && typeof val === 'object' && 'type' in val && (val as any).type === 'delete'
        );
        if (!hasDeleteField) {
            console.warn("updateFirestoreRoom called with no actual changes (all values were undefined or no changes). Skipping update. Original updates:", rawUpdatedFields);
            return;
        }
    }
  
    try {
      await updateDoc(roomRef, cleanedUpdates);
    } catch (error) {
      console.error("Error updating room in Firestore:", error, "Attempted (cleaned) updates:", cleanedUpdates, "Original updates:", rawUpdatedFields);
      toast({ title: "更新房间失败", description: `无法在服务器上更新房间状态。Error: ${(error as Error).message}`, variant: "destructive" });
    }
  }, [roomId, toast]);

  useEffect(() => {
    if (room && room.selectedTeamForMission) {
      setSelectedMissionTeam(room.selectedTeamForMission);
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
          const playerDetail: {id: string; name: string; role: Role; avatarUrl?: string} = { 
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
    setIsAiActing(false); 
    let finalPlays: MissionCardPlay[] = [...(room.missionCardPlaysForCurrentMission || [])];
    const playersInRoom = room.players;

    room.selectedTeamForMission.forEach(playerId => {
      const player = playersInRoom.find(p => p.id === playerId);
      if (player && player.id.startsWith("virtual_") && !finalPlays.some(fp => fp.playerId === playerId)) {
        const cardToPlay: 'success' | 'fail' = player.role === Role.Undercover ? 'fail' : 'success'; 
        finalPlays.push({ playerId: player.id, card: cardToPlay });
      }
    });

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
    
    const missionRecordData: Omit<Mission, 'generatedFailureReason' | 'cardPlays'> & { generatedFailureReason?: GeneratedFailureReason; cardPlays: MissionCardPlay[] } = {
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
        // missionCardPlaysForCurrentMission: finalPlays, // Keep this if you want to show who played what during reveal, but usually cleared
        generatedFailureReason: aiGeneratedFailureReason || deleteField(),
      });
    toast({ title: `第 ${room.currentRound} 场比赛结束`, description: `结果: ${outcome === 'success' ? '成功' : '失败'}${outcome === 'fail' && aiGeneratedFailureReason ? ` (${aiGeneratedFailureReason.narrativeSummary})` : ''}`});
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

    if (humanPlayersOnMission.length === 0 && missionTeamPlayerIds.length > 0) { 
      const timer = setTimeout(() => finalizeAndRevealMissionOutcome(), 1000); 
      return () => clearTimeout(timer);
    }

    const humanActionsRecorded = room.missionCardPlaysForCurrentMission?.filter(play => humanPlayersOnMission.includes(play.playerId)).length || 0;

    if (humanActionsRecorded === humanPlayersOnMission.length && humanPlayersOnMission.length > 0) {
      finalizeAndRevealMissionOutcome();
    }
  }, [room, user, finalizeAndRevealMissionOutcome]);


  const createPlayerPerspective = useCallback((targetPlayer: Player, viewerRole: Role, allPlayers: Player[]) => {
    let roleToShow = undefined;
    if (targetPlayer.id === user?.id) {
        roleToShow = targetPlayer.role; // Player always knows their own role
    } else {
        if (viewerRole === Role.Coach && targetPlayer.role === Role.Undercover) {
            roleToShow = Role.Undercover;
        } else if (viewerRole === Role.Undercover && targetPlayer.role === Role.Undercover) {
            roleToShow = Role.Undercover;
        }
    }
    return { id: targetPlayer.id, name: targetPlayer.name, role: roleToShow };
  }, [user?.id]);


  // AI Captain Proposes Team
  useEffect(() => {
    if (!room || !user || room.status !== GameRoomStatus.InProgress || room.currentPhase !== 'team_selection' || !(room.players?.length) || isAiActing) {
      return;
    }
    const playersInRoom = room.players;
    const currentCaptain = playersInRoom.find(p => p.id === room.currentCaptainId);

    if (currentCaptain && currentCaptain.id.startsWith("virtual_")) {
      const performAiCaptainTeamProposal = async () => {
        if (!room.currentRound || !room.missionPlayerCounts || !playersInRoom.length || (room.captainChangesThisRound  || 0) >= (room.maxCaptainChangesPerRound || MAX_CAPTAIN_CHANGES_PER_ROUND) || !currentCaptain.role) return;
        
        setIsAiActing(true);
        toast({description: `${currentCaptain.name} (虚拟玩家) 正在选择队伍...`});

        const aiInput: AiProposeTeamInput = {
            virtualCaptain: { id: currentCaptain.id, name: currentCaptain.name, role: currentCaptain.role },
            gameContext: {
                currentRound: room.currentRound,
                requiredPlayersForMission: room.missionPlayerCounts[room.currentRound -1],
                allPlayers: playersInRoom.map(p => createPlayerPerspective(p, currentCaptain.role!, playersInRoom)),
                missionHistory: (room.missionHistory || []).map(mh => ({
                  ...mh,
                  cardPlays: mh.cardPlays.map(cp => ({
                    ...cp,
                    // Reveal roles in cardPlays based on AI's perspective
                    role: playersInRoom.find(p=> p.id === cp.playerId)?.role === Role.Undercover && (currentCaptain.role === Role.Coach || currentCaptain.role === Role.Undercover) ? Role.Undercover : undefined
                  }))
                })),
                teamScores: room.teamScores || { teamMemberWins: 0, undercoverWins: 0 },
                missionPlayerCounts: room.missionPlayerCounts,
                captainChangesThisRound: room.captainChangesThisRound || 0,
                maxCaptainChangesPerRound: room.maxCaptainChangesPerRound || MAX_CAPTAIN_CHANGES_PER_ROUND,
            }
        };
        
        try {
            const aiDecision = await decideAiTeamProposal(aiInput);
            console.log("AI Captain Proposal:", aiDecision);
            
            await updateFirestoreRoom({
                selectedTeamForMission: aiDecision.selectedPlayerIds,
                currentPhase: 'team_voting',
                teamVotes: [], 
            });
            toast({ title: "虚拟队长已提议", description: `${currentCaptain.name} 提议队伍: ${aiDecision.selectedPlayerIds.map(id => playersInRoom.find(p=>p.id===id)?.name).join(', ')}`});
            setSelectedMissionTeam([]); 
        } catch (error) {
            console.error("Error in AI team proposal, defaulting:", error);
            // Fallback: random selection if AI flow fails
            let proposedTeamIds = [currentCaptain.id];
            const otherPlayerIds = playersInRoom.filter(p => p.id !== currentCaptain.id).map(p => p.id);
            const shuffledOtherPlayers = [...otherPlayerIds].sort(() => 0.5 - Math.random());
            const requiredPlayers = room.missionPlayerCounts[room.currentRound -1];
            while (proposedTeamIds.length < requiredPlayers && shuffledOtherPlayers.length > 0) {
                proposedTeamIds.push(shuffledOtherPlayers.shift()!);
            }
             proposedTeamIds = proposedTeamIds.slice(0, requiredPlayers);

            await updateFirestoreRoom({
                selectedTeamForMission: proposedTeamIds,
                currentPhase: 'team_voting',
                teamVotes: [],
            });
            toast({ title: "虚拟队长已提议 (备用)", description: `${currentCaptain.name} 提议队伍 (随机).`});
        } finally {
            setIsAiActing(false);
        }
      };
      const timer = setTimeout(performAiCaptainTeamProposal, 1500 + Math.random() * 1500); 
      return () => clearTimeout(timer);
    }
  }, [room, user, toast, updateFirestoreRoom, createPlayerPerspective, isAiActing]);


  const assignRolesAndCaptain = async () => {
    if (!room || !(room.players?.length) || room.players.length < MIN_PLAYERS_TO_START) return;
    const currentPlayers = room.players;
    const playerCount = currentPlayers.length;
    const config = ROLES_CONFIG[playerCount] || ROLES_CONFIG[Math.max(...Object.keys(ROLES_CONFIG).map(Number).filter(k => !isNaN(k)))]; // Ensure keys are numbers
    let rolesToAssign: Role[] = [];
    Object.entries(config).forEach(([role, count]) => {
      for (let i = 0; i < count; i++) rolesToAssign.push(role as Role);
    });
    while(rolesToAssign.length < playerCount) rolesToAssign.push(Role.TeamMember); 
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
    const missionPlayerCounts = MISSIONS_CONFIG[playerCount] || MISSIONS_CONFIG[Object.keys(MISSIONS_CONFIG).map(Number).sort((a,b)=> a-b)[0]];
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
        toast({title: "人数已达上限", description: `本轮比赛只需要 ${requiredPlayers} 名玩家。`, variant: "default"});
        return prevSelected;
      }
    });
  };

  const processTeamVotes = useCallback(async (currentVotes: PlayerVote[]) => {
    if (!room || !user || !(room.players?.length) || !room.teamScores || room.currentRound === undefined || room.currentCaptainId === undefined) return;
    setIsAiActing(false); 
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
    const updatedFullVoteHistoryFirestore = arrayUnion(newVoteLogEntry);

    if (voteOutcome === 'approved') {
      const currentSelectedTeam = room.selectedTeamForMission || [];
      const autoPlays: MissionCardPlay[] = []; 
      currentSelectedTeam.forEach(playerId => {
        const player = playersInRoom.find(p => p.id === playerId);
        if (player && !player.id.startsWith("virtual_") && (player.role === Role.TeamMember || player.role === Role.Coach)) {
          if (!room.missionCardPlaysForCurrentMission?.some(p => p.playerId === playerId)) {
            autoPlays.push({ playerId: player.id, card: 'success' });
          }
        }
      });

      await updateFirestoreRoom({
          currentPhase: 'mission_execution', 
          captainChangesThisRound: 0, 
          missionCardPlaysForCurrentMission: autoPlays, 
          fullVoteHistory: updatedFullVoteHistoryFirestore as any,
          // teamVotes will be cleared when next team_selection phase starts
      });
      setHumanUndercoverCardChoice(null); 

    } else { // Team Rejected
      let newCaptainChangesThisRound = (room.captainChangesThisRound || 0) + 1;
      if (newCaptainChangesThisRound >= (room.maxCaptainChangesPerRound || MAX_CAPTAIN_CHANGES_PER_ROUND)) {
        const finalTeamScores = { ...(room.teamScores || {teamMemberWins: 0, undercoverWins: 0}), undercoverWins: room.totalRounds || TOTAL_ROUNDS_PER_GAME }; 
        
        const finalRoomStateForRecord: GameRoom = {
          ...room, 
          status: GameRoomStatus.Finished,
          currentPhase: 'game_over' as GameRoomPhase,
          teamScores: finalTeamScores,
          teamVotes: currentVotes, 
          fullVoteHistory: [...(room.fullVoteHistory || []), newVoteLogEntry], 
          captainChangesThisRound: newCaptainChangesThisRound,
        };
        saveGameRecordForAllPlayers(finalRoomStateForRecord);

        toast({ title: "队伍被拒绝5次!", description: "卧底阵营获胜!", variant: "destructive" });
        await updateFirestoreRoom({ 
            status: GameRoomStatus.Finished,
            currentPhase: 'game_over',
            teamScores: finalTeamScores,
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
            selectedTeamForMission: [], 
            teamVotes: [], 
            fullVoteHistory: updatedFullVoteHistoryFirestore as any,
          });
        setSelectedMissionTeam([]); 
      }
    }
  }, [room, user, toast, saveGameRecordForAllPlayers, updateFirestoreRoom]);

  const handlePlayerVote = async (vote: 'approve' | 'reject') => {
    if (!room || !user || room.currentPhase !== 'team_voting' || !(room.players?.length)) {
      toast({ title: "错误", description: "当前无法投票。", variant: "destructive" }); return;
    }
    const existingVote = room.teamVotes?.find(v => v.playerId === user.id);
    if (existingVote) {
      return; 
    }

    const newVote: PlayerVote = { playerId: user.id, vote };
    await updateFirestoreRoom({ teamVotes: arrayUnion(newVote) as any});
  };

  // AI Player Voting
  useEffect(() => {
    if (!room || !user || room.status !== GameRoomStatus.InProgress || room.currentPhase !== 'team_voting' || !(room.players?.length) || isAiActing) {
      return;
    }
    const playersInRoom = room.players;
    const realPlayers = playersInRoom.filter(p => !p.id.startsWith("virtual_"));
    const currentVotes = room.teamVotes || [];
    const realPlayersWhoVotedIds = new Set(currentVotes.filter(v => realPlayers.some(rp => rp.id === v.playerId)).map(v => v.playerId));

    if (realPlayersWhoVotedIds.size === realPlayers.length) { 
        const virtualPlayers = playersInRoom.filter(p => p.id.startsWith("virtual_"));
        const virtualPlayersWhoHaventVoted = virtualPlayers.filter(vp => !currentVotes.some(v => v.playerId === vp.id));

        if (virtualPlayersWhoHaventVoted.length > 0) {
            const performAiVoting = async () => {
                setIsAiActing(true);
                toast({ description: "虚拟玩家正在投票..." });
                let aiVotesBatch: PlayerVote[] = [];

                for (const vp of virtualPlayersWhoHaventVoted) {
                  if (!vp.role) continue; // Should not happen if roles are assigned
                  const aiInput: VirtualPlayerVoteInput = {
                    virtualPlayer: { id: vp.id, name: vp.name, role: vp.role },
                    gameContext: {
                      currentRound: room.currentRound!,
                      captainId: room.currentCaptainId!,
                      proposedTeamIds: room.selectedTeamForMission || [],
                      allPlayers: playersInRoom.map(p => createPlayerPerspective(p, vp.role!, playersInRoom)),
                      missionHistory: (room.missionHistory || []).map(mh => ({
                        ...mh,
                         cardPlays: mh.cardPlays.map(cp => ({
                           ...cp,
                           role: playersInRoom.find(p=> p.id === cp.playerId)?.role === Role.Undercover && (vp.role === Role.Coach || vp.role === Role.Undercover) ? Role.Undercover : undefined
                         }))
                      })),
                      teamScores: room.teamScores || {teamMemberWins: 0, undercoverWins: 0},
                      captainChangesThisRound: room.captainChangesThisRound || 0,
                      maxCaptainChangesPerRound: room.maxCaptainChangesPerRound || MAX_CAPTAIN_CHANGES_PER_ROUND,
                    }
                  };
                  try {
                    const aiDecision = await decideVirtualPlayerVote(aiInput);
                    console.log(`AI Vote by ${vp.name} (${vp.role}): ${aiDecision.vote}. Reason: ${aiDecision.reasoning}`);
                    aiVotesBatch.push({ playerId: vp.id, vote: aiDecision.vote });
                  } catch (error) {
                    console.error(`Error in AI vote for ${vp.name}, defaulting to approve:`, error);
                    aiVotesBatch.push({ playerId: vp.id, vote: 'approve' }); // Fallback
                  }
                }
                if (aiVotesBatch.length > 0) {
                    await updateFirestoreRoom({ teamVotes: arrayUnion(...aiVotesBatch) as any });
                }
                // AI acting is set to false in processTeamVotes or the useEffect below
            };
            performAiVoting();
        }
    }
  }, [room, user, toast, updateFirestoreRoom, createPlayerPerspective, isAiActing]);

  // Process team votes after all votes (human + virtual) are in
 useEffect(() => {
    let timer: NodeJS.Timeout;
    if (
      room?.currentPhase === 'team_voting' &&
      room.teamVotes &&
      room.players &&
      room.teamVotes.length === room.players.length &&
      room.players.length > 0 &&
      !isAiActing // Only process if AI is not currently voting (to avoid race condition)
    ) {
      // Display results for a short period before processing
      timer = setTimeout(() => {
        // Double check conditions before processing, in case state changed during timeout
        if (room?.currentPhase === 'team_voting' && room.teamVotes && room.players && room.teamVotes.length === room.players.length) { 
           processTeamVotes(room.teamVotes);
        }
      }, 3000); 
    }
    return () => clearTimeout(timer); 
  }, [room?.teamVotes, room?.currentPhase, room?.players, processTeamVotes, isAiActing, room]);


  const handleHumanUndercoverPlayCard = async (card: 'success' | 'fail') => {
    if (!room || !user || room.currentPhase !== 'mission_execution' || !currentUserIsOnMission || currentUserRole !== Role.Undercover ) {
      toast({ title: "错误", description: "当前无法打出比赛牌。", variant: "destructive" });
      return;
    }
    const existingPlay = room.missionCardPlaysForCurrentMission?.find(p => p.playerId === user.id);
    if (existingPlay) {
        return; 
    }
    setHumanUndercoverCardChoice(card); 
    const newPlay: MissionCardPlay = { playerId: user.id, card };
    await updateFirestoreRoom({
        missionCardPlaysForCurrentMission: arrayUnion(newPlay) as any
    });
  };

  const handleProceedToNextRoundOrGameOver = async () => {
    if (!room || !room.teamScores || room.currentRound === undefined || room.totalRounds === undefined || !(room.players?.length)) return;
    const playersInRoom = room.players;
    let updates: Partial<GameRoom> = {};
    let gameIsOver = false;
    let nextPhase: GameRoomPhase = 'team_selection'; 

    if (room.teamScores.teamMemberWins >= 3 && room.teamScores.teamMemberWins > room.teamScores.undercoverWins) {
      const humanUndercovers = playersInRoom.filter(p => p.role === Role.Undercover && !p.id.startsWith("virtual_"));
      if (humanUndercovers.length > 0) { 
        nextPhase = 'coach_assassination';
        toast({ title: "战队方胜利在望!", description: "卧底现在有一次指认教练的机会来反败为胜。" });
      } else { 
        gameIsOver = true;
        nextPhase = 'game_over';
        toast({ title: "战队方获胜!", description: "卧底方无力回天。" });
      }
    } else if (room.teamScores.undercoverWins >= 3 && room.teamScores.undercoverWins > room.teamScores.undercoverWins) { // Bug: undercoverWins > undercoverWins
        gameIsOver = true;
        nextPhase = 'game_over';
        toast({ title: "卧底方获胜!", description: "卧底方已完成3场比赛。" });
    } else if (room.currentRound >= room.totalRounds) { 
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
      };
      const finalRoomState = {...room, ...updates, currentPhase: nextPhase } as GameRoom; 
      saveGameRecordForAllPlayers(finalRoomState); 
      await updateFirestoreRoom(updates);
    } else if (nextPhase === 'coach_assassination') {
        await updateFirestoreRoom({ 
          currentPhase: 'coach_assassination',
          missionOutcomeForDisplay: deleteField() as unknown as MissionOutcome,
          failCardsPlayedForDisplay: deleteField() as unknown as number,
          generatedFailureReason: deleteField() as unknown as GeneratedFailureReason,
        });
    } else { 
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
          teamVotes: [], 
          missionCardPlaysForCurrentMission: [], 
          missionOutcomeForDisplay: deleteField() as unknown as MissionOutcome, 
          failCardsPlayedForDisplay: deleteField() as unknown as number,
          generatedFailureReason: deleteField() as unknown as GeneratedFailureReason,
        };
      await updateFirestoreRoom(updates);
      setSelectedMissionTeam([]);
      setHumanUndercoverCardChoice(null);
      setSelectedCoachCandidate(null);
      toast({ title: `第 ${nextRoundNumber} 场比赛开始`, description: `队长是 ${playersInRoom.find(p=>p.id === newCaptainId)?.name}` });
    }
  };

  const handleConfirmCoachAssassination = async () => {
    if (!room || !user || !selectedCoachCandidate || currentUserRole !== Role.Undercover || room.currentPhase !== 'coach_assassination' || !(room.players?.length)) {
        toast({title: "错误", description: "无法确认指认。", variant: "destructive"});
        return;
    }
    const playersInRoom = room.players;
    const actualCoach = playersInRoom.find(p => p.role === Role.Coach);
    if (!actualCoach) {
      toast({ title: "游戏错误", description: "未找到教练角色。", variant: "destructive" });
      const finalRoomStateForError: Partial<GameRoom> = { status: GameRoomStatus.Finished, currentPhase: 'game_over', teamScores: room.teamScores };
      saveGameRecordForAllPlayers({...room, ...finalRoomStateForError} as GameRoom);
      await updateFirestoreRoom(finalRoomStateForError);
      return;
    }

    let toastTitle = "";
    let toastDescription = "";
    let finalTeamScores = { ...(room.teamScores || { teamMemberWins: 0, undercoverWins: 0 }) };

    if (selectedCoachCandidate === actualCoach.id) {
      toastTitle = "指认成功！卧底方反败为胜！";
      toastDescription = `${playersInRoom.find(p=>p.id === actualCoach.id)?.name || '教练'} 是教练！`;
      // Score adjustment handled by saveGameRecord via winningFaction
    } else {
      toastTitle = "指认失败！战队方获胜！";
      toastDescription = `${playersInRoom.find(p=>p.id === selectedCoachCandidate)?.name || '目标'} 不是教练。`;
      // Score adjustment handled by saveGameRecord
    }

    const finalUpdates: Partial<GameRoom> = {
      status: GameRoomStatus.Finished,
      currentPhase: 'game_over',
      coachCandidateId: selectedCoachCandidate, 
      teamScores: finalTeamScores, // teamScores might be further adjusted by saveGameRecord based on winningFaction
    };
    saveGameRecordForAllPlayers({...room, ...finalUpdates} as GameRoom); // Pass the potentially updated scores
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
              // Roles are not part of the "player" object for removal purposes, they are part of the GameRoom's player list
              
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
        return playerObject as Player; 
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
    };
    const finalRoomState = {...room, ...finalUpdates, currentPhase: 'game_over' } as GameRoom; 
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
    
    const objectToRemove: Partial<Player> = { id: playerToRemove.id, name: playerToRemove.name };
    if (playerToRemove.avatarUrl) objectToRemove.avatarUrl = playerToRemove.avatarUrl;
    
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
  if (!room || !user) return <div className="text-center py-10 text-destructive">载入房间错误或用户未验证。请尝试返回大厅。</div>;

  const localPlayers = room.players || [];
  const currentUserInRoom = localPlayers.find(p => p.id === user.id);
  const currentUserRole = currentUserInRoom?.role;
  const isHumanCaptain = user.id === room.currentCaptainId && !user.id.startsWith("virtual_");
  const hasUserVotedOnCurrentTeam = room.teamVotes?.some(v => v.playerId === user.id);

  const missionTeamPlayerObjects = room.selectedTeamForMission?.map(id => localPlayers.find(p => p.id === id)).filter(Boolean) as Player[] || [];
  const currentUserIsOnMission = !!room.selectedTeamForMission?.includes(user.id);
  const currentUserHasPlayedMissionCard = room.missionCardPlaysForCurrentMission?.some(p => p.playerId === user.id);
  const requiredPlayersForCurrentMission = room.missionPlayerCounts && room.currentRound !== undefined && room.currentRound > 0 && room.missionPlayerCounts.length >= room.currentRound  ? room.missionPlayerCounts[room.currentRound -1] : 0;
  const isHost = user.id === room.hostId;
  const canAddVirtualPlayer = isHost && room.status === GameRoomStatus.Waiting && localPlayers.length < room.maxPlayers;
  const canStartGame = isHost && room.status === GameRoomStatus.Waiting && localPlayers.length >= MIN_PLAYERS_TO_START && localPlayers.length <= room.maxPlayers;

  const knownUndercoversByCoach = (currentUserRole === Role.Coach && room.status === GameRoomStatus.InProgress) ? localPlayers.filter(p => p.role === Role.Undercover) : [];
  const fellowUndercovers = (currentUserRole === Role.Undercover && room.status === GameRoomStatus.InProgress) ? localPlayers.filter(p => p.role === Role.Undercover && p.id !== user.id) : [];
  const isSoleUndercover = currentUserRole === Role.Undercover && room.status === GameRoomStatus.InProgress && localPlayers.filter(p => p.role === Role.Undercover).length === 1;

  const votesToDisplay = room.teamVotes || [];
  const missionPlaysToDisplay = room.missionCardPlaysForCurrentMission || [];

  const assassinationTargetOptions = localPlayers.filter(p => {
    if (currentUserRole !== Role.Undercover) return false;
    if (p.id === user.id) return false; 
    if (fellowUndercovers.some(fu => fu.id === p.id)) return false; 
    return true;
  });

  let gameOverMessageNode: React.ReactNode = "游戏结束!";
  if (room.status === GameRoomStatus.Finished) {
    // This logic is now largely handled by saveGameRecordForAllPlayers and the resulting gameSummaryMessage
    // The gameOverMessageNode here can be simplified or use the saved gameSummary if we decide to fetch it post-game.
    // For now, let's use a generic approach and the GameSummary component will use the direct props from room.
    const teamMemberWins = room.teamScores?.teamMemberWins || 0;
    const undercoverWins = room.teamScores?.undercoverWins || 0;

    if (room.coachCandidateId && localPlayers.find(p => p.role === Role.Coach)) {
        const actualCoach = localPlayers.find(p => p.role === Role.Coach);
        if (room.coachCandidateId === actualCoach?.id) {
             gameOverMessageNode = <span className="text-destructive">卧底阵营胜利! (通过指认教练)</span>;
        } else {
             gameOverMessageNode = <span className="text-green-600">指认失败，战队方获胜</span>;
        }
    } else if (undercoverWins >=3 && undercoverWins > teamMemberWins ) {
        gameOverMessageNode = <span className="text-destructive">卧底阵营胜利! (通过完成比赛)</span>;
    } else if (teamMemberWins >=3 && teamMemberWins > undercoverWins ) {
        gameOverMessageNode = <span className="text-green-600">战队阵营胜利! (通过完成比赛)</span>;
    }  else if (room.captainChangesThisRound && room.maxCaptainChangesPerRound && room.captainChangesThisRound >= room.maxCaptainChangesPerRound) {
        gameOverMessageNode = <span className="text-destructive">卧底阵营胜利! (由于队伍连续5次组队失败)</span>;
    } else if (room.currentRound && room.totalRounds && room.currentRound > room.totalRounds) {
         if (undercoverWins > teamMemberWins) {
            gameOverMessageNode = <span className="text-destructive">卧底阵营胜利! (比赛结束时胜场较多)</span>;
        } else if (teamMemberWins > undercoverWins) {
            gameOverMessageNode = <span className="text-green-600">战队阵营胜利! (比赛结束时胜场较多)</span>;
        } else {
             gameOverMessageNode = <span className="text-foreground">游戏平局! (比分 {teamMemberWins} : {undercoverWins})</span>;
        }
    } else {
        gameOverMessageNode = <span className="text-foreground">游戏已结束. (最终比分 战队 {teamMemberWins} : 卧底 {undercoverWins})</span>;
    }
  }


  return (
    <div className="space-y-6">
      <RoomHeader
        room={room}
        localPlayers={localPlayers}
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
       {isAiActing && (
        <div className="flex items-center justify-center text-sm text-muted-foreground p-2 bg-muted/50 rounded-md shadow-sm">
          <Brain className="mr-2 h-4 w-4 animate-pulse text-primary" />
          AI 正在行动...
        </div>
      )}

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
                <CardHeader className="pb-4">
                  {/* Removed round/attempt info from here, it's in RoomHeader if needed or can be re-added if context is lost */}
                </CardHeader>
                <CardContent>
                  {room.currentPhase === 'team_selection' && (
                      <TeamSelectionControls
                          currentCaptainName={localPlayers.find(p => p.id === room.currentCaptainId)?.name}
                          isHumanCaptain={isHumanCaptain}
                          isAiActing={isAiActing}
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
                          userVote={room.teamVotes?.find(v=>v.playerId === user.id)?.vote}
                          totalPlayerCountInRoom={localPlayers.length}
                          isAiVoting={isAiActing && localPlayers.some(p=> p.id.startsWith("virtual_") && !room.teamVotes?.find(v=>v.playerId === p.id))}
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
                    localPlayersLength={localPlayers.length}
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
                    localPlayers={localPlayers}
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
                    localPlayers={localPlayers}
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
