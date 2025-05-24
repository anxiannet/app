
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
  RoomMode,
  type OfflineKeywordPlayerSetup, // New import
  type KeywordThemeName, // New import
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
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button"; // Added Button import
import { ScrollArea } from "@/components/ui/scroll-area"; // Added ScrollArea import

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
import { Swords, Shield, HelpCircle, KeyRound as KeyRoundIcon, ListChecks, Info } from "lucide-react"; // Added KeyRoundIcon, ListChecks, Info

import {
  ROLES_CONFIG,
  MISSIONS_CONFIG,
  MIN_PLAYERS_TO_START,
  TOTAL_ROUNDS_PER_GAME,
  MAX_CAPTAIN_CHANGES_PER_ROUND,
  HONOR_OF_KINGS_HERO_NAMES,
  FAILURE_REASONS_LIST_FOR_FALLBACK,
  PRE_GENERATED_AVATARS,
  STANDARD_PRESET_TEMPLATES, // Renamed PRESET_ROOM_TEMPLATES
  OFFLINE_KEYWORD_PRESET_TEMPLATES, // New import
} from '@/lib/game-config';
import { KEYWORD_THEMES_DATA, shuffleArray } from "@/lib/offline-keywords"; // New import


const VoteHistoryAccordion = dynamic(() => import('@/components/game-room/VoteHistoryAccordion').then(mod => mod.VoteHistoryAccordion), {
  loading: () => <p>正在加载投票记录...</p>,
  ssr: false
});

