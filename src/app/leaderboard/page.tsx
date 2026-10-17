import Link from "next/link";
import { requireProfile } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { lagosDate } from "@/lib/quiz/config";
import { finalizeOverdue } from "@/lib/quiz/finalize";
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

  const medal = (i: number) => (i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : String(i + 1));

  return (
    <main className="mx-auto max-w-xl px-6 py-10">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Leaderboard</h1>
        <span className="rounded-full bg-gray-100 px-3 py-1 text-sm">{level}</span>
      </div>
      <p className="mb-5 text-sm text-gray-600">
        {board === "today" && "Today's quiz: highest score wins, and a faster finish breaks a tie."}
        {board === "week" && "This week (Monday to Sunday): most points wins, so every quiz counts."}
        {board === "all" && "All time: best average score, once you have taken at least 3 quizzes."}
      </p>

      <div className="mb-5 flex gap-2">
        {BOARDS.map((b) => (
          <Link
            key={b.key}
            href={link({ board: b.key })}
            className={`rounded-full border px-4 py-1.5 text-sm ${b.key === board ? "border-blue-600 bg-blue-600 text-white" : "border-gray-300"}`}
          >
            {b.label}
          </Link>
        ))}
        {me.role === "admin" && (
          <Link href={link({ level: level === "JSS" ? "SS" : "JSS" })} className="ml-auto text-sm text-blue-700 underline">
            Show {level === "JSS" ? "SS" : "JSS"}
          </Link>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg bg-gray-50 p-4 text-sm text-gray-600">Nobody is on this board yet.</p>
      ) : (
        <ol className="space-y-2">
          {rows.map((r, i) => (
            <li
              key={r.userId}
              className={`flex items-center gap-4 rounded-xl border px-4 py-3 ${r.userId === me.id ? "border-blue-600 bg-blue-50" : "border-gray-200"}`}
            >
              <span className="w-8 text-center text-lg">{medal(i)}</span>
              <span className="flex-1 font-medium">
                {r.name}
                {r.userId === me.id && <span className="ml-2 text-xs text-blue-700">you</span>}
              </span>
              <span className="text-right">
                <span className="block font-semibold">{board === "week" ? `${r.points} pts` : `${r.avgPct}%`}</span>
                <span className="block text-xs text-gray-500">
                  {board === "today"
                    ? fmtTime(r.seconds)
                    : `${r.quizzes} quiz${r.quizzes === 1 ? "" : "zes"}${board === "week" ? ` · ${r.avgPct}% avg` : ""}`}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-8 text-sm">
        <Link href="/" className="text-blue-700 underline">
          Back home
        </Link>
      </div>
    </main>
  );
}