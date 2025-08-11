const CheatingWordleGame = require('../src/cheatingGame');

describe('CheatingWordleGame core logic', () => {
  const wordList = ['HELLO', 'WORLD', 'QUITE', 'FANCY', 'FRESH', 'PANIC', 'CRAZY', 'BUGGY'];

  test('initializes with all words as candidates', () => {
    const game = new CheatingWordleGame(wordList, 6);
    expect(game.candidates).toEqual(wordList);
    expect(game.currentAnswer).toBeNull();
    expect(game.status).toBe('IN_PROGRESS');
    expect(game.guesses).toEqual([]);
  });

  test('validates guesses correctly', () => {
    const game = new CheatingWordleGame(wordList);
    expect(game.validateGuess('hello').valid).toBe(true);
    expect(game.validateGuess('abc').valid).toBe(false);
    expect(game.validateGuess('12345').valid).toBe(false);
    expect(game.validateGuess('zzzzz').valid).toBe(true);
  });

  test('eliminates candidates that do not match feedback', () => {
    const game = new CheatingWordleGame(wordList);
    
    // Simulate HELLO getting _____ feedback
    const feedback = ['miss', 'miss', 'miss', 'miss', 'miss'];
    game.eliminateCandidates('HELLO', feedback);
    
    // HELLO should be eliminated since it doesn't match _____ pattern
    expect(game.candidates).not.toContain('HELLO');
    expect(game.candidates.length).toBeLessThan(wordList.length);
  });

  test('selects worst-scoring candidate', () => {
    const game = new CheatingWordleGame(wordList);
    
    // Test with a guess that would give different scores to different candidates
    const worstCandidate = game.selectWorstAnswer('HELLO');
    expect(worstCandidate).toBeDefined();
    expect(wordList).toContain(worstCandidate);
  });

  test('calculates scores correctly', () => {
    const game = new CheatingWordleGame(wordList);
    
    // Test score calculation
    const score = game.calculateScore('HELLO', 'WORLD');
    expect(score.hits).toBeGreaterThanOrEqual(0);
    expect(score.presents).toBeGreaterThanOrEqual(0);
    expect(score.hits + score.presents).toBeLessThanOrEqual(5);
  });

  test('compares scores correctly', () => {
    const game = new CheatingWordleGame(wordList);
    
    const score1 = { hits: 1, presents: 2 };
    const score2 = { hits: 2, presents: 1 };
    const score3 = { hits: 1, presents: 1 };
    
    // score1 is worse than score2 (fewer hits)
    expect(game.isWorseScore(score1, score2)).toBe(true);
    
    // score3 is worse than score1 (same hits, fewer presents)
    expect(game.isWorseScore(score3, score1)).toBe(true);
    
    // score2 is not worse than score1
    expect(game.isWorseScore(score2, score1)).toBe(false);
  });

  test('makes guess and updates state', () => {
    const game = new CheatingWordleGame(wordList, 6);
    
    const result = game.makeGuess('HELLO');
    expect(result.valid).toBe(true);
    expect(result.feedback.length).toBe(5);
    expect(game.guesses.length).toBe(1);
    expect(game.currentAnswer).toBeDefined();
    expect(game.candidates.length).toBeLessThan(wordList.length);
  });

  test('provides candidates count in response', () => {
    const game = new CheatingWordleGame(wordList, 6);
    
    const result = game.makeGuess('HELLO');
    expect(result.candidatesCount).toBeDefined();
    expect(result.candidatesCount).toBeGreaterThan(0);
    expect(result.candidatesCount).toBeLessThanOrEqual(wordList.length);
  });

  test('game over reveals remaining candidates', () => {
    const game = new CheatingWordleGame(wordList, 1);
    
    // Make one guess to trigger game over
    game.makeGuess('HELLO');
    
    const state = game.getState();
    expect(state.status).toBe('LOSE');
    expect(state.remainingCandidates).toBeDefined();
    expect(Array.isArray(state.remainingCandidates)).toBe(true);
  });
}); 