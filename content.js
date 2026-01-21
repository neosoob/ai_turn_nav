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
          background: transparent;
          color: #1f2328;
          border: none;
          border-radius: 0;
          padding: 0;
          font-size: 12px;
          backdrop-filter: none;
          box-shadow: none;
        }
        #${SIDEBAR_ID} .ai-nav-item {
          padding: 6px 8px;
          border-radius: 8px;
          cursor: pointer;
          line-height: 1.3;
          opacity: 0.9;
          margin: 2px 0;
        }
        #${SIDEBAR_ID} .ai-nav-item[data-active="1"] {
          background: transparent;
          opacity: 1;
        }
        #${SIDEBAR_ID} .ai-nav-item:not([data-active="1"]):hover {
          background: transparent;
        }
        #${SIDEBAR_ID} .ai-nav-text {
          display: block;
          max-height: 80px;
          overflow: hidden;
          color: inherit;
        }
        #${SIDEBAR_ID} .ai-nav-item[data-active="1"] .ai-nav-text {
          color: #1f6feb;
          font-weight: 600;
        }
        #${SIDEBAR_ID} .ai-nav-bar {
          display: block;
          height: 6px;
          width: 26px;
          border-radius: 999px;
          background: #c7cbd1;
        }
        #${SIDEBAR_ID}:not(:hover) {
          width: 40px;
          padding: 0;
        }
        #${SIDEBAR_ID}:not(:hover) .ai-nav-item {
          padding: 6px 4px;
        }
        #${SIDEBAR_ID}:not(:hover) .ai-nav-bar {
          opacity: 1;
          margin: 2px auto;
        }
        #${SIDEBAR_ID}:not(:hover) .ai-nav-text {
          opacity: 0;
          max-height: 0;
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
    if (!text) text = "(empty)";
    if (text.length > 50) text = text.slice(0, 50) + "...";

    return `${idx + 1}. ${text}`;
  }

  function render() {
    ensureSidebar();
    const list = document.getElementById(LIST_ID);
    if (!list) return;

    const activeIndex = Number.isInteger(window.__aiNavActiveIndex) ? window.__aiNavActiveIndex : -1;

    const articles = getTurnArticles();
    const titles = [];
    const userArticles = [];

    for (let i = 0; i < articles.length; i++) {
      const title = buildTitle(articles[i], userArticles.length);
      if (!title) continue;
      titles.push(title);
      userArticles.push(articles[i]);
    }

    const existingItems = Array.from(list.children);
    const shouldRebuild = existingItems.length !== titles.length || existingItems.some((el, idx) => el.dataset.title !== titles[idx]);
    if (!shouldRebuild) {
      setupActiveHighlight(userArticles, list);
      return;
    }

    list.innerHTML = "";

    for (let i = 0; i < titles.length; i++) {
      const title = titles[i];
      const article = userArticles[i];

      const item = document.createElement("div");
      item.className = "ai-nav-item";
      item.dataset.title = title;
      if (i === activeIndex) item.setAttribute("data-active", "1");

      const text = document.createElement("span");
      text.className = "ai-nav-text";
      text.textContent = title;

      const barEl = document.createElement("span");
      barEl.className = "ai-nav-bar";

      item.appendChild(text);
      item.appendChild(barEl);

      item.addEventListener("click", () => {
        userArticles.forEach(a => a.removeAttribute("data-ai-nav-active"));
        article.setAttribute("data-ai-nav-active", "1");

        // Freeze auto highlight briefly to avoid flicker after manual selection.
        window.__aiNavActiveIndex = userArticles.indexOf(article);
        window.__aiNavFreezeUntil = Date.now() + 1200;

        article.scrollIntoView({ behavior: "smooth", block: "start" });
      });

      list.appendChild(item);
    }

    // ??????????????????????????????????????????
    setupActiveHighlight(userArticles, list);
  }

  function setupActiveHighlight(userArticles, listEl) {
    window.__aiNavItems = userArticles;
    window.__aiNavListEl = listEl;

    const applyActive = (idx) => {
      Array.from(listEl.children).forEach((c, i) => {
        if (i === idx) {
          c.setAttribute("data-active", "1");
        } else {
          c.removeAttribute("data-active");
        }
      });
    };

    const computeActive = () => {
      const items = window.__aiNavItems || [];
      if (!items.length) return -1;

      let nextIndex = -1;
      let minBelow = Number.POSITIVE_INFINITY;
      let maxAbove = Number.NEGATIVE_INFINITY;
      let aboveIndex = -1;

      for (let i = 0; i < items.length; i++) {
        const rect = items[i].getBoundingClientRect();
        if (rect.top >= 0 && rect.top < minBelow) {
          minBelow = rect.top;
          nextIndex = i;
        } else if (rect.top < 0 && rect.top > maxAbove) {
          maxAbove = rect.top;
          aboveIndex = i;
        }
      }

      if (nextIndex === -1) nextIndex = aboveIndex;
      return nextIndex;
    };

    if (!window.__aiNavScrollHandler) {
      window.__aiNavScrollHandler = () => {
        if (window.__aiNavFreezeUntil && Date.now() < window.__aiNavFreezeUntil) return;
        const idx = computeActive();
        if (idx === -1 || idx === window.__aiNavActiveIndex) return;
        window.__aiNavActiveIndex = idx;
        applyActive(idx);
      };
      window.addEventListener("scroll", window.__aiNavScrollHandler, { passive: true });
      window.addEventListener("resize", window.__aiNavScrollHandler);
    }

    const currentIndex = Number.isInteger(window.__aiNavActiveIndex) ? window.__aiNavActiveIndex : -1;
    if (currentIndex !== -1) applyActive(currentIndex);
    window.__aiNavScrollHandler();
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
