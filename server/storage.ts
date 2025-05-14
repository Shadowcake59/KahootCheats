import { 
  users, type User, type InsertUser,
  gameSessions, type GameSession, type InsertGameSession,
  questions, type Question, type InsertQuestion
} from "@shared/schema";

// modify the interface with any CRUD methods
// you might need
export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Game session methods
  createGameSession(session: InsertGameSession): Promise<GameSession>;
  getGameSession(id: number): Promise<GameSession | undefined>;
  getGameSessionByPin(gamePin: string): Promise<GameSession | undefined>;
  updateGameSession(id: number, session: Partial<GameSession>): Promise<GameSession | undefined>;
  
  // Question methods
  createQuestion(question: InsertQuestion): Promise<Question>;
  getQuestionsByGameSession(gameSessionId: number): Promise<Question[]>;
  getQuestionByIndex(gameSessionId: number, index: number): Promise<Question | undefined>;
  updateQuestion(id: number, question: Partial<Question>): Promise<Question | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private gameSessions: Map<number, GameSession>;
  private questions: Map<number, Question>;
  currentUserId: number;
  currentGameSessionId: number;
  currentQuestionId: number;

  constructor() {
    this.users = new Map();
    this.gameSessions = new Map();
    this.questions = new Map();
    this.currentUserId = 1;
    this.currentGameSessionId = 1;
    this.currentQuestionId = 1;
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Game session methods
  async createGameSession(insertSession: InsertGameSession): Promise<GameSession> {
    const id = this.currentGameSessionId++;
    const session: GameSession = { ...insertSession, id };
    this.gameSessions.set(id, session);
    return session;
  }

  async getGameSession(id: number): Promise<GameSession | undefined> {
    return this.gameSessions.get(id);
  }

  async getGameSessionByPin(gamePin: string): Promise<GameSession | undefined> {
    return Array.from(this.gameSessions.values()).find(
      (session) => session.gamePin === gamePin && session.active
    );
  }

  async updateGameSession(id: number, sessionUpdate: Partial<GameSession>): Promise<GameSession | undefined> {
    const session = this.gameSessions.get(id);
    if (!session) return undefined;
    
    const updatedSession = { ...session, ...sessionUpdate };
    this.gameSessions.set(id, updatedSession);
    return updatedSession;
  }

  // Question methods
  async createQuestion(insertQuestion: InsertQuestion): Promise<Question> {
    const id = this.currentQuestionId++;
    const question: Question = { ...insertQuestion, id };
    this.questions.set(id, question);
    return question;
  }

  async getQuestionsByGameSession(gameSessionId: number): Promise<Question[]> {
    return Array.from(this.questions.values()).filter(
      (question) => question.gameSessionId === gameSessionId
    );
  }

  async getQuestionByIndex(gameSessionId: number, index: number): Promise<Question | undefined> {
    return Array.from(this.questions.values()).find(
      (question) => question.gameSessionId === gameSessionId && question.questionIndex === index
    );
  }

  async updateQuestion(id: number, questionUpdate: Partial<Question>): Promise<Question | undefined> {
    const question = this.questions.get(id);
    if (!question) return undefined;
    
    const updatedQuestion = { ...question, ...questionUpdate };
    this.questions.set(id, updatedQuestion);
    return updatedQuestion;
  }
}

export const storage = new MemStorage();
