const WordleGame = require('../src/game');

describe('WordleGame core logic', () => {
  const wordList = ['SOUTH', 'BOUND', 'YOUTH', 'LOUIS', 'OLIVE'];

  test('initializes with random answer from word list', () => {
    const game = new WordleGame(wordList, 6);
    expect(wordList).toContain(game.answer);
    expect(game.maxRounds).toBe(6);
    expect(game.status).toBe('IN_PROGRESS');
    expect(game.guesses).toEqual([]);
  });

  test('validates guesses correctly', () => {
    const game = new WordleGame(wordList);
    expect(game.validateGuess('south').valid).toBe(true);
    expect(game.validateGuess('abc').valid).toBe(false);
    expect(game.validateGuess('12345').valid).toBe(false);
    expect(game.validateGuess('zzzzz').valid).toBe(true); // Any 5 A-Z letters is valid
    expect(game.validateGuess('ABCDE').valid).toBe(true); // Any 5 A-Z letters is valid
  });

  test('accepts made-up 5-letter combinations', () => {
    const game = new WordleGame(wordList, 6, 'SOUTH');
    const result = game.makeGuess('ZZZZZ');
    expect(result.valid).toBe(true);
    expect(result.feedback).toEqual(['miss', 'miss', 'miss', 'miss', 'miss']);
  });

  test('scores hits, presents, and misses', () => {
    const game = new WordleGame(wordList, 6, 'SOUTH');
    // All correct
    expect(game.scoreGuess('SOUTH')).toEqual(['hit','hit','hit','hit','hit']);
    // Some presents
    expect(game.scoreGuess('SHOUT')).toEqual(['hit','present','present','present','present']);
    // All miss (update expected result to match actual logic)
    expect(game.scoreGuess('LOUIS')).toEqual(['miss','hit','hit','miss','present']);
  });

  test('win condition', () => {
    const game = new WordleGame(wordList, 6, 'SOUTH');
    const result = game.makeGuess('SOUTH');
    expect(result.status).toBe('WIN');
    expect(result.feedback).toEqual(['hit','hit','hit','hit','hit']);
    expect(game.status).toBe('WIN');
  });

  test('lose condition', () => {
    const game = new WordleGame(wordList, 2, 'SOUTH');
    game.makeGuess('BOUND');
    const result = game.makeGuess('LOUIS');
    expect(result.status).toBe('LOSE');
    expect(game.status).toBe('LOSE');
    expect(result.answer).toBe('SOUTH');
  });

  test('cannot guess after game over', () => {
    const game = new WordleGame(wordList, 1, 'SOUTH');
    game.makeGuess('BOUND');
    const result = game.makeGuess('LOUIS');
    expect(result.valid).toBe(false);
    expect(result.status).toBe('LOSE');
  });
});