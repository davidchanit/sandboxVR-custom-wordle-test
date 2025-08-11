const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const GameFactory = require('./gameFactory');
const RoomManager = require('./roomManager');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// In-memory game sessions (keyed by sessionId)
const sessions = {};

// Example word list (replace with file/db in production)
const WORD_LIST = [
  'SOUTH', 'BOUND', 'YOUTH', 'LOUIS', 'OLIVE', 'AROMA', 'COUCH', 'WORLD', 'HELLO', 'FRESH', 'PANIC', 'CRAZY', 'BUGGY', 'FANCY', 'QUITE', 'SCARE'
];

// Helper: generate random session ID
function genSessionId() {
  return Math.random().toString(36).substr(2, 9);
}

// Start a new game
app.post('/api/start', (req, res) => {
  const { maxRounds = 6, mode = 'normal' } = req.body;
  
  // Validate mode
  if (!['normal', 'cheating'].includes(mode)) {
    return res.status(400).json({ error: 'Invalid mode. Must be "normal" or "cheating"' });
  }
  
  const sessionId = genSessionId();
  const game = GameFactory.createGame(mode, WORD_LIST, maxRounds);
  sessions[sessionId] = game;
  
  res.json({ 
    sessionId, 
    mode,
    state: game.getState() 
  });
});

// Make a guess
app.post('/api/guess', (req, res) => {
  const { sessionId, guess } = req.body;
  if (!sessionId || !sessions[sessionId]) {
    return res.status(400).json({ error: 'Invalid session' });
  }
  const game = sessions[sessionId];
  const result = game.makeGuess(guess);
  res.json(result);
});

// Get game state
app.get('/api/state', (req, res) => {
  const { sessionId } = req.query;
  if (!sessionId || !sessions[sessionId]) {
    return res.status(400).json({ error: 'Invalid session' });
  }
  const game = sessions[sessionId];
  res.json(game.getState());
});

// Get available game modes
app.get('/api/modes', (req, res) => {
  res.json({
    modes: [
      {
        id: 'normal',
        name: 'Normal Mode',
        description: 'Classic Wordle game with a fixed answer'
      },
      {
        id: 'cheating',
        name: 'Cheating Mode',
        description: 'Host adapts to prolong the game (harder to win)'
      }
    ]
  });
});

// Multiplayer API endpoints
app.get('/api/multiplayer/rooms', (req, res) => {
  res.json(roomManager.getPublicRoomInfo());
});

app.get('/api/multiplayer/stats', (req, res) => {
  res.json(roomManager.getStats());
});

