// The sync operation must be retry-safe. It can throw a non-retryable error
// for conflicts, missing credentials, or other conditions requiring a decision.
export function createSyncScheduler({ synchronize, onIssue, delay = 600000 }) {
  let timer;
  let running = false;
  let retryNotBefore = 0;
  let paused = false;
  let stopped = false;
  let failures = 0;

  function schedule(wait) {
    clearTimeout(timer);
    timer = setTimeout(run, Math.max(wait, retryNotBefore - Date.now()));
  }

  async function run() {
    if (running || paused || stopped) return;
    running = true;
    clearTimeout(timer);
    let wait = delay;
    try {
      if (await synchronize() !== false) {
        failures = 0;
        if (!stopped) onIssue(null);
        retryNotBefore = 0;
      }
    } catch (error) {
      paused = error?.retryable === false;
      failures += 1;
      wait = Math.min(delay * 2 ** Math.min(failures, 5), Math.max(delay, 3600000));
      const retryAfter = error?.retryAfter;
      if (typeof retryAfter === 'string' && retryAfter.trim()) {
        retryNotBefore = /^\d+$/.test(retryAfter.trim())
          ? Date.now() + Number(retryAfter) * 1000
          : Date.parse(retryAfter) || 0;
      }
      if (!stopped) onIssue({ error, requiresAction: paused });
    } finally {
      running = false;
      if (!paused && !stopped) schedule(wait);
    }
  }

  schedule(0);
  return {
    get running() { return running; },
    syncNow() {
      if (running || paused || stopped || Date.now() < retryNotBefore) return false;
      schedule(0);
      return true;
    },
    resume() {
      paused = false;
      if (!running && !stopped) schedule(0);
    },
    stop() {
      stopped = true;
      clearTimeout(timer);
    },
  };
}
