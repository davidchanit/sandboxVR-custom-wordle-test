import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import Home from '../app/page'

// Mock fetch for API calls
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>

describe('Main Page', () => {
  beforeEach(() => {
    // Mock successful API response
    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
      json: async () => ({
        modes: [
          { id: 'normal', name: 'Normal Mode', description: 'Classic Wordle gameplay' },
          { id: 'cheating', name: 'Cheating Mode', description: 'Host cheating gameplay' }
        ]
      })
    } as Response)
  })

  test('renders main page with navigation', () => {
    render(<Home />)
    
    expect(screen.getByText('Wordle')).toBeInTheDocument()
    expect(screen.getByText('Choose your game mode and challenge level')).toBeInTheDocument()
    expect(screen.getByText('🎮 Play Multiplayer')).toBeInTheDocument()
  })

  test('shows game modes selection', async () => {
    render(<Home />)
    
    // Wait for modes to load
    await waitFor(() => {
      expect(screen.getByText('Normal Mode')).toBeInTheDocument()
      expect(screen.getByText('Cheating Mode')).toBeInTheDocument()
    })
  })

  test('has navigation links', () => {
    render(<Home />)
    
    const multiplayerLink = screen.getByRole('link', { name: /🎮 Play Multiplayer/i })
    expect(multiplayerLink).toBeInTheDocument()
    expect(multiplayerLink).toHaveAttribute('href', '/multiplayer')
  })

  test('shows start game button', () => {
    render(<Home />)
    
    expect(screen.getByText('Start Game')).toBeInTheDocument()
  })
}) 