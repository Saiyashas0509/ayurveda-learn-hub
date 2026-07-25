import { describe, it, expect } from "vitest";
import { validateQuestions } from "./quiz-generation";

const goodQuestion = {
  prompt: "What is Vata dosha primarily associated with?",
  options: ["Air and space", "Fire and water", "Earth and water", "None of these"],
  correctIndex: 0,
};

describe("validateQuestions", () => {
  it("accepts a well-formed set of questions", () => {
    const result = validateQuestions({ questions: [goodQuestion, goodQuestion, goodQuestion] });
    expect(result).toHaveLength(3);
    expect(result![0].correctIndex).toBe(0);
  });

  it("rejects a non-object / missing questions array", () => {
    expect(validateQuestions(null)).toBeNull();
    expect(validateQuestions("just a string")).toBeNull();
    expect(validateQuestions({})).toBeNull();
    expect(validateQuestions({ questions: "not an array" })).toBeNull();
  });

  it("drops individual malformed questions but keeps the valid ones", () => {
    const missingPrompt = { ...goodQuestion, prompt: "" };
    const tooFewOptions = { ...goodQuestion, options: ["only one"] };
    const outOfRangeCorrectIndex = { ...goodQuestion, correctIndex: 9 };
    const result = validateQuestions({
      questions: [
        goodQuestion,
        missingPrompt,
        tooFewOptions,
        outOfRangeCorrectIndex,
        goodQuestion,
        goodQuestion,
      ],
    });
    expect(result).toHaveLength(3);
  });

  it("requires at least 3 valid questions to accept the whole set", () => {
    expect(validateQuestions({ questions: [goodQuestion, goodQuestion] })).toBeNull();
    expect(
      validateQuestions({ questions: [goodQuestion, goodQuestion, goodQuestion] }),
    ).not.toBeNull();
  });

  it("rejects an option list that isn't all strings", () => {
    const bad = { ...goodQuestion, options: ["fine", 42, "also fine", "ok"] };
    const result = validateQuestions({
      questions: [bad, goodQuestion, goodQuestion, goodQuestion],
    });
    expect(result).toHaveLength(3);
  });
});
