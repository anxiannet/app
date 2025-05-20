
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { type GameRoom, type Player, Role, GameRoomStatus, type GameRoomPhase, type Mission, type PlayerVote, type MissionCardPlay, type MissionOutcome, type VoteHistoryEntry, type PlayerGameRecord, type WinningFactionType, type GeneratedFailureReason } from "@/lib/types";
import { Crown, Users, Play, Info, Swords, Shield, HelpCircle, UserPlus, Eye, UsersRound, ListChecks, Vote, ShieldCheck, ShieldX, ThumbsUp, ThumbsDown, CheckCircle2, XCircle, Zap, Target, History, RotateCcw, XOctagon, LogOut, Brain } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

import { db } from "@/lib/firebase"; // Firebase client SDK
import { doc, getDoc, updateDoc, onSnapshot, arrayUnion, arrayRemove, serverTimestamp, Timestamp, deleteField, deleteDoc, type Unsubscribe } from "firebase/firestore";
import { generateFailureReason } from "@/ai/flows/generate-failure-reason-flow";


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
  7: [2, 3, 3, 4, 4], // Rule: Round 4 with 7+ players needs 2 fail cards
  8: [3, 4, 4, 5, 5], // Rule: Round 4 with 7+ players needs 2 fail cards
  9: [3, 4, 4, 5, 5], // Rule: Round 4 with 7+ players needs 2 fail cards
  10: [3, 4, 4, 5, 5], // Rule: Round 4 with 7+ players needs 2 fail cards
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

// Duplicated for fallback in case the AI flow call itself fails
const FAILURE_REASONS_LIST_FOR_FALLBACK = [
  "阵容不合理", "节奏不同步", "资源利用差", "频繁送头", "技能释放错误", "经济差距",
  "盲目开团 / 不开团", "视野不足", "判断失误", "挂机、演员、互喷",
  "指责队友导致配合断裂", "网络卡顿 / 延迟高", "掉线、闪退", "匹配机制不平衡"
];


