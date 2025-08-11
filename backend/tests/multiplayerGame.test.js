// MultiplayerGame Unit Tests (Task 4)

const MultiplayerGame = require('../src/multiplayerGame');

describe('MultiplayerGame', () => {
  let game;
  
  beforeEach(() => {
    game = new MultiplayerGame('TEST123', 4, 'normal');
  });

  describe('Initialization', () => {
    test('creates game with correct properties', () => {
      expect(game.roomId).toBe('TEST123');
      expect(game.maxPlayers).toBe(4);
      expect(game.gameMode).toBe('normal');
      expect(game.gameState).toBe('WAITING');
      expect(game.currentRound).toBe(0);
      expect(game.players.size).toBe(0);
      expect(game.sharedGame).toBeNull();
    });

    test('creates cheating mode game', () => {
      const cheatingGame = new MultiplayerGame('CHEAT123', 3, 'cheating');
      expect(cheatingGame.gameMode).toBe('cheating');
    });
  });

  describe('Player Management', () => {
    test('adds first player as host', () => {
      const player = game.addPlayer('player1', 'Alice');
      expect(player.isHost).toBe(true);
      expect(game.players.size).toBe(1);
      expect(game.players.get('player1')).toBe(player);
    });

    test('adds subsequent players as non-hosts', () => {
      game.addPlayer('player1', 'Alice');
      const player2 = game.addPlayer('player2', 'Bob');
      expect(player2.isHost).toBe(false);
      expect(game.players.size).toBe(2);
    });

    test('prevents adding players when room is full', () => {
      game.addPlayer('player1', 'Alice');
      game.addPlayer('player2', 'Bob');
      game.addPlayer('player3', 'Charlie');
      game.addPlayer('player4', 'David');
      
      expect(() => {
        game.addPlayer('player5', 'Eve');
      }).toThrow('Room is full');
    });

    test('prevents adding players when game is in progress', () => {
      game.addPlayer('player1', 'Alice');
      game.addPlayer('player2', 'Bob');
      game.startGame();
      
      expect(() => {
        game.addPlayer('player3', 'Charlie');
      }).toThrow('Game already in progress');
    });

    test('removes player correctly', () => {
      game.addPlayer('player1', 'Alice');
      game.addPlayer('player2', 'Bob');
      
      game.removePlayer('player1');
      expect(game.players.size).toBe(1);
      expect(game.players.has('player1')).toBe(false);
      expect(game.players.get('player2').isHost).toBe(true);
    });

    test('assigns new host when host leaves', () => {
      game.addPlayer('player1', 'Alice');
      game.addPlayer('player2', 'Bob');
      
      game.removePlayer('player1');
      expect(game.players.get('player2').isHost).toBe(true);
    });
  });

  describe('Game Flow', () => {
    test('starts game with minimum players', () => {
      game.addPlayer('player1', 'Alice');
      game.addPlayer('player2', 'Bob');
      
      const result = game.startGame();
      expect(game.gameState).toBe('PLAYING');
      expect(game.currentRound).toBe(1);
      expect(game.sharedGame).toBeTruthy();
      expect(result.roomId).toBe('TEST123');
    });

    test('prevents starting game with insufficient players', () => {
      game.addPlayer('player1', 'Alice');
      
      expect(() => {
        game.startGame();
      }).toThrow('Need at least 2 players to start');
    });

    test('prevents starting game when already in progress', () => {
      game.addPlayer('player1', 'Alice');
      game.addPlayer('player2', 'Bob');
      game.startGame();
      
      expect(() => {
        game.startGame();
      }).toThrow('Game already in progress');
    });

    test('resets player states when starting game', () => {
      game.addPlayer('player1', 'Alice');
      game.addPlayer('player2', 'Bob');
      
      game.startGame();
      
      for (let player of game.players.values()) {
        expect(player.status).toBe('PLAYING');
        expect(player.score).toBe(0);
        expect(player.guesses).toEqual([]);
      }
    });
  });

  describe('Gameplay', () => {
    beforeEach(() => {
      game.addPlayer('player1', 'Alice');
      game.addPlayer('player2', 'Bob');
      game.startGame();
    });

    test('processes valid guess correctly', () => {
      const result = game.makeGuess('player1', 'HELLO');
      expect(result.valid).toBe(true);
      expect(result.feedback).toBeDefined();
      expect(result.status).toBeDefined();
      
      const player = game.players.get('player1');
      expect(player.guesses.length).toBe(1);
      expect(player.guesses[0].guess).toBe('HELLO');
      expect(player.guesses[0].round).toBe(1);
    });

    test('prevents guess from inactive player', () => {
      game.players.get('player1').status = 'FINISHED';
      
      expect(() => {
        game.makeGuess('player1', 'HELLO');
      }).toThrow('Player not active');
    });

    test('prevents guess when game not in progress', () => {
      game.gameState = 'FINISHED';
      
      expect(() => {
        game.makeGuess('player1', 'HELLO');
      }).toThrow('Game not in progress');
    });

    test('prevents guess from non-existent player', () => {
      expect(() => {
        game.makeGuess('nonexistent', 'HELLO');
      }).toThrow('Player not found');
    });
  });

  describe('Scoring System', () => {
    test('calculates score correctly for different guess counts', () => {
      expect(game.calculateScore(1)).toBe(100); // 1 guess = 100 points
      expect(game.calculateScore(2)).toBe(80);  // 2 guesses = 80 points
      expect(game.calculateScore(3)).toBe(60);  // 3 guesses = 60 points
      expect(game.calculateScore(6)).toBe(10);  // 6 guesses = 10 points (minimum)
    });

    test('maintains minimum score', () => {
      expect(game.calculateScore(10)).toBe(10); // Should not go below 10
    });
  });

  describe('Round Management', () => {
    beforeEach(() => {
      game.addPlayer('player1', 'Alice');
      game.addPlayer('player2', 'Bob');
      game.startGame();
    });

    test('ends round when all players finish', () => {
      // Simulate both players finishing
      game.players.get('player1').status = 'FINISHED';
      game.players.get('player2').status = 'FINISHED';
      
      game.checkRoundEnd();
      expect(game.currentRound).toBe(2);
      expect(game.gameState).toBe('PLAYING');
    });

    test('starts new round correctly', () => {
      game.currentRound = 1;
      game.startNewRound();
      
      expect(game.currentRound).toBe(2);
      expect(game.gameState).toBe('PLAYING');
      expect(game.sharedGame).toBeTruthy();
      
      // Check player states are reset
      for (let player of game.players.values()) {
        if (player.status !== 'DISCONNECTED') {
          expect(player.status).toBe('PLAYING');
          expect(player.guesses).toEqual([]);
        }
      }
    });
  });

  describe('Game End', () => {
    beforeEach(() => {
      game.addPlayer('player1', 'Alice');
      game.addPlayer('player2', 'Bob');
      game.startGame();
    });

    test('ends game after 3 rounds', () => {
      game.currentRound = 3;
      game.endGame();
      
      expect(game.gameState).toBe('FINISHED');
      expect(game.currentRound).toBe(3);
    });

    test('calculates final rankings correctly', () => {
      // Set up some scores
      game.players.get('player1').score = 150;
      game.players.get('player2').score = 200;
      
      const rankings = game.calculateRankings();
      expect(rankings.length).toBe(2);
      expect(rankings[0].rank).toBe(1);
      expect(rankings[0].playerId).toBe('player2'); // Higher score first
      expect(rankings[1].rank).toBe(2);
      expect(rankings[1].playerId).toBe('player1');
    });
  });

  describe('State Broadcasting', () => {
    beforeEach(() => {
      game.addPlayer('player1', 'Alice');
      game.addPlayer('player2', 'Bob');
    });

    test('broadcasts correct game state', () => {
      const state = game.broadcastGameState();
      
      expect(state.roomId).toBe('TEST123');
      expect(state.gameState).toBe('WAITING');
      expect(state.gameMode).toBe('normal');
      expect(state.maxPlayers).toBe(4);
      expect(state.players.length).toBe(2);
      expect(state.sharedGame).toBeNull();
    });

    test('includes shared game info when playing', () => {
      game.startGame();
      const state = game.broadcastGameState();
      
      expect(state.sharedGame).toBeTruthy();
      expect(state.sharedGame.status).toBeDefined();
      expect(state.sharedGame.roundsLeft).toBeDefined();
    });
  });

  describe('Room Management', () => {
    test('checks room inactivity correctly', () => {
      expect(game.isInactive(30)).toBe(false); // Should not be inactive immediately
      
      // Simulate 31 minutes of inactivity
      game.lastActivity = new Date(Date.now() - 31 * 60 * 1000);
      expect(game.isInactive(30)).toBe(true);
    });

    test('provides room info for lobby', () => {
      game.addPlayer('player1', 'Alice');
      const info = game.getRoomInfo();
      
      expect(info.roomId).toBe('TEST123');
      expect(info.gameMode).toBe('normal');
      expect(info.playerCount).toBe(1);
      expect(info.maxPlayers).toBe(4);
      expect(info.gameState).toBe('WAITING');
    });
  });
}); 