const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: [
      "https://www.braedenpope.dev", 
      "https://braedenpope.dev",
      "http://localhost:3000",  // for local testing
      "http://127.0.0.1:3000"   // for local testing
    ],
    methods: ["GET", "POST"],
    credentials: true
  }
});

const PORT = process.env.PORT || 3001;
const games = new Map();

// Game state management
class Game {
  constructor(code) {
    this.code = code;
    this.players = new Map();
    this.currentRound = 1;
    this.maxRounds = 4;
    this.currentPrompt = '';
    this.submissions = new Map();
    this.votes = new Map();
    this.scores = new Map();
    this.phase = 'lobby'; // lobby, writing, voting, results, final
    this.timer = null;
    this.timeLeft = 60;
    
    this.prompts = [
      "Why does Kaige Omen REALLY want to destroy Waterdeep?",
      "What is Oberon actually doing as a beggar in the city?",
      "The TRUTH behind why all the Masked Lords keep getting assassinated",
      "What Dusara al'Abhook's real plan is now that she can walk in sunlight",
      "Why the Stone of Golorr is causing so much chaos between the guilds",
      "The secret reason Captain Maverick keeps getting promoted",
      "What Thorn is ACTUALLY planning with Deepwater Mercantile",
      "Why Mielikki's power has been waning recently",
      "The real reason Duncan betrayed the party",
      "What Winter's Herald is ACTUALLY testing the party for",
      "Why Sprig looks exactly like Oberon (and it's not what you think)",
      "The truth about what happened to Apoch's creator Meepo"
    ];
  }

  addPlayer(socket, name) {
    this.players.set(socket.id, { name, socket, score: 0 });
    this.scores.set(socket.id, 0);
  }

  removePlayer(socketId) {
    this.players.delete(socketId);
    this.scores.delete(socketId);
  }

  getPlayerList() {
    return Array.from(this.players.values()).map(p => ({ name: p.name, id: p.socket.id }));
  }

  startRound() {
    // Don't repeat prompts in the same game
    const availablePrompts = this.prompts.filter(p => p !== this.currentPrompt);
    this.currentPrompt = availablePrompts[Math.floor(Math.random() * availablePrompts.length)];
    
    this.submissions.clear();
    this.votes.clear();
    this.phase = 'writing';
    this.timeLeft = 60;
    
    this.startTimer();
    this.broadcast('roundStart', {
      round: this.currentRound,
      prompt: this.currentPrompt,
      timeLeft: this.timeLeft
    });
  }

  startTimer() {
    this.timer = setInterval(() => {
      this.timeLeft--;
      this.broadcast('timerUpdate', { timeLeft: this.timeLeft });
      
      if (this.timeLeft <= 0) {
        this.endPhase();
      }
    }, 1000);
  }

  endPhase() {
    clearInterval(this.timer);
    
    if (this.phase === 'writing') {
      this.phase = 'voting';
      const submissions = Array.from(this.submissions.entries()).map(([id, text]) => ({
        id,
        text,
        playerName: this.players.get(id)?.name
      }));
      
      // Shuffle submissions for voting
      for (let i = submissions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [submissions[i], submissions[j]] = [submissions[j], submissions[i]];
      }
      
      this.broadcast('votingPhase', { submissions });
    } else if (this.phase === 'voting') {
      this.showResults();
    }
  }

  submitTheory(socketId, theory) {
    if (this.phase !== 'writing') return false;
    
    this.submissions.set(socketId, theory);
    
    this.broadcast('submissionUpdate', {
      submitted: this.submissions.size,
      total: this.players.size
    });
    
    // Auto-advance if everyone has submitted
    if (this.submissions.size === this.players.size) {
      clearInterval(this.timer);
      this.endPhase();
    }
    
    return true;
  }

  vote(voterId, votedForId) {
    if (this.phase !== 'voting' || voterId === votedForId) return false;
    
    this.votes.set(voterId, votedForId);
    
    this.broadcast('voteUpdate', {
      voted: this.votes.size,
      total: this.players.size
    });
    
    // Auto-advance if everyone has voted
    if (this.votes.size === this.players.size) {
      this.endPhase();
    }
    
    return true;
  }

  showResults() {
    this.phase = 'results';
    
    // Calculate vote counts and award points
    const voteCounts = new Map();
    for (const votedFor of this.votes.values()) {
      voteCounts.set(votedFor, (voteCounts.get(votedFor) || 0) + 1);
    }
    
    // Award points (1 point per vote received)
    for (const [playerId, votes] of voteCounts) {
      const currentScore = this.scores.get(playerId) || 0;
      this.scores.set(playerId, currentScore + votes);
    }
    
    // Prepare results
    const results = Array.from(this.submissions.entries()).map(([id, text]) => ({
      id,
      text,
      playerName: this.players.get(id)?.name,
      votes: voteCounts.get(id) || 0
    }));
    
    this.broadcast('results', { 
      results,
      isLastRound: this.currentRound >= this.maxRounds
    });
  }

