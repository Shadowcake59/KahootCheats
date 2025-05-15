import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { z } from "zod";
import { clientMessageSchema, gameStateSchema } from "@shared/schema";
import { log } from "./vite";
import Kahoot from "kahoot.js";

// Map to track connected clients and their game sessions
const clients = new Map<
  WebSocket,
  {
    gamePin: string | null;
    kahootClient: Kahoot | null;
    username: string | null;
  }
>();

// Map to track active kahoot games
const activeGames = new Map<
  string,
  {
    client: Kahoot;
    players: Set<WebSocket>;
    currentQuiz: any;
    currentQuestion: any;
    questionAnswers: any[];
    correctAnswers: any[];
    currentQuestionIndex: number;
    totalQuestions: number;
    points: number;
  }
>();

// Color and shape mapping for Kahoot answers
const colors = ["red", "blue", "yellow", "green"];
const shapes = ["triangle", "square", "circle", "diamond"];

// Game logic service
class KahootService {
  private static instance: KahootService;

  static getInstance(): KahootService {
    if (!KahootService.instance) {
      KahootService.instance = new KahootService();
    }
    return KahootService.instance;
  }

  // Join a Kahoot game by PIN
  async joinGame(gamePin: string, ws: WebSocket): Promise<boolean> {
    try {
      log(`Attempting to join Kahoot game with PIN: ${gamePin}`, "kahoot");

      // Random name for the Kahoot client
      const randomName = `Player_${Math.floor(Math.random() * 10000)}`;

      // Create a new Kahoot client
      const client = new Kahoot();

      // Initialize client events before joining
      this.setupKahootClientEvents(client, gamePin, ws);

      // Connect to the Kahoot game
      log(`Joining game with PIN ${gamePin} as ${randomName}`, "kahoot");
      await client.join(gamePin, randomName);

      // Store the client in the map
      clients.set(ws, {
        gamePin: gamePin,
        kahootClient: client,
        username: randomName,
      });

      // Create game session in storage
      const gameSession = await storage.createGameSession({
        gamePin,
        gameId: `kahoot-${gamePin}`,
        active: true,
        questionCount: 0, // Will update when we get quiz info
        currentQuestion: 0,
        createdAt: new Date().toISOString(),
      });

      // Initialize the active game
      if (!activeGames.has(gamePin)) {
        activeGames.set(gamePin, {
          client,
          players: new Set([ws]),
          currentQuiz: null,
          currentQuestion: null,
          questionAnswers: [],
          correctAnswers: [],
          currentQuestionIndex: 0,
          totalQuestions: 0,
          points: 0,
        });
      } else {
        // Add this player to existing game
        const gameData = activeGames.get(gamePin)!;
        gameData.players.add(ws);
      }

      return true;
    } catch (error) {
      log(`Error joining game: ${(error as Error).message}`, "kahoot");
      return false;
    }
  }

