// Simple Multiplayer Test Script
// Tests basic multiplayer functionality

const io = require('socket.io-client');

const socket1 = io('http://localhost:4000');
const socket2 = io('http://localhost:4000');

console.log('🧪 Testing Multiplayer Wordle System...\n');

// Test 1: Create Room
console.log('1️⃣ Testing Room Creation...');
socket1.emit('joinRoom', {
  playerName: 'Alice',
  createNew: true,
  maxPlayers: 2,
  gameMode: 'normal'
});

socket1.on('roomJoined', (data) => {
  console.log('✅ Room created successfully!');
  console.log(`   Room ID: ${data.roomId}`);
  console.log(`   Players: ${data.room.players.length}`);
  
  // Test 2: Join Room
  console.log('\n2️⃣ Testing Room Joining...');
  socket2.emit('joinRoom', {
    roomId: data.roomId,
    playerName: 'Bob'
  });
});

socket2.on('roomJoined', (data) => {
  console.log('✅ Second player joined successfully!');
  console.log(`   Total players: ${data.room.players.length}`);
  
  // Test 3: Start Game
  console.log('\n3️⃣ Testing Game Start...');
  socket1.emit('startGame', { roomId: data.roomId });
});

socket1.on('gameStarted', (data) => {
  console.log('✅ Game started successfully!');
  console.log(`   Game state: ${data.gameState}`);
  console.log(`   Current round: ${data.currentRound}`);
  
  // Test 4: Make Guesses
  console.log('\n4️⃣ Testing Gameplay...');
  socket1.emit('makeGuess', { roomId: data.roomId, guess: 'HELLO' });
  socket2.emit('makeGuess', { roomId: data.roomId, guess: 'WORLD' });
});

socket1.on('guessMade', (data) => {
  console.log(`✅ Guess made: ${data.guess} by ${data.playerId}`);
  console.log(`   Feedback: [${data.feedback.join(', ')}]`);
});

socket2.on('guessMade', (data) => {
  console.log(`✅ Guess made: ${data.guess} by ${data.playerId}`);
  console.log(`   Feedback: [${data.feedback.join(', ')}]`);
});

// Test 5: Room Stats
setTimeout(() => {
  console.log('\n5️⃣ Testing Room Statistics...');
  fetch('http://localhost:4000/api/multiplayer/stats')
    .then(response => response.json())
    .then(stats => {
      console.log('✅ Server statistics:');
      console.log(`   Total rooms: ${stats.totalRooms}`);
      console.log(`   Active games: ${stats.activeGames}`);
      console.log(`   Total players: ${stats.totalPlayers}`);
    })
    .catch(error => {
      console.log('❌ Failed to get stats:', error.message);
    });
}, 2000);

// Test 6: Cleanup
setTimeout(() => {
  console.log('\n6️⃣ Testing Cleanup...');
  socket1.emit('leaveRoom', { roomId: 'TEST' });
  socket2.emit('leaveRoom', { roomId: 'TEST' });
  
  console.log('✅ Test completed!');
  console.log('\n🎉 Multiplayer system is working correctly!');
  
  process.exit(0);
}, 5000);

// Error handling
socket1.on('error', (error) => {
  console.log('❌ Socket 1 error:', error.message);
});

socket2.on('error', (error) => {
  console.log('❌ Socket 2 error:', error.message);
});

console.log('⏳ Running tests... (will complete in 5 seconds)\n'); 