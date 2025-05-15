import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import AnswerCard from "./AnswerCard";
import ConnectionLog from "./ConnectionLog";
import { GameState } from "@shared/schema";

interface GameInterfaceProps {
  connected: boolean;
  gameState: GameState | null;
  onSelectAnswer: (index: number) => void;
  onToggleAutoAnswer: (enabled: boolean) => void;
  onToggleAnswerDelay: (enabled: boolean) => void;
  logMessages: string[];
}

export default function GameInterface({
  connected,
  gameState,
  onSelectAnswer,
  onToggleAutoAnswer,
  onToggleAnswerDelay,
  logMessages,
}: GameInterfaceProps) {
  const [loading, setLoading] = useState(false);
  const [autoAnswer, setAutoAnswer] = useState(false);
  const [answerDelay, setAnswerDelay] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  // Handle timer countdown
  useEffect(() => {
    if (!connected || !gameState?.currentQuestion?.timeLeft) {
      setTimeLeft(0);
      return;
    }

    setTimeLeft(gameState.currentQuestion.timeLeft);

    const interval = setInterval(() => {
      setTimeLeft((current) => {
        if (current <= 0) {
          clearInterval(interval);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [connected, gameState?.currentQuestion]);

  // Handle auto-answer
  useEffect(() => {
    if (!autoAnswer || !connected || !gameState?.currentQuestion?.answers)
      return;

    const correctAnswerIndex = gameState.currentQuestion.answers.findIndex(
      (a) => a.isCorrect,
    );
    if (correctAnswerIndex === -1) return;

    const delay = answerDelay ? Math.random() * 3000 + 1000 : 500;

    const timeout = setTimeout(() => {
      onSelectAnswer(correctAnswerIndex);
    }, delay);

    return () => clearTimeout(timeout);
  }, [gameState?.currentQuestion, autoAnswer, answerDelay, connected]);

  const handleAutoAnswerToggle = (checked: boolean) => {
    setAutoAnswer(checked);
    onToggleAutoAnswer(checked);
  };

  const handleAnswerDelayToggle = (checked: boolean) => {
    setAnswerDelay(checked);
    onToggleAnswerDelay(checked);
  };

  // Format time for display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Calculate progress percentage
  const progressPercentage = gameState?.gameProgress
    ? (gameState.gameProgress.current / gameState.gameProgress.total) * 100
    : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Game Info Panel */}
      <div className="lg:col-span-1">
        <Card className="h-full">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Game Info</h2>
              <span className="px-3 py-1 bg-warning text-white rounded-full text-sm font-medium">
                {formatTime(timeLeft)}
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500">
                  Current Question
                </h3>
                <p className="text-base font-medium">
                  {gameState?.currentQuestion?.text ||
                    "Not connected to a game"}
                </p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500">
                  Question Type
                </h3>
                <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                  {gameState?.currentQuestion?.type || "Unknown"}
                </div>
              </div>

              <div className="pt-2">
                <h3 className="text-sm font-medium text-gray-500 mb-2">
                  Game Progress
                </h3>
                <Progress value={progressPercentage} className="w-full h-2.5" />
                <div className="flex justify-between mt-1 text-xs text-gray-500">
                  <span>
                    {gameState?.gameProgress
                      ? `${gameState.gameProgress.current}/${gameState.gameProgress.total} Questions`
                      : "0/0 Questions"}
                  </span>
                  <span>
                    {gameState?.gameProgress?.points !== undefined
                      ? `${gameState.gameProgress.points} pts`
                      : "0 pts"}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-gray-100">
                <h3 className="text-sm font-medium text-gray-500 mb-2">
                  Advanced Settings
                </h3>
                <div className="flex items-center mb-2">
                  <Checkbox
                    id="auto-answer"
                    checked={autoAnswer}
                    onCheckedChange={handleAutoAnswerToggle}
                    disabled={!connected}
                  />
                  <label
                    htmlFor="auto-answer"
                    className="ml-2 text-sm text-gray-700"
                  >
                    Auto-answer questions
                  </label>
                </div>
                <div className="flex items-center">
                  <Checkbox
                    id="answer-delay"
                    checked={answerDelay}
                    onCheckedChange={handleAnswerDelayToggle}
                    disabled={!connected || !autoAnswer}
                  />
                  <label
                    htmlFor="answer-delay"
                    className="ml-2 text-sm text-gray-700"
                  >
                    Add random delay (less suspicious)
                  </label>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Answers Panel */}
      <div className="lg:col-span-2">
        <Card>
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold mb-4">Answers</h2>

            {/* No Game Connected State */}
            {!connected && (
              <div className="py-8 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                  <i className="ri-game-line text-2xl text-gray-400"></i>
                </div>
                <h3 className="text-lg font-medium text-gray-700 mb-2">
                  No Active Game
                </h3>
                <p className="text-gray-500 max-w-md mx-auto">
                  Enter a game PIN and join a Kahoot game to see questions and
                  answers here.
                </p>
              </div>
            )}

            {/* Loading State */}
            {connected && loading && (
              <div className="py-8 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full border-2 border-t-primary border-r-primary border-b-gray-200 border-l-gray-200 animate-spin mb-4"></div>
                <h3 className="text-md font-medium text-gray-700">
                  Analyzing Question...
                </h3>
                <p className="text-gray-500 text-sm mt-1">
                  Finding the correct answer
                </p>
              </div>
            )}

            {/* Game Connected State */}
            {connected && !loading && gameState?.currentQuestion?.answers && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {gameState.currentQuestion.answers.map((answer, index) => (
                  <AnswerCard
                    key={index}
                    text={answer.text}
                    color={answer.color}
                    shape={answer.shape || ""}
                    isCorrect={answer.isCorrect || false}
                    onClick={() => onSelectAnswer(index)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Additional Game Info */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4">
              <h3 className="text-sm font-medium text-gray-500 mb-2">
                Previous Question
              </h3>
              <p className="text-sm">
                {gameState?.previousQuestion?.text || "No previous questions"}
              </p>
              <div className="mt-2 flex items-center">
                <span className="text-xs text-gray-500 mr-2">
                  Correct answer:
                </span>
                <span className="text-xs font-medium text-success">
                  {gameState?.previousQuestion?.correctAnswer || "N/A"}
                </span>
              </div>
            </CardContent>
          </Card>

          <ConnectionLog messages={logMessages} />
        </div>
      </div>
    </div>
  );
}
