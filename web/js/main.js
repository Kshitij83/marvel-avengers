window.App = window.App || {};

App.state = {
  characters: [],
  movies: [],
  phases: [],
  trees: [],
  charactersById: {},
  moviesById: {},
  chatHistory: []
};

App.phaseColors = { 1: "#e62429", 2: "#f57c00", 3: "#9c27b0", 4: "#1e88e5", 5: "#43a047", 6: "#121212" };

App.qs = function (sel, root) {
  return (root || document).querySelector(sel);
};

App.qsa = function (sel, root) {
  return Array.from((root || document).querySelectorAll(sel));
};

App.esc = function (s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
};

App.emoji = function (c) {
  return c && c.emoji ? c.emoji : "🦸";
};

App.color = function (c) {
  return (c && c.color) || "#e62429";
};

App.imgFallback = function (img, color, emoji) {
  if (!img || !img.parentNode) return;
  if (img.dataset && img.dataset.fb) return;
  if (img.dataset) img.dataset.fb = "1";
  const c = color || (img.dataset ? img.dataset.color : "") || "#e62429";
  const e = emoji || (img.dataset ? img.dataset.emoji : "") || "⭐";
  const d = document.createElement("div");
  d.className = "img-placeholder " + (img.className || "");
  d.style.setProperty("--pc", c);
  d.textContent = e;
  img.replaceWith(d);
};

App.toast = function (msg, color) {
  const t = App.qs("#toast");
  t.textContent = msg;
  t.style.setProperty("--toast-c", color || "#ffd84d");
  t.hidden = false;
  clearTimeout(App._toastTimer);
  App._toastTimer = setTimeout(function () {
    t.hidden = true;
  }, 2800);
};

App.scrollToSection = function (id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  history.replaceState(null, "", "#" + id);
};

App.openCharacter = function (id) {
  if (typeof Characters !== "undefined") Characters.openCharacter(id);
};

App.openMovie = function (id) {
  if (typeof Timeline !== "undefined") Timeline.openMovie(id);
};

App.highlightMovie = function (id) {
  App.closeModal();
  App.scrollToSection("timeline");
  setTimeout(function () {
    if (typeof Timeline !== "undefined") Timeline.highlightMovie(id);
  }, 420);
};

App.openModal = function (html) {
  const m = App.qs("#modal");
  const p = App.qs("#modal-panel");
  p.innerHTML = html;
  m.hidden = false;
  document.body.style.overflow = "hidden";
  requestAnimationFrame(function () {
    m.classList.add("open");
    p.scrollTop = 0;
  });
  App.qs("#modal-backdrop").onclick = function () { App.closeModal(); };
  App.qsa("[data-close]", p).forEach(function (b) {
    b.addEventListener("click", function () { App.closeModal(); });
  });
  if (typeof App.bindModal === "function") App.bindModal();
  document.addEventListener("keydown", App._escKey);
};

App.closeModal = function () {
  const m = App.qs("#modal");
  if (m.hidden) return;
  m.classList.remove("open");
  document.body.style.overflow = "";
  document.removeEventListener("keydown", App._escKey);
  setTimeout(function () {
    m.hidden = true;
    App.qs("#modal-panel").innerHTML = "";
  }, 280);
};

App._escKey = function (e) {
  if (e.key === "Escape") App.closeModal();
};

App.bindModal = function () {};

App.buildSplash = function () {
  const t = App.qs("#splash-title");
  const text = "MARVEL AVENGERS";
  t.innerHTML = "";
  text.split("").forEach(function (ch, i) {
    const s = document.createElement("span");
    s.className = "splash-letter";
    s.textContent = ch === " " ? "\u00A0" : ch;
    if (ch === " ") s.style.width = "1.2em";
    else s.style.animationDelay = i * 60 + "ms";
    t.appendChild(s);
  });
  setTimeout(function () {
    const sp = App.qs("#splash");
    sp.classList.add("hide");
    setTimeout(function () { sp.hidden = true; }, 600);
  }, 1600);
};