  // Setup all event listeners for the Kahoot client
  private setupKahootClientEvents(
    client: Kahoot,
    gamePin: string,
    ws: WebSocket,
  ) {
    // When the quiz starts
    client.on("quizStart", (quiz: any) => {
      log(`Quiz started: ${quiz.name}`, "kahoot");

      const game = activeGames.get(gamePin);
      if (game) {
        game.currentQuiz = quiz;
        game.totalQuestions = quiz.questionCount;

        this.updateGameSession(gamePin, {
          questionCount: quiz.questionCount,
        });

        // Send the quiz start information to the client
        ws.send(
          JSON.stringify({
            type: "gameState",
            data: {
              gamePin,
              connected: true,
              gameProgress: {
                current: 0,
                total: quiz.questionCount,
                points: 0,
              },
            },
          }),
        );
      }
    });

    // When a question starts
    client.on("questionStart", async (question: any) => {
      log(
        `Question started: ${question.index + 1}/${question.quiz.questionCount}`,
        "kahoot",
      );

      const game = activeGames.get(gamePin);
      if (game) {
        game.currentQuestion = question;
        game.currentQuestionIndex = question.index;
        game.questionAnswers = [];

        // Map the answers to our format with colors and shapes
        const answers = question.choices.map((choice: any, index: number) => ({
          text: choice.answer,
          color: colors[index],
          shape: shapes[index],
          // Don't expose which is correct yet
          isCorrect: false,
        }));

        // Save question to the database
        const session = await storage.getGameSessionByPin(gamePin);
        if (session) {
          await storage.createQuestion({
            gameSessionId: session.id,
            questionIndex: question.index,
            questionText: question.question || "Unknown question",
            questionType: question.type || "Multiple Choice",
            answers: answers,
            correctAnswer: null, // We don't know this yet
            timeLimit: question.timeLimit / 1000, // Convert ms to seconds
            points: question.points,
          });

          await this.updateGameSession(gamePin, {
            currentQuestion: question.index,
          });
        }

        // Send the question information to the client
        ws.send(
          JSON.stringify({
            type: "gameState",
            data: {
              gamePin,
              connected: true,
              currentQuestion: {
                text: question.question || "Unknown question",
                type: question.type || "Multiple Choice",
                answers: answers,
                timeLeft: question.timeLimit / 1000, // Convert ms to seconds
              },
              gameProgress: {
                current: question.index + 1,
                total: game.totalQuestions,
                points: game.points,
              },
            },
          }),
        );
      }
    });

    // When question results are in
    client.on("questionEnd", async (questionResult: any) => {
      log(`Question ended: ${questionResult.questionIndex + 1}`, "kahoot");

      const game = activeGames.get(gamePin);
      if (game) {
        // Get the correct answers from the question
        const correctIndices: number[] = [];
        for (let i = 0; i < questionResult.correctChoices.length; i++) {
          if (questionResult.correctChoices[i]) {
            correctIndices.push(i);
          }
        }

        game.correctAnswers = correctIndices;

        // Update the question in the database with correct answers
        const session = await storage.getGameSessionByPin(gamePin);
        if (session) {
          const question = await storage.getQuestionByIndex(
            session.id,
            questionResult.questionIndex,
          );
          if (question) {
            const answers = question.answers as any[];
            const updatedAnswers = answers.map((ans, idx) => ({
              ...ans,
              isCorrect: correctIndices.includes(idx),
            }));

            await storage.updateQuestion(question.id, {
              answers: updatedAnswers,
              correctAnswer:
                correctIndices.length > 0
                  ? updatedAnswers[correctIndices[0]]
                  : null,
            });
          }
        }

        // Send the updated question information to the client
        const currentQuestion = await this.getCurrentQuestion(gamePin);
        if (currentQuestion) {
          ws.send(
            JSON.stringify({
              type: "questionResult",
              data: {
                correctIndices: correctIndices,
                questionIndex: questionResult.questionIndex,
              },
            }),
          );
        }
      }
    });

    // When the quiz ends
    client.on("quizEnd", (quiz: any) => {
      log(`Quiz ended`, "kahoot");

      // Update game session
      this.updateGameSession(gamePin, {
        active: false,
      });

      // Get the game data
      const gameData = activeGames.get(gamePin);

      // Notify the client
      ws.send(
        JSON.stringify({
          type: "gameState",
          data: {
            gamePin,
            connected: true,
            gameProgress: {
              current: quiz.questionCount,
              total: quiz.questionCount,
              points: gameData?.points || 0,
            },
            quizEnded: true,
          },
        }),
      );
    });

    // Handle errors
    client.on("error", (error: any) => {
      log(`Kahoot client error: ${error}`, "kahoot");

      // Notify the client
      ws.send(
        JSON.stringify({
          type: "error",
          message: `Error with Kahoot game: ${error}`,
        }),
      );
    });

    // Handle disconnections
    client.on("disconnect", (reason: any) => {
      log(`Disconnected from Kahoot game: ${reason}`, "kahoot");

      // Notify the client
      ws.send(
        JSON.stringify({
          type: "gameState",
          data: {
            connected: false,
          },
        }),
      );

      // Clean up
      this.cleanupGame(gamePin, ws);
    });
  }

  // Get current game state for a PIN
  async getGameState(gamePin: string): Promise<any> {
    try {
      const session = await storage.getGameSessionByPin(gamePin);
      if (!session) {
        return null;
      }

      const game = activeGames.get(gamePin);
      if (!game) {
        return null;
      }

      const currentQuestion = await this.getCurrentQuestion(gamePin);
      const previousQuestion =
        game.currentQuestionIndex > 0
          ? await storage.getQuestionByIndex(
              session.id,
              game.currentQuestionIndex - 1,
            )
          : null;

      return {
        gamePin,
        connected: true,
        currentQuestion: currentQuestion
          ? {
              text: currentQuestion.questionText,
              type: currentQuestion.questionType,
              answers: (currentQuestion.answers as any[]).map((ans) => ({
                text: ans.text,
                color: ans.color,
                isCorrect: ans.isCorrect,
                shape: ans.shape,
              })),
              timeLeft: currentQuestion.timeLimit,
            }
          : undefined,
        previousQuestion: previousQuestion
          ? {
              text: previousQuestion.questionText,
              correctAnswer: (previousQuestion.correctAnswer as any)?.text,
            }
          : undefined,
        gameProgress: {
          current: game.currentQuestionIndex + 1,
          total: game.totalQuestions,
          points: game.points,
        },
      };
    } catch (error) {
      log(`Error getting game state: ${(error as Error).message}`, "kahoot");
      return null;
    }
  }

  // Get the current question from database
  private async getCurrentQuestion(gamePin: string) {
    const session = await storage.getGameSessionByPin(gamePin);
    if (!session) return null;

    const game = activeGames.get(gamePin);
    if (!game) return null;

    return storage.getQuestionByIndex(session.id, game.currentQuestionIndex);
  }

