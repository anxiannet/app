"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { PlusCircle, Users, LogIn } from "lucide-react";
import type { GameRoom, Player } from "@/lib/types";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";

// Mock function to create a unique room ID
const createRoomId = () => `room_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

export default function LobbyPage() {
  const [rooms, setRooms] = useState<GameRoom[]>([]);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  // Effect to load/mock rooms (client-side only)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const mockRooms: GameRoom[] = [
        { id: createRoomId(), name: "Mystery Mansion", players: [{id: "player1", name: "Host"} as Player], maxPlayers: 6, status: "waiting", hostId: "player1" },
        { id: createRoomId(), name: "Cyber Heist", players: [], maxPlayers: 8, status: "waiting", hostId: "player2" },
      ];
       // Retrieve rooms from localStorage or use mock
      const storedRooms = localStorage.getItem("anxian-rooms");
      if (storedRooms) {
        setRooms(JSON.parse(storedRooms));
      } else {
        setRooms(mockRooms);
        localStorage.setItem("anxian-rooms", JSON.stringify(mockRooms));
      }
    }
  }, []);

  const handleCreateRoom = () => {
    if (!user) {
      toast({ title: "Login Required", description: "Please log in to create a room.", variant: "destructive" });
      router.push("/login");
      return;
    }
    const newRoomId = createRoomId();
    const newRoomName = `Room ${rooms.length + 1}`; // Simple default name
    const newRoom: GameRoom = {
      id: newRoomId,
      name: newRoomName,
      players: [], // Host will join on room page
      maxPlayers: 6, // Default max players
      status: "waiting",
      hostId: user.id,
    };
    
    const updatedRooms = [...rooms, newRoom];
    setRooms(updatedRooms);
    if (typeof window !== "undefined") {
      localStorage.setItem("anxian-rooms", JSON.stringify(updatedRooms));
    }
    router.push(`/rooms/${newRoomId}`);
  };

  if (authLoading) {
    return <div className="text-center py-10">Loading authentication...</div>;
  }

  return (
    <div className="space-y-8">
      <section className="text-center py-10 bg-card shadow-lg rounded-lg">
        <h1 className="text-5xl font-extrabold tracking-tight text-primary">
          Welcome to 暗线
        </h1>
        <p className="mt-4 text-xl text-muted-foreground">
          Unravel mysteries, expose the hidden, and claim victory.
        </p>
        <div className="mt-8">
          <Button 
            size="lg" 
            onClick={handleCreateRoom}
            className="bg-accent hover:bg-accent/90 text-accent-foreground transition-transform hover:scale-105 active:scale-95 shadow-md"
          >
            <PlusCircle className="mr-2 h-6 w-6" /> Create New Room
          </Button>
        </div>
      </section>

      <section>
        <h2 className="text-3xl font-semibold mb-6 text-center text-foreground/80">Available Rooms</h2>
        {rooms.length === 0 ? (
          <p className="text-center text-muted-foreground">No rooms available. Why not create one?</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rooms.map((room) => (
              <Card key={room.id} className="hover:shadow-xl transition-shadow duration-300 ease-in-out transform hover:-translate-y-1">
                <CardHeader>
                  <CardTitle className="text-primary truncate">{room.name}</CardTitle>
                  <CardDescription>Max Players: {room.maxPlayers}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Users className="mr-2 h-4 w-4" />
                    <span>{room.players.length} / {room.maxPlayers} players</span>
                  </div>
                  <div className="flex items-center text-sm text-muted-foreground">
                    Status: <span className={`ml-1 font-semibold ${room.status === 'waiting' ? 'text-green-500' : 'text-yellow-500'}`}>{room.status}</span>
                  </div>
                   <Image 
                    src={`https://placehold.co/600x400.png?text=${encodeURIComponent(room.name)}`} 
                    alt={room.name}
                    width={600}
                    height={400}
                    className="rounded-md mt-2 aspect-video object-cover"
                    data-ai-hint="game concept art" 
                  />
                </CardContent>
                <CardFooter>
                  <Button asChild className="w-full bg-primary hover:bg-primary/90 text-primary-foreground transition-transform hover:scale-105 active:scale-95">
                    <Link href={`/rooms/${room.id}`}>
                      <LogIn className="mr-2 h-4 w-4" /> Join Room
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
