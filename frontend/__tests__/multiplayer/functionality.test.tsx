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

describe('MultiplayerPage Functionality', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset socket mock
    mockSocket.on.mockClear()
    mockSocket.emit.mockClear()
  })

  // Helper function to simulate socket connection
  const simulateSocketConnection = () => {
    const connectCallback = mockSocket.on.mock.calls.find(([event]) => event === 'connect')?.[1]
    if (connectCallback) {
      connectCallback()
    }
  }

  describe('Room Management', () => {
    test('creates room with valid name', async () => {
      const user = userEvent.setup()
      render(<MultiplayerPage />)
      
      // Simulate socket connection to show lobby
      simulateSocketConnection()
      
      // Wait for lobby to appear
      await waitFor(() => {
        expect(screen.getByText('🎮 Multiplayer Wordle')).toBeInTheDocument()
      })
      
      const nameInput = screen.getAllByPlaceholderText('Your Name')[0] // Create room input
      const createButton = screen.getByText('Create Room')
      
      await user.type(nameInput, 'TestPlayer')
      await user.click(createButton)
      
      // Verify socket emit was called with correct parameters
      expect(mockSocket.emit).toHaveBeenCalledWith('joinRoom', {
        playerName: 'TestPlayer',
        createNew: true,
        gameMode: 'normal',
        maxPlayers: 4
      })
    })

    test('joins room with valid credentials', async () => {
      const user = userEvent.setup()
      render(<MultiplayerPage />)
      
      // Simulate socket connection to show lobby
      simulateSocketConnection()
      
      // Wait for lobby to appear
      await waitFor(() => {
        expect(screen.getByText('🎮 Multiplayer Wordle')).toBeInTheDocument()
      })
      
      const nameInputs = screen.getAllByPlaceholderText('Your Name')
      const joinNameInput = nameInputs[1] // Join room input
      const roomIdInput = screen.getByPlaceholderText('Room Code (e.g., ABC123)')
      const joinButton = screen.getByText('Join Room')
      
      await user.type(joinNameInput, 'TestPlayer')
      await user.type(roomIdInput, 'ABC123')
      await user.click(joinButton)
      
      // Verify socket emit was called
      expect(mockSocket.emit).toHaveBeenCalledWith('joinRoom', {
        roomId: 'ABC123',
        playerName: 'TestPlayer'
      })
    })
  })

  describe('Socket Connection', () => {
    test('establishes socket connection on mount', () => {
      render(<MultiplayerPage />)
      
      // Verify socket connection was attempted
      expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function))
      expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function))
    })

    test('handles connection events', async () => {
      render(<MultiplayerPage />)
      
      // Simulate socket connection
      simulateSocketConnection()
      
      // Wait for lobby to appear
      await waitFor(() => {
        expect(screen.getByText('🎮 Multiplayer Wordle')).toBeInTheDocument()
      })
    })
  })

  describe('Form Validation', () => {
    test('validates input fields', async () => {
      const user = userEvent.setup()
      render(<MultiplayerPage />)
      
      // Simulate socket connection to show lobby
      simulateSocketConnection()
      
      // Wait for lobby to appear
      await waitFor(() => {
        expect(screen.getByText('🎮 Multiplayer Wordle')).toBeInTheDocument()
      })
      
      const nameInputs = screen.getAllByPlaceholderText('Your Name')
      const createNameInput = nameInputs[0]
      const createButton = screen.getByText('Create Room')
      
      // Try to create room without name
      await user.click(createButton)
      
      // Verify socket emit was not called
      expect(mockSocket.emit).not.toHaveBeenCalled()
    })
  })
}) 