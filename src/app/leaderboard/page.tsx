import Link from "next/link";
import { requireProfile } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { lagosDate } from "@/lib/quiz/config";
import { finalizeOverdue } from "@/lib/quiz/finalize";
import Mascot from "@/components/mascot/Mascot";
import StudentShell from "@/components/StudentShell";
import { allTimeBoard, lagosWeekStart, todayBoard, weekBoard, type BoardRow, type Session } from "@/lib/leaderboard";

type Search = { board?: string; level?: string };
const BOARDS = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "all", label: "All time" },
];

function fmtTime(seconds: number | null) {
  if (seconds === null) return "";
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`;
}

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const me = await requireProfile();
  const board = BOARDS.some((b) => b.key === sp.board) ? sp.board! : "today";
  // students always see their own level; the admin can look at either
  const level = me.role === "admin" ? (sp.level === "SS" ? "SS" : "JSS") : (me.level ?? "JSS");

  const admin = createAdminClient();
  await finalizeOverdue(admin); // score quizzes that were abandoned after their time ran out

  const { data: students } = await admin.from("profiles").select("id, display_name").eq("role", "student").eq("level", level);
  const names = new Map((students ?? []).map((s) => [s.id as string, s.display_name as string]));
  const ids = [...names.keys()];

  let sessions: Session[] = [];
  if (ids.length) {
    const { data } = await admin
      .from("quiz_sessions")
      .select("user_id, quiz_date, score, total_questions, started_at, finished_at")
      .eq("status", "submitted")
      .in("user_id", ids);
    sessions = (data ?? [])
      .filter((s) => s.total_questions && s.score !== null)
      .map((s) => ({
        userId: s.user_id as string,
        quizDate: s.quiz_date as string,
        score: s.score as number,
        total: s.total_questions as number,
        seconds: s.finished_at ? Math.round((Date.parse(s.finished_at) - Date.parse(s.started_at)) / 1000) : null,
      }));
  }

  const today = lagosDate();
  const rows: BoardRow[] =
    board === "week"
      ? weekBoard(sessions, names, lagosWeekStart())
      : board === "all"
        ? allTimeBoard(sessions, names)
        : todayBoard(sessions, names, today);

  const link = (patch: Search) => {
    const qs = new URLSearchParams();
    const merged = { board, ...(me.role === "admin" ? { level } : {}), ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) qs.set(k, v);
    return `/leaderboard?${qs.toString()}`;
  };

  const top = rows.slice(0, 3);
  const rest = rows.slice(3);
  const valueOf = (r: BoardRow) => (board === "week" ? `${r.points} pts` : `${r.avgPct}%`);
  const subOf = (r: BoardRow) =>
    board === "today" ? fmtTime(r.seconds) : `${r.quizzes} quiz${r.quizzes === 1 ? "" : "zes"}${board === "week" ? ` · ${r.avgPct}% avg` : ""}`;
  // podium order: 2nd, 1st, 3rd
  const podium = [top[1], top[0], top[2]].map((r, i) => ({ r, place: [2, 1, 3][i], h: ["h-24", "h-32", "h-20"][i] }));

  return (
    <StudentShell name={me.display_name}>
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-brand-800">Leaderboard</h1>
        <span className="rounded-full bg-brand-100 px-3 py-1 text-sm font-bold text-brand-800">{level}</span>
      </div>
      <p className="mb-4 text-sm text-ink/65">
        {board === "today" && "Today's quiz: highest score wins, and a faster finish breaks a tie."}
        {board === "week" && "This week (Monday to Sunday): most points wins, so every quiz counts."}
        {board === "all" && "All time: best average score, once you have taken at least 3 quizzes."}
      </p>

      <div className="mb-5 flex gap-2">
        {BOARDS.map((b) => (
          <Link
            key={b.key}
            href={link({ board: b.key })}
            className={`rounded-full border-2 px-4 py-1.5 text-sm font-bold ${b.key === board ? "border-brand-600 bg-brand-600 text-white" : "border-brand-200 bg-white"}`}
          >
            {b.label}
          </Link>
        ))}
        {me.role === "admin" && (
          <Link href={link({ level: level === "JSS" ? "SS" : "JSS" })} className="ml-auto text-sm text-brand-700 underline">
            Show {level === "JSS" ? "SS" : "JSS"}
          </Link>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-brand-200 bg-white p-8 text-center shadow-sm">
          <Mascot mood="sleepy" size={110} />
          <p className="mt-3 font-semibold">Nobody is on this board yet.</p>
          <p className="text-sm text-ink/60">Take today&apos;s quiz and be the first!</p>
        </div>
      ) : (
        <>
          <div className="mb-5 flex items-end justify-center gap-3 rounded-3xl bg-linear-to-b from-brand-100 to-white px-3 pt-6">
            {podium.map(({ r, place, h }) =>
              r ? (
                <div key={r.userId} className="flex w-1/3 max-w-[9rem] flex-col items-center text-center">
                  <div className="mb-1 text-2xl">{place === 1 ? "🥇" : place === 2 ? "🥈" : "🥉"}</div>
                  <div className={`w-full truncate text-sm font-bold ${r.userId === me.id ? "text-brand-700" : ""}`}>{r.name}</div>
                  <div className="text-xs text-ink/60">{valueOf(r)}</div>
                  <div className={`mt-2 w-full rounded-t-xl ${h} ${place === 1 ? "bg-sun-400" : "bg-brand-300"} flex items-start justify-center pt-2 text-lg font-extrabold`}>
                    {place}
                  </div>
                </div>
              ) : (
                <div key={place} className="w-1/3 max-w-[9rem]" />
              ),
            )}
          </div>

          {rest.length > 0 && (
            <ol className="space-y-2">
              {rest.map((r, i) => (
                <li
                  key={r.userId}
                  className={`flex items-center gap-4 rounded-xl border-2 px-4 py-3 ${r.userId === me.id ? "border-brand-500 bg-brand-50" : "border-brand-100 bg-white"}`}
                >
                  <span className="w-8 text-center font-bold text-ink/60">{i + 4}</span>
                  <span className="flex-1 font-semibold">
                    {r.name}
                    {r.userId === me.id && <span className="ml-2 text-xs font-bold text-brand-700">you</span>}
                  </span>
                  <span className="text-right">
                    <span className="block font-bold">{valueOf(r)}</span>
                    <span className="block text-xs text-ink/55">{subOf(r)}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </StudentShell>
  );
}