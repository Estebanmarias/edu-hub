import { COMPULSORY, ELECTIVE_COUNT } from "@/lib/quiz/config";
import { getQuizSettings } from "@/lib/quiz/settings";
import SettingsForm from "./settings-form";

export default async function SettingsPage() {
  const settings = await getQuizSettings();
  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">Quiz settings</h1>
      <SettingsForm
        questionsPerSubject={settings.questionsPerSubject}
        durationMinutes={settings.durationMinutes}
        subjectsPerQuiz={COMPULSORY.length + ELECTIVE_COUNT}
      />
    </div>
  );
}