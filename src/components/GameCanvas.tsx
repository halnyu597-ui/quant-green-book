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

    const [completedIndices, setCompletedIndices] = useState<Set<number>>(new Set());
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [quickJumpValue, setQuickJumpValue] = useState("");

    const handleJumpTo = (index: number) => {
        if (index >= 0 && index < questions.length) {
            setCurrentIndex(index);
            setIsMenuOpen(false);
            // Reset state
            setShowHint(false);
            setIsFlipped(false);
            setUserAnswer("");
            setShowAnswer(false);
        }
    };

    const handleQuickJump = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            const idx = parseInt(quickJumpValue) - 1; // 1-based to 0-based
            if (!isNaN(idx)) {
                handleJumpTo(idx);
            }
            setQuickJumpValue("");
        }
    };

    const handleJudgeSubmit = () => {
        setCompletedIndices(prev => new Set(prev).add(currentIndex));
    };

    return (
        <div className="min-h-screen bg-black text-white p-4 md:p-8 flex flex-col items-center">
            {/* Navigation Overlay */}
            {isMenuOpen && (
                <div className="fixed inset-0 bg-black/95 z-50 flex flex-col p-6 animate-fade-in">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold text-primary tracking-widest">NAVIGATION</h2>
                        <button
                            onClick={() => setIsMenuOpen(false)}
                            className="text-white hover:text-primary transition-colors text-3xl font-thin"
                        >
                            ✕
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto grid grid-cols-5 md:grid-cols-8 lg:grid-cols-10 gap-3 place-content-start">
                        {questions.map((_, idx) => (
                            <button
                                key={idx}
                                onClick={() => handleJumpTo(idx)}
                                className={`
                                    h-12 rounded border font-mono text-sm transition-all
                                    ${idx === currentIndex
                                        ? 'border-primary text-primary shadow-[0_0_10px_rgba(0,255,100,0.3)]'
                                        : completedIndices.has(idx)
                                            ? 'bg-primary/20 border-primary/20 text-white'
                                            : 'border-zinc-800 text-gray-500 hover:border-gray-600 hover:text-gray-300'
                                    }
                                `}
                            >
                                {idx + 1}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="w-full max-w-4xl">
                {/* Header */}
                <div className="mb-8 flex flex-col md:flex-row justify-between items-end border-b border-gray-800 pb-4 shrink-0 gap-4">
                    <div className="w-full md:w-auto flex justify-between items-center">
                        <div>
                            <h1 className="text-2xl font-bold text-white mb-1 tracking-tight">QUANT SIMULATOR</h1>
                            <p className="text-[10px] text-primary finance-mono tracking-widest">STATUS: ONLINE // PROBABILITY</p>
                        </div>
                        {/* Mobile Menu Toggle */}
                        <button
                            onClick={() => setIsMenuOpen(true)}
                            className="md:hidden text-primary border border-primary/30 p-2 rounded"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                        </button>
                    </div>

                    <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 font-mono hidden md:inline">JUMP:</span>
                            <input
                                type="number"
                                value={quickJumpValue}
                                onChange={(e) => setQuickJumpValue(e.target.value)}
                                onKeyDown={handleQuickJump}
                                placeholder="#"
                                className="w-12 bg-zinc-900 border border-zinc-700 text-white text-center text-sm rounded py-1 focus:ring-1 focus:ring-primary outline-none font-mono"
                            />
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={handlePrev}
                                className="text-primary hover:text-white transition-colors disabled:opacity-50 font-mono text-sm"
                                title="Previous Question"
                            >
                                {"<"}
                            </button>
                            <button onClick={() => setIsMenuOpen(true)} className="text-xl font-bold text-white min-w-[4rem] text-center font-mono hover:text-primary transition-colors cursor-pointer" title="Open Navigation">
                                {currentIndex + 1} <span className="text-gray-600 text-sm">/ {questions.length}</span>
                            </button>
                            <button
                                onClick={handleNext}
                                className="text-primary hover:text-white transition-colors disabled:opacity-50 font-mono text-sm"
                                title="Next Question"
                            >
                                {">"}
                            </button>
                        </div>
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
                    onJudgeSubmit={handleJudgeSubmit}
                />
            </div>
        </div>
    );
}

