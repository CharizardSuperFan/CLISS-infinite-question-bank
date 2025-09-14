import React, { useState, useEffect } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { Question, Option } from './types';
import { GenerateIcon, BankIcon, HistoryIcon, CheckIcon, XIcon, AlertIcon, StarIcon, StarOutlineIcon, EyeSlashIcon } from './components/IconComponents';

type ActiveTab = 'generate' | 'bank' | 'history';

const MAX_QUESTIONS = 5000;
const DELETION_CHUNK_SIZE = 50;

// --- Local Storage Service ---
const useQuestionStorage = (): [Question[], (questions: Question[]) => void] => {
    const [questions, setQuestions] = useState<Question[]>([]);

    useEffect(() => {
        try {
            const storedQuestions = localStorage.getItem('lekolokoQuestions');
            if (storedQuestions) {
                setQuestions(JSON.parse(storedQuestions));
            } else {
                // Start with an empty bank if nothing is in storage
                setQuestions([]);
            }
        } catch (error) {
            console.error("Failed to load questions from local storage:", error);
            // Fallback to empty bank in case of parsing error
            setQuestions([]);
        }
    }, []);

    const saveQuestions = (newQuestions: Question[]) => {
        try {
            localStorage.setItem('lekolokoQuestions', JSON.stringify(newQuestions));
            setQuestions(newQuestions);
        } catch (error) {
            console.error("Failed to save questions to local storage:", error);
        }
    };

    return [questions, saveQuestions];
};

// --- Parser Logic ---

/**
 * Shuffles an array in place using the Fisher-Yates algorithm.
 * @param array The array to shuffle.
 */
const shuffleArray = <T,>(array: T[]): T[] => {
    // Create a copy to avoid mutating the original array
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
};

const parseGeneratedText = (text: string): { newQuestions: Question[], error: string | null } => {
    // Pre-process text to remove backslashes used for escaping by LLMs, e.g., turning \[ into [.
    // This regex finds any backslash followed by a non-alphanumeric, non-whitespace
    // character (i.e., punctuation/symbols) and replaces the pair with only the symbol.
    const processedText = text.replace(/\\([^\s\w])/g, '$1');

    if (!processedText.trim()) {
        return { newQuestions: [], error: "Input text is empty." };
    }

    const parts = processedText.split('∆∆∆∆∆').filter(p => p.trim());

    if (parts.length === 0 || parts.length % 2 !== 0) {
        return { newQuestions: [], error: "Invalid format. The text should contain pairs of sections separated by '∆∆∆∆∆'." };
    }

    const newQuestions: Question[] = [];

    for (let i = 0; i < parts.length; i += 2) {
        const questionText = parts[i].trim();
        const contentBlock = parts[i + 1];
        const contentParts = contentBlock.split('§§§§').filter(p => p.trim());
        if (contentParts.length !== 2) continue;

        const [optionsPart, explanationContainer] = contentParts;
        const explanationParts = explanationContainer.split('^^^^^').filter(p => p.trim());
        if (explanationParts.length !== 1) continue;

        const explanation = explanationParts[0].trim();
        const optionLines = optionsPart.trim().split('\n').filter(line => line.trim() !== '');

        if (!questionText || !explanation || optionLines.length === 0) continue;
        
        const seenSymbols = new Set<string>();
        const options: Option[] = optionLines
            .map(line => {
                const trimmedLine = line.trim();
                let symbol: string | null = null;
                let text: string | null = null;

                if (trimmedLine.startsWith('\\$') || trimmedLine.startsWith('\\€') || trimmedLine.startsWith('\\¥') || trimmedLine.startsWith('\\¢')) {
                    symbol = trimmedLine[1];
                    text = trimmedLine.substring(2).trim();
                } else if (['$', '€', '¥', '¢'].includes(trimmedLine[0])) {
                    symbol = trimmedLine[0];
                    text = trimmedLine.substring(1).trim();
                } else {
                    return null;
                }

                if (!symbol || !text) return null;
                if (seenSymbols.has(symbol)) return null;
                seenSymbols.add(symbol);

                const isCorrect = symbol === '$';
                return { text, isCorrect };
            })
            .filter((opt): opt is Option => opt !== null);

        if (options.length > 1 && options.some(o => o.isCorrect)) {
            newQuestions.push({
                id: `q_${Date.now()}_${Math.random()}_${i}`,
                questionText,
                options: shuffleArray(options), // Randomize options
                explanation,
                hasBeenPracticed: false,
            });
        }
    }
    
    if (newQuestions.length === 0) {
        return { newQuestions: [], error: "Parsing failed. Please check your format. Example: Question Text ∆∆∆∆∆ $Correct Option\n€Incorrect Option §§§§ Explanation ^^^^^" };
    }

    return { newQuestions, error: null };
};


