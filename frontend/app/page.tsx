'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';

interface GameState {
  guesses: Array<{ guess: string; feedback: string[] }>;
  status: 'IN_PROGRESS' | 'WIN' | 'LOSE';
  roundsLeft: number;
  answer?: string;
}

interface TileProps {
  letter: string;
  feedback: 'hit' | 'present' | 'miss' | 'empty';
  isCurrentRow?: boolean;
}

interface Alert {
  id: string;
  message: string;
  type: 'error' | 'success' | 'info';
}

const Tile = ({ letter, feedback, isCurrentRow }: TileProps) => {
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
      className={styles.tile}
      style={{ backgroundColor: getTileColor() }}
    >
      {letter}
    </div>
  );
};

const Snackbar = ({ alerts, onRemove }: { 
  alerts: Alert[]; 
  onRemove: (id: string) => void;
}) => {
  return (
    <div className={styles.snackbarContainer}>
      {alerts.map((alert) => (
        <div 
          key={alert.id} 
          className={`${styles.snackbar} ${styles[alert.type]}`}
        >
          {alert.message}
          <button 
            className={styles.snackbarClose}
            onClick={() => onRemove(alert.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
};

const Keyboard = ({ onKeyPress, keyStates }: { 
  onKeyPress: (key: string) => void; 
  keyStates: Record<string, 'hit' | 'present' | 'miss' | 'empty'>;
}) => {
  const rows = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', '⌫']
  ];

  const getKeyColor = (key: string) => {
    const state = keyStates[key] || 'empty';
    switch (state) {
      case 'hit': return '#6aaa64';
      case 'present': return '#c9b458';
      case 'miss': return '#3a3a3c';
      default: return '#818384';
    }
  };

  const getKeyClass = (key: string) => {
    if (key === 'ENTER') return 'enter';
    if (key === '⌫') return 'backspace';
    return '';
  };

  return (
    <div className={styles.keyboard}>
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className={styles.keyboardRow}>
          {row.map((key) => (
            <button
              key={key}
              className={`${styles.key} ${styles[getKeyClass(key)]}`}
              style={{ 
                backgroundColor: getKeyColor(key),
                flex: key === 'ENTER' || key === '⌫' ? 1.5 : 1
              }}
              onClick={() => onKeyPress(key)}
            >
              {key}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
};

export default function Home() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [sessionId, setSessionId] = useState<string>('');
  const [currentGuess, setCurrentGuess] = useState('');
  const [keyStates, setKeyStates] = useState<Record<string, 'hit' | 'present' | 'miss' | 'empty'>>({});
  const [alerts, setAlerts] = useState<Alert[]>([]);

  const API_BASE = 'http://localhost:4000/api';

  useEffect(() => {
    startNewGame();
  }, []);

  const addAlert = (message: string, type: 'error' | 'success' | 'info' = 'error') => {
    const id = Date.now().toString();
    const newAlert = { id, message, type };
    setAlerts(prev => [...prev, newAlert]);
    
    // Auto-remove alert after 3 seconds
    setTimeout(() => {
      removeAlert(id);
    }, 3000);
  };

  const removeAlert = (id: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== id));
  };

  const startNewGame = async () => {
    try {
      const response = await fetch(`${API_BASE}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxRounds: 6 })
      });
      const data = await response.json();
      setSessionId(data.sessionId);
      setGameState(data.state);
      setCurrentGuess('');
      setKeyStates({});
    } catch (error) {
      console.error('Failed to start game:', error);
      addAlert('Failed to start game. Please try again.', 'error');
    }
  };

  const submitGuess = async () => {
    if (currentGuess.length !== 5) {
      addAlert('Word must be 5 letters long', 'error');
      return;
    }
    
    if (!sessionId) {
      addAlert('Game session not found. Please refresh the page.', 'error');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/guess`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, guess: currentGuess })
      });
      const data = await response.json();
      
      if (data.valid) {
        setGameState(data);
        setCurrentGuess('');
        updateKeyStates(data.feedback, currentGuess);
        
        if (data.status === 'WIN') {
          addAlert('Congratulations! You won!', 'success');
        } else if (data.status === 'LOSE') {
          addAlert(`Game Over! The word was ${data.answer}`, 'info');
        }
      } else {
        // Show backend validation error (should only be length/character validation now)
        addAlert(data.reason || 'Invalid input', 'error');
      }
    } catch (error) {
      console.error('Failed to submit guess:', error);
      addAlert('Failed to submit guess. Please try again.', 'error');
    }
  };

  const updateKeyStates = (feedback: string[], guess: string) => {
    const newKeyStates = { ...keyStates };
    guess.split('').forEach((letter, index) => {
      const currentState = newKeyStates[letter] || 'empty';
      const newState = feedback[index];
      
      if (newState === 'hit' || 
          (newState === 'present' && currentState !== 'hit') ||
          (newState === 'miss' && currentState === 'empty')) {
        newKeyStates[letter] = newState;
      }
    });
    setKeyStates(newKeyStates);
  };

  const handleKeyPress = (key: string) => {
    if (gameState?.status !== 'IN_PROGRESS') return;

    if (key === 'ENTER') {
      submitGuess();
    } else if (key === '⌫') {
      setCurrentGuess(prev => prev.slice(0, -1));
    } else if (currentGuess.length < 5) {
      setCurrentGuess(prev => prev + key);
    }
  };

  useEffect(() => {
    const handlePhysicalKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        submitGuess();
      } else if (e.key === 'Backspace') {
        setCurrentGuess(prev => prev.slice(0, -1));
      } else if (/^[a-zA-Z]$/.test(e.key) && currentGuess.length < 5) {
        setCurrentGuess(prev => prev + e.key.toUpperCase());
      }
    };

    window.addEventListener('keydown', handlePhysicalKeyPress);
    return () => window.removeEventListener('keydown', handlePhysicalKeyPress);
  }, [currentGuess, sessionId]);

  const renderBoard = () => {
    const board = [];
    for (let row = 0; row < 6; row++) {
      const rowTiles = [];
      for (let col = 0; col < 5; col++) {
        let letter = '';
        let feedback: 'hit' | 'present' | 'miss' | 'empty' = 'empty';
        
        if (row < (gameState?.guesses.length || 0)) {
          const guess = gameState!.guesses[row];
          letter = guess.guess[col];
          feedback = guess.feedback[col] as 'hit' | 'present' | 'miss';
        } else if (row === (gameState?.guesses.length || 0)) {
          letter = currentGuess[col] || '';
          feedback = letter ? 'empty' : 'empty';
        }
        
        rowTiles.push(
          <Tile 
            key={col} 
            letter={letter} 
            feedback={feedback}
            isCurrentRow={row === (gameState?.guesses.length || 0)}
          />
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

  if (!gameState) {
    return <div className={styles.loading}>Loading...</div>;
  }

  return (
    <div className={styles.container}>
      <Snackbar alerts={alerts} onRemove={removeAlert} />
      
      <div className={styles.header}>
        <h1>Wordle</h1>
        {gameState.status !== 'IN_PROGRESS' && (
          <div className={styles.answer}>
            Answer: {gameState.answer}
          </div>
        )}
      </div>
      
      <div className={styles.board}>
        {renderBoard()}
      </div>
      
      <Keyboard onKeyPress={handleKeyPress} keyStates={keyStates} />
      
      {gameState.status !== 'IN_PROGRESS' && (
        <div className={styles.gameOver}>
          <h2>{gameState.status === 'WIN' ? 'Congratulations!' : 'Game Over'}</h2>
          <button onClick={startNewGame} className={styles.newGameButton}>
            New Game
          </button>
        </div>
      )}
    </div>
  );
}