export default function GameRoomPage() {
  const params = useParams();
  const router = useRouter();
  const { roomId } = params;
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [room, setRoom] = useState<GameRoom | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const localPlayers = room?.players || [];

  const [selectedMissionTeam, setSelectedMissionTeam] = useState<string[]>([]);
  const [humanUndercoverCardChoice, setHumanUndercoverCardChoice] = useState<'success' | 'fail' | null>(null);
  const [selectedCoachCandidate, setSelectedCoachCandidate] = useState<string | null>(null);

  const updateFirestoreRoom = useCallback(async (rawUpdatedFields: Partial<GameRoom>) => {
    if (!roomId || typeof roomId !== 'string') return;
    const roomRef = doc(db, "rooms", roomId);

    // Firestore does not allow 'undefined' values.
    // We need to clean the updates object to remove any keys with undefined values.
    const updatesForFirestore: { [key: string]: any } = {};
    for (const key in rawUpdatedFields) {
        if (Object.prototype.hasOwnProperty.call(rawUpdatedFields, key)) {
            const value = rawUpdatedFields[key as keyof GameRoom];
            if (value !== undefined) { // Only include defined values, allow deleteField()
                updatesForFirestore[key] = value;
            }
        }
    }
    
    if (Object.keys(updatesForFirestore).length === 0) {
        // console.log("No valid fields to update in Firestore.");
        return;
    }

    try {
        await updateDoc(roomRef, updatesForFirestore);
    } catch (error) {
        console.error("Error updating room in Firestore:", error, "Attempted updates:", updatesForFirestore, "Original input:", rawUpdatedFields);
        toast({ title: "更新房间失败", description: `无法在服务器上更新房间状态。Error: ${(error as Error).message}`, variant: "destructive" });
    }
  }, [roomId, toast]);


  useEffect(() => {
    if (authLoading || !user || typeof roomId !== 'string') {
      if (!authLoading && !user) {
        toast({ title: "需要登录", description: "请登录后访问房间。", variant: "destructive" });
        router.push(`/login?redirect=/rooms/${roomId}`);
      }
      return;
    }

    setIsLoading(true);
    const roomRef = doc(db, "rooms", roomId);
    let unsubscribe: Unsubscribe;

    const setupSnapshotListener = async () => {
        // Ensure db is initialized
        if (!db) {
            toast({ title: "数据库连接失败", description: "无法连接到数据库，请稍后重试或检查网络。", variant: "destructive" });
            setIsLoading(false);
            router.push("/");
            return;
        }
        const initialDocSnap = await getDoc(roomRef);
        if (initialDocSnap.exists()) {
            let initialRoomData = { id: initialDocSnap.id, ...initialDocSnap.data() } as GameRoom;
             initialRoomData.players = initialRoomData.players || [];


            const playerExists = initialRoomData.players.some(p => p.id === user.id);

            if (!playerExists && initialRoomData.status === GameRoomStatus.Waiting && initialRoomData.players.length < initialRoomData.maxPlayers) {
                const newPlayerForFirestore: { id: string; name: string; avatarUrl?: string } = {
                    id: user.id,
                    name: user.name,
                };
                if (user.avatarUrl) {
                    newPlayerForFirestore.avatarUrl = user.avatarUrl;
                }
                await updateDoc(roomRef, {
                    players: arrayUnion(newPlayerForFirestore)
                });
            } else if (!playerExists && initialRoomData.status !== GameRoomStatus.Waiting) {
                toast({ title: "游戏已开始或结束", description: "无法加入已开始或结束的游戏。", variant: "destructive" });
                router.push("/");
                return;
            } else if (!playerExists && initialRoomData.players.length >= initialRoomData.maxPlayers) {
                toast({ title: "房间已满", description: "此房间已满。", variant: "destructive" });
                router.push("/");
                return;
            }
        } else {
            toast({ title: "房间未找到", description: "请求的房间不存在。", variant: "destructive" });
            router.push("/");
            return;
        }

        unsubscribe = onSnapshot(roomRef, (docSnap) => {
          if (docSnap.exists()) {
            const roomData = { id: docSnap.id, ...docSnap.data() } as GameRoom;
            const validatedRoom: GameRoom = {
              ...roomData,
              players: roomData.players || [],
              teamVotes: roomData.teamVotes || [],
              missionCardPlaysForCurrentMission: roomData.missionCardPlaysForCurrentMission || [],
              missionHistory: roomData.missionHistory || [],
              fullVoteHistory: roomData.fullVoteHistory || [],
              teamScores: roomData.teamScores || { teamMemberWins: 0, undercoverWins: 0 },
              missionPlayerCounts: roomData.missionPlayerCounts || MISSIONS_CONFIG[roomData.players?.length || MIN_PLAYERS_TO_START] || MISSIONS_CONFIG[MIN_PLAYERS_TO_START],
              totalRounds: roomData.totalRounds || TOTAL_ROUNDS_PER_GAME,
              maxCaptainChangesPerRound: roomData.maxCaptainChangesPerRound || MAX_CAPTAIN_CHANGES_PER_ROUND,
              selectedTeamForMission: roomData.selectedTeamForMission || [],
              generatedFailureReason: roomData.generatedFailureReason || undefined,
            };
            setRoom(validatedRoom);
             if (validatedRoom.selectedTeamForMission) {
              setSelectedMissionTeam(validatedRoom.selectedTeamForMission);
            }
          } else {
            toast({ title: "房间不存在", description: "该房间可能已被删除。", variant: "destructive" });
            router.push("/");
          }
          setIsLoading(false);
        }, (error) => {
          console.error("Error listening to room updates:", error);
          toast({ title: "房间监听错误", description: "与房间的连接丢失。", variant: "destructive" });
          setIsLoading(false);
          router.push("/");
        });
    };
    
    setupSnapshotListener();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [roomId, user, authLoading, router, toast]);


  const saveGameRecordForAllPlayers = useCallback((finalRoomState: GameRoom) => {
    if (typeof window === "undefined" || finalRoomState.status !== GameRoomStatus.Finished || !finalRoomState.currentGameInstanceId) return;
    const allPlayersInGame = finalRoomState.players;
    let winningFaction: WinningFactionType = null;
    let gameSummaryMessage = "游戏结束!";

    const actualCoach = allPlayersInGame.find(p => p.role === Role.Coach);
    const teamMemberMissionWins = finalRoomState.teamScores?.teamMemberWins || 0;
    const undercoverMissionWins = finalRoomState.teamScores?.undercoverWins || 0;

    if (finalRoomState.coachCandidateId && actualCoach) {
        const targetedPlayer = allPlayersInGame.find(p => p.id === finalRoomState.coachCandidateId);
        if (finalRoomState.coachCandidateId === actualCoach.id) {
            winningFaction = Role.Undercover;
            gameSummaryMessage = `卧底阵营胜利! (通过指认教练: ${actualCoach.name} 是教练!)`;
        } else {
            winningFaction = Role.TeamMember;
            gameSummaryMessage = `战队阵营胜利! (教练指认失败: ${targetedPlayer?.name || '被指认者'} 不是教练。实际教练: ${actualCoach.name})`;
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
             // This case should ideally not be hit if game logic is correct,
             // but as a fallback if game ends prematurely without a clear winner from above conditions.
             winningFaction = 'Draw'; // Or determine based on current scores if one side is ahead
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
            role: p.role || Role.TeamMember, // Default to TeamMember if role is somehow missing
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
        // Prevent duplicate entries if somehow called multiple times for the same game end
        playerHistory = playerHistory.filter(r => r.gameInstanceId !== record.gameInstanceId);
        playerHistory.unshift(record); // Add new record to the beginning
        localStorage.setItem(historyKey, JSON.stringify(playerHistory.slice(0, 50))); // Keep only last 50 records
      } catch (e) {
        console.error(`Failed to save game record for player ${player.id}:`, e);
      }
    });
  }, []);

  const finalizeAndRevealMissionOutcome = useCallback(async () => {
    if (!room || !room.selectedTeamForMission || !localPlayers || !room.teamScores || room.currentRound === undefined) return;

    let finalPlays: MissionCardPlay[] = [...(room.missionCardPlaysForCurrentMission || [])];

    // Add AI/Virtual Player card plays
    room.selectedTeamForMission.forEach(playerId => {
      const player = localPlayers.find(p => p.id === playerId);
      // Ensure play isn't already recorded (e.g. if a human virtual player concept existed)
      if (player && player.id.startsWith("virtual_") && !finalPlays.some(fp => fp.playerId === playerId)) {
        const cardToPlay: 'success' | 'fail' = player.role === Role.Undercover ? 'fail' : 'success'; 
        finalPlays.push({ playerId: player.id, card: cardToPlay });
      }
    });

    const failCardsPlayed = finalPlays.filter(p => p.card === 'fail').length;
    let missionSuccessful: boolean;

    // Special rule: Round 4 with 7+ players needs 2 fail cards to fail the mission
    if (localPlayers.length >= 7 && room.currentRound === 4) {
      missionSuccessful = failCardsPlayed < 2; 
    } else {
      missionSuccessful = failCardsPlayed < 1; 
    }

    const outcome: MissionOutcome = missionSuccessful ? 'success' : 'fail';
    const newTeamScores = { ...room.teamScores };
    if (missionSuccessful) newTeamScores.teamMemberWins++;
    else newTeamScores.undercoverWins++;

    let aiGeneratedFailureReason: GeneratedFailureReason | undefined = undefined;
    if (outcome === 'fail') {
      try {
        aiGeneratedFailureReason = await generateFailureReason({ failCardCount: failCardsPlayed });
      } catch (e) {
        console.error("Error calling generateFailureReason flow:", e);
        const defaultReasonsCount = Math.min(failCardsPlayed, FAILURE_REASONS_LIST_FOR_FALLBACK.length, 3);
        const defaultReasons = FAILURE_REASONS_LIST_FOR_FALLBACK.slice(0, defaultReasonsCount);
        aiGeneratedFailureReason = {
          selectedReasons: defaultReasons,
          narrativeSummary: `比赛失利，主要原因是：${defaultReasons.join("，")}。`,
        };
      }
    }

    const missionRecord: Mission = {
      round: room.currentRound,
      captainId: room.currentCaptainId || "unknown_captain",
      teamPlayerIds: [...room.selectedTeamForMission],
      outcome: outcome,
      failCardsPlayed: failCardsPlayed,
      cardPlays: [...finalPlays], // Store all card plays for historical record
      generatedFailureReason: aiGeneratedFailureReason,
    };

    await updateFirestoreRoom({
        teamScores: newTeamScores,
        missionHistory: arrayUnion(missionRecord) as any, // Firestore arrayUnion
        currentPhase: 'mission_reveal',
        missionOutcomeForDisplay: outcome,
        failCardsPlayedForDisplay: failCardsPlayed,
        missionCardPlaysForCurrentMission: finalPlays, // Keep for display if needed, or could be cleared
        generatedFailureReason: aiGeneratedFailureReason || deleteField(),
      });
    toast({ title: `第 ${room.currentRound} 场比赛结束`, description: `结果: ${outcome === 'success' ? '成功' : '失败'}${outcome === 'fail' && aiGeneratedFailureReason ? ` (${aiGeneratedFailureReason.narrativeSummary})` : ''}`});
  }, [room, localPlayers, toast, updateFirestoreRoom]);

  // Effect to automatically finalize mission if all human players on mission have acted
  useEffect(() => {
    if (!room || room.status !== GameRoomStatus.InProgress || room.currentPhase !== 'mission_execution' || !user) {
      return;
    }
    const missionTeamPlayerIds = room.selectedTeamForMission || [];
    const humanPlayersOnMission = missionTeamPlayerIds.filter(playerId => {
      const player = localPlayers.find(p => p.id === playerId);
      return player && !player.id.startsWith("virtual_");
    });

    if (humanPlayersOnMission.length === 0 && missionTeamPlayerIds.length > 0) { // All virtual on mission
      const timer = setTimeout(() => finalizeAndRevealMissionOutcome(), 1000); // Short delay for effect
      return () => clearTimeout(timer);
    }

    // Check if all human players on the mission have recorded their play
    const humanActionsRecorded = room.missionCardPlaysForCurrentMission?.filter(play => humanPlayersOnMission.includes(play.playerId)).length || 0;

    if (humanActionsRecorded === humanPlayersOnMission.length && humanPlayersOnMission.length > 0) {
      finalizeAndRevealMissionOutcome();
    }
  }, [room, localPlayers, user, finalizeAndRevealMissionOutcome]);


  // Effect for AI Captain to propose a team
  useEffect(() => {
    if (!room || !user || room.status !== GameRoomStatus.InProgress || room.currentPhase !== 'team_selection' || !localPlayers.length) {
      return;
    }
    const currentCaptain = localPlayers.find(p => p.id === room.currentCaptainId);
    if (currentCaptain && currentCaptain.id.startsWith("virtual_")) {
      // Simple AI: Propose itself and then random other players
      const performVirtualCaptainTeamProposal = async () => {
        if (!room.currentRound || !room.missionPlayerCounts || !localPlayers.length || (room.captainChangesThisRound  || 0) >= (room.maxCaptainChangesPerRound || MAX_CAPTAIN_CHANGES_PER_ROUND)) return;
        
        const requiredPlayers = room.missionPlayerCounts[room.currentRound -1];
        
        let proposedTeamIds: string[] = [];
        // AI captain includes itself
        if (requiredPlayers > 0 && localPlayers.some(p => p.id === currentCaptain.id)) {
             proposedTeamIds.push(currentCaptain.id); 
        }

        // Get other players, excluding the captain
        const otherPlayers = localPlayers.filter(p => p.id !== currentCaptain.id);
        const shuffledOtherPlayers = [...otherPlayers].sort(() => 0.5 - Math.random());

        // Add other players until the team is full
        for (let i = 0; proposedTeamIds.length < requiredPlayers && i < shuffledOtherPlayers.length; i++) {
            proposedTeamIds.push(shuffledOtherPlayers[i].id);
        }
        
        // Fallback if not enough unique players (shouldn't happen with typical game sizes)
        if (proposedTeamIds.length < requiredPlayers) {
            const allPlayerIds = localPlayers.map(p => p.id);
            const remainingNeeded = requiredPlayers - proposedTeamIds.length;
            const availableToPick = allPlayerIds.filter(id => !proposedTeamIds.includes(id));
            const shuffledAvailable = availableToPick.sort(() => 0.5 - Math.random());
            proposedTeamIds.push(...shuffledAvailable.slice(0, remainingNeeded));
        }
        
        proposedTeamIds = proposedTeamIds.slice(0, requiredPlayers); // Ensure correct number

        const proposedTeamNames = proposedTeamIds.map(id => localPlayers.find(p=>p.id === id)?.name || 'Unknown').join(', ');
        await updateFirestoreRoom({
            selectedTeamForMission: proposedTeamIds,
            currentPhase: 'team_voting',
            teamVotes: [], // Clear previous votes for the new proposal
        });
        toast({ title: "虚拟队伍已提议", description: `${currentCaptain.name} 提议: ${proposedTeamNames}` });
      };
      const timer = setTimeout(performVirtualCaptainTeamProposal, 1500); // Simulate AI "thinking" time
      return () => clearTimeout(timer);
    }
  }, [room, user, localPlayers, toast, updateFirestoreRoom]);

  const assignRolesAndCaptain = async () => {
    if (!room || localPlayers.length < MIN_PLAYERS_TO_START) return;

    const playerCount = localPlayers.length;
    const config = ROLES_CONFIG[playerCount] || ROLES_CONFIG[Math.max(...Object.keys(ROLES_CONFIG).map(Number))];
    let rolesToAssign: Role[] = [];
    Object.entries(config).forEach(([role, count]) => {
      for (let i = 0; i < count; i++) rolesToAssign.push(role as Role);
    });
    // Fill remaining spots with TeamMember if rolesToAssign is less than playerCount
    while(rolesToAssign.length < playerCount) rolesToAssign.push(Role.TeamMember); 
    rolesToAssign = rolesToAssign.slice(0, playerCount).sort(() => Math.random() - 0.5); // Shuffle roles

    const updatedPlayers = localPlayers.map((playerData, index) => {
        const newPlayer: Player = {
            id: playerData.id,
            name: playerData.name,
            // avatarUrl: playerData.avatarUrl, // Keep avatarUrl if it exists
            role: rolesToAssign[index],
        };
        if (playerData.avatarUrl !== undefined) {
            newPlayer.avatarUrl = playerData.avatarUrl;
        }
        return newPlayer;
    });
    const firstCaptainIndex = Math.floor(Math.random() * updatedPlayers.length);
    const missionPlayerCounts = MISSIONS_CONFIG[playerCount] || MISSIONS_CONFIG[Object.keys(MISSIONS_CONFIG).map(Number).sort((a,b)=> a-b)[0]];
    const newGameInstanceId = `gameinst_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const updatedRoomData: Partial<GameRoom> = {
        players: updatedPlayers, // Players with roles
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
        // Ensure fields are explicitly removed if not applicable at game start
        missionOutcomeForDisplay: deleteField() as any,
        failCardsPlayedForDisplay: deleteField() as any,
        coachCandidateId: deleteField() as any,
        generatedFailureReason: deleteField() as any,
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
    if (localPlayers.length < MIN_PLAYERS_TO_START) {
      toast({ title: "玩家数量不足", description: `至少需要 ${MIN_PLAYERS_TO_START} 名玩家才能开始。当前 ${localPlayers.length} 名。`, variant: "destructive" }); return;
    }
    if (localPlayers.length > room.maxPlayers) {
      toast({ title: "玩家数量过多", description: `此房间最大支持 ${room.maxPlayers} 名玩家。当前 ${localPlayers.length} 名。`, variant: "destructive" }); return;
    }
    await assignRolesAndCaptain();
  };

  const handleAddVirtualPlayer = async () => {
    if (!room || !user || room.hostId !== user.id || room.status !== GameRoomStatus.Waiting) {
      toast({ title: "未授权", description: "只有主持人在等待阶段可以添加虚拟玩家。", variant: "destructive" }); return;
    }
    if (localPlayers.length >= room.maxPlayers) {
      toast({ title: "房间已满", description: "无法添加更多玩家，房间已满。", variant: "destructive" }); return;
    }
    const existingVirtualPlayerNames = localPlayers.filter(p => p.id.startsWith("virtual_")).map(p => p.name);
    const availableNames = HONOR_OF_KINGS_HERO_NAMES.filter(name => !existingVirtualPlayerNames.includes(name));
    if (availableNames.length === 0) {
      // Fallback if all hero names are used (unlikely with current list size)
      toast({ title: "错误", description: "没有更多可用的虚拟玩家名称。", variant: "destructive" }); return;
    }
    const virtualPlayerName = availableNames[Math.floor(Math.random() * availableNames.length)];
    const virtualPlayerId = `virtual_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    
    // Ensure the player object added to Firestore is clean
    const newVirtualPlayer: {id: string; name: string; avatarUrl?: string } = {
      id: virtualPlayerId, name: virtualPlayerName,
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
    toast({ title: "队伍已提议", description: "玩家现在将对提议的队伍进行投票。" });
  };

  const handlePlayerSelectionForMission = (playerId: string, checked: boolean) => {
    setSelectedMissionTeam(prevSelected => checked ? [...prevSelected, playerId] : prevSelected.filter(id => id !== playerId));
  };

  // This function processes votes after all players (human + AI) have voted
  const processTeamVotes = useCallback(async (currentVotes: PlayerVote[]) => {
    if (!room || !user || !localPlayers.length || !room.teamScores || room.currentRound === undefined || room.currentCaptainId === undefined) return;

    const approveVotes = currentVotes.filter(v => v.vote === 'approve').length;
    const rejectVotes = currentVotes.filter(v => v.vote === 'reject').length;
    const voteOutcome: 'approved' | 'rejected' = approveVotes > rejectVotes ? 'approved' : 'rejected';

    // Log this vote attempt to fullVoteHistory
    const newVoteLogEntry: VoteHistoryEntry = {
        round: room.currentRound,
        captainId: room.currentCaptainId,
        attemptNumberInRound: (room.captainChangesThisRound || 0) + 1,
        proposedTeamIds: [...(room.selectedTeamForMission || [])],
        votes: [...currentVotes], // Store a copy of the votes for this specific attempt
        outcome: voteOutcome,
    };
    const updatedFullVoteHistoryFirestore = arrayUnion(newVoteLogEntry);

    if (voteOutcome === 'approved') {
      toast({ title: "队伍已批准!", description: "进入比赛执行阶段。" });
      const currentSelectedTeam = room.selectedTeamForMission || [];
      // Auto-play "success" for human Team Members and Coaches on the mission
      const autoPlays: MissionCardPlay[] = []; 
      currentSelectedTeam.forEach(playerId => {
        const player = localPlayers.find(p => p.id === playerId);
        if (player && !player.id.startsWith("virtual_") && (player.role === Role.TeamMember || player.role === Role.Coach)) {
          // Only add if not already played (though this should be the first play for them)
          if (!room.missionCardPlaysForCurrentMission?.some(p => p.playerId === playerId)) {
            autoPlays.push({ playerId: player.id, card: 'success' });
          }
        }
      });

      await updateFirestoreRoom({
          currentPhase: 'mission_execution', teamVotes: currentVotes, // Keep votes for display during mission
          captainChangesThisRound: 0, // Reset for the next mission selection if this one fails
          missionCardPlaysForCurrentMission: autoPlays, // Initialize with auto-plays
          fullVoteHistory: updatedFullVoteHistoryFirestore as any,
      });
      setHumanUndercoverCardChoice(null); // Reset any previous choice for human undercover

    } else { // Team Rejected
      let newCaptainChangesThisRound = (room.captainChangesThisRound || 0) + 1;
      if (newCaptainChangesThisRound >= (room.maxCaptainChangesPerRound || MAX_CAPTAIN_CHANGES_PER_ROUND)) {
        // Game Over: Undercover wins due to 5 rejections
        const finalTeamScores = { ...(room.teamScores || {teamMemberWins: 0, undercoverWins: 0}), undercoverWins: room.totalRounds || TOTAL_ROUNDS_PER_GAME }; // Undercover wins all remaining rounds
        
        const finalRoomStateForRecord: GameRoom = {
          ...room, 
          status: GameRoomStatus.Finished,
          currentPhase: 'game_over' as GameRoomPhase,
          teamScores: finalTeamScores,
          teamVotes: currentVotes, // Persist the votes that led to game over
          fullVoteHistory: [...(room.fullVoteHistory || []), newVoteLogEntry], // Add the final vote entry
          captainChangesThisRound: newCaptainChangesThisRound,
        };
        saveGameRecordForAllPlayers(finalRoomStateForRecord);

        toast({ title: "队伍被拒绝5次!", description: "卧底阵营获胜!", variant: "destructive" });
        await updateFirestoreRoom({ 
            status: GameRoomStatus.Finished,
            currentPhase: 'game_over',
            teamScores: finalTeamScores,
            teamVotes: currentVotes, // Persist votes leading to game end
            fullVoteHistory: updatedFullVoteHistoryFirestore as any,
            captainChangesThisRound: newCaptainChangesThisRound,
        });
      } else {
        // Continue to next captain
        const currentCaptainIndex = localPlayers.findIndex(p => p.id === room.currentCaptainId);
        const nextCaptainIndex = (currentCaptainIndex + 1) % localPlayers.length;
        const newCaptainId = localPlayers[nextCaptainIndex].id;
        const newCaptainName = localPlayers[nextCaptainIndex].name;
        toast({ title: "队伍被拒绝!", description: `队长顺位传给 ${newCaptainName}。` });
        await updateFirestoreRoom({
            currentCaptainId: newCaptainId,
            captainChangesThisRound: newCaptainChangesThisRound, 
            currentPhase: 'team_selection',
            selectedTeamForMission: [], // Clear the rejected team
            teamVotes: [], // Clear votes for the new proposal
            fullVoteHistory: updatedFullVoteHistoryFirestore as any,
          });
        setSelectedMissionTeam([]); // Clear local selection UI
      }
    }
  }, [room, user, localPlayers, toast, saveGameRecordForAllPlayers, updateFirestoreRoom]);

 // Handles a human player's vote
 const handlePlayerVote = async (vote: 'approve' | 'reject') => {
    if (!room || !user || room.currentPhase !== 'team_voting' || !localPlayers.length) {
      toast({ title: "错误", description: "当前无法投票。", variant: "destructive" }); return;
    }
    const existingVote = room.teamVotes?.find(v => v.playerId === user.id);
    if (existingVote) {
      toast({ title: "已投票", description: "您已对该队伍投过票。", variant: "destructive" }); return;
    }

    const newVote: PlayerVote = { playerId: user.id, vote };
    // Optimistically update local state if needed, but Firestore update will trigger re-render
    // let updatedVotesForProcessing = [...(room.teamVotes || []), newVote];

    // Update Firestore immediately with this player's vote
    await updateFirestoreRoom({ teamVotes: arrayUnion(newVote) as any});
    toast({title: "投票已提交", description: `您投了 ${vote === 'approve' ? '同意' : '拒绝'}。等待其他玩家...`});

    // Check if all human players have voted AFTER this vote is committed (Firestore will update 'room')
    // This check will happen in a useEffect that monitors room.teamVotes
  };

  // useEffect to process votes when all players have voted
  useEffect(() => {
    if (!room || room.currentPhase !== 'team_voting' || !localPlayers.length) return;

    const realPlayers = localPlayers.filter(p => !p.id.startsWith("virtual_"));
    const currentVotes = room.teamVotes || [];
    const realPlayersWhoVotedIds = new Set(currentVotes.filter(v => realPlayers.some(rp => rp.id === v.playerId)).map(v => v.playerId));

    if (realPlayersWhoVotedIds.size === realPlayers.length) {
      // All real players have voted. Now, add virtual player votes.
      const virtualPlayers = localPlayers.filter(p => p.id.startsWith("virtual_"));
      const virtualPlayerVotes: PlayerVote[] = virtualPlayers.map(vp => {
        // Simple AI: Undercovers approve if team has an undercover, reject otherwise.
        // TeamMembers/Coach approve if team has no undercovers, reject otherwise.
        let aiVote: 'approve' | 'reject' = 'approve'; // Default
        const teamHasUndercover = room.selectedTeamForMission?.some(memberId => {
            const member = localPlayers.find(p=>p.id === memberId);
            return member?.role === Role.Undercover;
        });

        if (vp.role === Role.Undercover) {
            aiVote = teamHasUndercover ? 'approve' : 'reject'; // Approve if ally is on team
        } else { // TeamMember or Coach
            aiVote = teamHasUndercover ? 'reject' : 'approve'; // Reject if undercover is on team
        }
        return { playerId: vp.id, vote: aiVote };
      });

      const allVotes = [...currentVotes, ...virtualPlayerVotes];
      // Update Firestore with all votes before processing
      // This ensures processTeamVotes uses the complete vote set
      updateFirestoreRoom({ teamVotes: allVotes }).then(() => {
         processTeamVotes(allVotes);
      });
    }
  }, [room, localPlayers, processTeamVotes, updateFirestoreRoom]);


  const handleHumanUndercoverPlayCard = async (card: 'success' | 'fail') => {
    if (!room || !user || room.currentPhase !== 'mission_execution' || !currentUserIsOnMission || currentUserRole !== Role.Undercover ) {
      toast({ title: "错误", description: "当前无法打出比赛牌。", variant: "destructive" });
      return;
    }
    const existingPlay = room.missionCardPlaysForCurrentMission?.find(p => p.playerId === user.id);
    if (existingPlay) {
        toast({ title: "已行动", description: "您已在此比赛中行动过。", variant: "destructive" });
        return;
    }
    setHumanUndercoverCardChoice(card); // For UI feedback
    const newPlay: MissionCardPlay = { playerId: user.id, card };
    await updateFirestoreRoom({
        missionCardPlaysForCurrentMission: arrayUnion(newPlay) as any
    });
    toast({ title: "比赛牌已打出", description: `您打出了【${card === 'success' ? '成功' : '破坏'}】。` });
  };

  const handleProceedToNextRoundOrGameOver = async () => {
    if (!room || !room.teamScores || room.currentRound === undefined || room.totalRounds === undefined || !localPlayers.length) return;

    let updates: Partial<GameRoom> = {};
    let gameIsOver = false;
    let nextPhase: GameRoomPhase = 'team_selection'; 

    // Check for win by mission scores
    if (room.teamScores.teamMemberWins >= 3 && room.teamScores.teamMemberWins > room.teamScores.undercoverWins) {
      const humanUndercovers = localPlayers.filter(p => p.role === Role.Undercover && !p.id.startsWith("virtual_"));
      // If there are human undercovers, give them a chance to assassinate coach
      if (humanUndercovers.length > 0) { 
        nextPhase = 'coach_assassination';
        toast({ title: "战队方胜利在望!", description: "卧底现在有一次指认教练的机会来反败为胜。" });
      } else { // No human undercovers, team members win directly
        gameIsOver = true;
        nextPhase = 'game_over';
        toast({ title: "战队方获胜!", description: "卧底方无力回天。" });
      }
    } else if (room.teamScores.undercoverWins >= 3 && room.teamScores.undercoverWins > room.teamScores.teamMemberWins) {
        gameIsOver = true;
        nextPhase = 'game_over';
        toast({ title: "卧底方获胜!", description: "卧底方已完成3场比赛。" });
    } else if (room.currentRound >= room.totalRounds) { // All rounds played
        gameIsOver = true;
        nextPhase = 'game_over';
        toast({ title: "所有比赛结束!", description: "根据胜场决定最终胜负。" });
    }


    if (gameIsOver) {
      updates = { 
        status: GameRoomStatus.Finished, 
        currentPhase: 'game_over', 
        // Clear display-specific fields
        missionOutcomeForDisplay: deleteField() as any, 
        failCardsPlayedForDisplay: deleteField() as any,
        generatedFailureReason: deleteField() as any,
      };
      saveGameRecordForAllPlayers({...room, ...updates, currentPhase: nextPhase } as GameRoom); 
      await updateFirestoreRoom(updates);
    } else if (nextPhase === 'coach_assassination') {
        // Transition to coach assassination phase
        await updateFirestoreRoom({ 
          currentPhase: 'coach_assassination',
          missionOutcomeForDisplay: deleteField() as any,
          failCardsPlayedForDisplay: deleteField() as any,
          generatedFailureReason: deleteField() as any,
        });
    } else { // Proceed to next round
      const nextRoundNumber = room.currentRound + 1;
      const currentCaptainIndex = localPlayers.findIndex(p => p.id === room.currentCaptainId);
      const nextCaptainIndex = (currentCaptainIndex + 1) % localPlayers.length;
      const newCaptainId = localPlayers[nextCaptainIndex].id;

      updates = {
          currentRound: nextRoundNumber,
          currentCaptainId: newCaptainId,
          captainChangesThisRound: 0,
          currentPhase: 'team_selection',
          selectedTeamForMission: [],
          teamVotes: [], // Clear votes for the new round
          missionCardPlaysForCurrentMission: [], // Clear card plays for new round
          // Clear display-specific fields
          missionOutcomeForDisplay: deleteField() as any, 
          failCardsPlayedForDisplay: deleteField() as any,
          generatedFailureReason: deleteField() as any,
        };
      await updateFirestoreRoom(updates);
      setSelectedMissionTeam([]);
      setHumanUndercoverCardChoice(null);
      setSelectedCoachCandidate(null);
      toast({ title: `第 ${nextRoundNumber} 场比赛开始`, description: `队长是 ${localPlayers.find(p=>p.id === newCaptainId)?.name}` });
    }
  };

  const handleConfirmCoachAssassination = async () => {
    if (!room || !user || !selectedCoachCandidate || currentUserRole !== Role.Undercover || room.currentPhase !== 'coach_assassination' || !localPlayers.length) {
        toast({title: "错误", description: "无法确认指认。", variant: "destructive"});
        return;
    }
    const actualCoach = localPlayers.find(p => p.role === Role.Coach);
    if (!actualCoach) {
      // This should not happen if roles are assigned correctly
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
      toastDescription = `${actualCoach.name} 是教练！`;
      // Undercover wins by assassination, team member wins are not counted for final victory.
      // No change to score display; winning faction is determined by this event.
    } else {
      toastTitle = "指认失败！战队方获胜！";
      const wronglyAccusedPlayer = localPlayers.find(p => p.id === selectedCoachCandidate);
      toastDescription = `${wronglyAccusedPlayer?.name || '被指认者'} 不是教练。`;
      // Team members confirm their win. Scores reflect their mission wins.
    }

    const finalUpdates: Partial<GameRoom> = {
      status: GameRoomStatus.Finished,
      currentPhase: 'game_over',
      coachCandidateId: selectedCoachCandidate, 
      teamScores: finalTeamScores, // Keep scores as they were
    };
    saveGameRecordForAllPlayers({...room, ...finalUpdates} as GameRoom);
    await updateFirestoreRoom(finalUpdates);
    toast({ title: toastTitle, description: toastDescription, duration: 5000 });
    setSelectedCoachCandidate(null); // Reset selection
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
        } else if (room.players.some(p => p.id === user.id)) { // Non-host or host of active/finished game
            const playerObjectInRoom = room.players.find(p => p.id === user.id);
            if (playerObjectInRoom) {
              // Construct a clean player object for removal, only including defined fields.
              const cleanedPlayerObject: {id: string; name: string; avatarUrl?: string; role?: Role} = {
                id: playerObjectInRoom.id,
                name: playerObjectInRoom.name,
              };
              if (playerObjectInRoom.avatarUrl !== undefined) cleanedPlayerObject.avatarUrl = playerObjectInRoom.avatarUrl;
              if (playerObjectInRoom.role !== undefined) cleanedPlayerObject.role = playerObjectInRoom.role;

              try {
                  await updateDoc(roomRef, {
                      players: arrayRemove(cleanedPlayerObject)
                  });
                  toast({ title: "已离开房间", description: `您已离开房间 ${currentRoomName}。` });
              } catch (e) {
                  console.error("Failed to update Firestore on leave:", e);
                  toast({ title: "离开房间失败", description: `无法从房间 ${currentRoomName} 移除您。`, variant: "destructive" });
              }
            }
        } else {
            // User might not be in the room (e.g. already left, or stale local state)
             toast({ title: "已返回大厅" });
        }
    } else {
        toast({ title: "已返回大厅" });
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
    
    // Reset roles for players, keep other details
    const currentPlayersWithResetRoles = room.players.map(p => {
        const playerObject: { id: string; name: string; avatarUrl?: string } = {
            id: p.id,
            name: p.name,
        };
        if (p.avatarUrl !== undefined) {
            playerObject.avatarUrl = p.avatarUrl;
        }
        return playerObject; // Role is removed here, will be reassigned
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
        currentGameInstanceId: newGameInstanceId, // New game instance ID
        // Explicitly remove fields that should be reset
        currentCaptainId: deleteField() as any,
        currentRound: deleteField() as any,
        captainChangesThisRound: deleteField() as any,
        currentPhase: deleteField() as any, // Will show WaitingPhaseActions
        missionOutcomeForDisplay: deleteField() as any,
        failCardsPlayedForDisplay: deleteField() as any,
        coachCandidateId: deleteField() as any,
        generatedFailureReason: deleteField() as any,
      };
    await updateFirestoreRoom(updates);
    setSelectedMissionTeam([]);
    setHumanUndercoverCardChoice(null);
    setSelectedCoachCandidate(null);
    toast({ title: "游戏已重置", description: "房间已重置为等待状态。主持人可以开始新游戏。" });
  };

  const handleForceEndGame = async () => {
    if (!room || !user || room.hostId !== user.id) {
      toast({ title: "错误", description: "只有主持人可以强制结束游戏。", variant: "destructive" });
      return;
    }
    if (room.status !== GameRoomStatus.InProgress) {
      toast({ title: "错误", description: "游戏不在进行中，无法强制结束。", variant: "destructive" });
      return;
    }
    const finalUpdates: Partial<GameRoom> = {
      status: GameRoomStatus.Finished,
      currentPhase: 'game_over',
      teamScores: room.teamScores || { teamMemberWins: 0, undercoverWins: 0 }, // Preserve current scores
    };
    // Ensure current game instance ID is passed for record saving
    saveGameRecordForAllPlayers({...room, ...finalUpdates, currentPhase: 'game_over' } as GameRoom);
    await updateFirestoreRoom(finalUpdates);
    toast({ title: "游戏已结束", description: "主持人已强制结束本场游戏。" });
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
  // const currentUserIsUndercoverOnMission = currentUserIsOnMission && currentUserRole === Role.Undercover; // Not used directly
  const currentUserHasPlayedMissionCard = room.missionCardPlaysForCurrentMission?.some(p => p.playerId === user.id);
  const requiredPlayersForCurrentMission = room.missionPlayerCounts && room.currentRound !== undefined && room.currentRound > 0 && room.missionPlayerCounts.length >= room.currentRound  ? room.missionPlayerCounts[room.currentRound -1] : 0;
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
    if (p.id === user.id) return false; // Cannot target self
    // Cannot target fellow undercovers
    if (fellowUndercovers.some(fu => fu.id === p.id)) return false; 
    return true;
  });

  let gameOverMessageNode: React.ReactNode = "游戏结束!";
  if (room.status === GameRoomStatus.Finished) {
    const actualCoach = localPlayers.find(p => p.role === Role.Coach);
    const teamMemberMissionWins = room.teamScores?.teamMemberWins || 0;
    const undercoverMissionWins = room.teamScores?.undercoverWins || 0;

    if (room.coachCandidateId && actualCoach) {
      const targetedPlayer = localPlayers.find(p => p.id === room.coachCandidateId);
      if (room.coachCandidateId === actualCoach.id) {
        gameOverMessageNode = <span className="text-destructive">卧底阵营胜利! (通过指认教练: {actualCoach.name} 是教练!)</span>;
      } else {
        gameOverMessageNode = <span className="text-green-600">战队阵营胜利! (教练指认失败: {targetedPlayer?.name || '被指认者'} 不是教练。实际教练: {actualCoach.name})</span>;
      }
    } else if (undercoverMissionWins >= 3 && undercoverMissionWins > teamMemberMissionWins) {
      gameOverMessageNode = <span className="text-destructive">卧底阵营胜利! (通过完成比赛)</span>;
    } else if (teamMemberMissionWins >= 3 && teamMemberMissionWins > undercoverMissionWins) {
      gameOverMessageNode = <span className="text-green-600">战队阵营胜利! (通过完成比赛)</span>;
    } else if (room.captainChangesThisRound && room.maxCaptainChangesPerRound && room.captainChangesThisRound >= room.maxCaptainChangesPerRound) {
      gameOverMessageNode = <span className="text-destructive">卧底阵营胜利! (由于队伍连续5次组队失败)</span>;
    } else if (room.currentRound && room.totalRounds && room.currentRound > room.totalRounds) { // All rounds completed, decide by score
        if (undercoverMissionWins > teamMemberMissionWins) {
            gameOverMessageNode = <span className="text-destructive">卧底阵营胜利! (比赛结束时胜场较多)</span>;
        } else if (teamMemberMissionWins > undercoverMissionWins) {
            gameOverMessageNode = <span className="text-green-600">战队阵营胜利! (比赛结束时胜场较多)</span>;
        } else { // Draw
             gameOverMessageNode = <span className="text-foreground">游戏平局! (比分 {teamMemberMissionWins} : {undercoverMissionWins})</span>;
        }
    } else { // Default game over message if no specific condition met (e.g. host forced end)
      gameOverMessageNode = <span className="text-foreground">游戏已结束. (最终比分 战队 {teamMemberMissionWins} : 卧底 {undercoverMissionWins})</span>;
    }
  }


  return (
    <div className="space-y-6">
      <RoomHeader
        room={room}
        localPlayers={localPlayers}
        getPhaseDescription={getPhaseDescription}
        isHost={isHost}
        onForceEndGame={handleForceEndGame}
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

        <div className="md:col-span-2 space-y-4"> 
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

            {room.status === GameRoomStatus.InProgress && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-primary">游戏控制 / 状态</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                
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
                          generatedFailureReason={room.generatedFailureReason}
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
                </CardContent>
              </Card>
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
    </div>
  );
}

    