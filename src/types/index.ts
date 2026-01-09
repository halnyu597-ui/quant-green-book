export interface Question {
    id: string;
    title: string;
    problem_text: string;
    hint?: string;
    solution?: string;
    chapter: string;
    graph_url?: string;
}
