// Core Wordle game logic module
// No I/O, pure logic for reuse in backend API and tests

class WordleGame {
  constructor(wordList, maxRounds = 6, answer = null) {
    if (!Array.isArray(wordList) || wordList.length === 0) {
      throw new Error('Word list must be a non-empty array');
    }
    this.wordList = wordList.map(w => w.toUpperCase());
    this.maxRounds = maxRounds;
    this.answer = answer ? answer.toUpperCase() : this.wordList[Math.floor(Math.random() * this.wordList.length)];
    this.guesses = [];
    this.status = 'IN_PROGRESS'; // IN_PROGRESS, WIN, LOSE
  }

  // Validate guess: must be 5 letters from A-Z only
  validateGuess(guess) {
    const word = guess.toUpperCase();
    if (word.length !== 5) return { valid: false, reason: 'Guess must be 5 letters' };
    if (!/^[A-Z]{5}$/.test(word)) return { valid: false, reason: 'Guess must be A-Z only' };
    return { valid: true };
  }

  // Score guess: returns array of 'hit', 'present', 'miss'
  scoreGuess(guess) {
    const word = guess.toUpperCase();
    const answerArr = this.answer.split('');
    const guessArr = word.split('');
    const result = Array(5).fill('miss');
    const answerUsed = Array(5).fill(false);

    // First pass: hits
    for (let i = 0; i < 5; i++) {
      if (guessArr[i] === answerArr[i]) {
        result[i] = 'hit';
        answerUsed[i] = true;
      }
    }
    // Second pass: presents
    for (let i = 0; i < 5; i++) {
      if (result[i] === 'hit') continue;
      for (let j = 0; j < 5; j++) {
        if (!answerUsed[j] && guessArr[i] === answerArr[j]) {
          result[i] = 'present';
          answerUsed[j] = true;
          break;
        }
      }
    }
    return result;
  }

  // Make a guess, update state, return feedback
  makeGuess(guess) {
    if (this.status !== 'IN_PROGRESS') {
      return { valid: false, reason: 'Game is over', status: this.status };
    }
    const validation = this.validateGuess(guess);
    if (!validation.valid) {
      return { valid: false, reason: validation.reason };
    }
    const feedback = this.scoreGuess(guess);
    this.guesses.push({ guess: guess.toUpperCase(), feedback });
    if (guess.toUpperCase() === this.answer) {
      this.status = 'WIN';
    } else if (this.guesses.length >= this.maxRounds) {
      this.status = 'LOSE';
    }
    return {
      valid: true,
      feedback,
      guesses: this.guesses,
      status: this.status,
      roundsLeft: this.maxRounds - this.guesses.length,
      answer: this.status !== 'IN_PROGRESS' ? this.answer : undefined
    };
  }

  // Get current game state (for API)
  getState() {
    return {
      guesses: this.guesses,
      status: this.status,
      roundsLeft: this.maxRounds - this.guesses.length,
      answer: this.status !== 'IN_PROGRESS' ? this.answer : undefined
    };
  }
}

module.exports = WordleGame;