  nextRound() {
    this.currentRound++;
    if (this.currentRound > this.maxRounds) {
      this.showFinalResults();
    } else {
      this.startRound();
    }
  }

  showFinalResults() {
    this.phase = 'final';
    
    const finalScores = Array.from(this.players.entries()).map(([id, player]) => ({
      id,
      name: player.name,
      score: this.scores.get(id) || 0
    })).sort((a, b) => b.score - a.score);
    
    this.broadcast('finalResults', { scores: finalScores });
  }

  broadcast(event, data) {
    for (const player of this.players.values()) {
      player.socket.emit(event, data);
    }
  }
}

// Generate unique lobby code
function generateLobbyCode() {
  let code;
  do {
    // Generate 4 random characters
    code = Math.random().toString(36).substring(2, 6).toUpperCase();
    // Ensure it's exactly 4 characters
    while (code.length < 4) {
      code += Math.random().toString(36).substring(2, 3).toUpperCase();
    }
    code = code.substring(0, 4);
  } while (games.has(code));
  
  console.log('Generated new lobby code:', code);
  return code;
}

// Middleware
app.use(cors());
app.use(express.json());

// Basic route for health check
app.get('/', (req, res) => {
  res.json({ 
    message: 'Waterdeep Conspiracy Game Server', 
    activeGames: games.size,
    status: 'running'
  });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Host creates game
  socket.on('createGame', () => {
    const code = generateLobbyCode();
    const game = new Game(code);
    games.set(code, game);
    
    socket.join(code);
    socket.emit('gameCreated', { code });
    console.log(`Game created with code: ${code}`);
  });

  // Player joins game
  socket.on('joinGame', ({ code, name }) => {
    const upperCode = code.toUpperCase();
    const game = games.get(upperCode);
    
    console.log(`Join attempt - Code: ${upperCode}, Name: ${name}, Game exists: ${!!game}`);
    console.log(`Active games: ${Array.from(games.keys())}`);
    
    if (!game) {
      console.log(`Game not found for code: ${upperCode}`);
      socket.emit('error', 'Game not found');
      return;
    }
    
    if (name.length > 20) {
      socket.emit('error', 'Name too long (max 20 characters)');
      return;
    }
    
    // Check if name already exists in game
    const existingPlayer = Array.from(game.players.values()).find(p => p.name === name);
    if (existingPlayer) {
      socket.emit('error', 'Name already taken in this game');
      return;
    }
    
    socket.join(upperCode);
    game.addPlayer(socket, name);
    
    socket.emit('joinedGame', { code: upperCode });
    game.broadcast('playersUpdate', { players: game.getPlayerList() });
    console.log(`${name} joined game ${upperCode} successfully`);
  });

  // Start game
  socket.on('startGame', ({ code }) => {
    const game = games.get(code);
    if (game && game.players.size >= 1) {
      game.startRound();
      console.log(`Game ${code} started with ${game.players.size} players`);
    } else {
      socket.emit('error', 'Need at least 1 player to start');
    }
  });

  // Submit conspiracy theory
  socket.on('submitTheory', ({ code, theory }) => {
    const game = games.get(code);
    if (game && theory.trim().length > 0) {
      const success = game.submitTheory(socket.id, theory.trim());
      if (success) {
        socket.emit('theorySubmitted');
      }
    }
  });

  // Vote for theory
  socket.on('vote', ({ code, votedForId }) => {
    const game = games.get(code);
    if (game) {
      const success = game.vote(socket.id, votedForId);
      if (success) {
        socket.emit('voteRegistered');
      }
    }
  });

  // Next round
  socket.on('nextRound', ({ code }) => {
    const game = games.get(code);
    if (game) {
      game.nextRound();
    }
  });

  // Skip timer (host only)
  socket.on('skipTimer', ({ code }) => {
    const game = games.get(code);
    if (game) {
      game.endPhase();
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    for (const [code, game] of games) {
      if (game.players.has(socket.id)) {
        game.removePlayer(socket.id);
        game.broadcast('playersUpdate', { players: game.getPlayerList() });
        
        // Clean up empty games
        if (game.players.size === 0) {
          clearInterval(game.timer);
          games.delete(code);
          console.log(`Game ${code} cleaned up - no players remaining`);
        }
        break;
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Conspiracy Game Server running on port ${PORT}`);
});