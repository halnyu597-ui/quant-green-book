"use client";

import { Question } from "@/types";
import dynamic from "next/dynamic";
import "katex/dist/katex.min.css";
import React, { useState, useEffect } from "react";
import NextImage from "next/image";

const Latex = dynamic(() => import("react-latex-next"), { ssr: false });

interface QuestionCardProps {
    question: Question;
    isFlipped: boolean;
    setIsFlipped: (flipped: boolean) => void;
    userAnswer: string;
    setUserAnswer: (ans: string) => void;
    feedback: string | null;
    handleSubmit: () => void;
    isJudging: boolean;
    showHint: boolean;
    setShowHint: (show: boolean) => void;
}

export default function QuestionCard({
    question,
    isFlipped,
    setIsFlipped,
    userAnswer,
    setUserAnswer,
    feedback,
    handleSubmit,
    isJudging,
    showHint,
    setShowHint
}: QuestionCardProps) {
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

    useEffect(() => {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
        const loadVoices = () => {
            const available = window.speechSynthesis.getVoices();
            setVoices(available);
        };
        loadVoices();
        window.speechSynthesis.onvoiceschanged = loadVoices;
    }, [question]);

    const cleanTextForSpeech = (text: string) => {
        if (!text) return "";
        let clean = text;
        clean = clean.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "$1 over $2");
        clean = clean.replace(/\\binom\{([^}]+)\}\{([^}]+)\}/g, "$1 choose $2");
        clean = clean.replace(/\^2\b/g, " squared");
        clean = clean.replace(/\^3\b/g, " cubed");
        clean = clean.replace(/\^\{([^}]+)\}/g, " to the power of $1");
        clean = clean.replace(/_\{([^}]+)\}/g, " sub $1");
        clean = clean.replace(/_([a-zA-Z0-9])/g, " sub $1");
        clean = clean.replace(/\\sum/g, "the sum");
        clean = clean.replace(/\\int/g, "the integral");
        clean = clean.replace(/\\infty/g, "infinity");
        clean = clean.replace(/\\le/g, "is less than or equal to");
        clean = clean.replace(/\\ge/g, "is greater than or equal to");
        clean = clean.replace(/\\times/g, "times");
        clean = clean.replace(/\$\$/g, "").replace(/\$/g, "").replace(/\\/g, "").replace(/[{}]/g, "");
        return clean;
    };

    const handleSpeak = () => {
        if (isSpeaking) {
            window.speechSynthesis.cancel();
            setIsSpeaking(false);
            return;
        }
        const textToRead = `${question.title}. ${cleanTextForSpeech(question.problem_text)}`;
        const utterance = new SpeechSynthesisUtterance(textToRead);
        const usVoices = voices.filter(v => v.lang === "en-US");
        const preferredVoice =
            usVoices.find(v => v.name.includes("Samantha") && v.name.includes("Enhanced")) ||
            usVoices.find(v => v.name === "Samantha") ||
            usVoices.find(v => v.name.includes("Ava") && v.name.includes("Premium")) ||
            usVoices.find(v => v.name === "Alex") ||
            usVoices.find(v => v.name.includes("Enhanced")) ||
            usVoices.find(v => v.name === "Google US English") ||
            usVoices[0];

        if (preferredVoice) utterance.voice = preferredVoice;
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);
        setIsSpeaking(true);
        window.speechSynthesis.speak(utterance);
    };

    // Helper to force display mode for complex formulas
    const formatMathText = (text: string) => {
        if (!text) return "";
        // If text contains \frac, \sum, or big parens inside single $, upgrade to $$
        // This is a naive heuristic but effective for this dataset
        // Regex to match double-dollar blocks OR single-dollar blocks
        // We ignore existing $$ blocks to prevent double-wrapping
        return text.replace(/(\$\$[\s\S]*?\$\$)|(\$([^$]+)\$)/g, (match, doubleBlock, singleBlock, singleContent) => {
            if (doubleBlock) {
                return match; // Already in display mode, leave it alone
            }
            if (singleContent) {
                // Check if the single-dollar math needs promotion to display mode
                if (singleContent.includes("\\frac") || singleContent.includes("\\sum") || singleContent.includes("\\binom") || singleContent.match(/\\left\(.*\\right\)/)) {
                    return `$$${singleContent}$$`;
                }
            }
            return match;
        });
    };

    const formattedProblemText = formatMathText(question.problem_text);
    const formattedHint = formatMathText(question.hint || "");
    const formattedSolution = formatMathText(question.solution || "");

    // State for Chat History
    const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'assistant', content: string }[]>([]);
    const [isInternalJudging, setIsInternalJudging] = useState(false);

    // Reset chat on question change
    useEffect(() => {
        setChatHistory([]);
        setIsInternalJudging(false);
    }, [question]);

    const handleJudgeSubmit = async () => {
        if (!userAnswer.trim()) return;

        setIsInternalJudging(true);
        const userMsg = { role: 'user' as const, content: userAnswer };
        const updatedHistory = [...chatHistory, userMsg];

        setChatHistory(updatedHistory);
        setUserAnswer(""); // Clear input after submit

        try {
            const response = await fetch("/api/judge", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    problem_text: question.problem_text,
                    correct_solution: question.solution,
                    chat_history: updatedHistory
                }),
            });

            const data = await response.json();
            if (data.feedback) {
                setChatHistory(prev => [...prev, { role: 'assistant', content: data.feedback }]);
            } else if (data.error) {
                setChatHistory(prev => [...prev, { role: 'assistant', content: `System Error: ${data.error}` }]);
            }
        } catch (error) {
            console.error("Judge Error:", error);
            setChatHistory(prev => [...prev, { role: 'assistant', content: "Error contacting Judge." }]);
        } finally {
            setIsInternalJudging(false);
        }
    };

    return (
        <div className="perspective-container">
            <div className={`card-inner ${isFlipped ? "card-flipped" : ""}`}>
                {/* --- FRONT FACE --- */}
                <div className={`card-face ${!isFlipped ? "card-face-visible" : "card-face-hidden"}`}>
                    <div className="glass-card animate-fade-in relative overflow-hidden min-h-[500px] flex flex-col">
                        {/* Header */}
                        <div className="flex justify-between items-center mb-4 border-b border-gray-800 pb-2">
                            <div className="flex items-center gap-4">
                                <h2 className="text-2xl font-bold text-primary finance-mono">{question.title}</h2>
                                <button
                                    onClick={handleSpeak}
                                    className={`p-2 rounded-full transition-all ${isSpeaking
                                        ? "bg-red-500/20 text-red-500 hover:bg-red-500/30"
                                        : "bg-primary/10 text-primary hover:bg-primary/20"
                                        }`}
                                    title={isSpeaking ? "Stop Reading" : "Read Aloud"}
                                >
                                    {isSpeaking ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                                        </svg>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.414z" clipRule="evenodd" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                            <span className="text-xs text-muted uppercase tracking-widest">{question.chapter}</span>
                        </div>

                        {/* Question Text */}
                        <div className="text-gray-300 leading-relaxed font-mono text-base mb-6">
                            {/* @ts-expect-error: settings prop exists at runtime but missing in types */}
                            <Latex settings={{ throwOnError: false, trust: true }}>{formattedProblemText || ""}</Latex>
                        </div>

                        {/* Socratic Chat Interface */}
                        <div className="flex-1 flex flex-col min-h-0">
                            {/* Chat History */}
                            <div className="flex-1 overflow-y-auto mb-4 space-y-4 pr-2 max-h-[400px]">
                                {chatHistory.length === 0 && (
                                    <div className="text-gray-500 text-sm font-mono italic text-center pt-8">
                                        State your reasoning. The Socratic Judge will evaluate it.
                                    </div>
                                )}
                                {chatHistory.map((msg, idx) => (
                                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] rounded-lg p-3 text-sm font-mono ${msg.role === 'user'
                                            ? 'bg-zinc-800 text-gray-200 border border-zinc-700'
                                            : 'bg-primary/10 border-l-2 border-primary text-gray-200'
                                            }`}>
                                            {msg.role === 'assistant' && (
                                                <span className="font-bold text-primary block text-[10px] mb-1 tracking-wider uppercase">Socratic Judge</span>
                                            )}
                                            <div className="whitespace-pre-wrap leading-relaxed">
                                                {msg.role === 'assistant' ? (
                                                    /* @ts-expect-error: settings prop exists at runtime but missing in types */
                                                    <Latex settings={{ throwOnError: false, trust: true }}>{msg.content}</Latex>
                                                ) : msg.content}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {isInternalJudging && (
                                    <div className="flex justify-start">
                                        <div className="bg-primary/5 border-l-2 border-primary/50 p-3 rounded-r-lg">
                                            <span className="text-primary text-xs animate-pulse font-mono">Analying reasoning...</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Input Area */}
                            <div className="mt-auto">
                                <label className="block text-xs uppercase text-gray-500 mb-2 finance-mono">Your Reasoning</label>
                                <textarea
                                    value={userAnswer}
                                    onChange={(e) => setUserAnswer(e.target.value)}
                                    // Submit on Ctrl+Enter
                                    onKeyDown={(e) => {
                                        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                                            handleJudgeSubmit();
                                        }
                                    }}
                                    className="w-full h-[100px] p-4 text-base text-white bg-zinc-900 border border-zinc-700 rounded-md focus:ring-2 focus:ring-green-500 font-mono resize-none"
                                    placeholder="Type your thoughts... (Ctrl+Enter to submit)"
                                />
                                <div className="flex justify-end gap-3 mt-2">
                                    <button
                                        onClick={() => {
                                            setChatHistory([]);
                                            setUserAnswer("");
                                            setIsInternalJudging(false);
                                        }}
                                        className="text-xs text-gray-400 hover:text-white transition-colors"
                                        title="Clear chat history"
                                    >
                                        CLEAR CHAT
                                    </button>
                                    <button
                                        onClick={handleJudgeSubmit}
                                        disabled={isInternalJudging || !userAnswer.trim()}
                                        className="btn-primary py-2 px-6 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isInternalJudging ? "JUDGING..." : "SUBMIT"}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Bottom Navigation Buttons */}
                        <div className="pt-6 flex justify-between w-full border-t border-gray-800/50 mt-4">
                            {question.hint ? (
                                <button
                                    onClick={() => setShowHint(!showHint)}
                                    className={`text-xs font-mono py-2 px-4 rounded transition-all border ${showHint ? 'bg-yellow-900/20 text-yellow-500 border-yellow-500' : 'text-gray-400 border-gray-700 hover:border-yellow-500/50 hover:text-yellow-500'}`}
                                >
                                    {showHint ? "HIDE HINT" : "SHOW HINT"}
                                </button>
                            ) : (
                                <div></div> /* Spacer */
                            )}

                            <button
                                onClick={() => setIsFlipped(true)}
                                className="text-xs font-mono py-2 px-4 rounded transition-all border text-gray-400 border-gray-700 hover:border-primary/50 hover:text-primary"
                            >
                                SHOW SOLUTION
                            </button>
                        </div>

                        {/* Hint Display */}
                        {showHint && question.hint && (
                            <div className="mt-4 animate-fade-in bg-yellow-900/10 border-l-2 border-yellow-500 p-5 rounded-r-lg">
                                <span className="font-bold text-yellow-500 block text-xs mb-2 tracking-wider">HINT</span>
                                <div className="text-yellow-100/90 text-sm leading-relaxed">
                                    {/* @ts-expect-error: settings prop exists at runtime but missing in types */}
                                    <Latex settings={{ throwOnError: false, trust: true }}>{formattedHint}</Latex>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* --- BACK FACE (Solution) --- */}
                <div className={`card-face card-back glass-card p-8 ${isFlipped ? "card-face-visible" : "card-face-hidden"}`}>
                    <div className="flex justify-between items-center mb-6 border-b border-gray-800 pb-2">
                        <h2 className="text-xl font-bold text-primary">OFFICIAL SOLUTION</h2>
                        <button
                            onClick={() => setIsFlipped(false)}
                            className="text-xs border border-primary/50 text-primary px-3 py-1 rounded hover:bg-primary/10 transition-colors"
                        >
                            FLIP BACK
                        </button>
                    </div>

                    <div className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">
                        {/* @ts-expect-error: settings prop exists at runtime but missing in types */}
                        <Latex settings={{ throwOnError: false, trust: true }}>{formattedSolution}</Latex>
                    </div>

                    {question.graph_url && (
                        <div className="mt-6 bg-black/20 p-4 rounded-lg border border-gray-800">
                            <div className="max-w-[280px] mx-auto my-4">
                                <NextImage
                                    src={question.graph_url}
                                    alt={`${question.title} Diagram`}
                                    width={300}
                                    height={200}
                                    style={{ maxWidth: '250px' }}
                                    className="w-full h-auto object-contain rounded shadow-lg"
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
