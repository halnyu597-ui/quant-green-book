"use client";

import NextImage from "next/image";
import { useState, useEffect } from "react";
import QuestionCard from "./QuestionCard";
import { Question } from "@/types";
import questionsData from "@/data/questions.json";
import dynamic from "next/dynamic";
import "katex/dist/katex.min.css";

const Latex = dynamic(() => import("react-latex-next"), { ssr: false });

export default function GameCanvas() {
    const [questions, setQuestions] = useState<Question[]>(() => {
        return (questionsData as Question[]).filter(
            (q) => q.problem_text && q.problem_text.length > 20
        );
    });
    const [currentIndex, setCurrentIndex] = useState(0);
    const [userAnswer, setUserAnswer] = useState("");
    const [showAnswer, setShowAnswer] = useState(false);

    if (questions.length === 0) {
        return <div className="text-center p-10 finance-mono text-primary">Loading Neural Link...</div>;
    }

    const currentQuestion = questions[currentIndex];

    // Socratic Judge Submit Handler (Now handled inside QuestionCard)
    // Legacy state/handler removed.


    const [showHint, setShowHint] = useState(false);
    const [isFlipped, setIsFlipped] = useState(false); // Controlled Flip State

    // Reset state when question changes
    const handleNext = () => {
        setShowHint(false);
        setIsFlipped(false); // Reset flip
        setUserAnswer("");
        setShowAnswer(false);
        setCurrentIndex((prev) => (prev + 1) % questions.length);
    };

    const handlePrev = () => {
        setShowHint(false);
        setIsFlipped(false); // Reset flip
        setUserAnswer("");
        setShowAnswer(false);
        setCurrentIndex((prev) => (prev - 1 + questions.length) % questions.length);
    };

    return (
        <div className="min-h-screen bg-black text-white p-8 flex flex-col items-center">
            <div className="w-full max-w-4xl">
                {/* Header */}
                <div className="mb-8 flex justify-between items-end border-b border-gray-800 pb-4 shrink-0">
                    <div>
                        <h1 className="text-2xl font-bold text-white mb-1 tracking-tight">QUANT SIMULATOR</h1>
                        <p className="text-xs text-primary finance-mono">STATUS: ONLINE // CHAPTER: PROBABILITY</p>
                    </div>
                    <div className="text-right flex items-center gap-4">
                        <button
                            onClick={handlePrev}
                            className="text-primary hover:text-white transition-colors disabled:opacity-50 font-mono text-sm"
                            title="Previous Question"
                        >
                            {"<"} PREV
                        </button>
                        <div className="text-xl font-bold text-white min-w-[3rem] text-center font-mono">
                            {currentIndex + 1} <span className="text-gray-600 text-sm">/ {questions.length}</span>
                        </div>
                        <button
                            onClick={handleNext}
                            className="text-primary hover:text-white transition-colors disabled:opacity-50 font-mono text-sm"
                            title="Next Question"
                        >
                            NEXT {">"}
                        </button>
                    </div>
                </div>

                {/* Single Card Container */}
                <QuestionCard
                    question={currentQuestion}
                    isFlipped={isFlipped}
                    setIsFlipped={setIsFlipped}
                    userAnswer={userAnswer}
                    setUserAnswer={setUserAnswer}
                    // feedback, handleSubmit, isJudging are handled internally now
                    feedback={null}
                    handleSubmit={() => { }}
                    isJudging={false}
                    showHint={showHint}
                    setShowHint={setShowHint}
                />
            </div>
        </div>
    );
}

