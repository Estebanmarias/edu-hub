"use client";

import { approveAll } from "./actions";

export default function ApproveAllButton({
  subject,
  level,
  total,
}: {
  subject: string;
  level: string;
  total: number;
}) {
  return (
    <form action={approveAll} className="ml-auto">
      <input type="hidden" name="subject" value={subject} />
      <input type="hidden" name="level" value={level} />
      <button
        className="rounded-lg bg-green-700 px-3 py-1.5 text-white"
        onClick={(e) => {
          if (
            !confirm(
              `Approve ALL ${total} waiting ${subject} ${level} questions? Only do this after checking a random sample.`
            )
          )
            e.preventDefault();
        }}
      >
        Approve all {total} waiting
      </button>
    </form>
  );
}
