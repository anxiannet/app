
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { type GameRoom, type Player, Role, GameRoomStatus, type GameRoomPhase, type Mission, type PlayerVote, type MissionCardPlay, type MissionOutcome, type VoteHistoryEntry, type PlayerGameRecord, type WinningFactionType } from "@/lib/types";
import { Crown, Users, Play, Info, Swords, Shield, HelpCircle, UserPlus, Eye, UsersRound, ListChecks, Vote, ShieldCheck, ShieldX, ThumbsUp, ThumbsDown, CheckCircle2, XCircle, Zap, Target, History, RotateCcw, XOctagon, LogOut } from "lucide-react";
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
import { doc, getDoc, updateDoc, onSnapshot, arrayUnion, arrayRemove, serverTimestamp, Timestamp, deleteField } from "firebase/firestore";
import type { Unsubscribe } from "firebase/firestore";


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
  // Local players state is now derived from room.players for consistency
  const localPlayers = room?.players || [];

  const [selectedMissionTeam, setSelectedMissionTeam] = useState<string[]>([]);
  const [humanUndercoverCardChoice, setHumanUndercoverCardChoice] = useState<'success' | 'fail' | null>(null);
  const [selectedCoachCandidate, setSelectedCoachCandidate] = useState<string | null>(null);

  const updateFirestoreRoom = useCallback(async (updatedFields: Partial<GameRoom>) => {
    if (!roomId || typeof roomId !== 'string') return;
    const roomRef = doc(db, "rooms", roomId);

    // Create a new object excluding any properties with undefined values
    const cleanedUpdates: { [key: string]: any } = {};
    for (const key in updatedFields) {
      if (Object.prototype.hasOwnProperty.call(updatedFields, key)) {
        const value = updatedFields[key as keyof GameRoom];
        if (value !== undefined) {
          cleanedUpdates[key] = value;
        }
        // If a field needs to be explicitly removed from Firestore,
        // it should be passed as FieldValue.delete() instead of undefined.
        // For example: { coachCandidateId: deleteField() }
      }
    }

    if (Object.keys(cleanedUpdates).length === 0) {
      // Avoids an unnecessary Firestore write if all fields were undefined or no changes were made
      // console.warn("updateFirestoreRoom: No valid fields to update after cleaning.");
      return;
    }

    try {
      await updateDoc(roomRef, cleanedUpdates);
    } catch (error) {
      console.error("Error updating room in Firestore:", error, "Attempted (cleaned) updates:", cleanedUpdates, "Original updates:", updatedFields);
      toast({ title: "更新房间失败", description: "无法在服务器上更新房间状态。", variant: "destructive" });
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
        // Initial fetch to join player if necessary
        const initialDocSnap = await getDoc(roomRef);
        if (initialDocSnap.exists()) {
            let initialRoomData = { id: initialDocSnap.id, ...initialDocSnap.data() } as GameRoom;
             initialRoomData.players = initialRoomData.players || [];


            const playerExists = initialRoomData.players.some(p => p.id === user.id);

            if (!playerExists && initialRoomData.status === GameRoomStatus.Waiting && initialRoomData.players.length < initialRoomData.maxPlayers) {
                const newPlayer: Player = { ...user }; // No isCaptain here
                // Use Firestore arrayUnion to add the player
                await updateDoc(roomRef, {
                    players: arrayUnion(newPlayer)
                });
                // Firestore onSnapshot will pick up this change and update the local 'room' state
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

        // Now set up the real-time listener
        unsubscribe = onSnapshot(roomRef, (docSnap) => {
          if (docSnap.exists()) {
            const roomData = { id: docSnap.id, ...docSnap.data() } as GameRoom;
            // Ensure nested arrays/objects have defaults if not present in Firestore
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
        } else if (finalRoomState.currentRound && finalRoomState.totalRounds && finalRoomState.currentRound > finalRoomState.totalRounds) { // Changed to > totalRounds
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
        } else { // Default to draw if no other specific condition met (e.g. forced end or unexpected state)
             winningFaction = 'Draw';
             gameSummaryMessage = "游戏平局! (未知原因)";
        }
    }


    allPlayersInGame.forEach(player => {
      if (!player.role) return; // Should not happen in a finished game

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
        playersInGame: allPlayersInGame.map(p => ({ id: p.id, name: p.name, role: p.role || Role.TeamMember })), // Default role if somehow undefined
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
        // Filter out any existing record for the same gameInstanceId before adding the new one
        playerHistory = playerHistory.filter(r => r.gameInstanceId !== record.gameInstanceId);
        playerHistory.unshift(record);
        localStorage.setItem(historyKey, JSON.stringify(playerHistory.slice(0, 50))); // Limit to 50 records
      } catch (e) {
        console.error(`Failed to save game record for player ${player.id}:`, e);
      }
    });
  }, []);

  const finalizeAndRevealMissionOutcome = useCallback(async () => {
    if (!room || !room.selectedTeamForMission || !localPlayers || !room.teamScores || room.currentRound === undefined) return;

    let finalPlays: MissionCardPlay[] = [...(room.missionCardPlaysForCurrentMission || [])];

    // Simulate virtual player actions if they haven't "played" (this logic might need refinement if AI is added for this)
    room.selectedTeamForMission.forEach(playerId => {
      const player = localPlayers.find(p => p.id === playerId);
      if (player && player.id.startsWith("virtual_") && !finalPlays.some(fp => fp.playerId === playerId)) {
        const cardToPlay: 'success' | 'fail' = player.role === Role.Undercover ? 'fail' : 'success'; // Simple AI
        finalPlays.push({ playerId: player.id, card: cardToPlay });
      }
    });

    const failCardsPlayed = finalPlays.filter(p => p.card === 'fail').length;
    let missionSuccessful: boolean;

    // Rule: 7+ players, round 4 requires 2 fail cards to fail the mission
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
      captainId: room.currentCaptainId || "unknown_captain",
      teamPlayerIds: [...room.selectedTeamForMission],
      outcome: outcome,
      failCardsPlayed: failCardsPlayed,
      cardPlays: [...finalPlays], // Save detailed card plays
    };

    await updateFirestoreRoom({
        teamScores: newTeamScores,
        missionHistory: arrayUnion(missionRecord) as any, // Using arrayUnion to add to history
        currentPhase: 'mission_reveal',
        missionOutcomeForDisplay: outcome,
        failCardsPlayedForDisplay: failCardsPlayed,
        missionCardPlaysForCurrentMission: finalPlays, // Persist all plays for display
      });
    toast({ title: `第 ${room.currentRound} 轮比赛结束`, description: `结果: ${outcome === 'success' ? '成功' : '失败'} (${failCardsPlayed} 张破坏牌)`});
  }, [room, localPlayers, toast, updateFirestoreRoom]);

  useEffect(() => {
    if (!room || room.status !== GameRoomStatus.InProgress || room.currentPhase !== 'mission_execution' || !user) {
      return;
    }
    const missionTeamPlayerIds = room.selectedTeamForMission || [];
    const humanPlayersOnMission = missionTeamPlayerIds.filter(playerId => {
      const player = localPlayers.find(p => p.id === playerId);
      return player && !player.id.startsWith("virtual_");
    });

    // If no human players are on the mission (all virtual), proceed to finalize
    if (humanPlayersOnMission.length === 0 && missionTeamPlayerIds.length > 0) {
      const timer = setTimeout(() => finalizeAndRevealMissionOutcome(), 1000); // Short delay for effect
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
      const performVirtualCaptainTeamProposal = async () => {
        if (!room.currentRound || !room.missionPlayerCounts || !localPlayers.length || (room.captainChangesThisRound  || 0) >= (room.maxCaptainChangesPerRound || MAX_CAPTAIN_CHANGES_PER_ROUND)) return;
        const requiredPlayers = room.missionPlayerCounts[room.currentRound -1];
        
        let proposedTeamIds: string[] = [];
        // Virtual captain always includes themselves
        if (requiredPlayers > 0 && localPlayers.some(p => p.id === currentCaptain.id)) {
             proposedTeamIds.push(currentCaptain.id);
        }

        // Randomly select other players
        const otherPlayers = localPlayers.filter(p => p.id !== currentCaptain.id);
        const shuffledOtherPlayers = [...otherPlayers].sort(() => 0.5 - Math.random());

        for (let i = 0; proposedTeamIds.length < requiredPlayers && i < shuffledOtherPlayers.length; i++) {
            proposedTeamIds.push(shuffledOtherPlayers[i].id);
        }

        // If still not enough players (e.g. small required team size and captain was the only one needed)
        // This ensures the team is filled to the required size if possible.
        if (proposedTeamIds.length < requiredPlayers) {
            const allPlayerIds = localPlayers.map(p => p.id);
            const remainingNeeded = requiredPlayers - proposedTeamIds.length;
            const availableToPick = allPlayerIds.filter(id => !proposedTeamIds.includes(id));
            const shuffledAvailable = availableToPick.sort(() => 0.5 - Math.random());
            proposedTeamIds.push(...shuffledAvailable.slice(0, remainingNeeded));
        }
        
        proposedTeamIds = proposedTeamIds.slice(0, requiredPlayers); // Ensure correct length

        const proposedTeamNames = proposedTeamIds.map(id => localPlayers.find(p=>p.id === id)?.name || 'Unknown').join(', ');
        await updateFirestoreRoom({
            selectedTeamForMission: proposedTeamIds,
            currentPhase: 'team_voting',
            teamVotes: [], // Reset votes for the new proposal
        });
        toast({ title: "虚拟队伍已提议", description: `${currentCaptain.name} 提议: ${proposedTeamNames}` });
      };
      const timer = setTimeout(performVirtualCaptainTeamProposal, 1500); // Delay for AI "thinking"
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
    // Shuffle roles
    rolesToAssign = rolesToAssign.slice(0, playerCount).sort(() => Math.random() - 0.5);

    const updatedPlayers = localPlayers.map((player, index) => ({
      ...player, role: rolesToAssign[index],
    }));
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
        missionOutcomeForDisplay: undefined, // Explicitly undefined for reset
        failCardsPlayedForDisplay: undefined, // Explicitly undefined for reset
        teamScores: { teamMemberWins: 0, undercoverWins: 0 }, 
        missionHistory: [], 
        missionPlayerCounts: missionPlayerCounts,
        coachCandidateId: undefined, // Explicitly undefined for reset
        fullVoteHistory: [],
        currentGameInstanceId: newGameInstanceId,
      };
    await updateFirestoreRoom(updatedRoomData);
    setSelectedMissionTeam([]);
    setHumanUndercoverCardChoice(null);
    setSelectedCoachCandidate(null);
    toast({ title: "游戏开始!", description: `角色已分配。第 1 轮，队伍组建阶段。 ${updatedPlayers[firstCaptainIndex].name} 是首任队长。` });
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
      toast({ title: "错误", description: "没有更多可用的虚拟玩家名称。", variant: "destructive" }); return;
    }
    const virtualPlayerName = availableNames[Math.floor(Math.random() * availableNames.length)];
    const virtualPlayerId = `virtual_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const newVirtualPlayer: Player = {
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

  const processTeamVotes = useCallback(async (currentVotes: PlayerVote[]) => {
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
    // Use arrayUnion to add to fullVoteHistory
    const updatedFullVoteHistoryFirestore = arrayUnion(newVoteLogEntry);

    if (voteOutcome === 'approved') {
      toast({ title: "队伍已批准!", description: "进入比赛执行阶段。" });
      const currentSelectedTeam = room.selectedTeamForMission || [];
      const autoPlays: MissionCardPlay[] = [];
      currentSelectedTeam.forEach(playerId => {
        const player = localPlayers.find(p => p.id === playerId);
        if (player && !player.id.startsWith("virtual_") && (player.role === Role.TeamMember || player.role === Role.Coach)) {
          autoPlays.push({ playerId: player.id, card: 'success' });
        }
      });

      await updateFirestoreRoom({
          currentPhase: 'mission_execution', teamVotes: currentVotes, // Persist current votes for this approved team
          captainChangesThisRound: 0,
          missionCardPlaysForCurrentMission: autoPlays, 
          fullVoteHistory: updatedFullVoteHistoryFirestore as any,
      });
      setHumanUndercoverCardChoice(null);

    } else { // Vote Rejected
      let newCaptainChangesThisRound = (room.captainChangesThisRound || 0) + 1;
      if (newCaptainChangesThisRound >= (room.maxCaptainChangesPerRound || MAX_CAPTAIN_CHANGES_PER_ROUND)) {
        const finalTeamScores = { ...(room.teamScores || {teamMemberWins: 0, undercoverWins: 0}), undercoverWins: room.totalRounds || TOTAL_ROUNDS_PER_GAME };
        const finalRoomStateForRecord: GameRoom = {
          ...room, 
          status: GameRoomStatus.Finished,
          currentPhase: 'game_over' as GameRoomPhase,
          teamScores: finalTeamScores,
          teamVotes: currentVotes,
          fullVoteHistory: [...(room.fullVoteHistory || []), newVoteLogEntry], // For local record saving
          captainChangesThisRound: newCaptainChangesThisRound,
        };
        saveGameRecordForAllPlayers(finalRoomStateForRecord);
        toast({ title: "队伍被拒绝5次!", description: "卧底阵营获胜!", variant: "destructive" });
        await updateFirestoreRoom({ 
            status: GameRoomStatus.Finished,
            currentPhase: 'game_over',
            teamScores: finalTeamScores,
            teamVotes: currentVotes, 
            fullVoteHistory: updatedFullVoteHistoryFirestore as any,
            captainChangesThisRound: newCaptainChangesThisRound,
        });
      } else {
        const currentCaptainIndex = localPlayers.findIndex(p => p.id === room.currentCaptainId);
        const nextCaptainIndex = (currentCaptainIndex + 1) % localPlayers.length;
        const newCaptainId = localPlayers[nextCaptainIndex].id;
        const newCaptainName = localPlayers[nextCaptainIndex].name;
        toast({ title: "队伍被拒绝!", description: `队长顺位传给 ${newCaptainName}。` });
        await updateFirestoreRoom({
            currentCaptainId: newCaptainId,
            captainChangesThisRound: newCaptainChangesThisRound, 
            currentPhase: 'team_selection',
            selectedTeamForMission: [], 
            teamVotes: [], // Clear votes for new proposal
            fullVoteHistory: updatedFullVoteHistoryFirestore as any,
          });
        setSelectedMissionTeam([]);
      }
    }
  }, [room, user, localPlayers, toast, saveGameRecordForAllPlayers, updateFirestoreRoom]);

 const handlePlayerVote = async (vote: 'approve' | 'reject') => {
    if (!room || !user || room.currentPhase !== 'team_voting' || !localPlayers.length) {
      toast({ title: "错误", description: "当前无法投票。", variant: "destructive" }); return;
    }
    const existingVote = room.teamVotes?.find(v => v.playerId === user.id);
    if (existingVote) {
      toast({ title: "已投票", description: "您已对该队伍投过票。", variant: "destructive" }); return;
    }
    const newVote: PlayerVote = { playerId: user.id, vote };
    let updatedVotes = [...(room.teamVotes || []), newVote];

    toast({title: "投票已提交", description: `您投了 ${vote === 'approve' ? '同意' : '拒绝'}。等待其他玩家...`});

    const realPlayers = localPlayers.filter(p => !p.id.startsWith("virtual_"));
    const realPlayersWhoVotedIds = new Set(updatedVotes.filter(v => realPlayers.some(rp => rp.id === v.playerId)).map(v => v.playerId));

    if (realPlayersWhoVotedIds.size === realPlayers.length) {
      const virtualPlayers = localPlayers.filter(p => p.id.startsWith("virtual_"));
      const virtualPlayerVotes: PlayerVote[] = virtualPlayers.map(vp => {
        // Simple AI: Undercovers try to reject if team has no undercovers, approve if it does.
        // TeamMembers/Coach approve if team looks "good" (e.g. fewer known/suspected undercovers)
        // This is a placeholder for more complex AI later.
        let aiVote: 'approve' | 'reject' = 'approve'; // Default
        if (vp.role === Role.Undercover) {
            const teamHasUndercover = room.selectedTeamForMission?.some(memberId => {
                const member = localPlayers.find(p=>p.id === memberId);
                return member?.role === Role.Undercover;
            });
            aiVote = teamHasUndercover ? 'approve' : 'reject';
        } else if (vp.role === Role.Coach) {
            const teamHasUndercover = room.selectedTeamForMission?.some(memberId => {
                const member = localPlayers.find(p=>p.id === memberId);
                return member?.role === Role.Undercover;
            });
            aiVote = teamHasUndercover ? 'reject' : 'approve';
        } else { // TeamMember
            // Naive: Team members just approve for now
            aiVote = 'approve';
        }
        return { playerId: vp.id, vote: aiVote };
      });
      updatedVotes = [...updatedVotes, ...virtualPlayerVotes];
      // Update Firestore with all votes. The onSnapshot listener will then trigger UI updates and processTeamVotes if ready.
      // However, to ensure processTeamVotes is called immediately after all votes are in (including AI),
      // we call it directly here.
      // First, update Firestore with the votes.
      await updateFirestoreRoom({ teamVotes: updatedVotes });
      // Then, process them.
      await processTeamVotes(updatedVotes);
    } else {
        // Just update this user's vote in Firestore
        await updateFirestoreRoom({ teamVotes: arrayUnion(newVote) as any});
    }
  };

  const handleHumanUndercoverPlayCard = async (card: 'success' | 'fail') => {
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
    let nextPhase: GameRoomPhase = 'team_selection'; // Default next phase

    if (room.teamScores.teamMemberWins >= 3 && room.teamScores.teamMemberWins > room.teamScores.undercoverWins) {
      const humanUndercovers = localPlayers.filter(p => p.role === Role.Undercover && !p.id.startsWith("virtual_"));
      if (humanUndercovers.length > 0) {
        nextPhase = 'coach_assassination';
        toast({ title: "战队方胜利在望!", description: "卧底现在有一次指认教练的机会来反败为胜。" });
      } else { // No human undercovers to assassinate, team members win directly
        gameIsOver = true;
        nextPhase = 'game_over';
        toast({ title: "战队方获胜!", description: "卧底方无力回天。" });
      }
    } else if (room.teamScores.undercoverWins >= 3 && room.teamScores.undercoverWins > room.teamScores.teamMemberWins) {
        gameIsOver = true;
        nextPhase = 'game_over';
    } else if (room.currentRound >= room.totalRounds) { // All rounds played
        gameIsOver = true;
        nextPhase = 'game_over';
    }


    if (gameIsOver) {
      updates = { status: GameRoomStatus.Finished, currentPhase: 'game_over' };
      // Spread room to ensure all fields are present for saveGameRecordForAllPlayers
      saveGameRecordForAllPlayers({...room, ...updates, currentPhase: nextPhase } as GameRoom); 
      await updateFirestoreRoom(updates);
    } else if (nextPhase === 'coach_assassination') {
        await updateFirestoreRoom({ currentPhase: 'coach_assassination' });
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
          teamVotes: [],
          missionCardPlaysForCurrentMission: [],
          missionOutcomeForDisplay: undefined, // Reset for next round
          failCardsPlayedForDisplay: undefined, // Reset for next round
        };
      await updateFirestoreRoom(updates);
      setSelectedMissionTeam([]);
      setHumanUndercoverCardChoice(null);
      setSelectedCoachCandidate(null);
      toast({ title: `第 ${nextRoundNumber} 轮开始`, description: `队长是 ${localPlayers.find(p=>p.id === newCaptainId)?.name}` });
    }
  };

  const handleConfirmCoachAssassination = async () => {
    if (!room || !user || !selectedCoachCandidate || currentUserRole !== Role.Undercover || room.currentPhase !== 'coach_assassination' || !localPlayers.length) {
        toast({title: "错误", description: "无法确认指认。", variant: "destructive"});
        return;
    }
    const actualCoach = localPlayers.find(p => p.role === Role.Coach);
    if (!actualCoach) {
      toast({ title: "游戏错误", description: "未找到教练角色。", variant: "destructive" });
      const finalRoomStateForError: Partial<GameRoom> = { status: GameRoomStatus.Finished, currentPhase: 'game_over' };
      saveGameRecordForAllPlayers({...room, ...finalRoomStateForError} as GameRoom);
      await updateFirestoreRoom(finalRoomStateForError);
      return;
    }

    let finalTeamScores = { ...(room.teamScores!) };
    let toastTitle = "";
    let toastDescription = "";

    if (selectedCoachCandidate === actualCoach.id) {
      // Undercover wins by assassination, TeamMember wins are reduced to ensure Undercover is sole winner in score if they had fewer.
      // This effectively means TeamMember did not achieve 3 wins.
      finalTeamScores.teamMemberWins = Math.min(finalTeamScores.teamMemberWins, 2); 
      toastTitle = "指认成功！卧底方反败为胜！";
      toastDescription = `${actualCoach.name} 是教练！`;
    } else {
      // Team Members win as assassination failed. Their 3+ wins are confirmed.
      toastTitle = "指认失败！战队方获胜！";
      const wronglyAccusedPlayer = localPlayers.find(p => p.id === selectedCoachCandidate);
      toastDescription = `${wronglyAccusedPlayer?.name || '被指认者'} 不是教练。`;
    }

    const finalUpdates: Partial<GameRoom> = {
      status: GameRoomStatus.Finished,
      currentPhase: 'game_over',
      teamScores: finalTeamScores,
      coachCandidateId: selectedCoachCandidate,
    };
    saveGameRecordForAllPlayers({...room, ...finalUpdates} as GameRoom);
    await updateFirestoreRoom(finalUpdates);
    toast({ title: toastTitle, description: toastDescription, duration: 5000 });
    setSelectedCoachCandidate(null);
  };

  const handleReturnToLobbyAndLeaveRoom = useCallback(async () => {
    if (!user) { // Should not happen if user is on this page, but good check
        router.push("/");
        return;
    }
    const currentRoomId = typeof roomId === 'string' ? roomId : null;
    const currentRoomName = room?.name || "一个房间"; // Fallback name for toast

    // If the user is in the current room's player list and is not the host, remove them.
    if (currentRoomId && room && room.players.some(p => p.id === user.id) && room.hostId !== user.id) {
        const roomRef = doc(db, "rooms", currentRoomId);
        const playerToRemove = room.players.find(p => p.id === user.id); // Get the full player object to remove
        if (playerToRemove) {
            try {
                await updateDoc(roomRef, {
                    players: arrayRemove(playerToRemove)
                });
                toast({ title: "已离开房间", description: `您已离开房间 ${currentRoomName}。` });
            } catch (e) {
                console.error("Failed to update Firestore on leave:", e);
                toast({ title: "离开房间失败", description: `无法从房间 ${currentRoomName} 移除您。`, variant: "destructive" });
            }
        }
    } else if (room && room.hostId === user.id) {
         toast({ title: "已离开房间", description: `您作为房主已离开房间 ${currentRoomName}。房间可能仍然存在。`});
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
    // Reset roles and captain status for all players
    const currentPlayersWithResetRoles = room.players.map(p => ({
        id: p.id, 
        name: p.name, 
        avatarUrl: p.avatarUrl, 
        role: undefined // Explicitly reset role
    }));

    const updates: Partial<GameRoom> = {
        players: currentPlayersWithResetRoles,
        status: GameRoomStatus.Waiting,
        currentCaptainId: undefined, // Will be set by assignRolesAndCaptain
        currentRound: undefined,
        captainChangesThisRound: undefined,
        currentPhase: undefined, // Will be set by UI logic based on Waiting status
        selectedTeamForMission: [],
        teamVotes: [],
        missionCardPlaysForCurrentMission: [],
        missionOutcomeForDisplay: undefined,
        failCardsPlayedForDisplay: undefined,
        teamScores: { teamMemberWins: 0, undercoverWins: 0 },
        missionHistory: [],
        fullVoteHistory: [],
        coachCandidateId: undefined,
        currentGameInstanceId: newGameInstanceId, // New game instance ID
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
      // Scores remain as they were
    };
    // Ensure all fields are present for saveGameRecordForAllPlayers
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
  const currentUserIsUndercoverOnMission = currentUserIsOnMission && currentUserRole === Role.Undercover;
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
    if (p.id === user.id) return false;
    if (fellowUndercovers.some(fu => fu.id === p.id)) return false; // Can't target fellow undercovers
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
    } else if (room.currentRound && room.totalRounds && room.currentRound > room.totalRounds) { // Changed to > totalRounds
        if (undercoverMissionWins > teamMemberMissionWins) {
            gameOverMessageNode = <span className="text-destructive">卧底阵营胜利! (比赛结束时胜场较多)</span>;
        } else if (teamMemberMissionWins > undercoverMissionWins) {
            gameOverMessageNode = <span className="text-green-600">战队阵营胜利! (比赛结束时胜场较多)</span>;
        } else {
             gameOverMessageNode = <span className="text-foreground">游戏平局! (比分 {teamMemberMissionWins} : {undercoverMissionWins})</span>;
        }
    } else { // Fallback for other game end scenarios (e.g. host forced end)
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
              <Card><CardHeader>
                <CardTitle className="text-primary">游戏控制 / 状态</CardTitle>
                 <div className="text-sm text-muted-foreground p-1 bg-secondary/30 rounded-md border text-center">
                  {room.currentRound !== undefined && room.captainChangesThisRound !== undefined && (
                     <p className="font-semibold">第 {room.currentRound} 场比赛，第 {(room.captainChangesThisRound || 0) + 1} 次组队</p>
                  )}
                </div>
              </CardHeader><CardContent className="space-y-4">

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
    </div>
  );
}

