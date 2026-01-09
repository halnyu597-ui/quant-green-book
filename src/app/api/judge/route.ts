import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const { problem_text, user_reasoning, correct_solution } = await req.json();

        const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
        console.log("Checking API Key: ", apiKey ? "Present" : "Missing");
        if (!apiKey) {
            return NextResponse.json(
                { error: "GEMINI_API_KEY is not defined" },
                { status: 500 }
            );
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

        const prompt = `
        You are a Quant Interviewer at a top firm. 
        Problem: ${problem_text}
        Candidate's Reasoning: ${user_reasoning}
        Correct Solution: ${correct_solution}

        Task:
        1. Analyze the candidate's reasoning.
        2. VALIDATE their logic (is it sound? did they miss edge cases?).
        3. POINT OUT any fallacies or gaps.
        4. ASK a leading question to guide them closer to the answer or to a deeper understanding.
        5. DO NOT GIVE THE ANSWER.
        6. Keep your response concise (under 100 words) and conversational.
        `;

        const result = await model.generateContent(prompt);
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