App.initParticles = function () {
  const cv = App.qs("#fx-canvas");
  const ctx = cv.getContext("2d");
  const emojis = ["⭐", "✨", "💫", "🔥", "⚡", "🛡️", "⚔️", "🚀", "🕷️", "🌩️", "💥", "🔱", "👊", "🦸", "🎬"];
  let w, h;
  const resize = function () {
    w = cv.width = window.innerWidth;
    h = cv.height = window.innerHeight;
  };
  resize();
  window.addEventListener("resize", resize);
  const parts = Array.from({ length: 48 }, function () {
    return {
      x: Math.random() * w,
      y: Math.random() * h,
      r: 0.7 + Math.random() * 0.9,
      e: emojis[(Math.random() * emojis.length) | 0],
      vx: (Math.random() - 0.5) * 0.28,
      vy: -(0.08 + Math.random() * 0.32),
      o: 0.06 + Math.random() * 0.28,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.015
    };
  });
  const step = function () {
    ctx.clearRect(0, 0, w, h);
    parts.forEach(function (p) {
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      if (p.y < -24) { p.y = h + 24; p.x = Math.random() * w; }
      if (p.x < -24) p.x = w + 24;
      if (p.x > w + 24) p.x = -24;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = p.o;
      ctx.font = Math.round(p.r * 18) + "px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(p.e, 0, 0);
      ctx.restore();
    });
    requestAnimationFrame(step);
  };
  step();
};

App.animateHero = function () {
  App.qsa(".hero-line").forEach(function (line) {
    const txt = line.textContent;
    line.textContent = "";
    Array.from(txt).forEach(function (ch, i) {
      const s = document.createElement("span");
      s.className = "hero-letter";
      s.textContent = ch === " " ? "\u00A0" : ch;
      s.style.animationDelay = 0.35 + i * 0.06 + "s";
      line.appendChild(s);
    });
  });
  setTimeout(function () {
    App.qs(".hero-sub").classList.add("in");
  }, 1350);
  setTimeout(function () {
    App.qs("#assemble-btn").classList.add("in");
  }, 1550);
};

App.initNav = function () {
  const links = App.qsa(".nav-link");
  const ids = ["characters", "timeline", "family", "vs", "chat"];
  links.forEach(function (a) {
    a.addEventListener("click", function () {
      links.forEach(function (l) { l.classList.remove("active"); });
      a.classList.add("active");
    });
  });
  window.addEventListener("scroll", function () {
    let cur = "characters";
    ids.forEach(function (id) {
      const el = document.getElementById(id);
      if (!el) return;
      if (window.scrollY >= el.offsetTop - 220) cur = id;
    });
    links.forEach(function (l) {
      l.classList.toggle("active", l.getAttribute("href") === "#" + cur);
    });
  }, { passive: true });
};

App.initAssembleBtn = function () {
  App.qs("#assemble-btn").addEventListener("click", function () {
    if (typeof Characters !== "undefined") Characters.assemble();
    App.qs("#char-grid").scrollIntoView({ behavior: "smooth", block: "start" });
  });
};

App.renderLoading = function () {
  const g = App.qs("#char-grid");
  g.innerHTML = '<div class="loading-box">Hailing the Quinjet…</div>';
};

App.renderError = function () {
  const g = App.qs("#char-grid");
  g.innerHTML =
    '<div class="data-error">' +
    '<span class="data-error-emoji">📡</span>' +
    "<h3>RADAR DOWN</h3>" +
    "<p>The Avengers data feed is unreachable. Make sure the backend server is running at /api, then hit retry.</p>" +
    '<button class="comic-btn" onclick="location.reload()">RETRY</button>' +
    "</div>";
};

App.init = async function () {
  App.buildSplash();
  App.initNav();
  App.initParticles();
  setTimeout(App.animateHero, 1750);
  App.initAssembleBtn();
  App.renderLoading();
  try {
    const [chars, movies, trees] = await Promise.all([API.characters(), API.movies(), API.trees()]);
    App.state.characters = chars;
    App.state.phases = movies.phases;
    App.state.movies = movies.movies;
    App.state.trees = trees;
    App.state.charactersById = {};
    chars.forEach(function (c) { App.state.charactersById[c.id] = c; });
    App.state.moviesById = {};
    movies.movies.forEach(function (m) { App.state.moviesById[m.id] = m; });
    if (typeof Characters !== "undefined") Characters.init();
    if (typeof Timeline !== "undefined") Timeline.init();
    if (typeof Family !== "undefined") Family.init();
    if (typeof Vs !== "undefined") Vs.init();
    if (typeof Chat !== "undefined") Chat.init();
  } catch (err) {
    console.error(err);
    App.renderError();
  }
};