// --- UI Components ---

const Header: React.FC<{ activeTab: ActiveTab; setActiveTab: (tab: ActiveTab) => void }> = ({ activeTab, setActiveTab }) => {
    return (
        <header className="relative py-6 text-center border-b border-surface">
            <h1 className="text-4xl font-bold tracking-tight text-primary-text">
                 <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-teal-400">CLISS</span> Infinite Question Bank
            </h1>
            <p className="mt-2 text-lg text-secondary-text">Your personal SAT study powerhouse.</p>
            <nav className="mt-6 flex justify-center gap-2 sm:gap-4">
                {(['generate', 'bank', 'history'] as ActiveTab[]).map(tab => {
                    const isActive = activeTab === tab;
                    const Icon = tab === 'generate' ? GenerateIcon : tab === 'bank' ? BankIcon : HistoryIcon;
                    return (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-2.5 sm:px-6 font-medium text-sm sm:text-base rounded-lg flex items-center gap-2 transition-all duration-200 transform hover:scale-105 ${
                                isActive
                                    ? 'bg-brand-primary text-white shadow-lg'
                                    : 'bg-surface text-secondary-text hover:bg-slate-700 hover:text-primary-text'
                            }`}
                            aria-current={isActive ? 'page' : undefined}
                        >
                            <Icon className="w-5 h-5" />
                            <span className="capitalize">{tab}</span>
                        </button>
                    );
                })}
            </nav>
            <div className="absolute top-6 right-6 text-secondary-text font-mono text-sm hidden sm:block">LekoLeko</div>
        </header>
    );
};

const GenerateView: React.FC<{ onSave: (questions: Question[]) => void, questionCount: number }> = ({ onSave, questionCount }) => {
    const [text, setText] = useState('');
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    const handleParse = () => {
        const { newQuestions, error } = parseGeneratedText(text);
        if (error) {
            setFeedback({ type: 'error', message: error });
        } else {
            onSave(newQuestions);
            const isCapped = (questionCount + newQuestions.length) > MAX_QUESTIONS;
            const successMessage = `Successfully added ${newQuestions.length} new question(s)!` + (isCapped ? ` The oldest ${DELETION_CHUNK_SIZE} questions were removed.` : '');
            setFeedback({ type: 'success', message: successMessage });
            setText('');
        }
    };

    return (
        <div className="flex flex-col gap-6 items-center">
            <div className="w-full p-4 border border-dashed border-slate-600 bg-surface rounded-lg">
                <h3 className="font-semibold text-primary-text mb-2">Instructions</h3>
                <p className="text-sm text-secondary-text">
                    Paste the raw text generated by your LLM below. The app will parse and save the questions, shuffling the options for you.
                </p>
                 <p className="text-sm text-secondary-text mt-2">Current bank size: <span className="font-bold text-primary-text">{questionCount} / {MAX_QUESTIONS}</span></p>
            </div>
            {feedback && (
                <div className={`w-full p-4 rounded-lg flex items-start gap-3 ${
                    feedback.type === 'success' ? 'bg-emerald-900/50 border border-emerald-700 text-emerald-300' : 'bg-red-900/50 border border-red-700 text-red-300'
                }`}>
                    {feedback.type === 'success' ? <CheckIcon className="w-6 h-6 flex-shrink-0 mt-0.5" /> : <AlertIcon className="w-6 h-6 flex-shrink-0 mt-0.5" />}
                    <p>{feedback.message}</p>
                </div>
            )}
            <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste your generated questions here..."
                className="w-full p-4 bg-surface border border-slate-600 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition duration-200 resize-y"
                rows={15}
            />
            <button
                onClick={handleParse}
                disabled={!text.trim()}
                className="px-8 py-3 bg-brand-primary text-white font-semibold rounded-lg shadow-md hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 focus:ring-offset-background disabled:bg-slate-600 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 flex items-center gap-2"
            >
                <GenerateIcon className="w-5 h-5" />
                Parse & Save Questions
            </button>
        </div>
    );
};

const QuestionBankView: React.FC<{ 
    questions: Question[], 
    onUpdateNote: (questionId: string, note: string) => void, 
    onToggleMark: (questionId: string) => void,
    onMarkAsPracticed: (questionId: string) => void,
}> = ({ questions, onUpdateNote, onToggleMark, onMarkAsPracticed }) => {
    const [newDeck, setNewDeck] = useState<Question[]>([]);
    const [practicedDeck, setPracticedDeck] = useState<Question[]>([]);
    const [deckPosition, setDeckPosition] = useState(0);
    const [isPracticingNew, setIsPracticingNew] = useState(true);
    
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
    const [showExplanation, setShowExplanation] = useState(false);
    const [isAnalysisMode, setIsAnalysisMode] = useState(false);
    const [focusNewOnly, setFocusNewOnly] = useState(false);
    const [note, setNote] = useState('');
    const [eliminatedOptions, setEliminatedOptions] = useState<Set<string>>(new Set());
    const [time, setTime] = useState(0);
    const [isTimerRunning, setIsTimerRunning] = useState(true);

    useEffect(() => {
        const newQuestions = questions.filter(q => !q.hasBeenPracticed);
        const practicedQuestions = questions.filter(q => q.hasBeenPracticed);

        // If the number of questions in each deck hasn't changed, it was a minor update (e.g., starring).
        // In this case, just update the question data in the existing decks without resetting the view.
        if (newQuestions.length === newDeck.length && practicedQuestions.length === practicedDeck.length) {
            const updateDeck = (deck: Question[]) => deck.map(dq => questions.find(q => q.id === dq.id)!).filter(Boolean);
            setNewDeck(updateDeck(newDeck));
            setPracticedDeck(updateDeck(practicedDeck));
            return; // Exit without resetting position, timer, etc.
        }

        // Otherwise, it was a major change (add/delete/practice), so reset and reshuffle.
        setNewDeck(shuffleArray(newQuestions));
        setPracticedDeck(shuffleArray(practicedQuestions));
        
        setDeckPosition(0);
        setIsPracticingNew(newQuestions.length > 0);

        // Reset other states for a clean start
        setSelectedAnswer(null);
        setShowExplanation(false);
        setEliminatedOptions(new Set());
        setTime(0);
        setIsTimerRunning(true);
    }, [questions]);

    useEffect(() => {
        let interval: number | null = null;
        if (isTimerRunning) {
            interval = window.setInterval(() => {
                setTime(prevTime => prevTime + 1);
            }, 1000);
        }
        return () => {
            if (interval) window.clearInterval(interval);
        };
    }, [isTimerRunning]);
    
    const formatTime = (seconds: number) => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
    };

    const activeDeck = isPracticingNew ? newDeck : practicedDeck;
    const currentQuestion = activeDeck[deckPosition];

    const handleNext = () => {
        if (!currentQuestion) return;
    
        if (isPracticingNew) {
            onMarkAsPracticed(currentQuestion.id);
        }
    
        const isLastInNewDeck = isPracticingNew && deckPosition + 1 >= newDeck.length;
    
        // If it's the last new question, focus mode is OFF, and there are practiced questions, switch to the practiced deck.
        if (isLastInNewDeck && !focusNewOnly && practicedDeck.length > 0) {
            setIsPracticingNew(false);
            setDeckPosition(0);
        } else if (deckPosition + 1 < activeDeck.length) {
            // Otherwise, if there are more questions in the current deck, advance.
            setDeckPosition(deckPosition + 1);
        }
        // If at the end of a deck and can't switch, do nothing (button will be disabled).
    
        setSelectedAnswer(null);
        setShowExplanation(false);
        setEliminatedOptions(new Set());
        setTime(0);
        setIsTimerRunning(true);
    };

    const handleReshuffle = () => {
        setPracticedDeck(shuffleArray(practicedDeck));
        setDeckPosition(0);
        setSelectedAnswer(null);
        setShowExplanation(false);
        setEliminatedOptions(new Set());
        setTime(0);
        setIsTimerRunning(true);
    };

    useEffect(() => {
        if (currentQuestion) {
            setNote(currentQuestion.userNote || '');
        } else {
            setNote('');
        }
    }, [currentQuestion]);

    if (questions.length === 0) {
        return (
            <div className="text-center text-secondary-text p-8 bg-surface rounded-lg flex flex-col items-center gap-4">
                <BankIcon className="w-16 h-16 text-slate-600" />
                <h3 className="text-xl font-semibold text-primary-text">Your question bank is empty.</h3>
                <p>Go to the "Generate" tab to add some questions!</p>
            </div>
        );
    }
    
    if (!currentQuestion) {
        return (
             <div className="text-center text-secondary-text p-8 bg-surface rounded-lg">
                <p>No questions available in this section.</p>
             </div>
        )
    }
    
    const hasAnswered = selectedAnswer !== null;
    const isLastInNewDeck = isPracticingNew && deckPosition >= newDeck.length - 1;
    const isLastInPracticedDeck = !isPracticingNew && deckPosition >= practicedDeck.length - 1;

    const disableNextButton = isLastInPracticedDeck || (isLastInNewDeck && (focusNewOnly || practicedDeck.length === 0));


    const handleOptionClick = (optionText: string) => {
        if (hasAnswered) return;
        setSelectedAnswer(optionText);
        setIsTimerRunning(false);
    };

    const handleEliminateClick = (optionText: string) => {
        if (hasAnswered) return;
        setEliminatedOptions(prev => {
            const newSet = new Set(prev);
            if (newSet.has(optionText)) {
                newSet.delete(optionText);
            } else {
                newSet.add(optionText);
            }
            return newSet;
        });
    };
    
    const handleSaveNote = () => {
        onUpdateNote(currentQuestion.id, note);
    };

    return (
        <div className="w-full max-w-4xl mx-auto flex flex-col gap-6">
            <div className="flex justify-between items-center p-2 bg-surface rounded-lg flex-wrap gap-y-3">
                <div className="flex items-center gap-3">
                    <p className="text-sm font-semibold text-brand-primary">
                        {isPracticingNew ? `New Question ${deckPosition + 1} of ${newDeck.length}` : `Review Question ${deckPosition + 1} of ${practicedDeck.length}`}
                    </p>
                     <button 
                        onClick={() => onToggleMark(currentQuestion.id)} 
                        className="text-amber-400 hover:text-amber-300 transition-colors"
                        aria-label={currentQuestion.isMarked ? "Unmark question" : "Mark question"}
                    >
                        {currentQuestion.isMarked ? <StarIcon className="w-6 h-6" /> : <StarOutlineIcon className="w-6 h-6" />}
                    </button>
                    {!isPracticingNew && practicedDeck.length > 1 && (
                         <button onClick={handleReshuffle} className="text-xs font-semibold text-secondary-text hover:text-primary-text bg-slate-700 px-2 py-1 rounded">
                             RESHUFFLE
                         </button>
                    )}
                </div>
                 <div className="font-mono text-xl text-primary-text tracking-wider order-first sm:order-none w-full sm:w-auto text-center">
                    {formatTime(time)}
                </div>
                <div className="flex items-center gap-4">
                     <div className="flex items-center gap-2">
                        <label htmlFor="focus-mode" className="text-sm font-medium text-secondary-text cursor-pointer whitespace-nowrap">New Only</label>
                        <button
                            id="focus-mode"
                            role="switch"
                            aria-checked={focusNewOnly}
                            onClick={() => setFocusNewOnly(!focusNewOnly)}
                            className={`${focusNewOnly ? 'bg-brand-primary' : 'bg-slate-600'} relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}
                        >
                            <span className={`${focusNewOnly ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
                        </button>
                    </div>
                     <div className="flex items-center gap-2">
                        <label htmlFor="analysis-mode" className="text-sm font-medium text-secondary-text cursor-pointer whitespace-nowrap">Analysis Mode</label>
                        <button
                            id="analysis-mode"
                            role="switch"
                            aria-checked={isAnalysisMode}
                            onClick={() => setIsAnalysisMode(!isAnalysisMode)}
                            className={`${isAnalysisMode ? 'bg-brand-primary' : 'bg-slate-600'} relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}
                        >
                            <span className={`${isAnalysisMode ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
                        </button>
                    </div>
                </div>
            </div>

            <div className="p-6 bg-surface rounded-lg shadow-md">
                <p className="text-lg text-primary-text whitespace-pre-wrap">{currentQuestion.questionText}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {currentQuestion.options.map((option, index) => {
                    const isSelected = selectedAnswer === option.text;
                    const isEliminated = eliminatedOptions.has(option.text);
                    let containerClass = "bg-surface hover:bg-slate-700";

                    if (hasAnswered) {
                        if (option.isCorrect) containerClass = "bg-emerald-800/80 border-emerald-600";
                        else if (isSelected) containerClass = "bg-red-800/80 border-red-600";
                        else containerClass = "bg-surface opacity-60";
                    }
                    return (
                        <div key={index} className={`flex items-stretch rounded-lg overflow-hidden transition-all duration-200 border border-transparent ${containerClass}`}>
                            <button 
                                onClick={() => handleOptionClick(option.text)} 
                                disabled={hasAnswered} 
                                className="flex-grow p-4 text-left w-full disabled:cursor-not-allowed"
                            >
                                <span className="font-mono mr-3 text-brand-primary">{String.fromCharCode(65 + index)}.</span>
                                <span className={`text-primary-text transition-all ${isEliminated ? 'line-through opacity-50' : ''}`}>{option.text}</span>
                                {hasAnswered && (
                                    <span className="ml-4 inline-block">
                                        {option.isCorrect && <CheckIcon className="w-6 h-6 text-emerald-400" />}
                                        {isSelected && !option.isCorrect && <XIcon className="w-6 h-6 text-red-400" />}
                                    </span>
                                )}
                            </button>
                            <button
                                onClick={() => handleEliminateClick(option.text)}
                                disabled={hasAnswered}
                                className="px-4 text-secondary-text hover:text-primary-text disabled:opacity-50 disabled:cursor-not-allowed border-l border-slate-600/50"
                                aria-label={`Eliminate option ${option.text}`}
                            >
                                <EyeSlashIcon className="w-5 h-5" />
                            </button>
                        </div>
                    );
                })}
            </div>
            {hasAnswered && (
                <div className="flex flex-col gap-4 items-center">
                    <button onClick={() => setShowExplanation(!showExplanation)} className="font-semibold text-brand-primary hover:text-indigo-400">
                        {showExplanation ? 'Hide' : 'Show'} Explanation
                    </button>
                    {showExplanation && (
                        <div className="w-full p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                             <p className="text-secondary-text whitespace-pre-wrap">{currentQuestion.explanation}</p>
                        </div>
                    )}
                    {isAnalysisMode && (
                        <div className="w-full flex flex-col gap-2">
                             <h4 className="font-semibold text-primary-text">My Mistake Analysis:</h4>
                             <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What was my mistake? How can I avoid it next time?" className="w-full p-3 bg-surface border border-slate-600 rounded-lg focus:ring-2 focus:ring-brand-primary" rows={4} />
                             <button onClick={handleSaveNote} className="px-4 py-2 bg-brand-secondary text-white font-semibold rounded-lg self-end hover:bg-emerald-400">Save Note</button>
                        </div>
                    )}
                </div>
            )}
            <button 
                onClick={handleNext} 
                disabled={disableNextButton}
                className="w-full sm:w-auto mx-auto mt-4 px-8 py-3 bg-brand-primary text-white font-semibold rounded-lg shadow-md hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 focus:ring-offset-background disabled:bg-slate-600 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105"
            >
                Next Question
            </button>
        </div>
    );
};

const HistoryView: React.FC<{ questions: Question[]; onDelete: (questionId: string) => void; onToggleMark: (questionId: string) => void; }> = ({ questions, onDelete, onToggleMark }) => {
    const [showMarkedOnly, setShowMarkedOnly] = useState(false);

    const filteredQuestions = showMarkedOnly ? questions.filter(q => q.isMarked) : questions;

    if (questions.length === 0) {
        return (
            <div className="text-center text-secondary-text p-8 bg-surface rounded-lg flex flex-col items-center gap-4">
                <HistoryIcon className="w-16 h-16 text-slate-600" />
                <h3 className="text-xl font-semibold text-primary-text">No questions in your history yet.</h3>
                <p>Complete some questions in the "Bank" tab to see them here.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
             <div className="flex justify-end items-center mb-4 gap-2">
                <label htmlFor="filter-marked" className="text-sm font-medium text-secondary-text cursor-pointer">Show Marked Only</label>
                <button
                    id="filter-marked"
                    role="switch"
                    aria-checked={showMarkedOnly}
                    onClick={() => setShowMarkedOnly(!showMarkedOnly)}
                    className={`${showMarkedOnly ? 'bg-brand-primary' : 'bg-slate-600'} relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}
                >
                    <span className={`${showMarkedOnly ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
                </button>
            </div>
            
            {filteredQuestions.length === 0 && showMarkedOnly && (
                 <div className="text-center text-secondary-text p-8 bg-surface rounded-lg">You haven't marked any questions yet.</div>
            )}

            {filteredQuestions.slice().reverse().map((q) => (
                <details key={q.id} className="bg-surface p-4 rounded-lg cursor-pointer">
                    <summary className="font-medium text-primary-text flex justify-between items-center gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                            <button
                                onClick={(e) => { e.stopPropagation(); onToggleMark(q.id); }} 
                                className="text-amber-400 hover:text-amber-300 p-1 -ml-1 flex-shrink-0"
                                aria-label={q.isMarked ? `Unmark question` : `Mark question`}
                            >
                                {q.isMarked ? <StarIcon className="w-5 h-5"/> : <StarOutlineIcon className="w-5 h-5"/>}
                            </button>
                            <span className="truncate">Question {questions.indexOf(q) + 1}: {q.questionText}</span>
                        </div>
                        <button onClick={(e) => { e.preventDefault(); onDelete(q.id); }} className="text-red-500 hover:text-red-400 text-xs font-semibold ml-4 p-1 flex-shrink-0" aria-label={`Delete question ${questions.indexOf(q) + 1}`}>
                            DELETE
                        </button>
                    </summary>
                    <div className="mt-4 pt-4 border-t border-slate-700 text-secondary-text space-y-3">
                        <p className="whitespace-pre-wrap"><strong className="text-slate-300">Full Question:</strong><br/>{q.questionText}</p>
                        <div>
                            <strong className="text-slate-300">Options:</strong>
                            <ul className="list-disc list-inside ml-2">
                                {q.options.map((opt, i) => (
                                    <li key={i} className={opt.isCorrect ? 'text-emerald-400' : ''}>
                                        {opt.text} {opt.isCorrect && "(Correct)"}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <p className="whitespace-pre-wrap"><strong className="text-slate-300">Explanation:</strong><br/>{q.explanation}</p>
                        {q.userNote && (
                             <p className="whitespace-pre-wrap pt-3 border-t border-slate-700"><strong className="text-amber-400">My Mistake Analysis:</strong><br/>{q.userNote}</p>
                        )}
                    </div>
                </details>
            ))}
        </div>
    );
};

const ConfirmationModal: React.FC<{
    isOpen: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    questionsToDelete: Question[];
    newCount: number;
}> = ({ isOpen, onConfirm, onCancel, questionsToDelete, newCount }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900 bg-opacity-75 backdrop-blur-sm flex justify-center items-center z-50 p-4" aria-modal="true" role="dialog">
            <div className="bg-surface rounded-lg shadow-2xl p-6 w-full max-w-2xl border border-slate-700">
                <h2 className="text-2xl font-bold text-primary-text flex items-center gap-3"><AlertIcon className="w-7 h-7 text-amber-400" /> Capacity Reached</h2>
                <p className="mt-4 text-secondary-text">
                    Your question bank is capped at {MAX_QUESTIONS} questions. To add {newCount} new question(s), the {DELETION_CHUNK_SIZE} oldest questions will be permanently deleted.
                </p>
                <div className="mt-4 p-3 bg-slate-900/50 border border-slate-700 rounded-lg max-h-60 overflow-y-auto">
                    <h3 className="font-semibold text-slate-300 mb-2">Questions to be deleted:</h3>
                    <ul className="list-decimal list-inside text-sm text-secondary-text space-y-1">
                        {questionsToDelete.map(q => <li key={q.id}>{q.questionText.substring(0, 100)}...</li>)}
                    </ul>
                </div>
                 <div className="mt-6 flex justify-end gap-4">
                    <button onClick={onCancel} className="px-6 py-2 rounded-lg bg-slate-600 hover:bg-slate-500 font-semibold text-primary-text transition-colors">Cancel</button>
                    <button onClick={onConfirm} className="px-6 py-2 rounded-lg bg-red-600 hover:bg-red-500 font-semibold text-white transition-colors">Delete & Continue</button>
                </div>
            </div>
        </div>
    );
};

// --- Main App Component ---

const App: React.FC = () => {
    const [activeTab, setActiveTab] = useState<ActiveTab>('generate');
    const [questions, saveQuestions] = useQuestionStorage();
    const [modalState, setModalState] = useState<{ isOpen: boolean, newQuestions: Question[] }>({ isOpen: false, newQuestions: [] });

    const handleSaveNewQuestions = (newQuestions: Question[]) => {
        if (questions.length + newQuestions.length > MAX_QUESTIONS) {
            setModalState({ isOpen: true, newQuestions });
        } else {
            const updatedQuestions = [...questions, ...newQuestions];
            saveQuestions(updatedQuestions);
        }
    };
    
    const handleModalConfirm = () => {
        const questionsToKeep = questions.slice(DELETION_CHUNK_SIZE);
        const updatedQuestions = [...questionsToKeep, ...modalState.newQuestions];
        saveQuestions(updatedQuestions);
        setModalState({ isOpen: false, newQuestions: [] });
    };

    const handleModalCancel = () => {
        setModalState({ isOpen: false, newQuestions: [] });
    };

    const handleDeleteQuestion = (questionId: string) => {
        const updatedQuestions = questions.filter(q => q.id !== questionId);
        saveQuestions(updatedQuestions);
    };
    
    const handleUpdateQuestionNote = (questionId: string, note: string) => {
        const updatedQuestions = questions.map(q =>
            q.id === questionId ? { ...q, userNote: note } : q
        );
        saveQuestions(updatedQuestions);
    };

    const handleToggleMark = (questionId: string) => {
        const updatedQuestions = questions.map(q => 
            q.id === questionId ? { ...q, isMarked: !q.isMarked } : q
        );
        saveQuestions(updatedQuestions);
    };

    const handleMarkAsPracticed = (questionId: string) => {
        const updatedQuestions = questions.map(q =>
            q.id === questionId ? { ...q, hasBeenPracticed: true } : q
        );
        saveQuestions(updatedQuestions);
    };

    const renderActiveView = () => {
        switch (activeTab) {
            case 'generate':
                return <GenerateView onSave={handleSaveNewQuestions} questionCount={questions.length} />;
            case 'bank':
                return <QuestionBankView questions={questions} onUpdateNote={handleUpdateQuestionNote} onToggleMark={handleToggleMark} onMarkAsPracticed={handleMarkAsPracticed} />;
            case 'history':
                return <HistoryView questions={questions} onDelete={handleDeleteQuestion} onToggleMark={handleToggleMark} />;
            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen bg-background text-primary-text">
              <Analytics /> 
            <Header activeTab={activeTab} setActiveTab={setActiveTab} />
            <main className="container mx-auto px-4 py-8">
                {renderActiveView()}
            </main>
            <ConfirmationModal
                isOpen={modalState.isOpen}
                onConfirm={handleModalConfirm}
                onCancel={handleModalCancel}
                questionsToDelete={questions.slice(0, DELETION_CHUNK_SIZE)}
                newCount={modalState.newQuestions.length}
            />
        </div>
    );
};

export default App;
