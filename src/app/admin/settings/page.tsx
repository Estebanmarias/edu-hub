import { COMPULSORY, ELECTIVE_COUNT } from "@/lib/quiz/config";
import { getQuizSettings } from "@/lib/quiz/settings";
import SettingsForm from "./settings-form";

export default async function SettingsPage() {
  const settings = await getQuizSettings();
  return (
    <div>
      <h1 className="text-2xl font-extrabold text-brand-800">Quiz settings</h1>
      <p className="mb-5 text-ink/60">How long and how big the daily quiz is. Changes apply to quizzes started from now on.</p>
      <div className="max-w-lg rounded-2xl border border-brand-200 bg-white p-5 shadow-sm">
        <SettingsForm
          questionsPerSubject={settings.questionsPerSubject}
          durationMinutes={settings.durationMinutes}
          subjectsPerQuiz={COMPULSORY.length + ELECTIVE_COUNT}
        />
      </div>
    </div>
  );
}