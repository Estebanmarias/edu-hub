import { createClient } from "@/lib/supabase/server";
import CreateAccountForm from "./create-form";
import ResetPasswordForm from "./reset-form";

export default async function StudentsPage() {
  const supabase = await createClient(); // row-level security lets admins read every profile
  const { data: people } = await supabase
    .from("profiles")
    .select("id, username, display_name, role, level, created_at")
    .order("created_at", { ascending: true });

  return (
    <div className="space-y-10">
      <section>
        <h1 className="mb-4 text-xl font-bold">Create an account</h1>
        <CreateAccountForm />
      </section>

      <section>
        <h2 className="mb-4 text-xl font-bold">Accounts ({people?.length ?? 0})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 text-gray-600">
              <tr>
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Username</th>
                <th className="py-2 pr-4">Role</th>
                <th className="py-2 pr-4">Level</th>
                <th className="py-2">Password</th>
              </tr>
            </thead>
            <tbody>
              {people?.map((p) => (
                <tr key={p.id} className="border-b border-gray-100">
                  <td className="py-2 pr-4">{p.display_name}</td>
                  <td className="py-2 pr-4 font-mono">{p.username}</td>
                  <td className="py-2 pr-4">{p.role}</td>
                  <td className="py-2 pr-4">{p.level ?? "-"}</td>
                  <td className="py-2">
                    <ResetPasswordForm userId={p.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
