"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createAccount, type FormState } from "./actions";

const input = "w-full rounded-lg border border-gray-300 px-3 py-2";

export default function CreateAccountForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createAccount, undefined);
  const [role, setRole] = useState("student");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="grid gap-4 sm:grid-cols-2">
      <div>
        <label className="mb-1 block text-sm font-medium">Name</label>
        <input name="displayName" required className={input} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Username</label>
        <input name="username" required autoCapitalize="none" className={input} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Password</label>
        <input name="password" type="text" required minLength={6} className={input} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Role</label>
        <select
          name="role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className={input}
        >
          <option value="student">Student</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      {role === "student" && (
        <div>
          <label className="mb-1 block text-sm font-medium">Level</label>
          <select name="level" defaultValue="JSS" className={input}>
            <option value="JSS">JSS (junior)</option>
            <option value="SS">SS (senior)</option>
          </select>
        </div>
      )}
      <div className="sm:col-span-2">
        <button
          disabled={pending}
          className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-60"
        >
          {pending ? "Creating..." : "Create account"}
        </button>
        {state?.error && <p className="mt-3 text-sm text-red-600">{state.error}</p>}
        {state?.ok && <p className="mt-3 text-sm text-green-700">{state.ok}</p>}
      </div>
    </form>
  );
}
