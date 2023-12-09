import { AppDataSource } from "./data-source";
import { startGRPCServer } from "./grpcServer";
import * as cors from 'cors'
interface UserInfo {
  id: string | null;
  name: string | null;
}

interface Player {
  socketId: string;
  userInfo: UserInfo;
  score?: number;
  answered?: boolean;
}

interface Room {
  players: Player[];
  timer: number;
  timerInterval?: NodeJS.Timeout;
  questionTimer?: number;
  questionTimerInterval?: NodeJS.Timeout;
  currentQuestionIndex?: number;
  currentQuestion?: any; // Type for question object
}

const questions = [
    {
    "id": 1,
    "answer": "Tenaga",
    "question": "Di rumah makan padang, selain pakai sendok kita makan pakai?",
    "created_at": "2023-11-13T00:00:00.000000Z",
    "updated_at": "2023-11-14T03:38:38.000000Z"
    },
    {
    "id": 2,
    "answer": "Celana",
    "question": "Selain mobil, bus atau pesawat, orang pergi dari Jakarta ke Surabaya biasanya menggunakan?",
    "created_at": "2023-11-13T00:00:00.000000Z",
    "updated_at": "2023-11-13T00:00:00.000000Z"
    },
    {
    "id": 3,
    "answer": "Tolong",
    "question": "Biasa digunakan untuk menyalakan atau mematikan TV dan AC?",
    "created_at": "2023-11-13T00:00:00.000000Z",
    "updated_at": "2023-11-13T00:00:00.000000Z"
    },
    {
    "id": 4,
    "answer": "Noleh",
    "question": "Seseorang yang memimpin sebuah desa, biasanya dipanggil pak?",
    "created_at": "2023-11-13T00:00:00.000000Z",
    "updated_at": "2023-11-13T00:00:00.000000Z"
    },
    {
    "id": 5,
    "answer": "Telan",
    "question": "Senikmat-nikmatnya makan diluar lebih nikmat makan di?",
    "created_at": "2023-11-13T00:00:00.000000Z",
    "updated_at": "2023-11-13T00:00:00.000000Z"
    }
]

const express = require("express");
const http = require("http");
const socketIO = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"],
  },
});

const MAX_PLAYERS_PER_ROOM = 5;
const MAX_ROUNDS = 5;
const rooms: Record<string, Room & { currentRound: number, gameInProgress: boolean }> = {};

const startTimer = (room: string, duration: number, callback: () => void) => {
  const currentRoom = rooms[room];

  if (!currentRoom) {
    console.error(`Room ${room} not found.`);
    return;
  }

  if (currentRoom.timerInterval) {
    clearInterval(currentRoom.timerInterval);
  }

  currentRoom.timer = duration;

    currentRoom.timerInterval = setInterval(() => {
      currentRoom.timer = Math.max(0, currentRoom.timer - 1);
      io.to(room).emit("timerUpdate", { timer: currentRoom.timer });

      if (currentRoom.timer === 0) {
        clearInterval(currentRoom.timerInterval);
        currentRoom.timerInterval = undefined;
        callback();

        currentRoom.gameInProgress = false;
        io.to(room).emit("gameEnded");
      }
    }, 1000);
};

const resetGame = (room: string) => {
  try {
    if (!rooms[room]) {
      rooms[room] = { players: [], timer: 30, currentRound: 1, gameInProgress: true };
    }

    if (rooms[room].currentRound <= MAX_ROUNDS && rooms[room].gameInProgress) {
      startQuestionRound(room);
    } else {
      rooms[room].gameInProgress = false;
      showFinalScores(room);
    }
  } catch (error) {
    console.error('Error in resetGame:', error);
  }
};

const startQuestionRound = (room: string) => {
  const currentRoom = rooms[room];

  currentRoom.currentQuestionIndex = (currentRoom.currentQuestionIndex || 0) + 1;

  if (currentRoom.currentQuestionIndex < questions.length) {
    const randomQuestion = questions[currentRoom.currentQuestionIndex];

    currentRoom.currentQuestion = randomQuestion;
    currentRoom.questionTimer = 30;

    io.to(room).emit("newQuestion", { question: randomQuestion.question });

    startTimer(room, 30, () => {
      clearInterval(currentRoom.questionTimerInterval);
      currentRoom.questionTimerInterval = undefined;

      if (currentRoom.currentRound <= MAX_ROUNDS) {
        rooms[room].gameInProgress = true;
        rooms[room].currentRound += 1;
        startQuestionRound(room);
      } else {
        showFinalScores(room);
      }
    });

    currentRoom.questionTimerInterval = setInterval(() => {
      currentRoom.questionTimer = Math.max(0, currentRoom.questionTimer - 1);
      io.to(room).emit("questionTimer", { timer: currentRoom.questionTimer });

      if (currentRoom.questionTimer === 0) {
        clearInterval(currentRoom.questionTimerInterval);
        currentRoom.questionTimerInterval = undefined;
        io.to(room).emit("questionTimerZero");

        if (currentRoom.currentQuestionIndex === questions.length - 1) {
          showFinalScores(room);
        } else {
          startQuestionRound(room);
        }
      }
    }, 1000);
  } else {
    showFinalScores(room);
  }
};

