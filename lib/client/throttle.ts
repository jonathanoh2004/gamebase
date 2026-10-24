/** Runs `fn` at most once per `gap` ms; calls in between collapse into one trailing run. */
export function throttled(fn: () => void, gap: number) {
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const run = () => {
    timer = null;
    last = Date.now();
    fn();
  };
  return {
    call() {
      if (timer) return;
      const wait = last + gap - Date.now();
      if (wait <= 0) run();
      else timer = setTimeout(run, wait);
    },
    cancel() {
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}
