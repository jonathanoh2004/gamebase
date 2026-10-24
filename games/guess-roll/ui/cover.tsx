'use client';

/** Dev-only test game cover: a die and a question mark. */
export function GuessRollCover(_: { active: boolean }) {
  return (
    <div className="grid-paper flex h-full w-full items-center justify-center gap-4 bg-ink-2">
      <span className="flex size-16 items-center justify-center rounded-sm bg-teal font-extrabold text-3xl text-ink-0">
        ?
      </span>
      <span className="label">dev · runtime test</span>
    </div>
  );
}
