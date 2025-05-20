
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { GameRoom, Player, User } from '@/lib/types';
import { GameRoomStatus, type GameRoomPhase, type MissionOutcome, type GeneratedFailureReason, Role } from '@/lib/types';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, onSnapshot, arrayUnion, Unsubscribe, Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { 
  MISSIONS_CONFIG, 
  TOTAL_ROUNDS_PER_GAME, 
  MAX_CAPTAIN_CHANGES_PER_ROUND, 
  MIN_PLAYERS_TO_START 
} from '@/lib/game-config';

const defaultMissionPlayerCounts = MISSIONS_CONFIG[MIN_PLAYERS_TO_START];

export function useGameRoom(roomId: string, user: User | null, authLoading: boolean) {
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (authLoading || !user || typeof roomId !== 'string') {
      if (!authLoading && !user && typeof roomId === 'string' && roomId) {
        router.push(`/login?redirect=/rooms/${roomId}`);
      }
      if (!roomId && !authLoading) setIsLoading(false); // Ensure loading stops if no roomId
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

      try {
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
            // Firestore listener will pick up this change and update the room state.
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
      } catch (error) {
        console.error("Error during initial room check or player join:", error);
        toast({ title: "加入房间失败", description: (error as Error).message, variant: "destructive" });
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
            missionPlayerCounts: roomData.missionPlayerCounts || MISSIONS_CONFIG[roomData.players?.length || MIN_PLAYERS_TO_START] || defaultMissionPlayerCounts,
            totalRounds: roomData.totalRounds || TOTAL_ROUNDS_PER_GAME,
            maxCaptainChangesPerRound: roomData.maxCaptainChangesPerRound || MAX_CAPTAIN_CHANGES_PER_ROUND,
            selectedTeamForMission: roomData.selectedTeamForMission || [],
            createdAt: roomData.createdAt || Timestamp.now() // Ensure createdAt is present
          };
          setRoom(validatedRoom);
        } else {
          toast({ title: "房间不存在", description: "该房间可能已被删除。", variant: "destructive" });
          setRoom(null); 
          router.push("/");
        }
        setIsLoading(false);
      }, (error) => {
        console.error("Error listening to room updates:", error);
        toast({ title: "房间监听错误", description: "与房间的连接丢失。", variant: "destructive" });
        setIsLoading(false);
        setRoom(null); 
        router.push("/");
      });
    };
    
    if (roomId && user) { // Ensure roomId and user are available before setting up
        setupSnapshotListener();
    } else {
        setIsLoading(false); // Stop loading if essential params are missing
    }


    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [roomId, user, authLoading, router, toast]);

  return { room, isLoading };
}
