import { createClient } from "@/lib/supabase/server";
import CreateAccountForm from "./create-form";
import ResetPasswordForm from "./reset-form";

export default async function StudentsPage() {
  const supabase = await createClient();
  const { data: people } = await supabase
    .from("profiles")
    .select("id, username, display_name, role, level, created_at")
    .order("created_at", { ascending: true });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-brand-800">Students and accounts</h1>
        <p className="text-ink/60">Create logins for your cousins. They sign in with the username and password you set here.</p>
      </div>

      <section className="rounded-2xl border border-brand-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-bold">Create an account</h2>
        <CreateAccountForm />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">Accounts ({people?.length ?? 0})</h2>
        <ul className="space-y-3">
          {people?.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border border-brand-200 bg-white p-4 shadow-sm">
              <div className="min-w-[10rem] flex-1">
                <div className="font-bold">{p.display_name}</div>
                <div className="font-mono text-sm text-ink/60">{p.username}</div>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold">
                <span className={`rounded-full px-2.5 py-1 ${p.role === "admin" ? "bg-sun-300/70" : "bg-brand-100 text-brand-800"}`}>{p.role}</span>
                {p.level && <span className="rounded-full bg-brand-100 px-2.5 py-1 text-brand-800">{p.level}</span>}
              </div>
              <ResetPasswordForm userId={p.id} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}