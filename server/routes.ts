import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { z } from "zod";
import { clientMessageSchema, gameStateSchema } from "@shared/schema";
import { log } from "./vite";

// Map to track connected clients and their game sessions
const clients = new Map<WebSocket, { gamePin: string | null }>();

// Game logic service
class KahootService {
  private static instance: KahootService;
  
  // Cache for Kahoot game data
  private gameData: Map<string, {
    gameId: string;
    questions: Array<{
      question: string;
      type: string;
      answers: Array<{
        text: string;
        isCorrect: boolean;
        color: string;
        shape: string;
      }>;
      timeLimit: number;
      points: number;
    }>;
    currentQuestion: number;
  }> = new Map();

  static getInstance(): KahootService {
    if (!KahootService.instance) {
      KahootService.instance = new KahootService();
    }
    return KahootService.instance;
  }

  // Join a Kahoot game by PIN
  async joinGame(gamePin: string): Promise<boolean> {
    try {
      log(`Attempting to join Kahoot game with PIN: ${gamePin}`, "kahoot");
      
      // Simulated game data for the demo
      // In a real implementation, this would make API calls to Kahoot's APIs
      const mockGameData = {
        gameId: `kahoot-${gamePin}`,
        questions: [
          {
            question: "What is the capital of France?",
            type: "Multiple Choice",
            answers: [
              { text: "Berlin", isCorrect: false, color: "red", shape: "triangle" },
              { text: "Paris", isCorrect: true, color: "blue", shape: "square" },
              { text: "London", isCorrect: false, color: "yellow", shape: "circle" },
              { text: "Madrid", isCorrect: false, color: "green", shape: "diamond" }
            ],
            timeLimit: 20,
            points: 1000
          },
          {
            question: "Which planet is closest to the sun?",
            type: "Multiple Choice",
            answers: [
              { text: "Venus", isCorrect: false, color: "red", shape: "triangle" },
              { text: "Earth", isCorrect: false, color: "blue", shape: "square" },
              { text: "Mercury", isCorrect: true, color: "yellow", shape: "circle" },
              { text: "Mars", isCorrect: false, color: "green", shape: "diamond" }
            ],
            timeLimit: 20,
            points: 1000
          },
          {
            question: "Who painted the Mona Lisa?",
            type: "Multiple Choice",
            answers: [
              { text: "Vincent van Gogh", isCorrect: false, color: "red", shape: "triangle" },
              { text: "Pablo Picasso", isCorrect: false, color: "blue", shape: "square" },
              { text: "Leonardo da Vinci", isCorrect: true, color: "yellow", shape: "circle" },
              { text: "Michelangelo", isCorrect: false, color: "green", shape: "diamond" }
            ],
            timeLimit: 20,
            points: 1000
          }
        ],
        currentQuestion: 0
      };

      this.gameData.set(gamePin, mockGameData);
      
      // Create game session in storage
      await storage.createGameSession({
        gamePin,
        gameId: mockGameData.gameId,
        active: true,
        questionCount: mockGameData.questions.length,
        currentQuestion: 0,
        createdAt: new Date().toISOString()
      });

      // Add questions to storage
      for (let i = 0; i < mockGameData.questions.length; i++) {
        const q = mockGameData.questions[i];
        const session = await storage.getGameSessionByPin(gamePin);
        if (session) {
          await storage.createQuestion({
            gameSessionId: session.id,
            questionIndex: i,
            questionText: q.question,
            questionType: q.type,
            answers: q.answers,
            correctAnswer: q.answers.find(a => a.isCorrect),
            timeLimit: q.timeLimit,
            points: q.points
          });
        }
      }

      return true;
    } catch (error) {
      log(`Error joining game: ${(error as Error).message}`, "kahoot");
      return false;
    }
  }

  // Get current game state for a PIN
  async getGameState(gamePin: string): Promise<any> {
    try {
      const session = await storage.getGameSessionByPin(gamePin);
      if (!session) {
        return null;
      }

      const gameData = this.gameData.get(gamePin);
      if (!gameData) {
        return null;
      }

      const currentQuestionIndex = session.currentQuestion;
      const currentQuestion = await storage.getQuestionByIndex(session.id, currentQuestionIndex);
      const previousQuestion = currentQuestionIndex > 0 
        ? await storage.getQuestionByIndex(session.id, currentQuestionIndex - 1)
        : null;

      return {
        gamePin,
        connected: true,
        currentQuestion: currentQuestion ? {
          text: currentQuestion.questionText,
          type: currentQuestion.questionType,
          answers: (currentQuestion.answers as any[]).map(ans => ({
            text: ans.text,
            color: ans.color,
            isCorrect: ans.isCorrect,
            shape: ans.shape
          })),
          timeLeft: currentQuestion.timeLimit
        } : undefined,
        previousQuestion: previousQuestion ? {
          text: previousQuestion.questionText,
          correctAnswer: (previousQuestion.correctAnswer as any).text
        } : undefined,
        gameProgress: {
          current: currentQuestionIndex + 1,
          total: session.questionCount,
          points: 0 // Would be calculated based on correct answers in a real implementation
        }
      };
    } catch (error) {
      log(`Error getting game state: ${(error as Error).message}`, "kahoot");
      return null;
    }
  }

