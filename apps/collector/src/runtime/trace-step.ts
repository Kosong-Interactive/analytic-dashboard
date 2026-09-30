/** Logs one storage step with its duration, so a stalled step is visible in the Actions log. */
export function traceStep<A extends unknown[], R>(
  event: string,
  step: string,
  fn: (...args: A) => Promise<R>,
): (...args: A) => Promise<R> {
  return async (...args) => {
    const started = Date.now();
    console.info(JSON.stringify({ event, step, status: "started" }));
    const result = await fn(...args);
    console.info(JSON.stringify({ event, step, status: "done", ms: Date.now() - started }));
    return result;
  };
}
