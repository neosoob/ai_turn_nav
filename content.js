(() => {
  const SIDEBAR_ID = "ai-turn-nav";
  const LIST_ID = "ai-turn-nav-list";
  const STYLE_ID = "ai-turn-nav-style";

  function ensureSidebar() {
    let bar = document.getElementById(SIDEBAR_ID);
    if (bar) return bar;

    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = `
        #${SIDEBAR_ID} {
          position: fixed;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          width: 240px;
          max-height: 70vh;
          overflow: auto;
          z-index: 999999;
          background: rgba(250, 250, 250, 0.92);
          color: #1f2328;
          border: 1px solid rgba(0, 0, 0, 0.08);
          border-radius: 12px;
          padding: 8px;
          font-size: 12px;
          backdrop-filter: blur(8px);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12);
        }
        #${SIDEBAR_ID} .ai-nav-title {
          font-weight: 600;
          padding: 6px 8px;
          color: #111;
        }
        #${SIDEBAR_ID} .ai-nav-item {
          padding: 6px 8px;
          border-radius: 8px;
          cursor: pointer;
          line-height: 1.3;
          opacity: 0.9;
          margin: 2px 0;
          transition: background 140ms ease, opacity 140ms ease;
        }
        #${SIDEBAR_ID} .ai-nav-item:hover {
          background: rgba(0, 0, 0, 0.06);
        }
        #${SIDEBAR_ID} .ai-nav-text {
          display: block;
          max-height: 80px;
          overflow: hidden;
          transition: opacity 160ms ease, max-height 200ms ease;
        }
        #${SIDEBAR_ID} .ai-nav-bar {
          display: block;
          height: 6px;
          border-radius: 999px;
          background: #c7cbd1;
          transition: opacity 160ms ease, height 200ms ease;
        }
        #${SIDEBAR_ID}:not(:hover) .ai-nav-text {
          opacity: 0;
          max-height: 0;
        }
        #${SIDEBAR_ID}:not(:hover) .ai-nav-bar {
          opacity: 1;
        }
        #${SIDEBAR_ID}:hover .ai-nav-text {
          opacity: 1;
          max-height: 80px;
        }
        #${SIDEBAR_ID}:hover .ai-nav-bar {
          opacity: 0;
          height: 0;
        }
      `;
      document.head.appendChild(style);
    }

    bar = document.createElement("div");
    bar.id = SIDEBAR_ID;
    bar.innerHTML = `
      <div class="ai-nav-title">????????????</div>
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
      item.className = "ai-nav-item";

      const text = document.createElement("span");
      text.className = "ai-nav-text";
      text.textContent = title;

      const barEl = document.createElement("span");
      barEl.className = "ai-nav-bar";

      item.appendChild(text);
      item.appendChild(barEl);

      item.addEventListener("click", () => {
        userArticles.forEach(a => a.removeAttribute("data-ai-nav-active"));
        articles[i].setAttribute("data-ai-nav-active", "1");

        // Freeze auto highlight briefly to avoid flicker after manual selection.
        window.__aiNavActiveIndex = userArticles.indexOf(articles[i]);
        window.__aiNavFreezeUntil = Date.now() + 1200;

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
    const inView = new Map();
    let activeIndex = Number.isInteger(window.__aiNavActiveIndex) ? window.__aiNavActiveIndex : -1;

    const applyActive = (idx) => {
      if (idx === -1) return;
      Array.from(listEl.children).forEach((c, i) => {
        c.style.background = (i === idx) ? "rgba(0, 0, 0, 0.08)" : "transparent";
        c.style.opacity = (i === idx) ? "1" : "0.9";
      });
    };

    applyActive(activeIndex);

    const io = new IntersectionObserver((entries) => {
      if (window.__aiNavFreezeUntil && Date.now() < window.__aiNavFreezeUntil) return;

      entries.forEach(entry => {
        inView.set(entry.target, entry.isIntersecting);
      });

      let nextIndex = -1;
      for (let i = 0; i < userArticles.length; i++) {
        if (inView.get(userArticles[i])) {
          nextIndex = i;
          break;
        }
      }
      if (nextIndex === activeIndex || nextIndex === -1) return;
      activeIndex = nextIndex;
      window.__aiNavActiveIndex = activeIndex;
      applyActive(activeIndex);
    }, { threshold: 0.35, rootMargin: "0px 0px -40% 0px" });

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
