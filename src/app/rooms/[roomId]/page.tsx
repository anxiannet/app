
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { type GameRoom, type Player, Role, GameRoomStatus, type GameRoomPhase, type Mission, type PlayerVote, type MissionCardPlay, type MissionOutcome, type VoteHistoryEntry, type PlayerGameRecord, type WinningFactionType, type GeneratedFailureReason } from "@/lib/types";
import { Crown, Users, Play, Info, Swords, Shield, HelpCircle, UserPlus, Eye, UsersRound, ListChecks, Vote, ShieldCheck, ShieldX, ThumbsUp, ThumbsDown, CheckCircle2, XCircle, Zap, Target, History, RotateCcw, XOctagon, LogOut } from "lucide-react";
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
import { doc, getDoc, updateDoc, onSnapshot, arrayUnion, arrayRemove, serverTimestamp, Timestamp, deleteField, deleteDoc, type Unsubscribe } from "firebase/firestore";
import { generateFailureReason } from "@/ai/flows/generate-failure-reason-flow";
// AI Decision flows are removed
// import { decideVirtualPlayerVote, type VirtualPlayerVoteInput } from "@/ai/flows/decide-virtual-player-action-flow";
// import { decideAiTeamProposal, type AiProposeTeamInput } from "@/ai/flows/propose-team-flow";


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
  const [showTerminateConfirmDialog, setShowTerminateConfirmDialog] = useState(false);
  // const [isAiActing, setIsAiActing] = useState(false); // AI Decision-making removed


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
            typeof val === 'object' && val !== null && 'type' in val && (val as any).type === 'delete'
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
    if (authLoading || !user || typeof roomId !== 'string') {
      if (!authLoading && !user && typeof roomId === 'string' && roomId) {
         router.push(`/login?redirect=/rooms/${roomId}`);
      }
      return;
    }

    setIsLoading(true);
    const roomRef = doc(db, "rooms", roomId);
    let unsubscribe: Unsubscribe;

    const setupSnapshotListener = async () => {
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
                const newPlayerForFirestore: Partial<Player> = { id: user.id, name: user.name };
                if (user.avatarUrl) newPlayerForFirestore.avatarUrl = user.avatarUrl;
                
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
        if (finalRoomState.coachCandidateId === actualCoach.id) {
            winningFaction = Role.Undercover; 
            gameSummaryMessage = `卧底阵营胜利! (通过指认教练)`;
        } else {
            winningFaction = Role.TeamMember; 
            gameSummaryMessage = `战队阵营胜利! (教练指认失败)`;
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
        missionCardPlaysForCurrentMission: finalPlays, 
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

  // Virtual Captain Proposes Team (Simplified Logic)
  useEffect(() => {
    if (!room || !user || room.status !== GameRoomStatus.InProgress || room.currentPhase !== 'team_selection' || !(room.players?.length)) {
      return;
    }
    const playersInRoom = room.players;
    const currentCaptain = playersInRoom.find(p => p.id === room.currentCaptainId);

    if (currentCaptain && currentCaptain.id.startsWith("virtual_")) {
      const performVirtualCaptainTeamProposal = async () => {
        if (!room.currentRound || !room.missionPlayerCounts || !playersInRoom.length || (room.captainChangesThisRound  || 0) >= (room.maxCaptainChangesPerRound || MAX_CAPTAIN_CHANGES_PER_ROUND) || !currentCaptain.role) return;
        
        toast({description: `${currentCaptain.name} (虚拟玩家) 正在选择队伍...`});

        const requiredPlayers = room.missionPlayerCounts[room.currentRound -1];
        let proposedTeamIds = [];

        // Add self to team if possible
        if (requiredPlayers > 0) {
            proposedTeamIds.push(currentCaptain.id);
        }

        // Add other random players
        const otherPlayerIds = playersInRoom.filter(p => p.id !== currentCaptain.id).map(p => p.id);
        const shuffledOtherPlayers = [...otherPlayerIds].sort(() => 0.5 - Math.random());

        while (proposedTeamIds.length < requiredPlayers && shuffledOtherPlayers.length > 0) {
            proposedTeamIds.push(shuffledOtherPlayers.shift()!);
        }
        
        // If still not enough (e.g. captain was the only player), fill with any available unique players
        // This should be rare if game rules enforce enough players for missions.
        const allPlayerIdsShuffled = playersInRoom.map(p => p.id).sort(() => 0.5 - Math.random());
        while (proposedTeamIds.length < requiredPlayers && allPlayerIdsShuffled.length > 0) {
            const playerToAdd = allPlayerIdsShuffled.shift()!;
            if (!proposedTeamIds.includes(playerToAdd)) {
                proposedTeamIds.push(playerToAdd);
            }
        }
        proposedTeamIds = proposedTeamIds.slice(0, requiredPlayers); // Ensure correct length


        await updateFirestoreRoom({
            selectedTeamForMission: proposedTeamIds,
            currentPhase: 'team_voting',
            teamVotes: [], 
        });
        toast({ title: "虚拟队长已提议", description: `${currentCaptain.name} 提议队伍: ${proposedTeamIds.map(id => playersInRoom.find(p=>p.id===id)?.name).join(', ')}`});
        setSelectedMissionTeam([]); 
      };
      const timer = setTimeout(performVirtualCaptainTeamProposal, 1500); 
      return () => clearTimeout(timer);
    }
  }, [room, user, toast, updateFirestoreRoom]);


  const assignRolesAndCaptain = async () => {
    if (!room || !(room.players?.length) || room.players.length < MIN_PLAYERS_TO_START) return;
    const currentPlayers = room.players;
    const playerCount = currentPlayers.length;
    const config = ROLES_CONFIG[playerCount] || ROLES_CONFIG[Math.max(...Object.keys(ROLES_CONFIG).map(Number))];
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
        missionOutcomeForDisplay: deleteField() as unknown as MissionOutcome, // Explicitly remove
        failCardsPlayedForDisplay: deleteField() as unknown as number,       // Explicitly remove
        coachCandidateId: deleteField() as unknown as string,                 // Explicitly remove
        generatedFailureReason: deleteField() as unknown as GeneratedFailureReason, // Explicitly remove
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

  // Virtual Player Voting (Simplified Logic)
  useEffect(() => {
    if (!room || !user || room.status !== GameRoomStatus.InProgress || room.currentPhase !== 'team_voting' || !(room.players?.length)) {
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
            const performSimplifiedAiVoting = async () => {
                toast({ description: "虚拟玩家正在投票..." });
                let aiVotesBatch: PlayerVote[] = [];

                for (const vp of virtualPlayersWhoHaventVoted) {
                    // Simplified: virtual players always approve
                    aiVotesBatch.push({ playerId: vp.id, vote: 'approve' });
                }
                if (aiVotesBatch.length > 0) {
                    await updateFirestoreRoom({ teamVotes: arrayUnion(...aiVotesBatch) as any });
                }
            };
            performSimplifiedAiVoting();
        }
    }
  }, [room, user, toast, updateFirestoreRoom]);

  // Process team votes after all votes (human + virtual) are in
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (
      room?.currentPhase === 'team_voting' &&
      room.teamVotes &&
      room.players &&
      room.teamVotes.length === room.players.length &&
      room.players.length > 0
    ) {
      timer = setTimeout(() => {
        if (room.currentPhase === 'team_voting' && room.teamVotes && room.teamVotes.length === room.players.length) { 
           processTeamVotes(room.teamVotes!);
        }
      }, 3000); 
    }
    return () => clearTimeout(timer); 
  }, [room?.teamVotes, room?.currentPhase, room?.players, processTeamVotes, room]); 


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
    } else if (room.teamScores.undercoverWins >= 3 && room.teamScores.undercoverWins > room.teamScores.teamMemberWins) {
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
       if (finalTeamScores.teamMemberWins >=3 ) {
         // No change to undercoverWins, TM win is just nullified by this.
       }
    } else {
      toastTitle = "指认失败！战队方获胜！";
      toastDescription = `${playersInRoom.find(p=>p.id === selectedCoachCandidate)?.name || '目标'} 不是教练。`;
      if (finalTeamScores.teamMemberWins < 3) finalTeamScores.teamMemberWins = 3; 
    }

    const finalUpdates: Partial<GameRoom> = {
      status: GameRoomStatus.Finished,
      currentPhase: 'game_over',
      coachCandidateId: selectedCoachCandidate, 
      teamScores: finalTeamScores, 
    };
    saveGameRecordForAllPlayers({...room, ...finalUpdates} as GameRoom);
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
              try {
                  await updateDoc(roomRef, {
                      players: arrayRemove(cleanedPlayerObject)
                  });
                  toast({ title: "已离开房间", description: `您已离开房间 ${currentRoomName}。` });
              } catch (e) {
                  console.error("Failed to update Firestore on leave:", e, "Attempted to remove:", cleanedPlayerObject);
                  try {
                    await updateDoc(roomRef, { players: arrayRemove(playerObjectInRoom) });
                     toast({ title: "已离开房间", description: `您已离开房间 ${currentRoomName}。` });
                  } catch (e2) {
                     console.error("Second attempt to update Firestore on leave also failed:", e2);
                     toast({ title: "离开房间失败", description: `无法从房间 ${currentRoomName} 移除您。`, variant: "destructive" });
                  }
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
  if (!room || !user) return <div className="text-center py-10 text-destructive">载入房间错误或用户未验证。</div>;

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
    const actualCoach = localPlayers.find(p => p.role === Role.Coach);
    const teamMemberMissionWins = room.teamScores?.teamMemberWins || 0;
    const undercoverMissionWins = room.teamScores?.undercoverWins || 0;

    if (room.coachCandidateId && actualCoach) {
      if (room.coachCandidateId === actualCoach.id) {
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
       {/* AI Acting message removed */}

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
                   {/* Round/Attempt info removed from here */}
                </CardHeader>
                <CardContent>
                  {room.currentPhase === 'team_selection' && (
                      <TeamSelectionControls
                          currentCaptainName={localPlayers.find(p => p.id === room.currentCaptainId)?.name}
                          isHumanCaptain={isHumanCaptain}
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
                          totalPlayerCountInRoom={room.players.length}
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
