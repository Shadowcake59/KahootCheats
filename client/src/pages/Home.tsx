import { useState } from "react";
import GameConnection from "@/components/GameConnection";
import GameInterface from "@/components/GameInterface";
import { useToast } from "@/hooks/use-toast";
import { useKahootGame } from "@/hooks/useKahootGame";
import { GameState } from "@shared/schema";

export default function Home() {
  const { toast } = useToast();
  const [logMessages, setLogMessages] = useState<string[]>([
    "System initialized",
    "Waiting for game PIN"
  ]);

  const {
    connected,
    gamePin,
    gameState,
    connect,
    disconnect,
    selectAnswer,
    toggleAutoAnswer,
    toggleAnswerDelay,
  } = useKahootGame({
    onConnect: (pin) => {
      addLogMessage(`Connected to game #${pin}`);
      toast({
        title: "Connected",
        description: "Successfully connected to game!",
        variant: "default",
      });
    },
    onDisconnect: () => {
      addLogMessage("Disconnected from game");
      toast({
        title: "Disconnected",
        description: "Disconnected from game",
        variant: "destructive",
      });
    },
    onError: (error) => {
      addLogMessage(`Error: ${error}`);
      toast({
        title: "Error",
        description: error,
        variant: "destructive",
      });
    },
    onAnswerSelected: (color, correct) => {
      addLogMessage(`Selected ${color} answer: ${correct ? "Correct" : "Incorrect"}`);
      if (correct) {
        toast({
          title: "Correct Answer",
          description: "You selected the correct answer!",
          variant: "default",
        });
      }
    }
  });

  function addLogMessage(message: string) {
    const timestamp = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    setLogMessages((prev) => [`[${timestamp}] ${message}`, ...prev.slice(0, 19)]);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <h1 className="text-xl font-bold text-primary">Kahoot Companion</h1>
            <span className="ml-2 bg-accent text-white text-xs px-2 py-1 rounded-full">
              BETA
            </span>
          </div>
          <div>
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100">
              <span className={`w-2 h-2 mr-1 rounded-full ${connected ? "bg-success" : "bg-gray-400"}`}></span>
              {connected ? "Connected" : "Disconnected"}
            </span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <GameConnection 
          connected={connected}
          gamePin={gamePin}
          gameStatus={connected ? `Active: Kahoot Game #${gamePin}` : "Waiting for connection"}
          onConnect={connect}
          onDisconnect={disconnect}
        />

        <GameInterface
          connected={connected}
          gameState={gameState as GameState}
          onSelectAnswer={selectAnswer}
          onToggleAutoAnswer={toggleAutoAnswer}
          onToggleAnswerDelay={toggleAnswerDelay}
          logMessages={logMessages}
        />
      </main>

      <footer className="border-t mt-12 py-6">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <p className="text-sm text-gray-500">
                Kahoot Companion • For educational purposes only
              </p>
            </div>
            <div className="flex space-x-4">
              <button className="text-sm text-gray-500 hover:text-primary">
                <i className="ri-question-line mr-1"></i> Help
              </button>
              <button className="text-sm text-gray-500 hover:text-primary">
                <i className="ri-settings-3-line mr-1"></i> Settings
              </button>
            </div>
          </div>
          <div className="mt-4 text-xs text-gray-400 text-center">
            <p>
              This tool is created for educational and research purposes only.
              Use responsibly and ethically.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
