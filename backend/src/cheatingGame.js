// Host Cheating Wordle Game Logic (Task 3)
// Implements Absurdle-like behavior where host adapts to prolong the game

class CheatingWordleGame {
  constructor(wordList, maxRounds = 6) {
    if (!Array.isArray(wordList) || wordList.length === 0) {
      throw new Error('Word list must be a non-empty array');
    }
    this.wordList = wordList.map(w => w.toUpperCase());
    this.maxRounds = maxRounds;
    this.candidates = [...this.wordList]; // All words start as candidates
    this.guesses = [];
    this.status = 'IN_PROGRESS'; // IN_PROGRESS, WIN, LOSE
    this.currentAnswer = null; // Will be set dynamically
  }

  // Validate guess: must be 5 letters from A-Z only
  validateGuess(guess) {
    const word = guess.toUpperCase();
    if (word.length !== 5) return { valid: false, reason: 'Guess must be 5 letters' };
    if (!/^[A-Z]{5}$/.test(word)) return { valid: false, reason: 'Guess must be A-Z only' };
    return { valid: true };
  }

  // Check if a candidate word matches the feedback pattern
  matchesFeedback(candidate, guess, feedback) {
    const candidateArr = candidate.split('');
    const guessArr = guess.split('');
    
    // Check each position
    for (let i = 0; i < 5; i++) {
      if (feedback[i] === 'hit') {
        // Hit: letter must be in correct position
        if (candidateArr[i] !== guessArr[i]) return false;
      } else if (feedback[i] === 'present') {
        // Present: letter must be in word but wrong position
        if (candidateArr[i] === guessArr[i]) return false; // Can't be in same position
        if (!candidateArr.includes(guessArr[i])) return false; // Must contain letter
      } else if (feedback[i] === 'miss') {
        // Miss: letter must not be in word
        if (candidateArr.includes(guessArr[i])) return false;
      }
    }
    return true;
  }

  // Calculate score for a candidate against a guess
  calculateScore(candidate, guess) {
    const candidateArr = candidate.split('');
    const guessArr = guess.split('');
    let hits = 0, presents = 0;
    
    // Count hits
    for (let i = 0; i < 5; i++) {
      if (candidateArr[i] === guessArr[i]) {
        hits++;
      }
    }
    
    // Count presents (letters in word but wrong position)
    const usedPositions = new Set();
    for (let i = 0; i < 5; i++) {
      if (candidateArr[i] === guessArr[i]) continue; // Skip hits
      
      for (let j = 0; j < 5; j++) {
        if (i !== j && !usedPositions.has(j) && candidateArr[j] === guessArr[i]) {
          presents++;
          usedPositions.add(j);
          break;
        }
      }
    }
    
    return { hits, presents };
  }

  // Check if score1 is worse than score2 (fewer hits, or same hits but fewer presents)
  isWorseScore(score1, score2) {
    if (score1.hits < score2.hits) return true;
    if (score1.hits === score2.hits && score1.presents < score2.presents) return true;
    return false;
  }

  // Select the candidate that gives the worst (lowest) score
  selectWorstAnswer(guess) {
    if (this.candidates.length === 0) return null;
    
    let worstCandidate = this.candidates[0];
    let worstScore = this.calculateScore(worstCandidate, guess);
    
    for (let candidate of this.candidates) {
      const score = this.calculateScore(candidate, guess);
      if (this.isWorseScore(score, worstScore)) {
        worstScore = score;
        worstCandidate = candidate;
      }
    }
    
    return worstCandidate;
  }

  // Eliminate candidates that don't match the feedback
  eliminateCandidates(guess, feedback) {
    this.candidates = this.candidates.filter(candidate => 
      this.matchesFeedback(candidate, guess, feedback)
    );
  }

  // Score guess: returns array of 'hit', 'present', 'miss'
  scoreGuess(guess) {
    const word = guess.toUpperCase();
    const answerArr = this.currentAnswer.split('');
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

    // Select the worst-scoring candidate as the current answer
    this.currentAnswer = this.selectWorstAnswer(guess);
    
    // Score the guess against the selected answer
    const feedback = this.scoreGuess(guess);
    
    // Eliminate candidates that don't match this feedback
    this.eliminateCandidates(guess, feedback);
    
    // Add to guesses
    this.guesses.push({ guess: guess.toUpperCase(), feedback });
    
    // Check win condition
    if (guess.toUpperCase() === this.currentAnswer) {
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
      answer: this.status !== 'IN_PROGRESS' ? this.currentAnswer : undefined,
      candidatesCount: this.candidates.length,
      remainingCandidates: this.status !== 'IN_PROGRESS' ? this.candidates : undefined
    };
  }

  // Get current game state (for API)
  getState() {
    return {
      guesses: this.guesses,
      status: this.status,
      roundsLeft: this.maxRounds - this.guesses.length,
      answer: this.status !== 'IN_PROGRESS' ? this.currentAnswer : undefined,
      candidatesCount: this.candidates.length,
      remainingCandidates: this.status !== 'IN_PROGRESS' ? this.candidates : undefined
    };
  }
}

module.exports = CheatingWordleGame; 