  // Update game session with new data
  private async updateGameSession(gamePin: string, updates: any) {
    const session = await storage.getGameSessionByPin(gamePin);
    if (session) {
      await storage.updateGameSession(session.id, updates);
    }
  }

  // Select an answer for the current question
  async selectAnswer(
    gamePin: string,
    answerIndex: number,
    ws: WebSocket,
  ): Promise<boolean> {
    try {
      const clientData = clients.get(ws);
      if (!clientData || !clientData.kahootClient) {
        return false;
      }

      const game = activeGames.get(gamePin);
      if (!game || !game.currentQuestion) {
        return false;
      }

      // Send the answer to Kahoot
      log(
        `Sending answer ${answerIndex} for question ${game.currentQuestionIndex + 1}`,
        "kahoot",
      );
      await clientData.kahootClient.answerQuestion(answerIndex);

      // For now, we'll return true since we don't know if it's correct yet
      // The correctness will be revealed in the questionEnd event
      return true;
    } catch (error) {
      log(`Error selecting answer: ${(error as Error).message}`, "kahoot");
      return false;
    }
  }

  // Cleanup when disconnecting from a game
  private cleanupGame(gamePin: string, ws: WebSocket) {
    const game = activeGames.get(gamePin);
    if (game) {
      game.players.delete(ws);

      // If no players left, remove the game
      if (game.players.size === 0) {
        activeGames.delete(gamePin);
      }
    }

    // Clean up client
    clients.set(ws, { gamePin: null, kahootClient: null, username: null });
  }

  // Disconnect from a game
  async disconnectFromGame(gamePin: string, ws: WebSocket): Promise<boolean> {
    try {
      const clientData = clients.get(ws);
      if (clientData && clientData.kahootClient) {
        clientData.kahootClient.leave();
      }

      this.cleanupGame(gamePin, ws);
      return true;
    } catch (error) {
      log(
        `Error disconnecting from game: ${(error as Error).message}`,
        "kahoot",
      );
      return false;
    }
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });
  const kahootService = KahootService.getInstance();

  // WebSocket connection handler
  wss.on("connection", (ws: WebSocket) => {
    // Initialize client
    clients.set(ws, { gamePin: null, kahootClient: null, username: null });
    log("New client connected", "websocket");

    // Handle messages from clients
    ws.on("message", async (message: string) => {
      try {
        const data = JSON.parse(message);
        const validatedData = clientMessageSchema.parse(data);

        switch (validatedData.type) {
          case "join":
            if (validatedData.gamePin) {
              const success = await kahootService.joinGame(
                validatedData.gamePin,
                ws,
              );
              if (success) {
                log(
                  `Client joined game with PIN: ${validatedData.gamePin}`,
                  "websocket",
                );
              } else {
                ws.send(
                  JSON.stringify({
                    type: "error",
                    message:
                      "Could not join game. Invalid PIN or game not found.",
                  }),
                );
              }
            }
            break;

          case "disconnect":
            const clientData = clients.get(ws);
            if (clientData && clientData.gamePin) {
              const oldPin = clientData.gamePin;
              await kahootService.disconnectFromGame(oldPin, ws);
              log(`Client disconnected from game PIN: ${oldPin}`, "websocket");
              ws.send(
                JSON.stringify({
                  type: "gameState",
                  data: { connected: false },
                }),
              );
            }
            break;

          case "selectAnswer":
            const clientInfo = clients.get(ws);
            if (
              clientInfo &&
              clientInfo.gamePin &&
              validatedData.answer?.index !== undefined
            ) {
              await kahootService.selectAnswer(
                clientInfo.gamePin,
                validatedData.answer.index,
                ws,
              );
            }
            break;

          case "toggleAutoAnswer":
            // Store the auto-answer preference
            log(
              `Auto-answer toggled: ${validatedData.autoAnswer}`,
              "websocket",
            );
            break;

          case "toggleAnswerDelay":
            log(
              `Answer delay toggled: ${validatedData.answerDelay}`,
              "websocket",
            );
            break;
        }
      } catch (error) {
        log(
          `Error processing message: ${(error as Error).message}`,
          "websocket",
        );
        ws.send(
          JSON.stringify({
            type: "error",
            message: "Invalid message format or action",
          }),
        );
      }
    });

    // Handle disconnection
    ws.on("close", () => {
      const clientData = clients.get(ws);
      if (clientData && clientData.gamePin) {
        kahootService.disconnectFromGame(clientData.gamePin, ws);
      }
      clients.delete(ws);
      log("Client disconnected", "websocket");
    });
  });

  // API route to check server status
  app.get("/api/status", (req, res) => {
    res.json({ status: "ok", clients: clients.size });
  });

  return httpServer;
}
