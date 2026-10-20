"use client";

import { useActionState } from "react";
import Mascot from "@/components/mascot/Mascot";
import { signIn, type LoginState } from "./actions";

export default function LoginForm({ notice }: { notice?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(signIn, undefined);
  const mood = pending ? "thinking" : state?.error ? "sad" : "idle";

  return (
    <div className="w-full max-w-sm">
      <div className="mb-2 flex justify-center">
        <Mascot mood={mood} size={150} />
      </div>
      <h1 className="text-center text-3xl font-extrabold text-brand-800">Edu Hub</h1>
      <p className="mb-6 text-center text-ink/70">Sign in to take your quiz and study.</p>

      <form action={action} className="space-y-4 rounded-2xl border border-brand-200 bg-white p-6 shadow-sm">
        {notice && <p className="rounded-lg bg-sun-300/50 p-3 text-sm">{notice}</p>}
        <div>
          <label htmlFor="username" className="mb-1 block text-sm font-semibold">
            Username
          </label>
          <input
            id="username"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            required
            className="w-full rounded-xl border-2 border-brand-100 px-4 py-2.5 outline-none focus:border-brand-400"
          />
        </div>
        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-semibold">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="w-full rounded-xl border-2 border-brand-100 px-4 py-2.5 outline-none focus:border-brand-400"
          />
        </div>
        {state?.error && <p className="text-sm font-medium text-berry-600">{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-xl bg-brand-600 px-4 py-3 font-bold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}