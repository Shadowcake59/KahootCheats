import { useState, useEffect, useCallback, useRef } from "react";
import { GameState, ClientMessage } from "@shared/schema";

interface KahootGameHookOptions {
  onConnect?: (pin: string) => void;
  onDisconnect?: () => void;
  onError?: (message: string) => void;
  onAnswerSelected?: (color: string, correct: boolean) => void;
}

export function useKahootGame(options: KahootGameHookOptions = {}) {
  const [connected, setConnected] = useState(false);
  const [gamePin, setGamePin] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [autoAnswer, setAutoAnswer] = useState(false);
  const [answerDelay, setAnswerDelay] = useState(false);
  const socket = useRef<WebSocket | null>(null);

  // Initialize WebSocket connection
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    socket.current = new WebSocket(wsUrl);
    
    socket.current.onopen = () => {
      console.log("WebSocket connection established");
    };
    
    socket.current.onclose = () => {
      console.log("WebSocket connection closed");
      setConnected(false);
      setGamePin(null);
      setGameState(null);
    };
    
    socket.current.onerror = (error) => {
      console.error("WebSocket error:", error);
      options.onError?.("WebSocket connection error");
    };
    
    return () => {
      if (socket.current && socket.current.readyState === WebSocket.OPEN) {
        socket.current.close();
      }
    };
  }, []);
  
  // Handle incoming messages
  useEffect(() => {
    if (!socket.current) return;
    
    socket.current.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        switch (message.type) {
          case 'gameState':
            setGameState(message.data);
            if (message.data.connected === false) {
              setConnected(false);
              setGamePin(null);
            }
            break;
            
          case 'answerResult':
            if (message.data.correct !== undefined) {
              const color = gameState?.currentQuestion?.answers?.[message.data.answerIndex]?.color || "unknown";
              options.onAnswerSelected?.(color, message.data.correct);
            }
            break;
            
          case 'error':
            options.onError?.(message.data.message || "Unknown error");
            break;
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };
  }, [gameState, options]);
  
  // Connect to a game
  const connect = useCallback((pin: string) => {
    if (!socket.current || socket.current.readyState !== WebSocket.OPEN) {
      options.onError?.("WebSocket not connected");
      return;
    }
    
    const message: ClientMessage = {
      type: 'join',
      gamePin: pin
    };
    
    socket.current.send(JSON.stringify(message));
    setGamePin(pin);
    setConnected(true);
    options.onConnect?.(pin);
  }, [options]);
  
  // Disconnect from a game
  const disconnect = useCallback(() => {
    if (!socket.current || socket.current.readyState !== WebSocket.OPEN || !connected) {
      return;
    }
    
    const message: ClientMessage = {
      type: 'disconnect'
    };
    
    socket.current.send(JSON.stringify(message));
    setConnected(false);
    setGamePin(null);
    setGameState(null);
    options.onDisconnect?.();
  }, [connected, options]);
  
  // Select an answer
  const selectAnswer = useCallback((answerIndex: number) => {
    if (!socket.current || socket.current.readyState !== WebSocket.OPEN || !connected) {
      return;
    }
    
    const message: ClientMessage = {
      type: 'selectAnswer',
      answer: { index: answerIndex }
    };
    
    socket.current.send(JSON.stringify(message));
  }, [connected]);
  
  // Toggle auto answer
  const toggleAutoAnswer = useCallback((enabled: boolean) => {
    if (!socket.current || socket.current.readyState !== WebSocket.OPEN) {
      return;
    }
    
    const message: ClientMessage = {
      type: 'toggleAutoAnswer',
      autoAnswer: enabled
    };
    
    socket.current.send(JSON.stringify(message));
    setAutoAnswer(enabled);
  }, []);
  
  // Toggle answer delay
  const toggleAnswerDelay = useCallback((enabled: boolean) => {
    if (!socket.current || socket.current.readyState !== WebSocket.OPEN) {
      return;
    }
    
    const message: ClientMessage = {
      type: 'toggleAnswerDelay',
      answerDelay: enabled
    };
    
    socket.current.send(JSON.stringify(message));
    setAnswerDelay(enabled);
  }, []);
  
  return {
    connected,
    gamePin,
    gameState,
    autoAnswer,
    answerDelay,
    connect,
    disconnect,
    selectAnswer,
    toggleAutoAnswer,
    toggleAnswerDelay,
  };
}
