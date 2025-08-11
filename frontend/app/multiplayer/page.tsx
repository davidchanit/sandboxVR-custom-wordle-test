'use client';

import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import styles from './multiplayer.module.css';

interface Player {
  id: string;
  name: string;
  score: number;
  status: 'READY' | 'PLAYING' | 'FINISHED' | 'DISCONNECTED';
  isHost: boolean;
  guesses: Array<{ guess: string; feedback: string[]; round: number }>;
  joinedAt: Date;
  readyForNextRound?: boolean;
}

interface MultiplayerGame {
  roomId: string;
  gameState: 'WAITING' | 'PLAYING' | 'FINISHED';
  gameMode: 'normal' | 'cheating';
  maxPlayers: number;
  currentRound: number;
  players: Player[];
  sharedGame: {
    status: string;
    roundsLeft: number;
    candidatesCount?: number;
    answer?: string;
  } | null;
  createdAt: Date;
  lastActivity: Date;
}

interface RoomInfo {
  roomId: string;
  gameMode: 'normal' | 'cheating';
  playerCount: number;
  maxPlayers: number;
  createdAt: Date;
  lastActivity: Date;
}

export default function MultiplayerPage() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [room, setRoom] = useState<MultiplayerGame | null>(null);
  const [createPlayerName, setCreatePlayerName] = useState('');
  const [joinPlayerName, setJoinPlayerName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);
  const [currentGuess, setCurrentGuess] = useState('');
  const [availableRooms, setAvailableRooms] = useState<RoomInfo[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLobby, setShowLobby] = useState(true);
  const [gameMode, setGameMode] = useState<'normal' | 'cheating'>('normal');
  const [maxPlayers, setMaxPlayers] = useState(4);
  
  // Room persistence state
  const [isReconnecting, setIsReconnecting] = useState(false);
  
  // Keyboard states for colors
  const [keyStates, setKeyStates] = useState<Record<string, 'hit' | 'present' | 'miss' | 'empty'>>({});

  const socketRef = useRef<Socket | null>(null);

  // Helper function for robust player identification
  const identifyCurrentPlayer = (room: MultiplayerGame, stateName: string | null): Player | null => {
    let currentPlayer: Player | null = null;
    
    // Strategy 1: Use state variables (for normal join)
    if (stateName) {
      const found = room.players.find(p => p.name === stateName);
      if (found) currentPlayer = found;
      console.log('Strategy 1 (state variables):', stateName, currentPlayer ? 'found' : 'not found');
    }
    
    // Strategy 2: Use saved room info (for reconnection)
    if (!currentPlayer) {
      const savedRoom = getSavedRoomInfo();
      if (savedRoom && savedRoom.roomId === room.roomId) {
        const found = room.players.find(p => p.name === savedRoom.playerName);
        if (found) currentPlayer = found;
        console.log('Strategy 2 (saved room info):', savedRoom.playerName, currentPlayer ? 'found' : 'not found');
      }
    }
    
    // Strategy 3: Try to find by checking if we're the host (for room creator)
    if (!currentPlayer && stateName) {
      const found = room.players.find(p => p.isHost && p.name === stateName);
      if (found) currentPlayer = found;
      console.log('Strategy 3 (host matching):', stateName, currentPlayer ? 'found' : 'not found');
    }
    
    // Strategy 4: Single player room fallback
    if (!currentPlayer && room.players.length === 1) {
      currentPlayer = room.players[0];
      console.log('Strategy 4 (single player): assuming this is us:', currentPlayer.name);
    }
    
    // Strategy 5: Find the most recently added player (for new joins)
    if (!currentPlayer && room.players.length > 0) {
      // Sort players by joinedAt time, most recent first
      const sortedPlayers = room.players.sort((a: Player, b: Player) => 
        new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime()
      );
      
      // If we have a state name, try to find a close match
      if (stateName) {
        // Look for partial name matches (case-insensitive)
        const found = sortedPlayers.find((p: Player) => 
          p.name.toLowerCase().includes(stateName.toLowerCase()) ||
          stateName.toLowerCase().includes(p.name.toLowerCase())
        );
        if (found) currentPlayer = found;
        console.log('Strategy 5 (partial name match):', stateName, currentPlayer ? 'found' : 'not found');
      }
      
      // If still no match, use the most recently added player
      if (!currentPlayer) {
        currentPlayer = sortedPlayers[0];
        console.log('Strategy 5 (most recent player): assuming this is us:', currentPlayer.name);
      }
    }
    
    return currentPlayer;
  };

  useEffect(() => {
    // Initialize Socket.io connection
    const newSocket = io('http://localhost:4000');
    socketRef.current = newSocket;
    setSocket(newSocket);

    // Connection events
    newSocket.on('connect', () => {
      console.log('Connected to server');
      setIsConnected(true);
      setError(null);
      
      // Try to auto-rejoin room if we have saved room info
      const savedRoom = getSavedRoomInfo();
      if (savedRoom && !room) {
        console.log('Attempting to rejoin room:', savedRoom.roomId);
        console.log('Saved room info:', savedRoom);
        setIsReconnecting(true);
        
        // Set the player name from saved info for reconnection
        if (savedRoom.isHost) {
          setCreatePlayerName(savedRoom.playerName);
          console.log('Set createPlayerName to:', savedRoom.playerName);
        } else {
          setJoinPlayerName(savedRoom.playerName);
          console.log('Set joinPlayerName to:', savedRoom.playerName);
        }
        
        // Try to rejoin the room using saved info directly
        try {
          console.log('Sending rejoinRoom with saved info:', {
            roomId: savedRoom.roomId,
            playerName: savedRoom.playerName
          });
          
          newSocket.emit('rejoinRoom', {
            roomId: savedRoom.roomId,
            playerName: savedRoom.playerName
          });
          
          // Set a timeout for rejoin attempt
          setTimeout(() => {
            if (isReconnecting) {
              console.log('Rejoin timeout - clearing reconnecting state');
              setIsReconnecting(false);
              setError('Rejoin timeout. Please try refreshing again.');
            }
          }, 10000); // 10 second timeout
          
        } catch (error) {
          console.error('Error sending rejoinRoom event:', error);
          setIsReconnecting(false);
          setError('Failed to rejoin room. Please try again.');
        }
      }
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
      setIsConnected(false);
    });

    // Room events
    newSocket.on('roomJoined', ({ roomId, room }) => {
      setRoom(room);
      setRoomId(roomId);
      setShowLobby(false);
      setError(null);
      setIsReconnecting(false);
      
      console.log('Room joined, attempting player identification...');
      
      // Use the helper function for robust player identification
      const stateName = createPlayerName || joinPlayerName;
      const currentPlayer = identifyCurrentPlayer(room, stateName);
      
      // If still no match, this is an identification failure
      if (!currentPlayer) {
        console.error('All player identification strategies failed');
        console.log('Available players:', room.players.map((p: Player) => ({ name: p.name, isHost: p.isHost, joinedAt: p.joinedAt })));
        console.log('State name:', stateName);
        console.log('Saved room info:', getSavedRoomInfo());
        
        // Show helpful error message
        const availableNames = room.players.map((p: Player) => p.name).join(', ');
        setError(`Player identification failed. Available players: ${availableNames}. Please refresh to try again.`);
        setIsReconnecting(false);
        
        // CRITICAL: Set a fallback currentPlayerId so user can leave room
        // Use the first available player as a temporary fallback
        if (room.players.length > 0) {
          const fallbackPlayer = room.players[0];
          setCurrentPlayerId(fallbackPlayer.id);
          console.log('Setting fallback currentPlayerId:', fallbackPlayer.id, 'for player:', fallbackPlayer.name);
          
          // Also set the player name fields for consistency
          if (fallbackPlayer.isHost) {
            setCreatePlayerName(fallbackPlayer.name);
          } else {
            setJoinPlayerName(fallbackPlayer.name);
          }
          
          // Save room info for persistence
          saveRoomInfo(roomId, fallbackPlayer.name, fallbackPlayer.isHost);
        }
        
        return;
      }
      
      if (currentPlayer) {
        setCurrentPlayerId(currentPlayer.id);
        // Save room info for persistence
        saveRoomInfo(roomId, currentPlayer.name, currentPlayer.isHost);
        console.log('Successfully identified player:', currentPlayer.name, 'ID:', currentPlayer.id);
        
        // Update the player name fields to match what's in the room
        if (currentPlayer.isHost) {
          setCreatePlayerName(currentPlayer.name);
        } else {
          setJoinPlayerName(currentPlayer.name);
        }
      } else {
        console.error('Could not identify current player in room');
        console.log('Available players:', room.players.map((p: Player) => ({ name: p.name, isHost: p.isHost })));
        setError('Could not identify player in room. Please try refreshing.');
      }
      
      console.log('Joined room:', roomId, 'as player:', currentPlayer?.name);
      
      // Update keyboard colors when joining room
      setTimeout(() => updateKeyboardFromAllPlayers(), 100);
    });

    newSocket.on('playerJoined', ({ playerId, playerName }) => {
      console.log(`Player ${playerName} joined the room`);
      // Room state will be updated via roomUpdated event
    });

    newSocket.on('playerLeft', ({ playerId }) => {
      console.log('Player left the room');
      // Room state will be updated via roomUpdated event
    });

    newSocket.on('gameStarted', (gameState) => {
      setRoom(gameState);
      setKeyStates({}); // Reset key states for new game
      console.log('Game started!');
      
      // Update keyboard colors for new game
      setTimeout(() => updateKeyboardFromAllPlayers(), 100);
    });

    newSocket.on('guessMade', ({ playerId, guess, feedback, gameState }) => {
      setRoom(gameState);
      console.log(`Player ${playerId} made guess: ${guess}`);
      console.log('Feedback received:', feedback);
      console.log('Game state after guess:', gameState);
      
      // Update key states for ALL players (combined feedback)
      console.log('Updating key states for all players');
      updateKeyStates(feedback, guess);
    });

    newSocket.on('roundEnded', (gameState) => {
      setRoom(gameState);
      console.log('Round ended!');
      
      // Update keyboard colors for new round
      setTimeout(() => updateKeyboardFromAllPlayers(), 100);
    });

    newSocket.on('roundStarted', (gameState) => {
      setRoom(gameState);
      setKeyStates({}); // Reset keyboard colors for new round
      console.log('New round started!', gameState.currentRound);
      
      // Show notification for new round
      setError(`🎮 Round ${gameState.currentRound} Started! All players reset for new word.`);
      setTimeout(() => setError(null), 3000); // Clear after 3 seconds
      
      // Update keyboard colors for new round
      setTimeout(() => updateKeyboardFromAllPlayers(), 100);
    });

    newSocket.on('roomUpdated', (gameState) => {
      setRoom(gameState);
      
      // Keep current player ID in sync using multiple strategies
      if (currentPlayerId && gameState.players.find((p: Player) => p.id === currentPlayerId)) {
        // Player still exists in room - no action needed
        console.log('Current player ID still valid:', currentPlayerId);
      } else if (gameState.players.length > 0) {
        console.log('Current player ID not found, attempting re-identification...');
        
        let currentPlayer = null;
        
        // Use the helper function for robust player identification
        const stateName = createPlayerName || joinPlayerName;
        currentPlayer = identifyCurrentPlayer(gameState, stateName);
        
        if (currentPlayer) {
          setCurrentPlayerId(currentPlayer.id);
          console.log('Re-identified current player:', currentPlayer.name, 'ID:', currentPlayer.id);
        } else {
          console.log('Could not re-identify current player in roomUpdated');
        }
      }
      
      // Update keyboard colors based on all players' guesses
      updateKeyboardFromAllPlayers();
    });

    // Real-time room list updates
    newSocket.on('roomsUpdated', (rooms) => {
      setAvailableRooms(rooms);
    });

        newSocket.on('rejoinRoom', ({ roomId, room, success, message, playerName }) => {
      if (success) {
        setRoom(room);
        setRoomId(roomId);
        setShowLobby(false);
        setError(null);
        setIsReconnecting(false);
        
        console.log('Rejoin successful, looking for player:', playerName);
        
        // Use the playerName from the backend response for identification
        let currentPlayer = room.players.find((p: Player) => p.name === playerName);
        
        if (!currentPlayer) {
          console.error('Player identification failed for rejoin:', playerName);
          console.log('Available players:', room.players.map((p: Player) => ({ name: p.name, isHost: p.isHost })));
          
          // For reconnection, be more lenient
          if (room.players.length > 0) {
            // If there's only one player and we're trying to reconnect, assume it's us
            if (room.players.length === 1) {
              currentPlayer = room.players[0];
              console.log('Single player room rejoin - assuming this is us:', currentPlayer.name);
            } else {
              // Multiple players - show error but don't kick to lobby
              setError(`Rejoin failed: Player "${playerName}" not found in room. Available: ${room.players.map((p: Player) => p.name).join(', ')}. Please refresh to try again.`);
              setIsReconnecting(false);
              return;
            }
          } else {
            setError(`Rejoin failed: Room is empty or player "${playerName}" not found.`);
            setIsReconnecting(false);
            return;
          }
        }
        
        if (currentPlayer) {
          setCurrentPlayerId(currentPlayer.id);
          
          // Update the player name fields to match what's in the room
          if (currentPlayer.isHost) {
            setCreatePlayerName(currentPlayer.name);
          } else {
            setJoinPlayerName(currentPlayer.name);
          }
          
          // Save room info for persistence
          saveRoomInfo(roomId, currentPlayer.name, currentPlayer.isHost);
          
          console.log('Successfully rejoined room:', roomId, 'as player:', currentPlayer.name);
          
          // Update keyboard colors when rejoining room
          setTimeout(() => updateKeyboardFromAllPlayers(), 100);
        } else {
          console.error('Could not identify current player when rejoining room');
        }
      } else {
        setError(message || 'Failed to rejoin room');
        setIsReconnecting(false);
        
        // If reconnection failed, show option to go back to lobby or retry
        setShowLobby(true);
        
        // Add retry button
        setTimeout(() => {
          setError('Rejoin failed. You can try refreshing again or return to lobby.');
        }, 2000);
      }
    });

    newSocket.on('error', ({ message }) => {
      setError(message);
      console.error('Socket error:', message);
    });

    // Fetch available rooms
    fetchAvailableRooms();

    // Check for saved room info on component mount (for page refresh)
    const savedRoom = getSavedRoomInfo();
    if (savedRoom && !room && !isReconnecting) {
      console.log('Found saved room info on mount:', savedRoom);
      console.log('Will reconnect when socket connects');
    }

    return () => {
      newSocket.close();
    };
  }, []);

  // Update keyboard colors whenever room state changes
  useEffect(() => {
    if (room && room.gameState === 'PLAYING') {
      updateKeyboardFromAllPlayers();
    }
  }, [room]);

  // Save room info to localStorage
  const saveRoomInfo = (roomId: string, playerName: string, isHost: boolean) => {
    localStorage.setItem('multiplayer_room', JSON.stringify({
      roomId,
      playerName,
      isHost,
      timestamp: Date.now()
    }));
  };

  // Get saved room info from localStorage
  const getSavedRoomInfo = () => {
    try {
      const saved = localStorage.getItem('multiplayer_room');
      if (saved) {
        const roomInfo = JSON.parse(saved);
        // Check if saved info is less than 1 hour old
        if (Date.now() - roomInfo.timestamp < 60 * 60 * 1000) {
          return roomInfo;
        } else {
          console.log('Saved room info expired, clearing');
          clearRoomInfo();
        }
      }
    } catch (error) {
      console.error('Error reading saved room info:', error);
      clearRoomInfo(); // Clear corrupted data
    }
    return null;
  };

  // Clear saved room info
  const clearRoomInfo = () => {
    localStorage.removeItem('multiplayer_room');
  };

  const fetchAvailableRooms = async () => {
    try {
      const response = await fetch('http://localhost:4000/api/multiplayer/rooms');
      const rooms = await response.json();
      setAvailableRooms(rooms);
    } catch (error) {
      console.error('Failed to fetch rooms:', error);
    }
  };

  const createRoom = () => {
    if (!socket || !createPlayerName.trim()) {
      setError('Please enter your name');
      return;
    }

    setError(null);
    socket.emit('joinRoom', { 
      playerName: createPlayerName.trim(), 
      createNew: true, 
      maxPlayers, 
      gameMode 
    });
  };

  const joinRoom = () => {
    if (!socket || !joinPlayerName.trim() || !roomId.trim()) {
      setError('Please enter your name and room code');
      return;
    }

    setError(null);
    socket.emit('joinRoom', { 
      roomId: roomId.trim(), 
      playerName: joinPlayerName.trim() 
    });
  };

  const startGame = () => {
    if (!socket || !roomId) return;
    socket.emit('startGame', { roomId });
  };

  const makeGuess = () => {
    if (!socket || !roomId || !currentGuess.trim()) return;
    
    console.log('Making guess:', {
      roomId,
      guess: currentGuess.trim().toUpperCase(),
      currentPlayerId,
      socketId: socket?.id
    });
    
    socket.emit('makeGuess', { 
      roomId, 
      guess: currentGuess.trim().toUpperCase() 
    });
    setCurrentGuess('');
  };

  const leaveRoom = () => {
    if (!socket || !roomId) return;
    
    // If currentPlayerId is missing, try to get it from the room or use a fallback
    let playerIdToUse = currentPlayerId;
    
    if (!playerIdToUse && room) {
      // Try to find any player in the room to use as fallback
      if (room.players.length > 0) {
        playerIdToUse = room.players[0].id;
        console.log('Using fallback player ID for leave room:', playerIdToUse);
      }
    }
    
    if (!playerIdToUse) {
      // Last resort: force leave by clearing everything
      console.log('No player ID available, forcing room leave');
      setRoom(null);
      setRoomId('');
      setCurrentPlayerId(null);
      setShowLobby(true);
      clearRoomInfo();
      fetchAvailableRooms();
      return;
    }
    
    console.log(`Leaving room ${roomId} as player ${playerIdToUse}`);
    socket.emit('leaveRoom', { roomId, playerId: playerIdToUse });
    setRoom(null);
    setRoomId('');
    setCurrentPlayerId(null);
    setShowLobby(true);
    clearRoomInfo(); // Clear saved room info
    fetchAvailableRooms();
  };

  const markReadyForNextRound = (playerId: string) => {
    if (!socket || !roomId) return;
    
    console.log(`Marking player ${playerId} as ready for next round`);
    // Backend expects socketId
    socket.emit('markReadyForNextRound', { roomId, socketId: socket.id });
  };

  // Generate a random player name
  const generateRandomName = () => {
    const adjectives = ['Quick', 'Smart', 'Fast', 'Cool', 'Epic', 'Amazing', 'Super', 'Mega', 'Ultra', 'Pro', 'Awesome', 'Brilliant', 'Clever', 'Dynamic', 'Energetic', 'Fierce', 'Genius', 'Happy', 'Incredible', 'Jolly'];
    const nouns = ['Player', 'Gamer', 'Champion', 'Hero', 'Legend', 'Master', 'Ninja', 'Warrior', 'Hunter', 'Explorer', 'Adventurer', 'Brawler', 'Commander', 'Defender', 'Engineer', 'Fighter', 'Guardian', 'Inventor', 'Knight', 'Leader'];
    const randomNum = Math.floor(Math.random() * 1000);
    
    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    
    return `${adjective}${noun}${randomNum}`;
  };

  // Quick join room with immediate connection
  const quickJoinRoom = (roomId: string, playerName: string) => {
    if (!socket) {
      setError('Not connected to server');
      return;
    }
    
    if (!playerName.trim()) {
      setError('Please enter a player name');
      return;
    }
    
    console.log(`Quick joining room ${roomId} as ${playerName}`);
    setError(null);
    
    // Show success message for quick join
    setError(`🎯 Quick joining room ${roomId} as ${playerName}...`);
    
    // Join the room immediately
    socket.emit('joinRoom', { 
      roomId: roomId.trim(), 
      playerName: playerName.trim() 
    });
    
    // Clear the success message after a short delay
    setTimeout(() => {
      setError(null);
    }, 2000);
  };

  const updateKeyStates = (feedback: string[], guess: string) => {
    console.log('updateKeyStates called with:', { feedback, guess, currentKeyStates: keyStates });
    
    const newKeyStates = { ...keyStates };
    
    for (let i = 0; i < guess.length; i++) {
      const letter = guess[i];
      const feedbackType = feedback[i];
      
      console.log(`Processing letter ${letter} with feedback ${feedbackType}`);
      
      // Only update if the new feedback is better (hit > present > miss)
      if (feedbackType === 'hit' || 
          (feedbackType === 'present' && newKeyStates[letter] !== 'hit') ||
          (feedbackType === 'miss' && !['hit', 'present'].includes(newKeyStates[letter] || 'empty'))) {
        newKeyStates[letter] = feedbackType as 'hit' | 'present' | 'miss';
        console.log(`Updated ${letter} to ${feedbackType}`);
      } else {
        console.log(`Skipped updating ${letter} (current: ${newKeyStates[letter]}, new: ${feedbackType})`);
      }
    }
    
    console.log('New key states:', newKeyStates);
    setKeyStates(newKeyStates);
  };

  // Update keyboard colors based on ALL players' guesses in current round
  const updateKeyboardFromAllPlayers = () => {
    if (!room || !room.players) {
      console.log('updateKeyboardFromAllPlayers: No room or players available');
      return;
    }
    
    const currentRound = room.currentRound || 1;
    const newKeyStates: { [key: string]: 'hit' | 'present' | 'miss' } = {};
    
    console.log(`updateKeyboardFromAllPlayers: Processing round ${currentRound} with ${room.players.length} players`);
    
    // Collect feedback from all players in current round
    room.players.forEach(player => {
      if (!player.guesses) return;
      
      const roundGuesses = player.guesses.filter(g => g.round === currentRound);
      console.log(`Player ${player.name}: ${roundGuesses.length} guesses in round ${currentRound}`);
      
      roundGuesses.forEach(guess => {
        for (let i = 0; i < guess.guess.length; i++) {
          const letter = guess.guess[i];
          const feedbackType = guess.feedback[i];
          
          // Only update if the new feedback is better (hit > present > miss)
          if (feedbackType === 'hit' || 
              (feedbackType === 'present' && newKeyStates[letter] !== 'hit') ||
              (feedbackType === 'miss' && !['hit', 'present'].includes(newKeyStates[letter] || 'empty'))) {
            newKeyStates[letter] = feedbackType as 'hit' | 'present' | 'miss';
          }
        }
      });
    });
    
    console.log('Updated keyboard states from all players:', newKeyStates);
    setKeyStates(newKeyStates);
  };

  const handleKeyPress = (key: string) => {
    if (key === 'ENTER') {
      if (currentGuess.length === 5) {
        makeGuess();
      }
    } else if (key === '⌫') {
      setCurrentGuess(prev => prev.slice(0, -1));
    } else if (currentGuess.length < 5) {
      setCurrentGuess(prev => prev + key);
    }
  };

  const renderTile = (letter: string, feedback: string, isCurrentRow: boolean = false, key?: string) => {
    const getTileColor = () => {
      switch (feedback) {
        case 'hit': return '#6aaa64';
        case 'present': return '#c9b458';
        case 'miss': return '#3a3a3c';
        case 'empty': return isCurrentRow ? '#3a3a3c' : '#121213';
        default: return '#121213';
      }
    };

    return (
      <div 
        key={key}
        className={styles.tile}
        style={{ backgroundColor: getTileColor() }}
      >
        {letter}
      </div>
    );
  };

  const renderPlayerBoard = (player: Player) => {
    const board = [];
    const currentRound = room?.currentRound || 0;
    
    // Get all guesses for the current round
    const guesses = player.guesses.filter(g => g.round === currentRound);
    
    // Debug logging
    console.log(`Rendering board for player ${player.name}:`, {
      currentRound,
      totalGuesses: player.guesses.length,
      roundGuesses: guesses.length,
      guesses: guesses,
      playerId: player.id,
      currentPlayerId: currentPlayerId
    });
    
    for (let row = 0; row < 6; row++) {
      const rowTiles = [];
      for (let col = 0; col < 5; col++) {
        let letter = '';
        let feedback: string = 'empty';
        
        // Show guess in the appropriate row (attempt number)
        if (row < guesses.length) {
          const guess = guesses[row];
          letter = guess.guess[col] || '';
          feedback = guess.feedback[col] || 'empty';
          
          // Additional debug for each guess
          if (row === 0) {
            console.log(`Row ${row}, Col ${col}: letter="${letter}", feedback="${feedback}"`);
          }
        }
        
        rowTiles.push(
          renderTile(letter, feedback, false, `${player.id}-${row}-${col}`)
        );
      }
      board.push(
        <div key={row} className={styles.row}>
          {rowTiles}
        </div>
      );
    }
    return board;
  };

  if (!isConnected) {
    return (
      <div className={styles.container}>
        <div className={styles.connectionStatus}>
          <h1>Connecting to Server...</h1>
          <p>Please wait while we establish a connection.</p>
        </div>
      </div>
    );
  }

  if (isReconnecting) {
    return (
      <div className={styles.container}>
        <div className={styles.connectionStatus}>
          <h1>Reconnecting to Room...</h1>
          <p>Please wait while we rejoin your game.</p>
        </div>
      </div>
    );
  }

  if (showLobby) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h1>🎮 Multiplayer Wordle</h1>
          <p>Join existing rooms or create your own!</p>
        </div>

        {error && (
          <div className={styles.error}>
            {error}
          </div>
        )}

        <div className={styles.lobbySection}>
          <div className={styles.createRoom}>
            <h2>Create New Room</h2>
            <div className={styles.formGroup}>
              <input
                type="text"
                placeholder="Your Name"
                value={createPlayerName}
                onChange={(e) => setCreatePlayerName(e.target.value)}
                className={styles.input}
              />
            </div>
            
            <div className={styles.formGroup}>
              <select 
                value={gameMode} 
                onChange={(e) => setGameMode(e.target.value as 'normal' | 'cheating')}
                className={styles.select}
              >
                <option value="normal">🎯 Normal Mode</option>
                <option value="cheating">🎭 Cheating Mode</option>
              </select>
            </div>
            
            <div className={styles.formGroup}>
              <select 
                value={maxPlayers} 
                onChange={(e) => setMaxPlayers(Number(e.target.value))}
                className={styles.select}
              >
                <option value={2}>2 Players</option>
                <option value={3}>3 Players</option>
                <option value={4}>4 Players</option>
              </select>
            </div>
            
            <button onClick={createRoom} className={styles.createButton}>
              Create Room
            </button>
          </div>

          <div className={styles.joinRoom}>
            <h2>Join Existing Room</h2>
            <div className={styles.formGroup}>
              <input
                type="text"
                placeholder="Your Name"
                value={joinPlayerName}
                onChange={(e) => setJoinPlayerName(e.target.value)}
                className={styles.input}
              />
            </div>
            
            <div className={styles.formGroup}>
              <input
                type="text"
                placeholder="Room Code (e.g., ABC123)"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                className={styles.input}
                maxLength={6}
              />
            </div>
            
            <button onClick={joinRoom} className={styles.joinButton}>
              Join Room
            </button>
          </div>
        </div>

        <div className={styles.availableRooms}>
          <h2>Available Rooms ({availableRooms.length})</h2>
          {availableRooms.length === 0 ? (
            <p>No rooms available. Create one to get started!</p>
          ) : (
            <div className={styles.roomList}>
              {availableRooms.map((room) => (
                <div key={room.roomId} className={styles.roomCard}>
                  <div className={styles.roomHeader}>
                    <span className={styles.roomCode}>{room.roomId}</span>
                    <span className={styles.roomMode}>
                      {room.gameMode === 'cheating' ? '🎭' : '🎯'}
                    </span>
                  </div>
                  <div className={styles.roomInfo}>
                    <span>{room.playerCount}/{room.maxPlayers} players</span>
                    <span className={styles.roomTime}>
                      {new Date(room.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <button 
                    onClick={() => {
                      // Generate random name if none provided
                      let playerName = joinPlayerName.trim();
                      if (!playerName) {
                        playerName = createPlayerName.trim() || generateRandomName();
                        setJoinPlayerName(playerName);
                      }
                      
                      // Set room ID and join immediately
                      setRoomId(room.roomId);
                      quickJoinRoom(room.roomId, playerName);
                    }}
                    className={styles.quickJoinButton}
                    disabled={room.playerCount >= room.maxPlayers}
                    title="Click to join room with auto-generated name if needed"
                  >
                    {room.playerCount >= room.maxPlayers ? 'Full' : 'Quick Join'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <h1>Loading Room...</h1>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Room: {room.roomId}</h1>
        <div className={styles.roomInfo}>
          <span className={styles.gameMode}>
            {room.gameMode === 'cheating' ? '🎭 Cheating Mode' : '🎯 Normal Mode'}
          </span>
          <span className={styles.roundInfo}>
            Round {room.currentRound}
          </span>
          <span className={styles.playerCount}>
            {room.players.length}/{room.maxPlayers} Players
          </span>
        </div>
      </div>

      {error && (
        <div className={styles.error}>
          {error}
        </div>
      )}

      <div className={styles.gameSection}>
        {room.gameState === 'WAITING' && (
          <div className={styles.waiting}>
            <h2>Waiting for Players...</h2>
            <div className={styles.players}>
              {room.players.map((player) => (
                <div key={player.id} className={styles.player}>
                  <span className={styles.playerName}>
                    {player.name} {player.isHost && '👑'}
                  </span>
                  <span className={styles.playerStatus}>
                    {player.status === 'READY' ? '✅ Ready' : '⏳ Joining'}
                  </span>
                </div>
              ))}
            </div>
            
            {/* Debug info */}
            <div style={{ fontSize: '12px', color: '#666', margin: '10px 0' }}>
              Debug: Players: {room.players.length}, 
              CurrentPlayerId: {currentPlayerId}, 
              HostId: {room.players.find(p => p.isHost)?.id},
              IsHost: {room.players.find(p => p.id === currentPlayerId)?.isHost ? 'Yes' : 'No'}
            </div>
            
            <div className={styles.buttonContainer}>
              {room.players.length >= 2 && room.players.find(p => p.isHost)?.id === currentPlayerId && (
                <button onClick={startGame} className={styles.startButton}>
                  Start Game
                </button>
              )}
              
              <button onClick={leaveRoom} className={styles.leaveButton}>
                Leave Room
              </button>
              
              {/* Emergency Force Leave button when identification fails */}
              {!currentPlayerId && (
                <button 
                  onClick={() => {
                    console.log('Force leaving room due to identification failure');
                    setRoom(null);
                    setRoomId('');
                    setCurrentPlayerId(null);
                    setShowLobby(true);
                    clearRoomInfo();
                    fetchAvailableRooms();
                  }} 
                  className={styles.forceLeaveButton}

                >
                  🚨 Force Leave Room
                </button>
              )}
            </div>
            
            {/* Alternative Start Game button for debugging */}
            {room.players.length >= 2 && room.players.find((p: Player) => p.isHost)?.id !== currentPlayerId && (
              <div style={{ fontSize: '12px', color: '#ff6b6b', margin: '10px 0' }}>
                ⚠️ Start Game button hidden: Host check failed
              </div>
            )}
          </div>
        )}

        {/* Debug info */}
        <div style={{ fontSize: '12px', color: '#666', margin: '10px 0', textAlign: 'center' }}>
          Debug: GameState: {room.gameState}, 
          CurrentPlayerId: {currentPlayerId}, 
          PlayerStatus: {room.players.find((p: Player) => p.id === currentPlayerId)?.status}
          <br />
          Key States: {Object.entries(keyStates).map(([key, state]) => `${key}:${state}`).join(', ') || 'None'}
        </div>

        {room.gameState === 'PLAYING' && (
          <div className={styles.gameplay}>
            <div className={styles.sharedGame}>
              <h3>Shared Game Progress</h3>
              {room.sharedGame && (
                <div className={styles.gameStatus}>
                  <span>Status: {room.sharedGame.status}</span>
                  <span>Rounds Left: {room.sharedGame.roundsLeft}</span>
                  {room.gameMode === 'cheating' && room.sharedGame.candidatesCount && (
                    <span>Candidates: {room.sharedGame.candidatesCount}</span>
                  )}
                </div>
              )}
            </div>

            <div className={styles.playerBoards}>
              {room.players.map((player) => (
                <div key={player.id} className={styles.playerBoard}>
                  <div className={styles.playerHeader}>
                    <span className={styles.playerName}>
                      {player.name} {player.isHost && '👑'}
                    </span>
                    <span className={styles.playerScore}>
                      Score: {player.score}
                    </span>
                    <span className={styles.playerStatus}>
                      {player.status === 'PLAYING' ? '🎮 Playing' : '✅ Finished'}
                    </span>
                    {player.status === 'PLAYING' && (
                      <span className={styles.playerGuesses}>
                        Guesses: {player.guesses.length}/6
                      </span>
                    )}
                  </div>
                  
                  <div className={styles.board}>
                    {renderPlayerBoard(player)}
                  </div>
                  
                  {/* Ready for Next Round Button - Show when player is finished */}
                  {player.status === 'FINISHED' && (
                    <div className={styles.readyForNextRound}>
                      <button 
                        onClick={() => markReadyForNextRound(player.id)}
                        className={styles.readyButton}
                        disabled={player.readyForNextRound || false}
                      >
                        {player.readyForNextRound ? '✅ Ready' : '🎯 Ready for Next Round'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Guess Input - Show when player is in room */}
            {room.players.find((p: Player) => p.id === currentPlayerId) && (
              <div className={styles.guessInput}>
                <div className={styles.currentGuess}>
                  {currentGuess.padEnd(5, ' ').split('').map((letter, index) => (
                    <div key={index} className={styles.guessTile}>
                      {letter === ' ' ? '' : letter}
                    </div>
                  ))}
                </div>
                <button onClick={makeGuess} className={styles.submitButton} disabled={currentGuess.length !== 5}>
                  Submit Guess
                </button>
              </div>
            )}
            
            {/* Virtual Keyboard - Show when player is in room */}
            {room.players.find((p: Player) => p.id === currentPlayerId) && (
              <div className={styles.keyboard}>
                {[
                  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
                  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
                  ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', '⌫']
                ].map((row, rowIndex) => (
                  <div key={rowIndex} className={styles.keyboardRow}>
                    {row.map((key) => {
                      const getKeyColor = () => {
                        if (key === 'ENTER' || key === '⌫') return '#818384';
                        const state = keyStates[key] || 'empty';
                        const color = (() => {
                          switch (state) {
                            case 'hit': return '#6aaa64';
                            case 'present': return '#c9b458';
                            case 'miss': return '#3a3a3c';
                            default: return '#818384';
                          }
                        })();
                        
                        // Debug logging for key colors
                        if (key === 'H' || key === 'E' || key === 'F') {
                          console.log(`Key ${key}: state=${state}, color=${color}`);
                        }
                        
                        return color;
                      };
                      
                      return (
                        <button
                          key={key}
                          className={`${styles.key} ${key === 'ENTER' ? styles.enter : key === '⌫' ? styles.backspace : ''}`}
                          style={{ backgroundColor: getKeyColor() }}
                          onClick={() => handleKeyPress(key)}
                        >
                          {key}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}

            <div className={styles.buttonContainer}>
              <button onClick={leaveRoom} className={styles.leaveButton}>
                Leave Room
              </button>
            </div>
          </div>
        )}

        {room.gameState === 'FINISHED' && (
          <div className={styles.results}>
            <h2>Game Results</h2>
            <div className={styles.rankings}>
              {room.players
                .sort((a, b) => b.score - a.score)
                .map((player, index) => (
                  <div key={player.id} className={styles.rankingRow}>
                    <span className={styles.rank}>#{index + 1}</span>
                    <span className={styles.playerName}>{player.name}</span>
                    <span className={styles.score}>{player.score} points</span>
                  </div>
                ))}
            </div>
            
            {room.sharedGame?.answer && (
              <div className={styles.answer}>
                Final Answer: {room.sharedGame.answer}
              </div>
            )}
            
            <div className={styles.buttonContainer}>
              <button onClick={leaveRoom} className={styles.leaveButton}>
                Back to Lobby
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 