const showFinalScores = (room: string) => {
  const finalScores = rooms[room].players.map((player) => ({
    socketId: player.socketId,
    userInfo: player.userInfo,
    score: player.score || 0,
  }));

  io.to(room).emit("displayFinalScores", { players: finalScores });

  setTimeout(() => {
    resetGame(room);
  }, 10000);
};
const startWaitingState = (room: string) => {
  const currentRoom = rooms[room];
  const answeredPlayers = currentRoom.players.filter((player) => player.answered);

  if (answeredPlayers.length === currentRoom.players.length || currentRoom.questionTimer === 0) {
    io.to(room).emit("displayScores", { players: currentRoom.players });
    io.to(room).emit("scoresDisplayed");
    currentRoom.players.forEach((player) => {
      const isCorrect = player.answered && player.score > 0;
      const response = isCorrect ? 'benar' : 'salah';
      io.to(player.socketId).emit("answerResponse", { response });
    });

    setTimeout(() => {
      startQuestionRound(room);
    }, 5000);
  }
};
io.on("connection", (socket) => {
  console.log("a user connected");

  socket.on("setUserInfo", ({ id, name }) => {
    socket.userInfo = { id, name };
    socket.answered = false;
  });

  socket.on("answer", ({ room, answer, userId }) => {
    const currentRoom = rooms[room];
    const isCorrect = answer.toLowerCase() === currentRoom.currentQuestion.answer.toLowerCase();

    if (isCorrect) {
      const answeringPlayer = currentRoom.players.find((player) => player.userInfo.id === userId);
      if (answeringPlayer) {
        answeringPlayer.score = (answeringPlayer.score || 0) + 1;
      }
    }

    socket.answered = true;

    io.to(room).emit("updateScores", { players: currentRoom.players });

    startWaitingState(room);
  });

  socket.on("questionTimerZero", () => {
    const currentRoom = rooms[socket.room];

    clearInterval(currentRoom.questionTimerInterval);
    currentRoom.questionTimerInterval = undefined;

    io.to(socket.room).emit("displayScores", { players: currentRoom.players });

    setTimeout(() => {
      startQuestionRound(socket.room);
    }, 5000);
  });

  socket.on("matchmaking", () => {
    let room;
    for (const roomId in rooms) {
      if (rooms[roomId].players.length < MAX_PLAYERS_PER_ROOM && rooms[roomId].gameInProgress) {
        room = roomId;
        break;
      }
    }

    if (!room) {
      room = "room-" + Date.now().toString();
      rooms[room] = { players: [], timer: 30, currentRound: 1, gameInProgress: true };
    }

    socket.join(room);
    socket.room = room;
    rooms[room].players.push({ socketId: socket.id, userInfo: socket.userInfo });

    console.log(`User ${socket.id} joined room ${room}`);
    io.to(room).emit("matchmakingSuccess", {
      room,
      players: rooms[room].players,
      timer: rooms[room].timer,
      gameInProgress: rooms[room].gameInProgress,
    });

    console.log("matchmaking success", { room, players: rooms[room].players, timer: rooms[room].timer, gameInProgress: rooms[room].gameInProgress });

    startTimer(room, rooms[room].timer, () => {
      resetGame(room);
    });

    socket.on("disconnect", () => {
      const currentRoom = rooms[socket.room];

      const index = currentRoom.players.findIndex((player) => player.socketId === socket.id) || null;
      if (index !== -1 && index !== null) {
        currentRoom.players.splice(index, 1);
        console.log(`User ${socket.id} left room ${socket.room}`);
        io.to(socket.room).emit("playerLeft", { room: socket.room, players: currentRoom.players });
        if (currentRoom.players.length === 0) {
          delete rooms[socket.room];
        }
      }

      console.log("user disconnected");
    });
  });
});

AppDataSource.initialize().then(async () => {
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  app.get("/", (req, res) => {
    res.send("Socket.IO server is running.");
  });

  startGRPCServer();

  server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}).catch(error => console.log(error))


