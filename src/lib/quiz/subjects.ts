export const SUBJECT_EMOJI: Record<string, string> = {
  math: "➗",
  english: "📖",
  biology: "🧬",
  chemistry: "🧪",
  physics: "⚡",
  livestock: "🐄",
  coding: "🤖",
  "3d": "🧊",
  geography: "🌍",
  civic: "🏛️",
  "further-maths": "📐",
};
export const subjectEmoji = (s: string) => SUBJECT_EMOJI[s] ?? "📚";