export interface Option {
  text: string;
  isCorrect: boolean;
}

export interface Question {
  id: string;
  questionText: string;
  options: Option[];
  explanation: string;
  userNote?: string; // For "Pattern your mistake" feature
  isMarked?: boolean; // For "fav" questions
  hasBeenPracticed?: boolean; // To distinguish new from practiced questions
}