const ROOMS_LOCAL_STORAGE_KEY = "anxian-rooms";
const getManualRevealCompletedKey = (roomId: string, gameInstanceId: string | undefined) => `anxian_reveal_completed_${roomId}_${gameInstanceId || 'default'}`;
const getManualRevealCurrentIndexKey = (roomId: string, gameInstanceId: string | undefined) => `anxian_reveal_current_index_${roomId}_${gameInstanceId || 'default'}`;
const getManualMissionPlayerIndexKey = (roomId: string, gameInstanceId: string | undefined | null) => `anxian_manual_mission_player_index_${roomId}_${gameInstanceId || 'default'}`;
const getManualMissionPlaysCollectedKey = (roomId: string, gameInstanceId: string | undefined | null) => `anxian_manual_mission_plays_${roomId}_${gameInstanceId || 'default'}`;
const getOfflineKeywordSetupsKey = (roomId: string, gameInstanceId: string | undefined) => `anxian_offline_setups_${roomId}_${gameInstanceId || 'default'}`;


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

  const [manualRoleRevealIndex, setManualRoleRevealIndex] = useState<number | null>(null);
  const [isManualRoleVisible, setIsManualRoleVisible] = useState<boolean>(false);
  const [manualRoleRevealCompleted, setManualRoleRevealCompleted] = useState<boolean>(false);

  const [manualMissionPlayerIndex, setManualMissionPlayerIndex] = useState<number | null>(null);
  const [isManualCardInputVisible, setIsManualCardInputVisible] = useState<boolean>(false);
  const [manualMissionPlaysCollected, setManualMissionPlaysCollected] = useState<MissionCardPlay[]>([]);


  const generateOfflineKeywordSetups = useCallback((presetRoomTemplate: typeof OFFLINE_KEYWORD_PRESET_TEMPLATES[0]): OfflineKeywordPlayerSetup[] => {
    const availableThemeKeys = shuffleArray(Object.keys(KEYWORD_THEMES_DATA));
    if (availableThemeKeys.length < presetRoomTemplate.playerCount) {
      console.error("Not enough unique keyword themes for the number of players!");
      // Potentially throw an error or return empty/fallback setups
      return [];
    }

    return presetRoomTemplate.players.map((templatePlayer, index) => {
      const assignedThemeKey = availableThemeKeys[index] as KeywordThemeName;
      const themeKeywords = shuffleArray(KEYWORD_THEMES_DATA[assignedThemeKey]);
      
      if (themeKeywords.length < 60) {
        console.warn(`Theme "${assignedThemeKey}" has fewer than 60 keywords. Keyword repetition may occur or generation might fail.`);
      }

      const successKeywords = themeKeywords.slice(0, 30);
      const failKeywords = themeKeywords.slice(30, 60);

      if (successKeywords.length < 30 || failKeywords.length < 30) {
           console.error(`Could not generate enough unique keywords for player ${templatePlayer.name} with theme ${assignedThemeKey}. Required 30 for success, 30 for fail.`);
           // Handle this error - e.g., by assigning fewer keywords or stopping
      }


      return {
        id: `offline_player_${index}_${Date.now()}`, // Generate a temporary unique ID
        name: templatePlayer.name,
        role: templatePlayer.role,
        avatarUrl: PRE_GENERATED_AVATARS[index % PRE_GENERATED_AVATARS.length],
        keywordTheme: assignedThemeKey,
        successKeywords: successKeywords,
        failKeywords: failKeywords,
      };
    });
  }, []);


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
      let allRooms: GameRoom[] = storedRoomsRaw ? JSON.parse(storedRoomsRaw) : [];
      let currentRoomData = allRooms.find(r => r.id === roomId);

      const standardTemplate = STANDARD_PRESET_TEMPLATES.find(t => t.id === roomId);
      const offlineKeywordTemplate = OFFLINE_KEYWORD_PRESET_TEMPLATES.find(t => t.id === roomId);

      if (!currentRoomData && (standardTemplate || offlineKeywordTemplate)) {
        const template = standardTemplate || offlineKeywordTemplate!;
        const newPlayer: Player = { id: user.id, name: user.name, avatarUrl: user.avatarUrl || PRE_GENERATED_AVATARS[0] };
        
        let initialOfflineSetups: OfflineKeywordPlayerSetup[] | undefined = undefined;
        let initialPlayersForRoom: Player[];

        if (template.mode === RoomMode.OfflineKeyword && offlineKeywordTemplate) {
            // For offline keyword mode, players are defined by the template, not by who joins.
            // The 'user' who clicked is conceptually the GM/first observer.
            // We generate the setups but don't necessarily add the current user to a 'players' list
            // in the same way as online/manual modes. The `offlinePlayerSetups` IS the player list.
            initialOfflineSetups = generateOfflineKeywordSetups(offlineKeywordTemplate);
             // Players in GameRoom for offlineKeyword mode might just be the template players
            initialPlayersForRoom = initialOfflineSetups.map(s => ({id: s.id, name: s.name, role: s.role, avatarUrl: s.avatarUrl}));

        } else {
            initialPlayersForRoom = [newPlayer];
        }


        const newRoomForStorage: GameRoom = {
          id: template.id,
          name: template.name,
          players: initialPlayersForRoom,
          maxPlayers: template.maxPlayers || template.playerCount || MIN_PLAYERS_TO_START,
          status: GameRoomStatus.Waiting, // OfflineKeyword rooms might go straight to 'InProgress' for setup display
          hostId: user.id, // Current user becomes host/GM
          createdAt: new Date().toISOString(),
          mode: template.mode,
          teamScores: { teamMemberWins: 0, undercoverWins: 0 },
          missionHistory: [],
          fullVoteHistory: [],
          missionPlayerCounts: (standardTemplate?.missionPlayerCounts) || MISSIONS_CONFIG[template.maxPlayers || template.playerCount || MIN_PLAYERS_TO_START] || MISSIONS_CONFIG[MIN_PLAYERS_TO_START],
          totalRounds: (standardTemplate?.totalRounds) || TOTAL_ROUNDS_PER_GAME,
          maxCaptainChangesPerRound: (standardTemplate?.maxCaptainChangesPerRound) || MAX_CAPTAIN_CHANGES_PER_ROUND,
          selectedTeamForMission: [],
          teamVotes: [],
          missionCardPlaysForCurrentMission: [],
          currentGameInstanceId: `gameinst_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // New game instance
          offlinePlayerSetups: initialOfflineSetups,
        };

        if (newRoomForStorage.mode === RoomMode.OfflineKeyword && newRoomForStorage.offlinePlayerSetups) {
          // For offline keyword, game starts immediately to show setup.
          newRoomForStorage.status = GameRoomStatus.InProgress; 
          localStorage.setItem(getOfflineKeywordSetupsKey(newRoomForStorage.id, newRoomForStorage.currentGameInstanceId), JSON.stringify(newRoomForStorage.offlinePlayerSetups));
        }


        allRooms.push(newRoomForStorage);
        localStorage.setItem(ROOMS_LOCAL_STORAGE_KEY, JSON.stringify(allRooms));
        currentRoomData = newRoomForStorage;
        toast({ title: `已加入 ${template.name}`, description: "你是当前房间的主持人/游戏设定者。" });
      
      } else if (currentRoomData && currentRoomData.mode === RoomMode.OfflineKeyword && currentRoomData.status === GameRoomStatus.InProgress && !currentRoomData.offlinePlayerSetups) {
        // Attempt to load persisted offline setups if page was refreshed
        const setupsKey = getOfflineKeywordSetupsKey(currentRoomData.id, currentRoomData.currentGameInstanceId);
        const storedSetups = localStorage.getItem(setupsKey);
        if (storedSetups) {
            try {
                currentRoomData.offlinePlayerSetups = JSON.parse(storedSetups);
            } catch(e) {
                console.error("Error parsing stored offline setups", e);
                // Potentially regenerate or show error
            }
        } else {
            // Setups not found, might need regeneration if template exists
            const templateForRegen = OFFLINE_KEYWORD_PRESET_TEMPLATES.find(t => t.id === roomId);
            if (templateForRegen) {
                currentRoomData.offlinePlayerSetups = generateOfflineKeywordSetups(templateForRegen);
                currentRoomData.players = currentRoomData.offlinePlayerSetups.map(s => ({id: s.id, name: s.name, role: s.role, avatarUrl: s.avatarUrl}));
                localStorage.setItem(setupsKey, JSON.stringify(currentRoomData.offlinePlayerSetups));
            }
        }
      }


      if (currentRoomData) {
        // Standard player joining logic for Online/Manual modes
        if (currentRoomData.mode === RoomMode.Online || currentRoomData.mode === RoomMode.ManualInput) {
            const playerExists = currentRoomData.players.some(p => p.id === user.id);
            if (!playerExists && currentRoomData.status === GameRoomStatus.Waiting && currentRoomData.players.length < currentRoomData.maxPlayers) {
            const newPlayer: Player = { id: user.id, name: user.name, avatarUrl: user.avatarUrl || PRE_GENERATED_AVATARS[currentRoomData.players.length % PRE_GENERATED_AVATARS.length] };
            currentRoomData.players.push(newPlayer);
            // updateLocalStorageRoom will handle saving
            } else if (!playerExists && currentRoomData.status !== GameRoomStatus.Waiting) {
            toast({ title: "游戏已开始或结束", description: "无法加入已开始或结束的游戏。", variant: "destructive" });
            router.push("/");
            return;
            } else if (!playerExists && currentRoomData.players.length >= currentRoomData.maxPlayers) {
            toast({ title: "房间已满", description: "此房间已满。", variant: "destructive" });
            router.push("/");
            return;
            }
        }
        
        setRoom(currentRoomData);

        // Manual Mode Reveal State Initialization from localStorage
        if (currentRoomData.mode === RoomMode.ManualInput &&
            currentRoomData.status === GameRoomStatus.InProgress &&
            currentRoomData.currentGameInstanceId) {

          const revealCompletedKey = getManualRevealCompletedKey(currentRoomData.id, currentRoomData.currentGameInstanceId);
          const isRevealSequenceCompleted = localStorage.getItem(revealCompletedKey) === 'true';
          setManualRoleRevealCompleted(isRevealSequenceCompleted);
          setIsManualRoleVisible(false); // Always hide role initially on load/refresh

          if (isRevealSequenceCompleted) {
            setManualRoleRevealIndex(null);
          } else {
            const revealIndexKey = getManualRevealCurrentIndexKey(currentRoomData.id, currentRoomData.currentGameInstanceId);
            const storedIndex = localStorage.getItem(revealIndexKey);
            if (storedIndex !== null) {
                const parsedIndex = parseInt(storedIndex, 10);
                if (!isNaN(parsedIndex) && parsedIndex >= 0 && currentRoomData.players && parsedIndex < currentRoomData.players.length) {
                    setManualRoleRevealIndex(parsedIndex);
                } else {
                    console.warn("Invalid manual role reveal index found in localStorage, defaulting to 0 for game:", currentRoomData.currentGameInstanceId);
                    setManualRoleRevealIndex(0); // Default to 0 if stored index is bad
                    localStorage.setItem(revealIndexKey, "0");
                }
            } else {
                setManualRoleRevealIndex(0); // Default to 0 if no index stored
            }
          }
        } else {
            setManualRoleRevealCompleted(false);
            setManualRoleRevealIndex(null);
            setIsManualRoleVisible(false);
        }

        // Manual Mode Mission Execution State Initialization
        if (currentRoomData.mode === RoomMode.ManualInput &&
            currentRoomData.status === GameRoomStatus.InProgress &&
            currentRoomData.currentPhase === 'mission_execution' &&
            currentRoomData.currentGameInstanceId && currentRoomData.selectedTeamForMission) {

            const missionIndexKey = getManualMissionPlayerIndexKey(currentRoomData.id, currentRoomData.currentGameInstanceId);
            const storedMissionIndex = localStorage.getItem(missionIndexKey);
            if (storedMissionIndex !== null) {
                const parsedIndex = parseInt(storedMissionIndex, 10);
                 if (!isNaN(parsedIndex) && parsedIndex >= 0 && currentRoomData.selectedTeamForMission && parsedIndex < currentRoomData.selectedTeamForMission.length) {
                    setManualMissionPlayerIndex(parsedIndex);
                } else {
                    setManualMissionPlayerIndex(0);
                    localStorage.setItem(missionIndexKey, "0");
                }
            } else {
                setManualMissionPlayerIndex(0);
                localStorage.setItem(missionIndexKey, "0");
            }
            setIsManualCardInputVisible(false);

            const playsCollectedKey = getManualMissionPlaysCollectedKey(currentRoomData.id, currentRoomData.currentGameInstanceId);
            const storedPlays = localStorage.getItem(playsCollectedKey);
            if (storedPlays) {
                try {
                    setManualMissionPlaysCollected(JSON.parse(storedPlays));
                } catch (e) {
                    console.error("Error parsing stored manual mission plays:", e);
                    setManualMissionPlaysCollected([]);
                    localStorage.setItem(playsCollectedKey, JSON.stringify([]));
                }
            } else {
                setManualMissionPlaysCollected([]);
                 localStorage.setItem(playsCollectedKey, JSON.stringify([]));
            }
        } else {
             setManualMissionPlayerIndex(null);
             setIsManualCardInputVisible(false);
             setManualMissionPlaysCollected([]);
        }


      } else {
        toast({ title: "房间未找到", description: "请求的房间不存在或已关闭。", variant: "destructive" });
        router.push("/");
      }
    } catch (e) {
      console.error("Error loading room from localStorage:", e);
      toast({ title: "加载房间失败", variant: "destructive" });
      router.push("/");
    }
    setIsLoading(false);
  }, [roomId, user, authLoading, router, toast, generateOfflineKeywordSetups]);

  const updateLocalStorageRoom = useCallback((updatedRoomData: GameRoom | null) => {
    if (!updatedRoomData || !roomId) return;
    try {
      const storedRoomsRaw = localStorage.getItem(ROOMS_LOCAL_STORAGE_KEY);
      let allRooms: GameRoom[] = storedRoomsRaw ? JSON.parse(storedRoomsRaw) : [];
      const roomIndex = allRooms.findIndex(r => r.id === roomId);
      if (roomIndex !== -1) {
        allRooms[roomIndex] = updatedRoomData;
      } else {
        allRooms.push(updatedRoomData);
      }
      localStorage.setItem(ROOMS_LOCAL_STORAGE_KEY, JSON.stringify(allRooms));
    } catch (e) {
      console.error("Error saving room to localStorage:", e);
    }
  }, [roomId]);

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
    if (typeof window === "undefined" || finalRoomState.status !== GameRoomStatus.Finished || !finalRoomState.currentGameInstanceId || finalRoomState.mode === RoomMode.OfflineKeyword) return; // Do not save records for offline keyword mode

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
         // This case might indicate an unexpected game end (e.g. host forced end)
        winningFaction = 'Draw'; 
        gameSummaryMessage = "游戏提前结束!";
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
          const playerDetail: { id: string; name: string; role: Role; avatarUrl?: string; } = {
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
        playerHistory = playerHistory.slice(0, 10);
        localStorage.setItem(historyKey, JSON.stringify(playerHistory));
      } catch (e) {
        console.error(`Failed to save game record for player ${player.id}:`, e);
      }
    });
  }, []);

  const finalizeAndRevealMissionOutcome = useCallback(() => {
    if (!room || !room.selectedTeamForMission || !room.players || !room.teamScores || room.currentRound === undefined) return;
    if (room.mode === RoomMode.OfflineKeyword) return; // Not applicable for offline mode

    let finalPlays: MissionCardPlay[] = [...(room.missionCardPlaysForCurrentMission || [])];
    const playersInRoom = room.players;

    if (room.mode === RoomMode.Online) {
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
    if (!room || room.mode !== RoomMode.Online || room.status !== GameRoomStatus.InProgress || room.currentPhase !== 'mission_execution' || !user) {
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


  const assignRolesAndCaptain = () => {
    if (!room || !(room.players?.length) || room.players.length < MIN_PLAYERS_TO_START || room.mode === RoomMode.OfflineKeyword) return;
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

    if (room.mode === RoomMode.ManualInput && room.id && newGameInstanceId) {
      localStorage.removeItem(getManualRevealCompletedKey(room.id, room.currentGameInstanceId)); // Clear for old instance
      localStorage.removeItem(getManualRevealCurrentIndexKey(room.id, room.currentGameInstanceId));
      localStorage.removeItem(getManualMissionPlayerIndexKey(room.id, room.currentGameInstanceId));
      localStorage.removeItem(getManualMissionPlaysCollectedKey(room.id, room.currentGameInstanceId));
      
      localStorage.removeItem(getManualRevealCompletedKey(room.id, newGameInstanceId)); // Clear for new instance just in case
      localStorage.removeItem(getManualRevealCurrentIndexKey(room.id, newGameInstanceId));
    }


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

    setManualMissionPlayerIndex(null);
    setIsManualCardInputVisible(false);
    setManualMissionPlaysCollected([]);

    if (room?.mode === RoomMode.ManualInput) {
      setManualRoleRevealIndex(0);
      setIsManualRoleVisible(false);
      setManualRoleRevealCompleted(false);
    }

    toast({ title: "游戏开始!", description: `角色已分配。第 1 场比赛，队伍组建阶段。 ${updatedPlayers[firstCaptainIndex].name} 是首任队长。` });
  };

  const handleStartGame = () => {
    if (!room || !user || room.hostId !== user.id || room.mode === RoomMode.OfflineKeyword) {
      toast({ title: "未授权或模式错误", description: "只有主持人可以开始在线或手动模式游戏。", variant: "destructive" }); return;
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
    if (!room || !user || room.hostId !== user.id || room.status !== GameRoomStatus.Waiting || room.mode !== RoomMode.Online) {
      toast({ title: "未授权或模式错误", description: "只有主持人在等待阶段的在线模式房间可以添加虚拟玩家。", variant: "destructive" }); return;
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

  const handleManualAddPlayer = (nickname: string) => {
    if (!room || !user || room.hostId !== user.id || room.status !== GameRoomStatus.Waiting || room.mode !== RoomMode.ManualInput) {
      toast({ title: "操作无效", description: "当前无法手动添加玩家。", variant: "destructive" });
      return;
    }
    if (room.players.length >= room.maxPlayers) {
      toast({ title: "房间已满", description: "无法添加更多玩家。", variant: "destructive" });
      return;
    }
    if (!nickname.trim()) {
      toast({ title: "昵称不能为空", variant: "destructive" });
      return;
    }
    if (room.players.some(p => p.name === nickname.trim())) {
      toast({ title: "昵称已存在", description: "该昵称已被使用，请输入其他昵称。", variant: "destructive" });
      return;
    }

    const newManualPlayer: Player = {
      id: `manual_${Date.now()}_${nickname.trim().replace(/\s+/g, '_')}`, 
      name: nickname.trim(),
      avatarUrl: PRE_GENERATED_AVATARS[room.players.length % PRE_GENERATED_AVATARS.length],
    };
    setRoom(prevRoom => prevRoom ? { ...prevRoom, players: [...(prevRoom.players || []), newManualPlayer] } : null);
    toast({ title: "真实玩家已添加", description: `${nickname.trim()} 已加入房间。` });
  };


  const handleHumanProposeTeam = () => {
    if (!room || !user || room.currentPhase !== 'team_selection' || !room.missionPlayerCounts || room.currentRound === undefined || room.mode === RoomMode.OfflineKeyword) {
      toast({ title: "错误", description: "当前无法提议队伍。", variant: "destructive" }); return;
    }
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
        teamVotes: [] 
    } : null);
  };

  const handlePlayerSelectionForMission = (playerId: string) => {
    if (!room || !user || room.currentPhase !== 'team_selection' || !room.missionPlayerCounts || room.currentRound === undefined || room.mode === RoomMode.OfflineKeyword) {
      return;
    }
    const canSelect = (room.mode === RoomMode.Online && room.currentCaptainId === user.id) ||
                      (room.mode === RoomMode.ManualInput && room.hostId === user.id);
    if (!canSelect) return;


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
    if (!room || !user || !(room.players?.length) || !room.teamScores || room.currentRound === undefined || room.currentCaptainId === undefined || room.mode === RoomMode.OfflineKeyword) return;
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

      if (room.mode === RoomMode.Online) {
        currentSelectedTeam.forEach(playerId => {
          const player = playersInRoom.find(p => p.id === playerId);
          if (player && !player.id.startsWith("virtual_") && (player.role === Role.TeamMember || player.role === Role.Coach)) {
            if (!room.missionCardPlaysForCurrentMission?.some(p => p.playerId === playerId)) {
              autoPlays.push({ playerId: player.id, card: 'success' });
            }
          }
        });
      }

      setRoom(prevRoom => {
        if (!prevRoom) return null;
        const updates: Partial<GameRoom> = {
            currentPhase: 'mission_execution',
            missionCardPlaysForCurrentMission: autoPlays,
            fullVoteHistory: updatedFullVoteHistory,
            captainChangesThisRound: 0,
            teamVotes: currentVotes, 
        };
        if (prevRoom.mode === RoomMode.ManualInput) {
            setManualMissionPlayerIndex(0);
            setIsManualCardInputVisible(false);
            setManualMissionPlaysCollected([]);
            if (prevRoom.id && prevRoom.currentGameInstanceId) {
                localStorage.setItem(getManualMissionPlayerIndexKey(prevRoom.id, prevRoom.currentGameInstanceId), "0");
                localStorage.setItem(getManualMissionPlaysCollectedKey(prevRoom.id, prevRoom.currentGameInstanceId), JSON.stringify([]));
            }
        }
        return { ...prevRoom, ...updates };
      });
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
          teamVotes: currentVotes, 
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
          selectedTeamForMission: [],
          teamVotes: [], 
          fullVoteHistory: updatedFullVoteHistory,
        } : null);
        setSelectedMissionTeam([]);
      }
    }
  }, [room, user, toast, saveGameRecordForAllPlayers]);

  const handlePlayerVote = (vote: 'approve' | 'reject') => {
    if (!room || !user || room.currentPhase !== 'team_voting' || !(room.players?.length) || room.mode !== RoomMode.Online) {
      toast({ title: "错误", description: "当前无法投票或模式不正确。", variant: "destructive" }); return;
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

  useEffect(() => {
    if (!room || room.mode !== RoomMode.Online || room.status !== GameRoomStatus.InProgress || room.currentPhase !== 'team_voting' || !room.players || room.players.length === 0 || !user) {
      return;
    }

    const currentVotes = room.teamVotes || [];
    const humanPlayers = room.players.filter(p => !p.id.startsWith("virtual_") && !p.id.startsWith("manual_") );
    const humanPlayersWhoVotedIds = new Set(currentVotes.filter(v => humanPlayers.some(hp => hp.id === v.playerId)).map(v => v.playerId));

    if (humanPlayersWhoVotedIds.size === humanPlayers.length) { 
      const virtualPlayers = room.players.filter(p => p.id.startsWith("virtual_"));
      const virtualPlayersWhoHaventVoted = virtualPlayers.filter(vp => !currentVotes.some(v => v.playerId === vp.id));

      if (virtualPlayersWhoHaventVoted.length > 0) {
        toast({ description: "虚拟玩家正在投票..." });
        let virtualVotesBatch: PlayerVote[] = [];
        for (const vp of virtualPlayersWhoHaventVoted) {
          virtualVotesBatch.push({ playerId: vp.id, vote: 'approve' });
        }
        const finalVotesWithVirtual = [...currentVotes, ...virtualVotesBatch];
        setRoom(prevRoom => prevRoom ? { ...prevRoom, teamVotes: finalVotesWithVirtual } : null);
      }
    }
  }, [room?.teamVotes, room?.players, room?.currentPhase, room?.status, room?.mode, user, toast, setRoom]);

  const handleBulkSubmitVotes = (submittedVotes: PlayerVote[]) => {
    if (!room || room.currentPhase !== 'team_voting' || room.mode !== RoomMode.ManualInput) {
        toast({ title: "错误", description: "当前无法提交投票或模式不正确。", variant: "destructive" });
        return;
    }
    setRoom(prevRoom => prevRoom ? { ...prevRoom, teamVotes: submittedVotes } : null);
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (
      room?.currentPhase === 'team_voting' &&
      room.teamVotes &&
      room.players &&
      room.teamVotes.length === room.players.length &&
      room.players.length > 0 &&
      room.mode !== RoomMode.OfflineKeyword
    ) {
      timer = setTimeout(() => {
        if (room?.currentPhase === 'team_voting' && room.teamVotes && room.players && room.teamVotes.length === room.players.length) {
          processTeamVotes(room.teamVotes);
        }
      }, 3000); 
    }
    return () => clearTimeout(timer);
  }, [room?.teamVotes, room?.currentPhase, room?.players, processTeamVotes, room]);


  const handleHumanUndercoverPlayCard = (card: 'success' | 'fail') => {
    if (!room || !user || room.currentPhase !== 'mission_execution' || !currentUserIsOnMission || currentUserRole !== Role.Undercover || room.mode !== RoomMode.Online) {
      toast({ title: "错误", description: "当前无法打出比赛牌或模式不正确。", variant: "destructive" });
      return;
    }
    const existingPlay = room.missionCardPlaysForCurrentMission?.find(p => p.playerId === user.id);
    if (existingPlay && room.mode === RoomMode.Online) {
      toast({ title: "已行动", description: "您已在本轮比赛中行动过。", variant: "default" });
      return;
    }

    setHumanUndercoverCardChoice(card);
    const newPlay: MissionCardPlay = { playerId: user.id, card };

    setRoom(prevRoom => prevRoom ? {
        ...prevRoom,
        missionCardPlaysForCurrentMission: [...(prevRoom.missionCardPlaysForCurrentMission || []), newPlay]
    } : null);
    toast({ title: "比赛牌已打出", description: `你打出了【${card === 'success' ? '成功' : '破坏'}】。` });
  };

  const handleShowManualCardInput = useCallback(() => {
    setIsManualCardInputVisible(true);
  }, []);

  const handleManualCardPlay = useCallback((card: 'success' | 'fail') => {
    if (!room || !user || room.hostId !== user.id || room.mode !== RoomMode.ManualInput || manualMissionPlayerIndex === null || !room.selectedTeamForMission) {
        toast({ title: "错误", description: "无法记录手动出牌。", variant: "destructive" });
        return;
    }
    const missionTeam = room.selectedTeamForMission;
    if (manualMissionPlayerIndex >= missionTeam.length) {
        toast({ title: "错误", description: "无效的玩家索引。", variant: "destructive" });
        return;
    }

    const currentPlayerId = missionTeam[manualMissionPlayerIndex];
    const updatedManualPlays = [...manualMissionPlaysCollected, { playerId: currentPlayerId, card }];
    setManualMissionPlaysCollected(updatedManualPlays);
    if (room.id && room.currentGameInstanceId) {
        localStorage.setItem(getManualMissionPlaysCollectedKey(room.id, room.currentGameInstanceId), JSON.stringify(updatedManualPlays));
    }
    setIsManualCardInputVisible(false);

    const nextMissionPlayerIndex = manualMissionPlayerIndex + 1;
    if (nextMissionPlayerIndex < missionTeam.length) {
        setManualMissionPlayerIndex(nextMissionPlayerIndex);
        if (room.id && room.currentGameInstanceId) {
            localStorage.setItem(getManualMissionPlayerIndexKey(room.id, room.currentGameInstanceId), nextMissionPlayerIndex.toString());
        }
    } else {
        setRoom(prevRoom => {
            if (!prevRoom) return null;
            return { ...prevRoom, missionCardPlaysForCurrentMission: updatedManualPlays };
        });
        setManualMissionPlayerIndex(null);
         if (room.id && room.currentGameInstanceId) {
            localStorage.removeItem(getManualMissionPlayerIndexKey(room.id, room.currentGameInstanceId));
        }
    }
  }, [room, user, manualMissionPlayerIndex, manualMissionPlaysCollected, toast]);

  useEffect(() => { 
      if (room && room.mode === RoomMode.ManualInput && room.currentPhase === 'mission_execution' &&
          room.selectedTeamForMission && room.missionCardPlaysForCurrentMission &&
          room.missionCardPlaysForCurrentMission.length === room.selectedTeamForMission.length &&
          room.selectedTeamForMission.length > 0 &&
          manualMissionPlayerIndex === null // Indicates all manual plays have been collected and set to room state
          ) {
            finalizeAndRevealMissionOutcome();
            if (room.id && room.currentGameInstanceId) {
                localStorage.removeItem(getManualMissionPlaysCollectedKey(room.id, room.currentGameInstanceId));
            }
      }
  }, [room?.missionCardPlaysForCurrentMission, room?.mode, room?.currentPhase, room?.selectedTeamForMission, manualMissionPlayerIndex, finalizeAndRevealMissionOutcome, room]);


  const handleProceedToNextRoundOrGameOver = useCallback(() => {
    if (!room || !room.teamScores || room.currentRound === undefined || room.totalRounds === undefined || !(room.players?.length) || room.mode === RoomMode.OfflineKeyword) return;
    const playersInRoom = room.players;
    let updates: Partial<GameRoom> = {};
    let gameIsOver = false;
    let nextPhase: GameRoomPhase = 'team_selection';

    console.log(`[GameLogic] Proceeding. Current scores: Team Members: ${room.teamScores?.teamMemberWins}, Undercovers: ${room.teamScores?.undercoverWins}. Round: ${room.currentRound}`);

    if (room.teamScores.teamMemberWins >= 3 && room.teamScores.teamMemberWins > room.teamScores.undercoverWins) {
      const canAssassinate = (room.mode === RoomMode.Online && playersInRoom.some(p => p.role === Role.Undercover && !p.id.startsWith("virtual_"))) ||
                             (room.mode === RoomMode.ManualInput && playersInRoom.some(p => p.role === Role.Undercover));
      const hasCoach = playersInRoom.some(p => p.role === Role.Coach);

      if (canAssassinate && hasCoach) {
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

      if (room?.mode === RoomMode.ManualInput && room.id && room.currentGameInstanceId) {
         setManualMissionPlayerIndex(null);
         setIsManualCardInputVisible(false);
         setManualMissionPlaysCollected([]);
         localStorage.removeItem(getManualMissionPlayerIndexKey(room.id, room.currentGameInstanceId));
         localStorage.removeItem(getManualMissionPlaysCollectedKey(room.id, room.currentGameInstanceId));
      }

      setRoom(prevRoom => prevRoom ? { ...prevRoom, ...newRoomState } : null);
      setSelectedMissionTeam([]);
      setHumanUndercoverCardChoice(null);
      setSelectedCoachCandidate(null);
      toast({ title: `第 ${nextRoundNumber} 场比赛开始`, description: `队长是 ${playersInRoom.find(p => p.id === newCaptainId)?.name}` });
    }
  }, [room, toast, saveGameRecordForAllPlayers]);


  const handleConfirmCoachAssassination = () => {
    if (!room || !user || !selectedCoachCandidate || room.currentPhase !== 'coach_assassination' || !(room.players?.length) || room.mode === RoomMode.OfflineKeyword) {
      toast({ title: "错误", description: "无法确认指认。", variant: "destructive" });
      return;
    }
    const isHostInManualMode = room.mode === RoomMode.ManualInput && user.id === room.hostId;
    const isUndercoverInOnlineMode = room.mode === RoomMode.Online && currentUserRole === Role.Undercover;

    if (!isHostInManualMode && !isUndercoverInOnlineMode) {
      toast({ title: "错误", description: "当前用户无权执行此操作。", variant: "destructive" });
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

      if (user.id === room.hostId && (room.status === GameRoomStatus.Waiting || room.mode === RoomMode.OfflineKeyword) ) {
        updatedRooms = updatedRooms.filter(r => r.id !== currentRoomId);
        toast({ title: "房间已关闭", description: `您作为主持人/设定者已关闭了房间 ${currentRoomName}。` });
      } else if (room.mode !== RoomMode.OfflineKeyword) { // Non-hosts can't "leave" an offline keyword setup display
        const roomIndex = updatedRooms.findIndex(r => r.id === currentRoomId);
        if (roomIndex !== -1) {
          updatedRooms[roomIndex].players = updatedRooms[roomIndex].players.filter(p => p.id !== user.id);
           if (updatedRooms[roomIndex].players.length === 0 && updatedRooms[roomIndex].hostId !== user.id) {
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
    if (!room || !user || room.hostId !== user.id || room.mode === RoomMode.OfflineKeyword) {
      toast({ title: "错误", description: "只有主持人可以重置在线/手动模式游戏。", variant: "destructive" });
      return;
    }
    if (room.status !== GameRoomStatus.Finished) {
      toast({ title: "错误", description: "游戏尚未结束，无法重置。", variant: "destructive" });
      return;
    }
    const oldGameInstanceId = room.currentGameInstanceId;
    const newGameInstanceId = `gameinst_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    if (room.mode === RoomMode.ManualInput && room.id && oldGameInstanceId) {
      localStorage.removeItem(getManualRevealCompletedKey(room.id, oldGameInstanceId));
      localStorage.removeItem(getManualRevealCurrentIndexKey(room.id, oldGameInstanceId));
      localStorage.removeItem(getManualMissionPlayerIndexKey(room.id, oldGameInstanceId));
      localStorage.removeItem(getManualMissionPlaysCollectedKey(room.id, oldGameInstanceId));
    }


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
      offlinePlayerSetups: undefined, // Clear offline setups if any
    };

    setRoom(prevRoom => prevRoom ? { ...prevRoom, ...updates } : null);
    setManualRoleRevealIndex(null);
    setIsManualRoleVisible(false);
    setManualRoleRevealCompleted(false);
    setManualMissionPlayerIndex(null);
    setIsManualCardInputVisible(false);
    setManualMissionPlaysCollected([]);


    setSelectedMissionTeam([]);
    setHumanUndercoverCardChoice(null);
    setSelectedCoachCandidate(null);
    toast({ title: "游戏已重置", description: "房间已重置为等待状态。主持人可以开始新游戏。" });
  };

  const requestForceEndGame = () => {
    if (!room || !user || room.hostId !== user.id || room.status !== GameRoomStatus.InProgress || room.mode === RoomMode.OfflineKeyword) {
      toast({ title: "错误", description: "当前无法终止游戏。", variant: "destructive" });
      return;
    }
    setShowTerminateConfirmDialog(true);
  };

  const handleForceEndGame = () => {
    if (!room || !user || room.hostId !== user.id || room.mode === RoomMode.OfflineKeyword) {
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

  const handleRemovePlayer = (playerIdToRemove: string) => {
    if (!room || !user || user.id !== room.hostId || room.status !== GameRoomStatus.Waiting || room.mode === RoomMode.OfflineKeyword) {
      toast({ title: "操作无效", description: "当前无法移除该玩家。", variant: "destructive" });
      return;
    }
     if (playerIdToRemove === user.id) {
      toast({ title: "操作无效", description: "主持人不能移除自己。", variant: "destructive" });
      return;
    }

    const playerToRemove = room.players.find(p => p.id === playerIdToRemove);
    if (!playerToRemove) {
      toast({ title: "错误", description: "未找到指定的玩家。", variant: "destructive" });
      return;
    }

    const canRemove = (room.mode === RoomMode.ManualInput) ||
                      (room.mode === RoomMode.Online && playerToRemove.id.startsWith("virtual_"));

    if (!canRemove) {
        toast({ title: "操作无效", description: "在线模式下只能移除虚拟玩家。", variant: "destructive" });
        return;
    }

    setRoom(prevRoom => {
        if (!prevRoom) return null;
        const updatedPlayers = prevRoom.players.filter(p => p.id !== playerIdToRemove);
        return { ...prevRoom, players: updatedPlayers };
    });
    toast({ title: "玩家已移除", description: `${playerToRemove.name} 已被移除出房间。` });
  };

  const handleShowMyRoleManual = useCallback(() => {
    if (!room || !room.players || manualRoleRevealIndex === null || !room.id || !room.currentGameInstanceId || room.mode !== RoomMode.ManualInput) return;

    setIsManualRoleVisible(true);
    
    const nextPlayerIndexForStorage = (manualRoleRevealIndex ?? -1) + 1;
    if (nextPlayerIndexForStorage < room.players.length) {
        localStorage.setItem(getManualRevealCurrentIndexKey(room.id, room.currentGameInstanceId), nextPlayerIndexForStorage.toString());
    } else {
        localStorage.setItem(getManualRevealCompletedKey(room.id, room.currentGameInstanceId), 'true');
        localStorage.removeItem(getManualRevealCurrentIndexKey(room.id, room.currentGameInstanceId));
    }
  }, [room, manualRoleRevealIndex]);


  const handleNextPlayerForRoleReveal = () => {
    setIsManualRoleVisible(false); // Hide current role first
    if (room && room.players && manualRoleRevealIndex !== null && room.id && room.currentGameInstanceId && room.mode === RoomMode.ManualInput) {
      const nextIndexForReactState = (manualRoleRevealIndex ?? -1) + 1;

      if (nextIndexForReactState < room.players.length) {
        setManualRoleRevealIndex(nextIndexForReactState);
        // The localStorage for current index was already updated by handleShowMyRoleManual
      } else {
        setManualRoleRevealCompleted(true);
        setManualRoleRevealIndex(null);
        // localStorage for completion was already updated by handleShowMyRoleManual
      }
    }
  };

  useEffect(() => {
    if (room?.mode === RoomMode.ManualInput && room.status === GameRoomStatus.InProgress && room.id && room.currentGameInstanceId) {
      const revealCompletedKey = getManualRevealCompletedKey(room.id, room.currentGameInstanceId);
      const isRevealSequenceCompleted = localStorage.getItem(revealCompletedKey) === 'true';

      setManualRoleRevealCompleted(isRevealSequenceCompleted);
      setIsManualRoleVisible(false);

      if (isRevealSequenceCompleted) {
        setManualRoleRevealIndex(null);
      } else {
        const revealIndexKey = getManualRevealCurrentIndexKey(room.id, room.currentGameInstanceId);
        const storedIndex = localStorage.getItem(revealIndexKey);
        if (storedIndex !== null) {
            const parsedIndex = parseInt(storedIndex, 10);
            if (!isNaN(parsedIndex) && parsedIndex >= 0 && room.players && parsedIndex < room.players.length) {
                setManualRoleRevealIndex(parsedIndex);
            } else {
                console.warn("Invalid manual role reveal index found in localStorage, defaulting to 0 for game:", room.currentGameInstanceId);
                setManualRoleRevealIndex(0);
            }
        } else {
            setManualRoleRevealIndex(0);
        }
        setIsManualRoleVisible(false); 
      }
    }
  }, [room?.mode, room?.status, room?.id, room?.currentGameInstanceId, room?.players?.length]); // Added room.players.length


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
  const canAddVirtualPlayer = isHostCurrentUser && room.status === GameRoomStatus.Waiting && room.players.length < room.maxPlayers && room.mode === RoomMode.Online;
  const canStartGame = isHostCurrentUser && room.status === GameRoomStatus.Waiting && room.players.length >= MIN_PLAYERS_TO_START && room.players.length <= room.maxPlayers && room.mode !== RoomMode.OfflineKeyword;

  const knownUndercoversByCoach = (currentUserRole === Role.Coach && room.status === GameRoomStatus.InProgress && room.mode !== RoomMode.OfflineKeyword) ? room.players.filter(p => p.role === Role.Undercover) : [];
  const fellowUndercovers = (currentUserRole === Role.Undercover && room.status === GameRoomStatus.InProgress && room.mode !== RoomMode.OfflineKeyword) ? room.players.filter(p => p.role === Role.Undercover && p.id !== user.id) : [];
  const isSoleUndercover = currentUserRole === Role.Undercover && room.status === GameRoomStatus.InProgress && room.mode !== RoomMode.OfflineKeyword && room.players.filter(p => p.role === Role.Undercover).length === 1;

  const votesToDisplay = room.teamVotes || [];

  let assassinationTargetOptions: Player[] = [];
  if (room.status === GameRoomStatus.InProgress && room.currentPhase === 'coach_assassination' && room.mode !== RoomMode.OfflineKeyword) {
    if (room.mode === RoomMode.ManualInput) {
      assassinationTargetOptions = room.players.filter(p => p.role !== Role.Undercover);
    } else { 
      const successfulCaptainIds = new Set(
        (room.missionHistory || [])
          .filter(mission => mission.outcome === 'success')
          .map(mission => mission.captainId)
      );
      assassinationTargetOptions = room.players.filter(p => {
        if (!successfulCaptainIds.has(p.id)) return false;
        if (currentUserRole === Role.Undercover && p.id === user.id) return false; 
        if (p.role === Role.Undercover) return false; // Cannot target known undercovers
        return true;
      });
    }
  }


  let gameOverMessageNode: React.ReactNode = "游戏结束!";
  if (room.status === GameRoomStatus.Finished && room.mode !== RoomMode.OfflineKeyword) {
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

  const totalHumanPlayersInRoom = room.players.filter(p => !p.id.startsWith("virtual_") && !p.id.startsWith("manual_")).length;


  const playerForManualReveal = (manualRoleRevealIndex !== null && room.players && manualRoleRevealIndex < room.players.length)
    ? room.players[manualRoleRevealIndex]
    : undefined;

  const isLastPlayerForManualReveal = manualRoleRevealIndex !== null && room.players ? manualRoleRevealIndex === room.players.length - 1 : false;

  const showManualRoleRevealUI = room.mode === RoomMode.ManualInput &&
                                 room.status === GameRoomStatus.InProgress &&
                                 !manualRoleRevealCompleted &&
                                 manualRoleRevealIndex !== null &&
                                 user.id === room.hostId; // Only host interacts with this UI

  const isPlayerListInSelectionMode =
       room.status === GameRoomStatus.InProgress &&
       room.currentPhase === 'team_selection' &&
       room.mode !== RoomMode.OfflineKeyword &&
       (
         (room.mode === RoomMode.Online && isDesignatedCaptainTheCurrentUser) ||
         (room.mode === RoomMode.ManualInput && isHostCurrentUser)
       );

  const showActiveTeamSelectionControls =
    room.status === GameRoomStatus.InProgress &&
    room.currentPhase === 'team_selection' &&
    room.mode !== RoomMode.OfflineKeyword &&
    (
      (room.mode === RoomMode.Online && isDesignatedCaptainTheCurrentUser) ||
      (room.mode === RoomMode.ManualInput && isHostCurrentUser)
    );


  if (room.mode === RoomMode.OfflineKeyword) {
    // UI for Offline Keyword Setup Display
    return (
        <div className="space-y-6">
            <Card className="shadow-xl">
                <CardHeader>
                    <CardTitle className="text-3xl text-primary flex items-center">
                        <KeyRoundIcon className="mr-3 h-8 w-8 text-yellow-500" />
                        {room.name} - 游戏设定
                    </CardTitle>
                    <CardDescription>请记录以下信息以进行线下游戏。每位玩家的暗语主题和词汇都不同。</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button onClick={handleReturnToLobbyAndLeaveRoom} variant="outline" className="mb-4">返回大厅并关闭设定</Button>
                    {room.offlinePlayerSetups && room.offlinePlayerSetups.length > 0 ? (
                        <ScrollArea className="h-[calc(100vh-20rem)]">
                            <div className="space-y-4">
                                {room.offlinePlayerSetups.map((setup, idx) => (
                                    <Card key={setup.id || idx} className="p-4">
                                        <h3 className="text-xl font-semibold text-secondary-foreground mb-2">
                                            {setup.name} (<span className={
                                                setup.role === Role.Undercover ? "text-destructive" :
                                                setup.role === Role.Coach ? "text-yellow-600" :
                                                "text-blue-600"
                                            }>{setup.role}</span>) - 主题: {setup.keywordTheme}
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
                                            <div>
                                                <h4 className="font-medium text-green-600">同意/成功 暗语 (30个):</h4>
                                                <ul className="list-disc list-inside text-sm text-muted-foreground h-40 overflow-y-auto border p-2 rounded-md">
                                                    {setup.successKeywords.map(kw => <li key={kw}>{kw}</li>)}
                                                </ul>
                                            </div>
                                            <div>
                                                <h4 className="font-medium text-red-600">反对/失败 暗语 (30个):</h4>
                                                 <ul className="list-disc list-inside text-sm text-muted-foreground h-40 overflow-y-auto border p-2 rounded-md">
                                                    {setup.failKeywords.map(kw => <li key={kw}>{kw}</li>)}
                                                </ul>
                                            </div>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        </ScrollArea>
                    ) : (
                        <p className="text-muted-foreground">正在生成暗语设定，或设定信息不可用...</p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
  }


  // Standard UI for Online and Manual Input modes
  return (
    <div className="space-y-6">
      <RoomHeader
        room={room}
        isHost={isHostCurrentUser}
        onPromptTerminateGame={requestForceEndGame}
      />

      {!showManualRoleRevealUI && room.status === GameRoomStatus.InProgress && room.mode === RoomMode.Online && (
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
            isInSelectionMode={isPlayerListInSelectionMode}
            selectedPlayersForMission={selectedMissionTeam}
            onTogglePlayerForMission={handlePlayerSelectionForMission}
            selectionLimitForMission={requiredPlayersForCurrentMission}
            isCoachAssassinationModeActive={
              room.currentPhase === 'coach_assassination' &&
              (
                (room.mode === RoomMode.Online && currentUserRole === Role.Undercover) ||
                (room.mode === RoomMode.ManualInput && isHostCurrentUser)
              )
            }
            selectedCoachCandidateId={selectedCoachCandidate}
            onSelectCoachCandidate={setSelectedCoachCandidate}
            assassinationTargetOptionsPlayerIds={assassinationTargetOptions.map(p => p.id)}
            onRemovePlayer={handleRemovePlayer}
            isHostCurrentUser={isHostCurrentUser}
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
                      onPlayerVote={handlePlayerVote}
                      onBulkSubmitVotes={handleBulkSubmitVotes}
                      currentPhase={room.currentPhase}
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
                      allPlayersInRoom={room.players}
                      currentUserIsOnMission={currentUserIsOnMission}
                      currentUserRole={currentUserRole}
                      currentUserHasPlayedMissionCard={currentUserHasPlayedMissionCard}
                      onHumanUndercoverPlayCard={handleHumanUndercoverPlayCard}
                      missionCardPlaysForCurrentMission={room.missionCardPlaysForCurrentMission || []}
                      manualMissionPlayerIndex={manualMissionPlayerIndex}
                      isManualCardInputVisible={isManualCardInputVisible}
                      onShowManualCardInput={handleShowManualCardInput}
                      onManualCardPlay={handleManualCardPlay}
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
                      roomMode={room.mode}
                      onManualAddPlayer={handleManualAddPlayer}
                  />
              </CardContent></Card>
            )}

            {room.status === GameRoomStatus.Finished && (
              <GameOverSummary
                room={room}
                gameOverMessage={gameOverMessageNode}
                onReturnToLobby={handleReturnToLobbyAndLeaveRoom}
                isHost={isHostCurrentUser}
                onRestartGame={handleRestartGame}
              />
            )}

            { (room.status === GameRoomStatus.InProgress || room.status === GameRoomStatus.Finished) &&
              room.fullVoteHistory && room.fullVoteHistory.length > 0 && room.mode !== RoomMode.OfflineKeyword && (
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
