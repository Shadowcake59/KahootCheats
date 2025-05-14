import { useState, ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

interface GameConnectionProps {
  connected: boolean;
  gamePin: string | null;
  gameStatus: string;
  onConnect: (pin: string) => void;
  onDisconnect: () => void;
}

export default function GameConnection({
  connected,
  gamePin,
  gameStatus,
  onConnect,
  onDisconnect,
}: GameConnectionProps) {
  const [inputPin, setInputPin] = useState("");
  const [pinValidation, setPinValidation] = useState("Enter the PIN displayed on the host's screen");
  const [validationError, setValidationError] = useState(false);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.trim();
    setInputPin(value);

    // Validate input
    if (value.length > 0 && !/^\d+$/.test(value)) {
      setPinValidation("Game PIN must contain only numbers");
      setValidationError(true);
    } else if (value.length > 0 && value.length < 4) {
      setPinValidation("Game PIN is usually 6-8 digits");
      setValidationError(true);
    } else {
      setPinValidation("Enter the PIN displayed on the host's screen");
      setValidationError(false);
    }
  };

  const handleConnect = () => {
    if (inputPin.length < 4 || !/^\d+$/.test(inputPin)) {
      setPinValidation("Please enter a valid game PIN");
      setValidationError(true);
      return;
    }

    onConnect(inputPin);
  };

  return (
    <Card className="mb-6">
      <CardContent className="p-6">
        <h2 className="text-lg font-semibold mb-4">Join a Game</h2>

        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-grow">
            <label htmlFor="game-pin" className="block text-sm font-medium text-gray-700 mb-1">
              Game PIN
            </label>
            <Input
              id="game-pin"
              type="text"
              placeholder="Enter the 6-digit game PIN"
              value={inputPin}
              onChange={handleInputChange}
              disabled={connected}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition"
            />
            <p className={`mt-1 text-xs ${validationError ? "text-accent" : "text-gray-500"}`}>
              {pinValidation}
            </p>
          </div>
          <div className="flex items-end">
            {!connected ? (
              <Button 
                onClick={handleConnect}
                className="px-6 py-2 bg-primary text-white rounded-lg font-medium hover:bg-opacity-90 transition shadow-sm"
              >
                Join Game
              </Button>
            ) : (
              <Button
                onClick={onDisconnect}
                variant="outline"
                className="px-6 py-2 rounded-lg font-medium transition shadow-sm border-accent text-accent hover:bg-accent hover:text-white"
              >
                Disconnect
              </Button>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center">
            <span className="text-sm">Game Status:</span>
            <span className="ml-2 text-sm font-medium text-gray-600">
              {gameStatus}
            </span>
          </div>
          <button
            onClick={onDisconnect}
            className={`text-sm text-gray-500 hover:text-accent flex items-center ${!connected ? "opacity-50 pointer-events-none" : ""}`}
          >
            <i className="ri-logout-box-line mr-1"></i>
            Disconnect
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
