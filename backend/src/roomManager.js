// Room Manager for Multiplayer Wordle (Task 4)
// Manages multiple game rooms and handles room lifecycle

const MultiplayerGame = require('./multiplayerGame');

class RoomManager {
  constructor() {
    this.rooms = new Map(); // roomId -> MultiplayerGame
    this.cleanupInterval = null;
    this.startCleanupTimer();
  }

  // Create a new multiplayer game room
  createRoom(maxPlayers = 4, gameMode = 'normal') {
    const roomId = this.generateRoomId();
    
    // Ensure unique room ID
    while (this.rooms.has(roomId)) {
      roomId = this.generateRoomId();
    }
    
    const room = new MultiplayerGame(roomId, maxPlayers, gameMode);
    this.rooms.set(roomId, room);
    
    console.log(`Created room: ${roomId} (${gameMode} mode, max ${maxPlayers} players)`);
    return room;
  }

  // Join an existing room
  joinRoom(roomId, playerId, playerName) {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Room not found');
    }
    
    if (room.gameState !== 'WAITING') {
      throw new Error('Game already in progress');
    }
    
    if (room.players.size >= room.maxPlayers) {
      throw new Error('Room is full');
    }
    
    const player = room.addPlayer(playerId, playerName);
    console.log(`Player ${playerName} joined room ${roomId}`);
    
    return room;
  }

  // Get a specific room
  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  // Get all active rooms (for lobby)
  getActiveRooms() {
    const activeRooms = [];
    
    for (const [roomId, room] of this.rooms.entries()) {
      // Only show rooms that are waiting for players
      if (room.gameState === 'WAITING') {
        activeRooms.push(room.getRoomInfo());
      }
    }
    
    return activeRooms.sort((a, b) => b.createdAt - a.createdAt);
  }

  // Remove a room
  deleteRoom(roomId) {
    const room = this.rooms.get(roomId);
    if (room) {
      console.log(`Deleting room: ${roomId}`);
      this.rooms.delete(roomId);
      return true;
    }
    return false;
  }

  // Generate a unique room ID
  generateRoomId() {
    // Generate 6-character alphanumeric code
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // Get room statistics
  getStats() {
    const totalRooms = this.rooms.size;
    const waitingRooms = Array.from(this.rooms.values())
      .filter(room => room.gameState === 'WAITING').length;
    const activeGames = Array.from(this.rooms.values())
      .filter(room => room.gameState === 'PLAYING').length;
    const finishedGames = Array.from(this.rooms.values())
      .filter(room => room.gameState === 'FINISHED').length;
    
    return {
      totalRooms,
      waitingRooms,
      activeGames,
      finishedGames,
      totalPlayers: Array.from(this.rooms.values())
        .reduce((sum, room) => sum + room.players.size, 0)
    };
  }

  // Clean up inactive rooms
  cleanupInactiveRooms() {
    const now = new Date();
    const roomsToDelete = [];
    
    for (const [roomId, room] of this.rooms.entries()) {
      // Delete rooms that are inactive for more than 30 minutes
      if (room.isInactive(30)) {
        roomsToDelete.push(roomId);
      }
      
      // Delete finished games older than 1 hour
      if (room.gameState === 'FINISHED' && 
          (now - room.lastActivity) / (1000 * 60 * 60) > 1) {
        roomsToDelete.push(roomId);
      }
    }
    
    // Delete inactive rooms
    for (const roomId of roomsToDelete) {
      this.deleteRoom(roomId);
    }
    
    if (roomsToDelete.length > 0) {
      console.log(`Cleaned up ${roomsToDelete.length} inactive rooms`);
    }
  }

  // Start automatic cleanup timer
  startCleanupTimer() {
    // Clean up every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveRooms();
    }, 5 * 60 * 1000);
  }

  // Stop cleanup timer (for testing or shutdown)
  stopCleanupTimer() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  // Get room by player ID (find which room a player is in)
  getRoomByPlayer(playerId) {
    for (const [roomId, room] of this.rooms.entries()) {
      // Check direct player ID first
      if (room.players.has(playerId)) {
        return { roomId, room };
      }
      
      // Check socket mapping for reconnected players
      if (room.getPlayerBySocketId && room.getPlayerBySocketId(playerId)) {
        return { roomId, room };
      }
    }
    return null;
  }

  // Remove player from any room they're in
  removePlayerFromRoom(socketId) {
    // Find room by socket ID
    let playerRoom = null;
    for (const [roomId, room] of this.rooms.entries()) {
      if (room.socketToPlayer && room.socketToPlayer.has(socketId)) {
        playerRoom = { roomId, room };
        break;
      }
    }
    
    if (playerRoom) {
      const { roomId, room } = playerRoom;
      room.removePlayer(socketId);
      
      // Check if all players are disconnected (but don't delete room immediately)
      const activePlayers = Array.from(room.players.values())
        .filter(p => p.status !== 'DISCONNECTED');
      
      if (activePlayers.length === 0) {
        // All players disconnected, mark room for cleanup later
        console.log(`Room ${roomId} has no active players, marking for cleanup`);
      }
      
      return { roomId, room }; // Return room info for updates
    }
    return null;
  }

  // Handle explicit player leave (for Leave Room action)
  handlePlayerExplicitLeave(persistentPlayerId) {
    // Find room by persistent player ID
    let playerRoom = null;
    for (const [roomId, room] of this.rooms.entries()) {
      if (room.players.has(persistentPlayerId)) {
        playerRoom = { roomId, room };
        break;
      }
    }
    
    if (playerRoom) {
      const { roomId, room } = playerRoom;
      const removed = room.explicitlyRemovePlayer(persistentPlayerId);
      
      if (removed) {
        // If room is empty, delete it
        if (room.players.size === 0) {
          this.deleteRoom(roomId);
          console.log(`Room ${roomId} deleted - no players remaining`);
          return null; // Room was deleted
        }
        
        return { roomId, room }; // Return room info for updates
      }
    }
    return null;
  }

  // Broadcast message to all players in a room
  broadcastToRoom(roomId, event, data) {
    const room = this.rooms.get(roomId);
    if (room) {
      return {
        roomId,
        event,
        data,
        timestamp: new Date()
      };
    }
    return null;
  }

  // Get public room information (for lobby display)
  getPublicRoomInfo() {
    const publicRooms = [];
    
    for (const [roomId, room] of this.rooms.entries()) {
      // Only show rooms that are waiting for players
      if (room.gameState === 'WAITING') {
        publicRooms.push({
          roomId: room.roomId,
          gameMode: room.gameMode,
          playerCount: room.players.size,
          maxPlayers: room.maxPlayers,
          createdAt: room.createdAt,
          lastActivity: room.lastActivity
        });
      }
    }
    
    return publicRooms.sort((a, b) => b.createdAt - a.createdAt);
  }
}

module.exports = RoomManager; 