import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ConnectionLogProps {
  messages: string[];
}

export default function ConnectionLog({ messages }: ConnectionLogProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="text-sm font-medium text-gray-500 mb-2">
          Connection Log
        </h3>
        <ScrollArea className="h-20 w-full">
          <div className="text-xs text-gray-600">
            {messages.map((message, index) => (
              <div key={index} className="mb-1">
                • {message}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
