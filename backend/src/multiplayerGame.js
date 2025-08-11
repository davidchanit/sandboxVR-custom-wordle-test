// Multiplayer Wordle Game Logic (Task 4)
// Manages real-time multiplayer game sessions

const { v4: uuidv4 } = require('uuid');
const GameFactory = require('./gameFactory');

class MultiplayerGame {
  constructor(roomId, maxPlayers = 4, gameMode = 'normal') {
    this.roomId = roomId;
    this.maxPlayers = maxPlayers;
    this.gameMode = gameMode;
    this.players = new Map(); // persistentPlayerId -> playerData
    this.socketToPlayer = new Map(); // socketId -> persistentPlayerId
    this.gameState = 'WAITING'; // WAITING, PLAYING, FINISHED
    this.currentRound = 0;
    this.sharedGame = null; // Normal or Cheating game instance
    this.playerGames = new Map(); // persistentPlayerId -> game instance
    this.wordList = ['HELLO', 'WORLD', 'QUITE', 'FANCY', 'FRESH', 'PANIC', 'CRAZY', 'vGY', 'HAPPY', 'SMILE'];
    this.createdAt = new Date();
    this.lastActivity = new Date();
  }

  // Add a new player to the room
  addPlayer(socketId, playerName) {
    if (this.players.size >= this.maxPlayers) {
      throw new Error('Room is full');
    }
    
    if (this.gameState !== 'WAITING') {
      throw new Error('Game already in progress');
    }
    
    // Generate a persistent player ID (not tied to socket)
    const persistentPlayerId = `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Store player data with persistent ID
    this.players.set(persistentPlayerId, {
      id: persistentPlayerId,
      name: playerName,
      score: 0,
      guesses: [],
      status: 'READY',
      joinedAt: new Date(),
      isHost: this.players.size === 0, // First player becomes host
      readyForNextRound: false,
      lastSeen: new Date()
    });
    
    // Map socket ID to persistent player ID
    this.socketToPlayer.set(socketId, persistentPlayerId);
    
    this.lastActivity = new Date();
    return this.players.get(persistentPlayerId);
  }

  // Mark player as disconnected (but keep them in room)
  // Used for: Page refresh, browser close, network disconnect
  removePlayer(socketId) {
    const persistentPlayerId = this.socketToPlayer.get(socketId);
    if (persistentPlayerId) {
      const player = this.players.get(persistentPlayerId);
      if (player) {
        // Mark player as disconnected but keep them in room
        player.status = 'DISCONNECTED';
        player.lastSeen = new Date();
        
        // Remove socket mapping
        this.socketToPlayer.delete(socketId);
        
        console.log(`Player ${player.name} disconnected (socket ${socketId}) but kept in room`);
        
        // If host disconnected, assign new host to next active player
        if (player.isHost && this.gameState === 'PLAYING') {
          const activePlayers = Array.from(this.players.values())
            .filter(p => p.status !== 'DISCONNECTED');
          if (activePlayers.length > 0) {
            activePlayers[0].isHost = true;
            console.log(`New host assigned: ${activePlayers[0].name}`);
          }
        }
        
        this.lastActivity = new Date();
      }
    }
  }

  // Explicitly remove player from room (for Leave Room action)
  explicitlyRemovePlayer(persistentPlayerId) {
    const player = this.players.get(persistentPlayerId);
    if (player) {
      console.log(`Explicitly removing player ${player.name} from room`);
      
      // Remove player from players map
      this.players.delete(persistentPlayerId);
      
      // Remove player's game instance
      this.playerGames.delete(persistentPlayerId);
      
      // Remove all socket mappings for this player
      for (const [socketId, mappedPlayerId] of this.socketToPlayer.entries()) {
        if (mappedPlayerId === persistentPlayerId) {
          this.socketToPlayer.delete(socketId);
        }
      }
      
      // If host leaves, assign new host
      if (player.isHost && this.players.size > 0) {
        const firstPlayer = this.players.values().next().value;
        firstPlayer.isHost = true;
        console.log(`New host assigned: ${firstPlayer.name}`);
      }
      
      // If game is playing and player was active, handle removal
      if (this.gameState === 'PLAYING') {
        this.checkRoundEnd();
      }
      
      this.lastActivity = new Date();
      
      console.log(`Player ${player.name} completely removed from room. Players remaining: ${this.players.size}`);
      return true;
    }
    return false;
  }

  // Start the multiplayer game
  startGame() {
    if (this.players.size < 2) {
      throw new Error('Need at least 2 players to start');
    }
    
    if (this.gameState !== 'WAITING') {
      throw new Error('Game already in progress');
    }
    
    this.gameState = 'PLAYING';
    this.currentRound = 1;
    
    // Create shared game instance for word selection
    this.sharedGame = GameFactory.createGame(this.gameMode, this.wordList, 6);
    
    // Create individual game instances for each player (same word, separate guess limits)
    this.playerGames.clear();
    for (let player of this.players.values()) {
      // Only create games for active players (not disconnected ones)
      if (player.status !== 'DISCONNECTED') {
        // Create individual game with same word but separate guess tracking
        const individualGame = GameFactory.createGame(this.gameMode, this.wordList, 6);
        // Set the same answer for all players
        individualGame.answer = this.sharedGame.answer;
        this.playerGames.set(player.id, individualGame);
        
        player.guesses = [];
        player.status = 'PLAYING';
        player.score = 0;
      }
    }
    
    console.log(`Started game with word: ${this.sharedGame.answer}`);
    this.lastActivity = new Date();
    return this.broadcastGameState();
  }

  // Process a guess from a player
  makeGuess(socketId, guess) {
    // Get player by socket ID
    const player = this.getPlayerBySocketId(socketId);
    if (!player) {
      throw new Error('Player not found');
    }
    
    if (this.gameState !== 'PLAYING') {
      throw new Error('Game not in progress');
    }
    
    if (player.status !== 'PLAYING') {
      throw new Error('Player not active');
    }
    
    // Get player's individual game instance using persistent player ID
    const playerGame = this.playerGames.get(player.id);
    if (!playerGame) {
      throw new Error('Player game not found');
    }
    
    // Validate guess using player's game
    const validation = playerGame.validateGuess(guess);
    if (!validation.valid) {
      return { valid: false, reason: validation.reason };
    }
    
    // Process guess through player's individual game
    const result = playerGame.makeGuess(guess);
    
    if (result.valid) {
      // Update player state
      player.guesses.push({ 
        guess: guess.toUpperCase(), 
        feedback: result.feedback,
        round: this.currentRound
      });
      
      // Check if player won or lost this round
      if (result.status === 'WIN') {
        player.score += this.calculateScore(result.guesses.length);
        player.status = 'FINISHED';
        console.log(`Player ${player.name} WON round ${this.currentRound} with score ${player.score}`);
        this.checkRoundEnd();
      } else if (result.status === 'LOSE') {
        player.status = 'FINISHED';
        console.log(`Player ${player.name} LOST round ${this.currentRound} after ${result.guesses.length} guesses`);
        this.checkRoundEnd();
      }
      
      this.lastActivity = new Date();
    }
    
    return result;
  }

  // Calculate score based on number of guesses
  calculateScore(guessesUsed) {
    // Scoring system: fewer guesses = higher score
    // 1 guess: 100 points, 2 guesses: 80 points, etc.
    return Math.max(100 - (guessesUsed - 1) * 20, 10);
  }

  // Mark player as ready for next round
  markReadyForNextRound(socketId) {
    // Get player by socket ID
    const player = this.getPlayerBySocketId(socketId);
    if (!player) {
      throw new Error('Player not found');
    }
    
    if (player.status !== 'FINISHED') {
      throw new Error('Player must finish current round first');
    }
    
    player.readyForNextRound = true;
    console.log(`Player ${player.name} marked ready for next round`);
    
    // Check if all finished players are ready
    this.checkAllPlayersReady();
    
    return true;
  }

  // Update player's socket ID (for reconnection after page refresh)
  // Used for: Page refresh reconnection, browser reconnection
  updatePlayerSocketId(playerName, newSocketId) {
    console.log(`Attempting to reconnect player "${playerName}" with socket ${newSocketId}`);
    
    // Find player by exact name match
    let player = null;
    let persistentPlayerId = null;
    
    for (const [pid, p] of this.players.entries()) {
      if (p.name === playerName) {
        player = p;
        persistentPlayerId = pid;
        break;
      }
    }
    
    if (!player) {
      console.log(`Player "${playerName}" not found in room for reconnection`);
      return false;
    }
    
    // Check if this player is already connected through another socket
    let oldSocketId = null;
    for (const [socketId, mappedPlayerId] of this.socketToPlayer.entries()) {
      if (mappedPlayerId === persistentPlayerId) {
        oldSocketId = socketId;
        break;
      }
    }
    
    // If player is already connected, replace the old socket
    if (oldSocketId) {
      console.log(`Player ${playerName} already connected through socket ${oldSocketId}, replacing with ${newSocketId}`);
      this.socketToPlayer.delete(oldSocketId);
    }
    
    // Check if new socket is already mapped to another player
    if (this.socketToPlayer.has(newSocketId)) {
      const conflictingPlayerId = this.socketToPlayer.get(newSocketId);
      const conflictingPlayer = this.players.get(conflictingPlayerId);
      if (conflictingPlayer) {
        console.log(`Socket ${newSocketId} already mapped to player ${conflictingPlayer.name}, removing mapping`);
        this.socketToPlayer.delete(newSocketId);
      }
    }
    
    // Map new socket ID to persistent player ID
    this.socketToPlayer.set(newSocketId, persistentPlayerId);
    
    // Update last seen time
    player.lastSeen = new Date();
    
    // If player was disconnected, reactivate them
    if (player.status === 'DISCONNECTED') {
      if (this.gameState === 'WAITING') {
        player.status = 'READY';
        console.log(`Reactivated disconnected player ${playerName} to READY status`);
      } else if (this.gameState === 'PLAYING') {
        // If game is in progress, create a new game instance for the reconnected player
        if (!this.playerGames.has(player.id)) {
          const individualGame = GameFactory.createGame(this.gameMode, this.wordList, 6);
          individualGame.answer = this.sharedGame.answer;
          this.playerGames.set(player.id, individualGame);
          console.log(`Created new game instance for reconnected player ${player.name}`);
        }
        player.status = 'PLAYING';
        console.log(`Reactivated disconnected player ${playerName} to PLAYING status`);
      }
    }
    
    console.log(`Successfully reconnected player ${player.name} with socket ${newSocketId}, status: ${player.status}`);
    return true;
  }

  // Get player by socket ID (for reconnection)
  getPlayerBySocketId(socketId) {
    if (this.socketToPlayer.has(socketId)) {
      const persistentPlayerId = this.socketToPlayer.get(socketId);
      return this.players.get(persistentPlayerId);
    }
    return null;
  }

  // Check if all finished players are ready for next round
  checkAllPlayersReady() {
    const finishedPlayers = Array.from(this.players.values())
      .filter(p => p.status === 'FINISHED');
    
    const allReady = finishedPlayers.every(p => p.readyForNextRound);
    
    if (allReady && finishedPlayers.length > 0) {
      console.log('All finished players are ready, advancing to next round');
      this.endRound();
    }
  }

  // Check if round should end
  checkRoundEnd() {
    const activePlayers = Array.from(this.players.values())
      .filter(p => p.status === 'PLAYING');
    
    console.log(`checkRoundEnd: ${activePlayers.length} active players out of ${this.players.size} total`);
    
    if (activePlayers.length === 0) {
      // All players finished, end round
      console.log('All players finished, ending round');
      this.endRound();
    } else {
      console.log(`Still waiting for ${activePlayers.length} players to finish`);
    }
  }

  // End current round and prepare for next
  endRound() {
    console.log(`Ending round ${this.currentRound}, checking if game should continue...`);
    
    // Check if game should end (allow more rounds, end after 5 rounds)
    if (this.currentRound >= 5) {
      console.log('Game ended: reached maximum rounds');
      this.endGame();
    } else {
      // Start new round
      console.log(`Starting new round ${this.currentRound + 1}`);
      this.startNewRound();
    }
  }

  // Start a new round
  startNewRound() {
    // Increment round number
    this.currentRound++;
    
    console.log(`New round ${this.currentRound} started`);
    
    // Create new shared game for next round
    this.sharedGame = GameFactory.createGame(this.gameMode, this.wordList, 6);
    
    // Create new individual game instances for each player
    this.playerGames.clear();
    for (let player of this.players.values()) {
      if (player.status !== 'DISCONNECTED') {
        // Create individual game with same word but separate guess tracking
        const individualGame = GameFactory.createGame(this.gameMode, this.wordList, 6);
        // Set the same answer for all players
        individualGame.answer = this.sharedGame.answer;
        this.playerGames.set(player.id, individualGame);
        
        player.guesses = [];
        player.status = 'PLAYING';
        player.readyForNextRound = false;
        console.log(`Reset player ${player.name} for new round with word: ${this.sharedGame.answer}`);
      }
    }
    
    this.gameState = 'PLAYING';
    this.lastActivity = new Date();
  }

  // End the entire game
  endGame() {
    this.gameState = 'FINISHED';
    this.lastActivity = new Date();
    
    // Calculate final rankings
    const rankings = this.calculateRankings();
    return rankings;
  }

  // Calculate final player rankings
  calculateRankings() {
    const players = Array.from(this.players.values());
    return players
      .sort((a, b) => b.score - a.score)
      .map((player, index) => ({
        rank: index + 1,
        playerId: player.id,
        name: player.name,
        score: player.score,
        totalGuesses: player.guesses.reduce((sum, g) => sum + g.guess.length, 0)
      }));
  }

  // Get current game state for broadcasting
  broadcastGameState() {
    return {
      roomId: this.roomId,
      gameState: this.gameState,
      gameMode: this.gameMode,
      maxPlayers: this.maxPlayers,
      currentRound: this.currentRound,
      players: Array.from(this.players.values()).map(player => {
        const playerGame = this.playerGames.get(player.id);
        return {
          id: player.id,
          name: player.name,
          score: player.score,
          status: player.status,
          isHost: player.isHost,
          guesses: player.guesses,
          joinedAt: player.joinedAt,
          roundsLeft: playerGame ? playerGame.roundsLeft || (6 - player.guesses.length) : 6,
          gameStatus: playerGame ? playerGame.status : 'IN_PROGRESS',
          readyForNextRound: player.readyForNextRound || false
        };
      }),
      sharedGame: this.sharedGame ? {
        status: this.sharedGame.status || 'IN_PROGRESS',
        roundsLeft: this.sharedGame.roundsLeft || 6,
        candidatesCount: this.sharedGame.candidatesCount,
        answer: this.gameState === 'FINISHED' ? this.sharedGame.currentAnswer : undefined
      } : null,
      createdAt: this.createdAt,
      lastActivity: this.lastActivity
    };
  }

  // Check if room is inactive (for cleanup)
  isInactive(timeoutMinutes = 30) {
    const now = new Date();
    const diffMinutes = (now - this.lastActivity) / (1000 * 60);
    return diffMinutes > timeoutMinutes;
  }

  // Clean up inactive disconnected players
  cleanupInactivePlayers(timeoutMinutes = 5) {
    const now = new Date();
    let cleanedCount = 0;
    
    for (const [playerId, player] of this.players.entries()) {
      if (player.status === 'DISCONNECTED' && player.lastSeen) {
        const diffMinutes = (now - player.lastSeen) / (1000 * 60);
        if (diffMinutes > timeoutMinutes) {
          console.log(`Cleaning up inactive disconnected player ${player.name} (inactive for ${Math.round(diffMinutes)} minutes)`);
          
          // Remove player completely
          this.players.delete(playerId);
          this.playerGames.delete(playerId);
          
          // Remove all socket mappings for this player
          for (const [socketId, mappedPlayerId] of this.socketToPlayer.entries()) {
            if (mappedPlayerId === playerId) {
              this.socketToPlayer.delete(socketId);
            }
          }
          
          // If host was cleaned up, assign new host
          if (player.isHost && this.players.size > 0) {
            const firstPlayer = this.players.values().next().value;
            firstPlayer.isHost = true;
            console.log(`New host assigned after cleanup: ${firstPlayer.name}`);
          }
          
          cleanedCount++;
        }
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} inactive disconnected players`);
      this.lastActivity = new Date();
    }
    
    return cleanedCount;
  }

  // Get room status summary
  getRoomStatus() {
    const totalPlayers = this.players.size;
    const activePlayers = Array.from(this.players.values())
      .filter(p => p.status !== 'DISCONNECTED').length;
    const disconnectedPlayers = totalPlayers - activePlayers;
    
    return {
      totalPlayers,
      activePlayers,
      disconnectedPlayers,
      gameState: this.gameState,
      currentRound: this.currentRound,
      lastActivity: this.lastActivity
    };
  }

  // Get room info for lobby
  getRoomInfo() {
    return {
      roomId: this.roomId,
      gameMode: this.gameMode,
      playerCount: this.players.size,
      maxPlayers: this.maxPlayers,
      gameState: this.gameState,
      createdAt: this.createdAt,
      lastActivity: this.lastActivity
    };
  }

  // Check if game should end
  checkGameEnd() {
    if (this.gameState !== 'PLAYING') return;
    
    const activePlayers = Array.from(this.players.values())
      .filter(p => p.status === 'PLAYING');
    
    if (activePlayers.length === 0) {
      this.endRound();
    }
  }
}

module.exports = MultiplayerGame; 