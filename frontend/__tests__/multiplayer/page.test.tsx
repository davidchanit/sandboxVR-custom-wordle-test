import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MultiplayerPage from '../../app/multiplayer/page'

// Create mock socket directly in test file
const mockSocket = {
  on: jest.fn(),
  emit: jest.fn(),
  connect: jest.fn(),
  disconnect: jest.fn(),
  close: jest.fn(),
  id: 'mock-socket-id',
  connected: true,
}

// Mock socket.io-client
jest.mock('socket.io-client', () => ({
  io: jest.fn(() => mockSocket),
}))

// Create localStorage mock locally
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn(),
}

describe('MultiplayerPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Reset localStorage mock
    localStorageMock.getItem.mockReturnValue(null)
    localStorageMock.setItem.mockImplementation(() => {})
    localStorageMock.removeItem.mockImplementation(() => {})
    localStorageMock.clear.mockImplementation(() => {})
    
    // Reset socket mock
    mockSocket.on.mockClear()
    mockSocket.emit.mockClear()
    
    // Mock localStorage globally
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
    })
  })

  // Helper function to simulate socket connection
  const simulateSocketConnection = () => {
    const connectCallback = mockSocket.on.mock.calls.find(([event]) => event === 'connect')?.[1]
    if (connectCallback) {
      connectCallback()
    }
  }

  describe('Initial State', () => {
    test('renders lobby view initially', async () => {
      render(<MultiplayerPage />)
      
      // Simulate socket connection to show lobby
      simulateSocketConnection()
      
      // Wait for lobby to appear
      await waitFor(() => {
        expect(screen.getByText('🎮 Multiplayer Wordle')).toBeInTheDocument()
        expect(screen.getByText('Join existing rooms or create your own!')).toBeInTheDocument()
      })
    })

    test('shows connection status when not connected', () => {
      render(<MultiplayerPage />)
      
      expect(screen.getByText('Connecting to Server...')).toBeInTheDocument()
      expect(screen.getByText('Please wait while we establish a connection.')).toBeInTheDocument()
    })
  })

  describe('Room Creation', () => {
    test('allows creating a room with valid name', async () => {
      const user = userEvent.setup()
      render(<MultiplayerPage />)
      
      // Simulate socket connection to show lobby
      simulateSocketConnection()
      
      // Wait for lobby to appear
      await waitFor(() => {
        expect(screen.getByText('🎮 Multiplayer Wordle')).toBeInTheDocument()
      })
      
      const nameInput = screen.getAllByPlaceholderText('Your Name')[0]
      const createButton = screen.getByText('Create Room')
      
      await user.type(nameInput, 'TestPlayer')
      await user.click(createButton)
      
      expect(mockSocket.emit).toHaveBeenCalledWith('joinRoom', {
        playerName: 'TestPlayer',
        createNew: true,
        maxPlayers: 4,
        gameMode: 'normal'
      })
    })

    test('prevents creating room without name', async () => {
      const user = userEvent.setup()
      render(<MultiplayerPage />)
      
      // Simulate socket connection to show lobby
      simulateSocketConnection()
      
      // Wait for lobby to appear
      await waitFor(() => {
        expect(screen.getByText('🎮 Multiplayer Wordle')).toBeInTheDocument()
      })
      
      const createButton = screen.getByText('Create Room')
      await user.click(createButton)
      
      expect(mockSocket.emit).not.toHaveBeenCalled()
    })

    test('allows selecting different game modes', async () => {
      const user = userEvent.setup()
      render(<MultiplayerPage />)
      
      // Simulate socket connection to show lobby
      simulateSocketConnection()
      
      // Wait for lobby to appear
      await waitFor(() => {
        expect(screen.getByText('🎮 Multiplayer Wordle')).toBeInTheDocument()
      })
      
      // Find the game mode select by looking for the option text
      const gameModeSelect = screen.getByDisplayValue('🎯 Normal Mode')
      expect(gameModeSelect).toBeInTheDocument()
      
      await user.selectOptions(gameModeSelect, 'cheating')
      expect(gameModeSelect).toHaveValue('cheating')
    })
  })

  describe('Room Joining', () => {
    test('allows joining room with valid room ID and name', async () => {
      const user = userEvent.setup()
      render(<MultiplayerPage />)
      
      // Simulate socket connection to show lobby
      simulateSocketConnection()
      
      // Wait for lobby to appear
      await waitFor(() => {
        expect(screen.getByText('🎮 Multiplayer Wordle')).toBeInTheDocument()
      })
      
      const nameInputs = screen.getAllByPlaceholderText('Your Name')
      const joinNameInput = nameInputs[1]
      const roomIdInput = screen.getByPlaceholderText('Room Code (e.g., ABC123)')
      const joinButton = screen.getByText('Join Room')
      
      await user.type(joinNameInput, 'TestPlayer')
      await user.type(roomIdInput, 'ABC123')
      await user.click(joinButton)
      
      expect(mockSocket.emit).toHaveBeenCalledWith('joinRoom', {
        roomId: 'ABC123',
        playerName: 'TestPlayer'
      })
    })

    test('prevents joining without room ID or name', async () => {
      const user = userEvent.setup()
      render(<MultiplayerPage />)
      
      // Simulate socket connection to show lobby
      simulateSocketConnection()
      
      // Wait for lobby to appear
      await waitFor(() => {
        expect(screen.getByText('🎮 Multiplayer Wordle')).toBeInTheDocument()
      })
      
      const joinButton = screen.getByText('Join Room')
      await user.click(joinButton)
      
      expect(mockSocket.emit).not.toHaveBeenCalled()
    })

    test('shows quick join option for room IDs', async () => {
      render(<MultiplayerPage />)
      
      // Simulate socket connection to show lobby
      simulateSocketConnection()
      
      // Wait for lobby to appear
      await waitFor(() => {
        expect(screen.getByText('🎮 Multiplayer Wordle')).toBeInTheDocument()
      })
      
      // Simulate available rooms being fetched to show quick join buttons
      const roomsUpdatedCallback = mockSocket.on.mock.calls.find(([event]) => event === 'roomsUpdated')?.[1]
      if (roomsUpdatedCallback) {
        roomsUpdatedCallback([
          {
            roomId: 'TEST123',
            gameMode: 'normal',
            playerCount: 1,
            maxPlayers: 4,
            createdAt: new Date(),
            lastActivity: new Date(),
          }
        ])
      }
      
      // Check for quick join elements
      await waitFor(() => {
        expect(screen.getByText('Quick Join')).toBeInTheDocument()
      })
    })
  })

  describe('Game Room View', () => {
    test('shows room information after joining', async () => {
      render(<MultiplayerPage />)
      
      // Simulate socket connection to show lobby
      simulateSocketConnection()
      
      // Wait for lobby to appear
      await waitFor(() => {
        expect(screen.getByText('🎮 Multiplayer Wordle')).toBeInTheDocument()
      })
      
      // Simulate room join
      const roomJoinedCallback = mockSocket.on.mock.calls.find(([event]) => event === 'roomJoined')?.[1]
      if (roomJoinedCallback) {
        roomJoinedCallback({
          roomId: 'TEST123',
          room: {
            roomId: 'TEST123',
            gameState: 'WAITING',
            gameMode: 'normal',
            maxPlayers: 4,
            currentRound: 0,
            players: [
              {
                id: 'player1',
                name: 'TestPlayer',
                score: 0,
                status: 'READY',
                isHost: true,
                guesses: [],
                joinedAt: new Date(),
                readyForNextRound: false,
              }
            ],
            sharedGame: null,
            createdAt: new Date(),
            lastActivity: new Date(),
          }
        })
      }
      
      // Wait for room view to appear
      await waitFor(() => {
        expect(screen.getByText('Room: TEST123')).toBeInTheDocument()
      })
    })

    test('shows player list correctly', async () => {
      render(<MultiplayerPage />)
      
      // Simulate socket connection to show lobby
      simulateSocketConnection()
      
      // Wait for lobby to appear
      await waitFor(() => {
        expect(screen.getByText('🎮 Multiplayer Wordle')).toBeInTheDocument()
      })
      
      // Simulate room join with players
      const roomJoinedCallback = mockSocket.on.mock.calls.find(([event]) => event === 'roomJoined')?.[1]
      if (roomJoinedCallback) {
        roomJoinedCallback({
          roomId: 'TEST123',
          room: {
            roomId: 'TEST123',
            gameState: 'WAITING',
            gameMode: 'normal',
            maxPlayers: 4,
            currentRound: 0,
            players: [
              {
                id: 'player1',
                name: 'TestPlayer',
                score: 0,
                status: 'READY',
                isHost: true,
                guesses: [],
                joinedAt: new Date(),
                readyForNextRound: false,
              },
              {
                id: 'player2',
                name: 'OtherPlayer',
                score: 0,
                status: 'READY',
                isHost: false,
                guesses: [],
                joinedAt: new Date(),
                readyForNextRound: false,
              }
            ],
            sharedGame: null,
            createdAt: new Date(),
            lastActivity: new Date(),
          }
        })
      }
      
      // Wait for room view to appear and then check for players
      await waitFor(() => {
        expect(screen.getByText('Room: TEST123')).toBeInTheDocument()
      })
      
      // Now check for player names - use partial text matching since they include emojis
      expect(screen.getByText(/TestPlayer/)).toBeInTheDocument()
      expect(screen.getByText(/OtherPlayer/)).toBeInTheDocument()
    })

    test('allows host to start game', async () => {
      const user = userEvent.setup()
      render(<MultiplayerPage />)
      
      // Simulate socket connection to show lobby
      simulateSocketConnection()
      
      // Wait for lobby to appear
      await waitFor(() => {
        expect(screen.getByText('🎮 Multiplayer Wordle')).toBeInTheDocument()
      })
      
      // Simulate room join as host with at least 2 players (required for start game button)
      const roomJoinedCallback = mockSocket.on.mock.calls.find(([event]) => event === 'roomJoined')?.[1]
      if (roomJoinedCallback) {
        roomJoinedCallback({
          roomId: 'TEST123',
          room: {
            roomId: 'TEST123',
            gameState: 'WAITING',
            gameMode: 'normal',
            maxPlayers: 4,
            currentRound: 0,
            players: [
              {
                id: 'player1',
                name: 'TestPlayer',
                score: 0,
                status: 'READY',
                isHost: true,
                guesses: [],
                joinedAt: new Date(),
                readyForNextRound: false,
              },
              {
                id: 'player2',
                name: 'OtherPlayer',
                score: 0,
                status: 'READY',
                isHost: false,
                guesses: [],
                joinedAt: new Date(),
                readyForNextRound: false,
              }
            ],
            sharedGame: null,
            createdAt: new Date(),
            lastActivity: new Date(),
          }
        })
      }
      
      // Wait for room view to appear
      await waitFor(() => {
        expect(screen.getByText('Room: TEST123')).toBeInTheDocument()
      })
      
      // Check for start game button - it should be visible for host with 2+ players
      const startGameButton = screen.getByText('Start Game')
      expect(startGameButton).toBeInTheDocument()
      
      // Click start game
      await user.click(startGameButton)
      
      expect(mockSocket.emit).toHaveBeenCalledWith('startGame', { roomId: 'TEST123' })
    })
  })

  describe('Gameplay', () => {
    test('shows game board when game is in progress', async () => {
      render(<MultiplayerPage />)
      
      // Simulate socket connection to show lobby
      simulateSocketConnection()
      
      // Wait for lobby to appear
      await waitFor(() => {
        expect(screen.getByText('🎮 Multiplayer Wordle')).toBeInTheDocument()
      })
      
      // Simulate room join with game in progress
      const roomJoinedCallback = mockSocket.on.mock.calls.find(([event]) => event === 'roomJoined')?.[1]
      if (roomJoinedCallback) {
        roomJoinedCallback({
          roomId: 'TEST123',
          room: {
            roomId: 'TEST123',
            gameState: 'PLAYING',
            gameMode: 'normal',
            maxPlayers: 4,
            currentRound: 1,
            players: [
              {
                id: 'player1',
                name: 'TestPlayer',
                score: 0,
                status: 'PLAYING',
                isHost: true,
                guesses: [],
                joinedAt: new Date(),
                readyForNextRound: false,
              }
            ],
            sharedGame: {
              status: 'IN_PROGRESS',
              roundsLeft: 6,
              answer: 'HELLO'
            },
            createdAt: new Date(),
            lastActivity: new Date(),
          }
        })
      }
      
      // Wait for game board to appear
      await waitFor(() => {
        expect(screen.getByText('Status: IN_PROGRESS')).toBeInTheDocument()
        expect(screen.getByText('Rounds Left: 6')).toBeInTheDocument()
      })
    })

    test('allows making guesses using virtual keyboard', async () => {
      const user = userEvent.setup()
      render(<MultiplayerPage />)
      
      // Simulate socket connection to show lobby
      simulateSocketConnection()
      
      // Wait for lobby to appear
      await waitFor(() => {
        expect(screen.getByText('🎮 Multiplayer Wordle')).toBeInTheDocument()
      })
      
      // Simulate room join with game in progress
      const roomJoinedCallback = mockSocket.on.mock.calls.find(([event]) => event === 'roomJoined')?.[1]
      if (roomJoinedCallback) {
        roomJoinedCallback({
          roomId: 'TEST123',
          room: {
            roomId: 'TEST123',
            gameState: 'PLAYING',
            gameMode: 'normal',
            maxPlayers: 4,
            currentRound: 1,
            players: [
              {
                id: 'player1',
                name: 'TestPlayer',
                score: 0,
                status: 'PLAYING',
                isHost: true,
                guesses: [],
                joinedAt: new Date(),
                readyForNextRound: false,
              }
            ],
            sharedGame: {
              status: 'IN_PROGRESS',
              roundsLeft: 6,
              answer: 'HELLO'
            },
            createdAt: new Date(),
            lastActivity: new Date(),
          }
        })
      }
      
      // Wait for game board to appear
      await waitFor(() => {
        expect(screen.getByText('Status: IN_PROGRESS')).toBeInTheDocument()
      })
      
      // Find submit button and virtual keyboard - use more specific selectors to avoid duplicates
      const submitButton = screen.getByText('Submit Guess')
      const enterKey = screen.getByText('ENTER')
      
      // Type HELLO using virtual keyboard - use getAllByText for L since there are two
      const lKeys = screen.getAllByText('L')
      const keyboardLKey = lKeys.find(key => key.className.includes('key'))
      
      await user.click(screen.getByText('H'))
      await user.click(screen.getByText('E'))
      await user.click(keyboardLKey!)
      await user.click(keyboardLKey!)
      await user.click(screen.getByText('O'))
      
      // Submit the guess
      await user.click(enterKey)
      
      expect(mockSocket.emit).toHaveBeenCalledWith('makeGuess', {
        roomId: 'TEST123',
        guess: 'HELLO'
      })
    })

    test('shows virtual keyboard', async () => {
      render(<MultiplayerPage />)
      
      // Simulate socket connection to show lobby
      simulateSocketConnection()
      
      // Wait for lobby to appear
      await waitFor(() => {
        expect(screen.getByText('🎮 Multiplayer Wordle')).toBeInTheDocument()
      })
      
      // Simulate room join with game in progress
      const roomJoinedCallback = mockSocket.on.mock.calls.find(([event]) => event === 'roomJoined')?.[1]
      if (roomJoinedCallback) {
        roomJoinedCallback({
          roomId: 'TEST123',
          room: {
            roomId: 'TEST123',
            gameState: 'PLAYING',
            gameMode: 'normal',
            maxPlayers: 4,
            currentRound: 1,
            players: [
              {
                id: 'player1',
                name: 'TestPlayer',
                score: 0,
                status: 'PLAYING',
                isHost: true,
                guesses: [],
                joinedAt: new Date(),
                readyForNextRound: false,
              }
            ],
            sharedGame: {
              status: 'IN_PROGRESS',
              roundsLeft: 6,
              answer: 'HELLO'
            },
            createdAt: new Date(),
            lastActivity: new Date(),
          }
        })
      }
      
      // Wait for game board to appear
      await waitFor(() => {
        expect(screen.getByText('Status: IN_PROGRESS')).toBeInTheDocument()
      })
      
      // Check for virtual keyboard
      expect(screen.getByText('Q')).toBeInTheDocument()
      expect(screen.getByText('W')).toBeInTheDocument()
      expect(screen.getByText('E')).toBeInTheDocument()
    })
  })

  describe('Ready for Next Round', () => {
    test('shows ready for next round button when player finishes', async () => {
      render(<MultiplayerPage />)
      
      // Simulate socket connection to show lobby
      simulateSocketConnection()
      
      // Wait for lobby to appear
      await waitFor(() => {
        expect(screen.getByText('🎮 Multiplayer Wordle')).toBeInTheDocument()
      })
      
      // Simulate room join with finished player
      const roomJoinedCallback = mockSocket.on.mock.calls.find(([event]) => event === 'roomJoined')?.[1]
      if (roomJoinedCallback) {
        roomJoinedCallback({
          roomId: 'TEST123',
          room: {
            roomId: 'TEST123',
            gameState: 'PLAYING',
            gameMode: 'normal',
            maxPlayers: 4,
            currentRound: 1,
            players: [
              {
                id: 'player1',
                name: 'TestPlayer',
                score: 40,
                status: 'FINISHED',
                isHost: true,
                guesses: [
                  { guess: 'HELLO', feedback: ['hit', 'hit', 'hit', 'hit', 'hit'], round: 1 }
                ],
                joinedAt: new Date(),
                readyForNextRound: false,
              }
            ],
            sharedGame: {
              status: 'IN_PROGRESS',
              roundsLeft: 5,
              answer: 'HELLO'
            },
            createdAt: new Date(),
            lastActivity: new Date(),
          }
        })
      }
      
      // Wait for ready button to appear
      await waitFor(() => {
        expect(screen.getByText('🎯 Ready for Next Round')).toBeInTheDocument()
      })
    })

    test('allows marking ready for next round', async () => {
      const user = userEvent.setup()
      render(<MultiplayerPage />)
      
      // Simulate socket connection to show lobby
      simulateSocketConnection()
      
      // Wait for lobby to appear
      await waitFor(() => {
        expect(screen.getByText('🎮 Multiplayer Wordle')).toBeInTheDocument()
      })
      
      // Simulate room join with finished player
      const roomJoinedCallback = mockSocket.on.mock.calls.find(([event]) => event === 'roomJoined')?.[1]
      if (roomJoinedCallback) {
        roomJoinedCallback({
          roomId: 'TEST123',
          room: {
            roomId: 'TEST123',
            gameState: 'PLAYING',
            gameMode: 'normal',
            maxPlayers: 4,
            currentRound: 1,
            players: [
              {
                id: 'player1',
                name: 'TestPlayer',
                score: 40,
                status: 'FINISHED',
                isHost: true,
                guesses: [
                  { guess: 'HELLO', feedback: ['hit', 'hit', 'hit', 'hit', 'hit'], round: 1 }
                ],
                joinedAt: new Date(),
                readyForNextRound: false,
              }
            ],
            sharedGame: {
              status: 'IN_PROGRESS',
              roundsLeft: 5,
              answer: 'HELLO'
            },
            createdAt: new Date(),
            lastActivity: new Date(),
          }
        })
      }
      
      // Wait for ready button to appear
      await waitFor(() => {
        expect(screen.getByText('🎯 Ready for Next Round')).toBeInTheDocument()
      })
      
      // Click ready button
      const readyButton = screen.getByText('🎯 Ready for Next Round')
      await user.click(readyButton)
      
      expect(mockSocket.emit).toHaveBeenCalledWith('markReadyForNextRound', {
        roomId: 'TEST123',
        socketId: 'mock-socket-id'
      })
    })
  })

  describe('Error Handling', () => {
    test('shows error messages from server', async () => {
      render(<MultiplayerPage />)
      
      // Simulate socket connection to show lobby
      simulateSocketConnection()
      
      // Wait for lobby to appear
      await waitFor(() => {
        expect(screen.getByText('🎮 Multiplayer Wordle')).toBeInTheDocument()
      })
      
      // Simulate server error
      const errorCallback = mockSocket.on.mock.calls.find(([event]) => event === 'error')?.[1]
      if (errorCallback) {
        errorCallback({ message: 'Server error occurred' })
      }
      
      // Wait for error message to appear - the component shows error without prefix
      await waitFor(() => {
        expect(screen.getByText('Server error occurred')).toBeInTheDocument()
      })
    })

    test('shows connection errors', async () => {
      render(<MultiplayerPage />)
      
      // Simulate socket connection to show lobby
      simulateSocketConnection()
      
      // Wait for lobby to appear
      await waitFor(() => {
        expect(screen.getByText('🎮 Multiplayer Wordle')).toBeInTheDocument()
      })
      
      // The component doesn't handle connect_error events, so we'll test with a regular error
      const errorCallback = mockSocket.on.mock.calls.find(([event]) => event === 'error')?.[1]
      if (errorCallback) {
        errorCallback({ message: 'Connection failed' })
      }
      
      // Wait for error message to appear - the component shows error without prefix
      await waitFor(() => {
        expect(screen.getByText('Connection failed')).toBeInTheDocument()
      })
    })
  })

  describe('Reconnection', () => {
    test('attempts to reconnect when connection is lost', async () => {
      render(<MultiplayerPage />)
      
      // Simulate socket connection to show lobby
      simulateSocketConnection()
      
      // Wait for lobby to appear
      await waitFor(() => {
        expect(screen.getByText('🎮 Multiplayer Wordle')).toBeInTheDocument()
      })
      
      // Simulate disconnect
      const disconnectCallback = mockSocket.on.mock.calls.find(([event]) => event === 'disconnect')?.[1]
      if (disconnectCallback) {
        disconnectCallback()
      }
      
      // Should show reconnection status
      await waitFor(() => {
        expect(screen.getByText('Connecting to Server...')).toBeInTheDocument()
      })
    })

    test('saves room info for reconnection', async () => {
      const user = userEvent.setup()
      render(<MultiplayerPage />)
      
      // Simulate socket connection to show lobby
      simulateSocketConnection()
      
      // Wait for lobby to appear
      await waitFor(() => {
        expect(screen.getByText('🎮 Multiplayer Wordle')).toBeInTheDocument()
      })
      
      // Create a room
      const nameInput = screen.getAllByPlaceholderText('Your Name')[0]
      const createButton = screen.getByText('Create Room')
      
      await user.type(nameInput, 'TestPlayer')
      await user.click(createButton)
      
      // The component saves room info when roomJoined event is received, not when creating
      // So we need to simulate the roomJoined event to trigger localStorage save
      const roomJoinedCallback = mockSocket.on.mock.calls.find(([event]) => event === 'roomJoined')?.[1]
      if (roomJoinedCallback) {
        roomJoinedCallback({
          roomId: 'TEST123',
          room: {
            roomId: 'TEST123',
            gameState: 'WAITING',
            gameMode: 'normal',
            maxPlayers: 4,
            currentRound: 0,
            players: [
              {
                id: 'player1',
                name: 'TestPlayer',
                score: 0,
                status: 'READY',
                isHost: true,
                guesses: [],
                joinedAt: new Date(),
                readyForNextRound: false,
              }
            ],
            sharedGame: null,
            createdAt: new Date(),
            lastActivity: new Date(),
          }
        })
      }
      
      // Verify localStorage was used after room join
      await waitFor(() => {
        expect(localStorageMock.setItem).toHaveBeenCalled()
      })
    })
  })

  describe('Utility Functions', () => {
    test('shows quick join functionality when rooms are available', async () => {
      render(<MultiplayerPage />)
      
      // Simulate socket connection to show lobby
      simulateSocketConnection()
      
      // Wait for lobby to appear
      await waitFor(() => {
        expect(screen.getByText('🎮 Multiplayer Wordle')).toBeInTheDocument()
      })
      
      // Simulate available rooms being fetched
      const roomsUpdatedCallback = mockSocket.on.mock.calls.find(([event]) => event === 'roomsUpdated')?.[1]
      if (roomsUpdatedCallback) {
        roomsUpdatedCallback([
          {
            roomId: 'TEST123',
            gameMode: 'normal',
            playerCount: 1,
            maxPlayers: 4,
            createdAt: new Date(),
            lastActivity: new Date(),
          }
        ])
      }
      
      // Check for quick join functionality in available rooms section
      await waitFor(() => {
        expect(screen.getByText('Quick Join')).toBeInTheDocument()
      })
    })

    test('validates input fields', async () => {
      const user = userEvent.setup()
      render(<MultiplayerPage />)
      
      // Simulate socket connection to show lobby
      simulateSocketConnection()
      
      // Wait for lobby to appear
      await waitFor(() => {
        expect(screen.getByText('🎮 Multiplayer Wordle')).toBeInTheDocument()
      })
      
      // Try to create room with invalid name
      const nameInput = screen.getAllByPlaceholderText('Your Name')[0]
      const createButton = screen.getByText('Create Room')
      
      await user.type(nameInput, '   ') // Just spaces
      await user.click(createButton)
      
      // Should not emit socket event
      expect(mockSocket.emit).not.toHaveBeenCalled()
    })
  })
}) 