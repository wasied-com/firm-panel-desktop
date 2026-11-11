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

  /**
   * The panel is healthy: /api/health answers {"status":"ok"} (the server allows this one route from any origin).
   * A proxy error page (502 while the server restarts), a timeout or a network failure keep the start page.
   */
  async function healthy(url) {
    const controller = new AbortController();
    const stop = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    try {
      const response = await fetch(new URL("/api/health", url), { cache: "no-store", signal: controller.signal });
      if (!response.ok) return false;
      const body = await response.json();
      return body !== null && body.status === "ok";
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
    if (await healthy(target)) {
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
