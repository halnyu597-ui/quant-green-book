import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const { problem_text, correct_solution, chat_history } = await req.json();

        const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
        console.log("Checking API Key: ", apiKey ? "Present" : "Missing");
        if (!apiKey) {
            return NextResponse.json(
                { error: "GEMINI_API_KEY is not defined" },
                { status: 500 }
            );
        }

        const genAI = new GoogleGenerativeAI(apiKey);

        const systemPrompt = `
        You are a Quant Interviewer at a top firm. 
        Problem: ${problem_text}
        Correct Solution: ${correct_solution}

        Task:
        1. Analyze the candidate's reasoning.
        2. VALIDATE their logic (is it sound? did they miss edge cases?).
        3. POINT OUT any fallacies or gaps.
        4. ASK a leading question to guide them closer to the answer or to a deeper understanding.
        5. DO NOT GIVE THE ANSWER.
        6. Keep your response concise (under 100 words) and conversational.
        `;

        const model = genAI.getGenerativeModel({
            model: "gemini-flash-latest", // Reverting to original working alias
            systemInstruction: systemPrompt
        });

        // Parse history for Gemini
        // chat_history from frontend: { role: 'user' | 'assistant', content: string }[]
        // Gemini expects: { role: 'user' | 'model', parts: [{ text: string }] }[]

        // We separate the last message effectively, as startChat takes history (previous turns)
        // and we send the new message content.

        const lastMessage = chat_history[chat_history.length - 1];
        const historyForGemini = chat_history.slice(0, -1).map((msg: any) => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
        }));

        const chat = model.startChat({
            history: historyForGemini,
        });

        const result = await chat.sendMessage(lastMessage.content);
        const feedback = result.response.text();

        return NextResponse.json({ feedback });
    } catch (error: any) {
        console.error("Error in Socratic Judge:", error);
        return NextResponse.json(
            { error: `Failed to generate feedback: ${error.message || error}` },
            { status: 500 }
        );
    }
}