// Initialize room manager
const roomManager = new RoomManager();

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join or create room
  socket.on('joinRoom', ({ roomId, playerName, createNew = false, maxPlayers = 4, gameMode = 'normal' }) => {
    try {
      let room;
      
      if (createNew) {
        room = roomManager.createRoom(maxPlayers, gameMode);
        roomId = room.roomId;
        // Add the creator to the room
        room.addPlayer(socket.id, playerName);
      } else {
        room = roomManager.joinRoom(roomId, socket.id, playerName);
      }
      
      socket.join(roomId);
      socket.emit('roomJoined', { roomId, room: room.broadcastGameState() });
      socket.to(roomId).emit('playerJoined', { playerId: socket.id, playerName });
      
      // Update all players in the room with the new state
      io.to(roomId).emit('roomUpdated', room.broadcastGameState());
      
      // Broadcast updated room list to all clients
      io.emit('roomsUpdated', roomManager.getActiveRooms());
      
      console.log(`Player ${playerName} ${createNew ? 'created' : 'joined'} room ${roomId}`);
      
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });

  // Start game
  socket.on('startGame', ({ roomId }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        throw new Error('Room not found');
      }
      
      room.startGame();
      io.to(roomId).emit('gameStarted', room.broadcastGameState());
      
      // Broadcast updated room list to all clients
      io.emit('roomsUpdated', roomManager.getActiveRooms());
      
      console.log(`Game started in room ${roomId}`);
      
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });

  // Rejoin room (for page refresh)
  socket.on('rejoinRoom', ({ roomId, playerName }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        socket.emit('rejoinRoom', { 
          success: false, 
          message: 'Room not found' 
        });
        return;
      }
      
      // Check if player exists in room
      const existingPlayer = Array.from(room.players.values())
        .find(p => p.name === playerName);
      
      if (!existingPlayer) {
        socket.emit('rejoinRoom', { 
          success: false, 
          message: `Player "${playerName}" not found in room. Available players: ${Array.from(room.players.values()).map(p => p.name).join(', ')}` 
        });
        return;
      }
      
      // Check if player is already connected through another socket
      for (const [socketId, mappedPlayerId] of room.socketToPlayer.entries()) {
        if (mappedPlayerId === existingPlayer.id) {
          socket.emit('rejoinRoom', { 
            success: false, 
            message: `Player "${playerName}" is already connected through another session. Please close other browser tabs first.` 
          });
          return;
        }
      }
      
      // Update player's socket ID to the new one
      const reconnected = room.updatePlayerSocketId(playerName, socket.id);
      
      if (!reconnected) {
        socket.emit('rejoinRoom', { 
          success: false, 
          message: `Failed to reconnect player "${playerName}". Player may be in an invalid state.` 
        });
        return;
      }
      
      // Rejoin the room
      socket.join(roomId);
      socket.emit('rejoinRoom', { 
        success: true, 
        roomId, 
        room: room.broadcastGameState(),
        playerName: playerName // Include player name for frontend identification
      });
      
      // Notify other players
      socket.to(roomId).emit('playerRejoined', { 
        playerId: existingPlayer.id, 
        playerName 
      });
      
      // Update all players in the room with the new state (except the rejoining player)
      socket.to(roomId).emit('roomUpdated', room.broadcastGameState());
      
      // Broadcast updated room list to all clients
      io.emit('roomsUpdated', roomManager.getActiveRooms());
      
      console.log(`Player ${playerName} rejoined room ${roomId} with new socket ID ${socket.id}`);
      
    } catch (error) {
      socket.emit('rejoinRoom', { 
        success: false, 
        message: error.message 
      });
    }
  });

  // Make guess
  socket.on('makeGuess', ({ roomId, guess }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        throw new Error('Room not found');
      }
      
      const result = room.makeGuess(socket.id, guess);
      
      if (result.valid) {
        io.to(roomId).emit('guessMade', {
          playerId: socket.id,
          guess,
          feedback: result.feedback,
          gameState: room.broadcastGameState()
        });
        
        // Check if round/game ended
        if (result.status === 'WIN' || result.status === 'LOSE') {
          io.to(roomId).emit('roundEnded', room.broadcastGameState());
          
          // Check if a new round should start
          const currentGameState = room.broadcastGameState();
          if (currentGameState.gameState === 'PLAYING' && currentGameState.currentRound > 1) {
            // New round started, emit roundStarted event
            io.to(roomId).emit('roundStarted', currentGameState);
          }
        }
      } else {
        socket.emit('guessError', { reason: result.reason });
      }
      
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });

  // Leave room
  socket.on('leaveRoom', ({ roomId, playerId }) => {
    try {
      console.log(`Player ${playerId} explicitly leaving room ${roomId}`);
      
      // Use explicit removal instead of just marking as disconnected
      const playerRoom = roomManager.handlePlayerExplicitLeave(playerId);
      
      if (playerRoom) {
        const { roomId: updatedRoomId, room } = playerRoom;
        
        // Notify other players in the room
        socket.to(updatedRoomId).emit('playerLeft', { playerId });
        
        // Update remaining players
        io.to(updatedRoomId).emit('roomUpdated', room.broadcastGameState());
        
        // Broadcast updated room list to all clients
        io.emit('roomsUpdated', roomManager.getActiveRooms());
        
        console.log(`Player ${playerId} successfully left room ${updatedRoomId}`);
      } else {
        // Room was deleted (no players remaining)
        console.log(`Room ${roomId} was deleted after player ${playerId} left`);
        
        // Broadcast updated room list to all clients
        io.emit('roomsUpdated', roomManager.getActiveRooms());
      }
      
      // Remove socket from room
      socket.leave(roomId);
      
    } catch (error) {
      console.error('Error leaving room:', error);
      socket.emit('error', { message: 'Failed to leave room' });
    }
  });

  // Get room info
  socket.on('getRoomInfo', ({ roomId }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (room) {
        socket.emit('roomInfo', room.broadcastGameState());
      } else {
        socket.emit('error', { message: 'Room not found' });
      }
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });

  // Mark player as ready for next round
  socket.on('markReadyForNextRound', ({ roomId, socketId }) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        throw new Error('Room not found');
      }
      
      const success = room.markReadyForNextRound(socketId);
      if (success) {
        // Broadcast updated room state to all players
        io.to(roomId).emit('roomUpdated', room.broadcastGameState());
      } else {
        socket.emit('error', { message: 'Failed to mark player as ready' });
      }
      
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });

  // Disconnect handling (page refresh, browser close, network issues)
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    try {
      // Remove player from any room they're in (but keep them in room as disconnected)
      const playerRoom = roomManager.removePlayerFromRoom(socket.id);
      
      // If player was in a room, update remaining players
      if (playerRoom && playerRoom.room) {
        const roomStatus = playerRoom.room.getRoomStatus();
        console.log(`Player disconnected from room ${playerRoom.roomId}. Status: ${roomStatus.activePlayers}/${roomStatus.totalPlayers} active`);
        
        // Update remaining players in the room
        io.to(playerRoom.roomId).emit('roomUpdated', playerRoom.room.broadcastGameState());
        
        // Clean up inactive disconnected players after a delay
        setTimeout(() => {
          try {
            const cleanedCount = playerRoom.room.cleanupInactivePlayers(5); // 5 minutes timeout
            if (cleanedCount > 0) {
              console.log(`Cleaned up ${cleanedCount} inactive players from room ${playerRoom.roomId}`);
              
              // Update room state after cleanup
              io.to(playerRoom.roomId).emit('roomUpdated', playerRoom.room.broadcastGameState());
              io.emit('roomsUpdated', roomManager.getActiveRooms());
            }
          } catch (cleanupError) {
            console.error('Error during cleanup:', cleanupError);
          }
        }, 60000); // Wait 1 minute before cleanup
      }
      
      // Broadcast updated room list to all clients
      io.emit('roomsUpdated', roomManager.getActiveRooms());
    } catch (error) {
      console.error('Error handling disconnect:', error);
    }
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`Wordle backend running on port ${PORT}`);
  console.log(`Available modes: normal, cheating`);
  console.log(`WebSocket server enabled for multiplayer`);
});
