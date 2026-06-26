/**
 * Sample Learning Journey content. In production this comes from the Admin
 * Dashboard / CPN (content authoring is CPN's responsibility per the PRD);
 * here we bake two modules so the bot's quiz flow is fully exercisable.
 */
import type { ModuleContent } from "./cards/types.ts";

export const MODULES: ModuleContent[] = [
  {
    id: "module-1",
    title: "Building Customer Empathy",
    summary: "A short journey on listening, context, and service recovery.",
    track: "Customers",
    durationMin: 15,
    videoUrl: "https://www.centralpattana.co.th",
    outcome: "See how to stay focused on the customer's real need under pressure.",
    lesson: {
      heading: "Listen before you solve",
      body: "When a customer is upset, restate their need in your own words first. It signals you understand, and it surfaces the real problem before you act."
    },
    questions: [
      {
        id: "m1q1",
        number: 1,
        question: "A peak-hour tenant escalation is rising. What is the best next step?",
        options: [
          { key: "A", text: "Clarify the customer's most urgent need and align the team on recovery.", correct: true, explanation: "Leading with Customers means understanding the real need first, then aligning fast." },
          { key: "B", text: "Follow the standard queue and resolve it later." },
          { key: "C", text: "Escalate to leadership before understanding the issue." }
        ]
      },
      {
        id: "m1q2",
        number: 2,
        question: "A shopper says 'no one is helping me.' What do you do first?",
        options: [
          { key: "A", text: "Explain the store is busy and ask them to wait." },
          { key: "B", text: "Acknowledge the frustration and restate what they need.", correct: true, explanation: "Acknowledging first de-escalates and reveals the real need." },
          { key: "C", text: "Direct them to the information counter." }
        ]
      },
      {
        id: "m1q3",
        number: 3,
        question: "After resolving an issue, what builds lasting trust?",
        options: [
          { key: "A", text: "A quick follow-up to confirm it's truly resolved.", correct: true, explanation: "Following up shows you own the outcome, not just the transaction." },
          { key: "B", text: "Moving on to the next task immediately." },
          { key: "C", text: "Logging it and waiting for feedback." }
        ]
      }
    ]
  },
  {
    id: "module-2",
    title: "Solving With Impact",
    summary: "Scenario practice for decision-making under time pressure.",
    track: "Dynamism",
    durationMin: 12,
    videoUrl: "https://www.centralpattana.co.th",
    outcome: "Practice making a confident call when priorities and resources shift.",
    lesson: {
      heading: "Aim high, then act",
      body: "Dynamism is choosing the boldest option you can actually deliver — then moving. Decide the outcome first, then the smallest step that proves it."
    },
    questions: [
      {
        id: "m2q1",
        number: 1,
        question: "Two priorities collide and you can only ship one this week. You…",
        options: [
          { key: "A", text: "Pick the one with the highest customer impact and commit.", correct: true, explanation: "Aim high: choose the boldest deliverable outcome and own it." },
          { key: "B", text: "Split effort across both to keep everyone happy." },
          { key: "C", text: "Wait for your manager to decide." }
        ]
      },
      {
        id: "m2q2",
        number: 2,
        question: "A new idea could work but is unproven. Best first move?",
        options: [
          { key: "A", text: "Run a small, cheap test to prove it before scaling.", correct: true, explanation: "Entrepreneurial = create, but de-risk with the smallest proof first." },
          { key: "B", text: "Roll it out everywhere at once." },
          { key: "C", text: "Shelve it until it's certain." }
        ]
      }
    ]
  }
];

export function getModule(id: string): ModuleContent | undefined {
  return MODULES.find((m) => m.id === id);
}

export function firstAssignedModule(): ModuleContent {
  return MODULES[0]!;
}

export function nextModuleAfter(id: string): ModuleContent | null {
  const i = MODULES.findIndex((m) => m.id === id);
  return i >= 0 && i + 1 < MODULES.length ? MODULES[i + 1]! : null;
}
