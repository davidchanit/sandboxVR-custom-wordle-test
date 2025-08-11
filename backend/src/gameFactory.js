// Game Factory for creating different types of Wordle games
const WordleGame = require('./game');
const CheatingWordleGame = require('./cheatingGame');

class GameFactory {
  static createGame(mode, wordList, maxRounds = 6, answer = null) {
    switch (mode) {
      case 'normal':
        return new WordleGame(wordList, maxRounds, answer);
      case 'cheating':
        return new CheatingWordleGame(wordList, maxRounds);
      default:
        throw new Error(`Unknown game mode: ${mode}`);
    }
  }
}

module.exports = GameFactory; 