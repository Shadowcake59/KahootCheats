declare module "kahoot.js" {
  class Kahoot {
    constructor();
    join(gamePin: string, name: string): Promise<void>;
    leave(): void;
    answerQuestion(choice: number): Promise<void>;
    on(event: string, callback: (data: any) => void): void;
  }
  export = Kahoot;
}
