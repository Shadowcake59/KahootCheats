import { Card } from "@/components/ui/card";
import { Check } from "lucide-react";

interface AnswerCardProps {
  text: string;
  color: string;
  shape: string;
  isCorrect: boolean;
  onClick: () => void;
}

export default function AnswerCard({
  text,
  color,
  shape,
  isCorrect,
  onClick,
}: AnswerCardProps) {
  // Map color names to Tailwind classes
  const colorClasses: Record<string, string> = {
    red: "bg-accent",
    blue: "bg-secondary",
    yellow: "bg-warning",
    green: "bg-success",
  };

  // Map shape names to icon components
  const shapeIcons: Record<string, string> = {
    triangle: "ri-triangle-fill",
    square: "ri-checkbox-blank-fill",
    circle: "ri-circle-fill",
    diamond: "ri-indeterminate-circle-fill",
  };

  return (
    <Card
      className={`answer-card cursor-pointer hover:shadow-md flex items-center space-x-3 p-4 ${
        isCorrect
          ? "correct border-2 border-success bg-success bg-opacity-5"
          : "border border-gray-200"
      }`}
      onClick={onClick}
    >
      <div
        className={`w-6 h-6 rounded-md ${colorClasses[color] || "bg-gray-400"} flex-shrink-0 flex items-center justify-center text-white`}
      >
        <i className={shapeIcons[shape] || "ri-question-fill"}></i>
      </div>
      <div className="flex-grow">
        <span className="block font-medium">{text}</span>
        {isCorrect && (
          <span className="text-success text-sm flex items-center mt-1">
            <Check className="h-3 w-3 mr-1" /> Correct Answer
          </span>
        )}
      </div>
    </Card>
  );
}
