import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import MultiplayerPage from '../../app/multiplayer/page'

// Mock socket.io-client
const mockSocket = {
  on: jest.fn(),
  emit: jest.fn(),
  connect: jest.fn(),
  disconnect: jest.fn(),
  close: jest.fn(),
  id: 'mock-socket-id',
}

jest.mock('socket.io-client', () => ({
  io: jest.fn(() => mockSocket),
}))

describe('MultiplayerPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('renders basic elements', async () => {
    render(<MultiplayerPage />)
    
    // Initially shows connecting status
    expect(screen.getByText('Connecting to Server...')).toBeInTheDocument()
    
    // Simulate socket connection
    const connectCallback = mockSocket.on.mock.calls.find(([event]) => event === 'connect')?.[1]
    if (connectCallback) {
      connectCallback()
    }
    
    // Wait for lobby to appear
    await waitFor(() => {
      expect(screen.getByText('🎮 Multiplayer Wordle')).toBeInTheDocument()
      expect(screen.getByText('Join existing rooms or create your own!')).toBeInTheDocument()
    })
  })

  test('shows connection status', () => {
    render(<MultiplayerPage />)
    
    expect(screen.getByText('Connecting to Server...')).toBeInTheDocument()
  })

  test('has room creation form', async () => {
    render(<MultiplayerPage />)
    
    // Simulate socket connection
    const connectCallback = mockSocket.on.mock.calls.find(([event]) => event === 'connect')?.[1]
    if (connectCallback) {
      connectCallback()
    }
    
    // Wait for lobby to appear
    await waitFor(() => {
      // Check that we have name input fields (there are two - one for create, one for join)
      const nameInputs = screen.getAllByPlaceholderText('Your Name')
      expect(nameInputs).toHaveLength(2)
      
      // Check buttons
      expect(screen.getByText('Create Room')).toBeInTheDocument()
      expect(screen.getByText('Join Room')).toBeInTheDocument()
    })
  })
}) 