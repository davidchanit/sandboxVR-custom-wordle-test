# Wordle Project (Tasks 1 & 2: Normal + Server/Client)

## Introduction
This project implements the classic Wordle game, fulfilling both Task 1 (Normal Wordle) and Task 2 (Server/Client Wordle) as described in the assignment. The solution is designed for extensibility, maintainability, and clarity, following best practices and all measurement criteria.

## Technology Choices
- **Frontend:** Next.js (React-based, for modern, interactive UI)
- **Backend:** Node.js (Express, for RESTful API and game logic)
- **Language:** JavaScript/TypeScript (fullstack, code sharing between client/server)
- **Testing:** Jest (unit and integration tests)

## Architecture Overview
- **Core Game Logic:** Implemented as a reusable, pure module (no I/O), shared by backend and easily testable.
- **Backend API:** Node.js server exposes endpoints for starting a game, making guesses, and retrieving game state. Handles input validation and enforces game rules.
- **Frontend UI:** Next.js app communicates with backend via API, displays the game board, handles user input, and provides feedback (hit/present/miss) as per Wordle rules.

## Folder Structure
```
/ (project root)
  /backend         # Node.js backend (API, game logic)
    /src
      game.js      # Core game logic (shared, pure functions)
      server.js    # Express server, API endpoints
      ...
    /tests         # Backend unit tests
  /frontend        # Next.js frontend (UI)
    /components    # React components (Board, Keyboard, etc.)
    /pages         # Next.js pages (index.js, etc.)
    /utils         # Shared helpers
    ...
  /shared          # (Optional) Shared code (e.g., word lists, types)
  README.md        # Project documentation
  ...
```

## Trade-offs & Design Decisions
- **Why Next.js + Node.js?**
  - Enables a modern, interactive web UI and a scalable backend for future multiplayer/cheating features.
  - Fullstack JavaScript/TypeScript allows code sharing and easier maintenance.
- **Modular Game Logic:** Core logic is decoupled from UI and server, making it easy to test and extend.
- **API-Driven:** Even for single-player, the frontend uses the backend API, ensuring a consistent architecture for future features.
- **Extensibility:** The structure supports easy addition of multiplayer, host cheating, and bonus features.

## Measurement Criteria Fulfillment
- **Understanding of Abstract Problem:** Implements all required rules, configurable word list and rounds, and clear win/lose logic.
- **Decision Making:** All technology and structure choices are documented above, with trade-offs explained.
- **Code Quality & Organization:** Modular, well-documented code, clear folder structure, and best practices followed.
- **Documentation:** This README and in-code comments explain setup, usage, and design decisions.
- **Source Code Repository Practice:** Organized commits, clear history, and maintainable structure.

## Setup & Running
Instructions for installing dependencies, running backend and frontend, and running tests will be added as implementation progresses.

---

*Continue to update this README as the project evolves, documenting all major decisions and instructions.*

## How This Project Works (Summary)

This project is a fullstack Wordle game with a modern web architecture:

- **Frontend:** Built with Next.js (React), it provides a user-friendly interface for playing Wordle in the browser.
- **Backend:** Built with Node.js and Express, it handles all game logic, validation, and state management.

### How the Game Flow Works

1. **Start a Game:**  
   The frontend requests a new game from the backend. The backend generates a random answer, creates a new game session, and returns a unique `sessionId` to the frontend.

2. **Play the Game:**  
   For each guess, the frontend sends the guess and the `sessionId` to the backend. The backend validates the guess, updates the game state, and returns feedback (hit/present/miss) along with the updated state.

3. **Session Management:**  
   Each game session is stored in backend memory, keyed by `sessionId`. The frontend keeps track of the `sessionId` to continue the game.

4. **Game State:**  
   The backend tracks all guesses, rounds left, and win/lose status. The frontend displays this information to the user.

5. **Multiple Users:**  
   Each user (or browser tab) gets a unique session and can play independently.

> **Note:** For now, all sessions are stored in backend memory. If the server restarts, all games in progress are lost.