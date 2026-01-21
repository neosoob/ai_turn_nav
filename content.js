(() => {
  const SIDEBAR_ID = "ai-turn-nav";
  const LIST_ID = "ai-turn-nav-list";

  function ensureSidebar() {
    let bar = document.getElementById(SIDEBAR_ID);
    if (bar) return bar;

    bar = document.createElement("div");
    bar.id = SIDEBAR_ID;
    bar.style.cssText = `
      position: fixed;
      right: 12px;
      top: 120px;
      width: 240px;
      max-height: calc(100vh - 160px);
      overflow: auto;
      z-index: 999999;
      background: rgba(20,20,20,0.85);
      color: #fff;
      border-radius: 12px;
      padding: 8px;
      font-size: 12px;
      backdrop-filter: blur(8px);
    `;
    bar.innerHTML = `
      <div style="font-weight:600;padding:6px 8px;">对话导航</div>
      <div id="${LIST_ID}"></div>
    `;
    document.body.appendChild(bar);
    return bar;
  }

  function getTurnArticles() {
    // 你给的 DOM 对应这个，非常稳
    const a = Array.from(document.querySelectorAll('article[data-testid^="conversation-turn-"]'));
    if (a.length) return a;

    // 兜底
    return Array.from(document.querySelectorAll("article[data-turn-id]"));
  }

  function buildTitle(article, idx) {
    const roleNode = article.querySelector("[data-message-author-role]");
    const role = roleNode?.getAttribute("data-message-author-role") || "msg";

    // 只用 user 做导航：你也可以改成 user+assistant
    if (role !== "user") return null;

    let text = (roleNode?.innerText || "").replace(/\s+/g, " ").trim();
    if (!text) text = "(空)";
    if (text.length > 50) text = text.slice(0, 50) + "…";

    return `${idx + 1}. 🧑 ${text}`;
  }

  function render() {
    ensureSidebar();
    const list = document.getElementById(LIST_ID);
    if (!list) return;

    const articles = getTurnArticles();
    list.innerHTML = "";

    const userArticles = [];
    for (let i = 0; i < articles.length; i++) {
      const title = buildTitle(articles[i], userArticles.length);
      if (!title) continue;

      userArticles.push(articles[i]);

      const item = document.createElement("div");
      item.textContent = title;
      item.style.cssText = `
        padding: 6px 8px;
        border-radius: 8px;
        cursor: pointer;
        line-height: 1.3;
        opacity: 0.9;
        margin: 2px 0;
      `;
      item.onmouseenter = () => (item.style.background = "rgba(255,255,255,0.12)");
      item.onmouseleave = () => (item.style.background = "transparent");

      item.addEventListener("click", () => {
        userArticles.forEach(a => a.removeAttribute("data-ai-nav-active"));
        articles[i].setAttribute("data-ai-nav-active", "1");

        articles[i].scrollIntoView({ behavior: "smooth", block: "start" });
      });

      list.appendChild(item);
    }

    // 高亮当前可见回合（可选增强）
    setupActiveHighlight(userArticles, list);
  }

  function setupActiveHighlight(userArticles, listEl) {
    // 断开旧的 observer
    if (window.__aiNavIO) {
      window.__aiNavIO.disconnect();
      window.__aiNavIO = null;
    }

    const children = Array.from(listEl.children);
    const io = new IntersectionObserver((entries) => {
      const visible = entries
        .filter(e => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (!visible) return;

      const idx = userArticles.indexOf(visible.target);
      children.forEach((c, i) => {
        c.style.background = (i === idx) ? "rgba(255,255,255,0.22)" : "transparent";
        c.style.opacity = (i === idx) ? "1" : "0.9";
      });
    }, { threshold: 0.2 });

    userArticles.forEach(a => io.observe(a));
    window.__aiNavIO = io;
  }

  function observe() {
    const mo = new MutationObserver(() => {
      clearTimeout(observe._t);
      observe._t = setTimeout(render, 250);
    });
    mo.observe(document.body, { subtree: true, childList: true });
  }

  render();
  observe();
})();
