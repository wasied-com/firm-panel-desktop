// Start page of the desktop shell. The shell (src-tauri/src/lib.rs) calls `firmPanel.phase` and `firmPanel.open`
// through `eval`: this page has no access to the shell, and the shell no access to the page beyond these two calls.
(() => {
  const RETRY_EVERY_S = 10;
  const PROBE_TIMEOUT_MS = 8000;
  let target = null;
  let timer = null;

  function phase(name) {
    document.body.dataset.phase = name;
    for (const node of document.querySelectorAll("[data-phase]")) node.hidden = node.dataset.phase !== name;
  }

  /** The panel answers: any HTTP answer counts, only a network failure or a timeout does not. */
  async function reachable(url) {
    const controller = new AbortController();
    const stop = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    try {
      await fetch(new URL("/api/health", url), { mode: "no-cors", cache: "no-store", signal: controller.signal });
      return true;
    } catch {
      return false;
    } finally {
      clearTimeout(stop);
    }
  }

  function countdown() {
    clearInterval(timer);
    let left = RETRY_EVERY_S;
    const label = document.querySelector("[data-countdown]");
    label.textContent = String(left);
    timer = setInterval(() => {
      left -= 1;
      label.textContent = String(Math.max(left, 0));
      if (left <= 0) attempt();
    }, 1000);
  }

  async function attempt() {
    clearInterval(timer);
    phase("connect");
    if (await reachable(target)) {
      window.location.replace(target);
      return;
    }
    phase("offline");
    countdown();
  }

  window.firmPanel = {
    phase,
    open(url) {
      target = url;
      attempt();
    },
  };

  document.querySelector("[data-retry]").addEventListener("click", () => attempt());
  phase("connect");
})();