  // Advance to the next question for a game
  async advanceQuestion(gamePin: string): Promise<boolean> {
    try {
      const session = await storage.getGameSessionByPin(gamePin);
      if (!session || session.currentQuestion >= session.questionCount - 1) {
        return false;
      }

      await storage.updateGameSession(session.id, {
        currentQuestion: session.currentQuestion + 1
      });

      return true;
    } catch (error) {
      log(`Error advancing question: ${(error as Error).message}`, "kahoot");
      return false;
    }
  }

  // Select an answer for the current question
  async selectAnswer(gamePin: string, answerIndex: number): Promise<boolean> {
    try {
      const session = await storage.getGameSessionByPin(gamePin);
      if (!session) {
        return false;
      }

      const currentQuestion = await storage.getQuestionByIndex(
        session.id, 
        session.currentQuestion
      );

      if (!currentQuestion) {
        return false;
      }

      const answers = currentQuestion.answers as any[];
      const isCorrect = answers[answerIndex]?.isCorrect || false;

      // In a real implementation, we would send the answer to Kahoot's servers
      log(`Selected answer for game ${gamePin}: ${isCorrect ? 'CORRECT' : 'INCORRECT'}`, "kahoot");

      return isCorrect;
    } catch (error) {
      log(`Error selecting answer: ${(error as Error).message}`, "kahoot");
      return false;
    }
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  const kahootService = KahootService.getInstance();

  // WebSocket connection handler
  wss.on('connection', (ws: WebSocket) => {
    // Initialize client
    clients.set(ws, { gamePin: null });
    log("New client connected", "websocket");

    // Handle messages from clients
    ws.on('message', async (message: string) => {
      try {
        const data = JSON.parse(message);
        const validatedData = clientMessageSchema.parse(data);
        
        switch (validatedData.type) {
          case 'join':
            if (validatedData.gamePin) {
              const success = await kahootService.joinGame(validatedData.gamePin);
              if (success) {
                // Update client's game pin
                clients.set(ws, { gamePin: validatedData.gamePin });
                
                // Send game state
                const gameState = await kahootService.getGameState(validatedData.gamePin);
                ws.send(JSON.stringify({ type: 'gameState', data: gameState }));
                
                log(`Client joined game with PIN: ${validatedData.gamePin}`, "websocket");
              } else {
                ws.send(JSON.stringify({ 
                  type: 'error', 
                  message: 'Could not join game. Invalid PIN or game not found.' 
                }));
              }
            }
            break;
            
          case 'disconnect':
            // Clear the game pin
            const oldPin = clients.get(ws)?.gamePin;
            clients.set(ws, { gamePin: null });
            log(`Client disconnected from game PIN: ${oldPin}`, "websocket");
            ws.send(JSON.stringify({ 
              type: 'gameState', 
              data: { connected: false } 
            }));
            break;
            
          case 'selectAnswer':
            const gamePin = clients.get(ws)?.gamePin;
            if (gamePin && validatedData.answer?.index !== undefined) {
              const result = await kahootService.selectAnswer(
                gamePin, 
                validatedData.answer.index
              );
              ws.send(JSON.stringify({ 
                type: 'answerResult', 
                data: { correct: result } 
              }));
              
              // In a real implementation, after some time we would advance to the next question
              // Simulating this behavior here
              setTimeout(async () => {
                await kahootService.advanceQuestion(gamePin);
                const gameState = await kahootService.getGameState(gamePin);
                ws.send(JSON.stringify({ type: 'gameState', data: gameState }));
              }, 3000);
            }
            break;
            
          case 'toggleAutoAnswer':
            // These would be implemented in a real application to
            // control the automated answering behavior
            log(`Auto-answer toggled: ${validatedData.autoAnswer}`, "websocket");
            break;
            
          case 'toggleAnswerDelay':
            log(`Answer delay toggled: ${validatedData.answerDelay}`, "websocket");
            break;
        }
      } catch (error) {
        log(`Error processing message: ${(error as Error).message}`, "websocket");
        ws.send(JSON.stringify({ 
          type: 'error', 
          message: 'Invalid message format or action'
        }));
      }
    });

    // Handle disconnection
    ws.on('close', () => {
      clients.delete(ws);
      log("Client disconnected", "websocket");
    });
  });

  // API route to check server status
  app.get('/api/status', (req, res) => {
    res.json({ status: 'ok', clients: clients.size });
  });

  return httpServer;
}
