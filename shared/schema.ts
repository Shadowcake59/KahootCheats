import { pgTable, text, serial, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table - for storing user data
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

// Game session table - for storing active game sessions
export const gameSessions = pgTable("game_sessions", {
  id: serial("id").primaryKey(),
  gamePin: text("game_pin").notNull(),
  gameId: text("game_id"),
  active: boolean("active").default(true),
  questionCount: integer("question_count").default(0),
  currentQuestion: integer("current_question").default(0),
  createdAt: text("created_at").notNull()
});

export const insertGameSessionSchema = createInsertSchema(gameSessions).pick({
  gamePin: true,
  gameId: true,
  active: true,
  questionCount: true,
  currentQuestion: true,
  createdAt: true,
});

// Questions table - for storing questions from Kahoot games
export const questions = pgTable("questions", {
  id: serial("id").primaryKey(),
  gameSessionId: integer("game_session_id").notNull(),
  questionIndex: integer("question_index").notNull(),
  questionText: text("question_text"),
  questionType: text("question_type"),
  answers: jsonb("answers"),
  correctAnswer: jsonb("correct_answer"),
  timeLimit: integer("time_limit"),
  points: integer("points").default(0),
});

export const insertQuestionSchema = createInsertSchema(questions).pick({
  gameSessionId: true,
  questionIndex: true,
  questionText: true,
  questionType: true,
  answers: true,
  correctAnswer: true,
  timeLimit: true,
  points: true,
});

// Types for WebSocket messages
export const gameStateSchema = z.object({
  gamePin: z.string(),
  connected: z.boolean(),
  currentQuestion: z.object({
    text: z.string().optional(),
    type: z.string().optional(),
    answers: z.array(z.object({
      text: z.string(),
      color: z.string(),
      isCorrect: z.boolean().optional(),
      shape: z.string().optional()
    })).optional(),
    timeLeft: z.number().optional(),
  }).optional(),
  previousQuestion: z.object({
    text: z.string().optional(),
    correctAnswer: z.string().optional(),
  }).optional(),
  gameProgress: z.object({
    current: z.number(),
    total: z.number(),
    points: z.number().optional(),
  }).optional(),
});

// Types for client to server messages
export const clientMessageSchema = z.object({
  type: z.enum(['join', 'disconnect', 'selectAnswer', 'toggleAutoAnswer', 'toggleAnswerDelay']),
  gamePin: z.string().optional(),
  answer: z.object({
    index: z.number().optional(),
    color: z.string().optional()
  }).optional(),
  autoAnswer: z.boolean().optional(),
  answerDelay: z.boolean().optional(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertGameSession = z.infer<typeof insertGameSessionSchema>;
export type GameSession = typeof gameSessions.$inferSelect;

export type InsertQuestion = z.infer<typeof insertQuestionSchema>;
export type Question = typeof questions.$inferSelect;

export type GameState = z.infer<typeof gameStateSchema>;
export type ClientMessage = z.infer<typeof clientMessageSchema>;
