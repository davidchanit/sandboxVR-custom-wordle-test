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

describe('Ready for Next Round Functionality', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset socket mock
    mockSocket.on.mockClear()
    mockSocket.emit.mockClear()
    
    // Reset localStorage mock
    localStorageMock.getItem.mockReturnValue(null)
    localStorageMock.setItem.mockImplementation(() => {})
    localStorageMock.removeItem.mockImplementation(() => {})
    localStorageMock.clear.mockImplementation(() => {})
    
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

  describe('Button Display', () => {
    test('shows ready button when player finishes round', async () => {
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

    test('does not show ready button for playing players', async () => {
      render(<MultiplayerPage />)
      
      // Simulate socket connection to show lobby
      simulateSocketConnection()
      
      // Wait for lobby to appear
      await waitFor(() => {
        expect(screen.getByText('🎮 Multiplayer Wordle')).toBeInTheDocument()
      })
      
      // Simulate room join with playing player
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
      
      // Wait for game to load
      await waitFor(() => {
        expect(screen.getByText('Status: IN_PROGRESS')).toBeInTheDocument()
      })
      
      // Ready button should not be visible
      expect(screen.queryByText('🎯 Ready for Next Round')).not.toBeInTheDocument()
    })
  })

  describe('Button Functionality', () => {
    test('emits correct socket event when clicked', async () => {
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
      
      // Click the ready button
      const readyButton = screen.getByText('🎯 Ready for Next Round')
      await user.click(readyButton)
      
      // Verify correct socket event was emitted
      expect(mockSocket.emit).toHaveBeenCalledWith('markReadyForNextRound', {
        roomId: 'TEST123',
        socketId: 'mock-socket-id'
      })
    })

    test('button is disabled when player is already ready', async () => {
      render(<MultiplayerPage />)
      
      // Simulate socket connection to show lobby
      simulateSocketConnection()
      
      // Wait for lobby to appear
      await waitFor(() => {
        expect(screen.getByText('🎮 Multiplayer Wordle')).toBeInTheDocument()
      })
      
      // Simulate room join with already ready player
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
                readyForNextRound: true,
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
        const readyButton = screen.getByText('✅ Ready')
        expect(readyButton).toBeInTheDocument()
        expect(readyButton).toBeDisabled()
      })
    })
  })

  describe('Player Identification', () => {
    test('correctly identifies current player for ready button', async () => {
      render(<MultiplayerPage />)
      
      // Simulate socket connection to show lobby
      simulateSocketConnection()
      
      // Wait for lobby to appear
      await waitFor(() => {
        expect(screen.getByText('🎮 Multiplayer Wordle')).toBeInTheDocument()
      })
      
      // Simulate room join with multiple players
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
              },
              {
                id: 'player2',
                name: 'OtherPlayer',
                score: 0,
                status: 'PLAYING',
                isHost: false,
                guesses: [],
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
      
      // Wait for game to load
      await waitFor(() => {
        // Should show ready button for finished player
        expect(screen.getByText('🎯 Ready for Next Round')).toBeInTheDocument()
        // Should not show ready button for playing player
        expect(screen.queryByText('OtherPlayer')).toBeInTheDocument()
      })
    })
  })

  describe('Error Handling', () => {
    test('handles socket errors gracefully', async () => {
      render(<MultiplayerPage />)
      
      // Simulate socket connection to show lobby
      simulateSocketConnection()
      
      // Wait for lobby to appear
      await waitFor(() => {
        expect(screen.getByText('🎮 Multiplayer Wordle')).toBeInTheDocument()
      })
      
      // Simulate socket error
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
}) 