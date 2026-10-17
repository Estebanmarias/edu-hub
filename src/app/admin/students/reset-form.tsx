"use client";

import { useActionState } from "react";
import { resetPassword, type FormState } from "./actions";

export default function ResetPasswordForm({ userId }: { userId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(resetPassword, undefined);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <input
        name="password"
        placeholder="New password"
        required
        minLength={6}
        className="w-32 rounded border border-gray-300 px-2 py-1 text-sm"
      />
      <button disabled={pending} className="rounded border border-gray-300 px-2 py-1 text-sm disabled:opacity-60">
        {pending ? "..." : "Reset"}
      </button>
      {state?.error && <span className="text-xs text-red-600">{state.error}</span>}
      {state?.ok && <span className="text-xs text-green-700">{state.ok}</span>}
    </form>
  );
}
