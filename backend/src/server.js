const express = require('express');
const cors = require('cors');
const GameFactory = require('./gameFactory');

const app = express();
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

app.listen(PORT, () => {
  console.log(`Wordle backend running on port ${PORT}`);
  console.log(`Available modes: normal, cheating`);
});
