const Characters = (function () {
  let grid;
  let assembled = false;
  let gridObserved = false;

  function init() {
    grid = App.qs("#char-grid");
    renderGrid();
    observeAutoAssemble();
  }

  function card(c) {
    const color = App.color(c);
    const tag = c.personality || "HERO";
    const move = c.specialMove || "SPECIAL MOVE";
    return (
      '<button class="char-card" data-id="' + App.esc(c.id) + '" style="--c:' + App.esc(color) + '" onclick="Characters.playSpecialMove(\'' + App.esc(c.id) + '\')">' +
      '<div class="char-burst">✦</div>' +
      '<div class="char-avatar">' +
      '<img src="/images/characters/' + App.esc(c.id) + '.jpg" alt="' + App.esc(c.name) + '" loading="lazy" data-emoji="' + App.esc(App.emoji(c)) + '" data-color="' + App.esc(color) + '" onerror="App.imgFallback(this)">' +
      "</div>" +
      '<div class="char-name">' + App.esc(c.name) + "</div>" +
      '<div class="char-tag">' + App.esc(tag) + "</div>" +
      '<div class="char-move">' + App.esc(move) + "</div>" +
      "</button>"
    );
  }

  function renderGrid() {
    if (!App.state.characters.length) {
      grid.innerHTML = '<div class="loading-box">Waiting for roster…</div>';
      return;
    }
    grid.innerHTML = App.state.characters.map(card).join("");
    App.qsa(".char-card", grid).forEach(function (el) {
      el.addEventListener("mousemove", tilt);
      el.addEventListener("mouseleave", untilt);
    });
  }

  function observeAutoAssemble() {
    if (gridObserved) return;
    gridObserved = true;
    if (!("IntersectionObserver" in window)) { assemble(); return; }
    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          assemble();
          io.disconnect();
        }
      });
    }, { threshold: 0.12 });
    io.observe(grid);
  }

  function assemble() {
    assembled = true;
    const cards = App.qsa(".char-card", grid);
    cards.forEach(function (el) {
      el.classList.remove("in");
    });
    void grid.offsetWidth;
    cards.forEach(function (el, i) {
      setTimeout(function () {
        el.classList.add("in");
      }, 55 * i);
    });
  }

  function tilt(e) {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform =
      "perspective(900px) rotateX(" + (-y * 14) + "deg) rotateY(" + (x * 16) + "deg) translateY(-6px)";
  }

  function untilt(e) {
    e.currentTarget.style.transform = "";
  }

  function openCharacter(id) {
    const c = App.state.charactersById[id];
    if (!c) return;
    const color = App.color(c);
    const powers = (c.powers || []).map(function (p) {
      return typeof p === "object" ? p : { name: p };
    });
    const partners = (c.partners || []).map(function (p) {
      return typeof p === "object" ? p : { id: p, name: p };
    });
    const appearances = (c.appearances || []).map(function (mid) {
      return App.state.moviesById[mid];
    }).filter(Boolean);

    const tabs = [
      ["powers", "⚡ POWERS", powersPane(powers)],
      ["partners", "🤝 PARTNERS", partnersPane(partners)],
      ["appearances", "🎬 APPEARANCES", appearancesPane(appearances)],
      ["origin", "📖 ORIGIN", originPane(c)]
    ];
    const nav = tabs.map(function (t, i) {
      return '<button class="tab-btn' + (i === 0 ? " active" : "") + '" data-tab="' + t[0] + '">' + t[1] + "</button>";
    }).join("");
    const body = tabs.map(function (t, i) {
      return '<div class="tab-pane' + (i === 0 ? " active" : "") + '" data-pane="' + t[0] + '">' + t[2] + "</div>";
    }).join("");

    const html =
      '<div class="char-modal" style="--c:' + App.esc(color) + '">' +
      '<button class="modal-x" data-close>✕</button>' +
      '<div class="cm-top">' +
      '<div class="cm-avatar">' +
      '<img src="/images/characters/' + App.esc(c.id) + '.jpg" alt="' + App.esc(c.name) + '" data-emoji="' + App.esc(App.emoji(c)) + '" data-color="' + App.esc(color) + '" onerror="App.imgFallback(this)">' +
      "</div>" +
      '<div class="cm-info">' +
      '<div class="cm-emoji">' + App.emoji(c) + "</div>" +
      '<h3 class="cm-name">' + App.esc(c.name) + "</h3>" +
      '<div class="cm-real">' + App.esc(c.realName || "") + "</div>" +
      '<div class="cm-pill">' + App.esc(c.personality || "HERO") + "</div>" +
      '<div class="cm-quote">"' + App.esc(c.quote || "") + '"</div>' +
      "</div>" +
      "</div>" +
      '<div class="tab-nav">' + nav + "</div>" +
      '<div class="tab-body">' + body + "</div>" +
      '<div class="catchphrase">' + App.esc(c.catchphrase || "Excelsior!") + "</div>" +
      "</div>";
    App.bindModal = bindModal;
    App.openModal(html);
  }

  function powersPane(powers) {
    const icons = ["⚡", "🔥", "💥", "🛡️", "🌀", "❄️", "🕸️", "🌌", "🔨", "🗡️", "👊", "🚀", "🧠", "⚙️", "🌊"];
    const items = powers.map(function (p, i) {
      const nm = typeof p.name === "string" ? p.name : JSON.stringify(p);
      return '<li><span class="power-ico">' + icons[i % icons.length] + "</span>" + App.esc(nm) + "</li>";
    }).join("");
    return '<ul class="power-list">' + (items || "<li>Classified powers.</li>") + "</ul>";
  }

  function partnersPane(partners) {
    const items = partners.map(function (p) {
      const partner = App.state.charactersById[p.id];
      if (partner) {
        return (
          '<button class="chip" style="--c:' + App.esc(App.color(partner)) + '" onclick="App.openCharacter(\'' + App.esc(partner.id) + '\')">' +
          '<span class="chip-emoji">' + App.emoji(partner) + "</span>" + App.esc(partner.name) +
          "</button>"
        );
      }
      return '<span class="chip" style="--c:#8892c4">' + App.esc(p.name || p.id || "?") + "</span>";
    }).join("");
    return '<div class="chip-row">' + (items || "<span>No known partners.</span>") + "</div>";
  }

  function appearancesPane(movies) {
    const items = movies.map(function (m) {
      return (
        '<button class="chip" style="--c:' + App.esc(App.phaseColors[m.phase] || "#e62429") + '" onclick="App.highlightMovie(\'' + App.esc(m.id) + '\')">' +
        "🎬 " + App.esc(m.title) + " · " + App.esc(m.year) +
        "</button>"
      );
    }).join("");
    return '<div class="chip-row">' + (items || "<span>No appearances recorded.</span>") + "</div>";
  }

  function originPane(c) {
    return (
      '<div class="origin-block">' +
      "<p>" + App.esc(c.origin || "Origin classified.") + "</p>" +
      '<ul class="origin-facts">' +
      "<li><b>FIRST APPEARANCE</b>" + App.esc(c.firstAppearance || "Unknown") + "</li>" +
      "<li><b>ALIASES</b>" + App.esc((c.aliases || []).join(", ") || "None") + "</li>" +
      "<li><b>PERSONALITY</b>" + App.esc(c.personalityDesc || c.personality || "Heroic") + "</li>" +
      "</ul>" +
      "</div>"
    );
  }

  function bindModal() {
    App.qsa(".tab-btn").forEach(function (b) {
      b.addEventListener("click", function () {
        App.qsa(".tab-btn").forEach(function (x) { x.classList.remove("active"); });
        App.qsa(".tab-pane").forEach(function (x) { x.classList.remove("active"); });
        b.classList.add("active");
        const pane = App.qs('.tab-pane[data-pane="' + b.dataset.tab + '"]');
        if (pane) pane.classList.add("active");
      });
    });
  }

  function el(tag, cls, txt) {
    const d = document.createElement(tag);
    d.className = cls;
    if (txt != null) d.textContent = txt;
    return d;
  }

  function playSpecialMove(id) {
    const c = App.state.charactersById[id];
    if (!c) return;
    const ov = App.qs("#special");
    const color = App.color(c);
    ov.style.setProperty("--fx-c", color);
    ov.innerHTML = "";
    const style = c.specialMoveStyle || "chaos";
    ov.append(el("div", "fx-flash"), el("div", "fx-burst"));
    const avatar = el("img", "fx-avatar");
    avatar.src = "/images/characters/" + c.id + ".jpg";
    avatar.alt = c.name;
    avatar.dataset.emoji = App.emoji(c);
    avatar.dataset.color = color;
    avatar.onerror = function () {
      App.imgFallback(avatar);
      const holder = App.qs(".fx-avatar");
      if (holder && holder.tagName === "DIV") holder.style.fontSize = "min(44vmin, 340px)";
    };
    ov.append(avatar);
    ov.append(el("div", "fx-name", (c.name || "HERO").toUpperCase()));
    ov.append(el("div", "fx-move", (c.specialMove || "SPECIAL MOVE") + "!"));
    addFx(ov, style, color);
    ov.hidden = false;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { ov.classList.add("active"); });
    });
    setTimeout(function () {
      ov.classList.remove("active");
      setTimeout(function () {
        ov.hidden = true;
        ov.innerHTML = "";
        openCharacter(id);
      }, 360);
    }, 2350);
  }

  function addFx(ov, style, color) {
    const styles = {
      web: webFx,
      lightning: boltFx,
      fire: fireFx,
      frost: frostFx,
      shield: shieldFx,
      chaos: chaosFx,
      spin: spinFx,
      shadow: shadowFx
    };
    (styles[style] || chaosFx)(ov, color);
  }

  function webFx(ov) {
    for (let i = 0; i < 14; i++) {
      const s = el("div", "beam web-strand");
      s.style.setProperty("--rot", (i * 360) / 14 + "deg");
      ov.appendChild(s);
    }
    for (let i = 0; i < 30; i++) {
      const d = el("div", "web-dot");
      d.style.left = Math.random() * 100 + "%";
      d.style.top = Math.random() * 100 + "%";
      d.style.animationDelay = Math.random() * 0.8 + "s";
      ov.appendChild(d);
    }
  }

  function boltFx(ov) {
    for (let i = 0; i < 9; i++) {
      const b = el("div", "beam bolt");
      b.style.left = Math.random() * 100 + "%";
      b.style.setProperty("--dy", (Math.random() * 140 - 70).toFixed(0) + "px");
      b.style.setProperty("--sd", (Math.random() * 0.5).toFixed(2) + "s");
      ov.appendChild(b);
    }
  }

  function fireFx(ov, color) {
    for (let i = 0; i < 18; i++) {
      const f = el("div", "beam flame");
      f.style.left = Math.random() * 100 + "%";
      f.style.setProperty("--sd", (Math.random() * 0.6).toFixed(2) + "s");
      f.style.setProperty("--sc", (Math.random() * 0.7 + 0.3).toFixed(2));
      f.style.backgroundColor = color;
      ov.appendChild(f);
    }
  }

  function frostFx(ov) {
    for (let i = 0; i < 20; i++) {
      const s = el("div", "beam shard");
      s.style.left = Math.random() * 100 + "%";
      s.style.top = Math.random() * 55 + "%";
      s.style.setProperty("--sd", (Math.random() * 0.7).toFixed(2) + "s");
      s.style.setProperty("--rot", (Math.random() * 360).toFixed(0) + "deg");
      ov.appendChild(s);
    }
  }

  function shieldFx(ov) {
    for (let i = 0; i < 5; i++) {
      const r = el("div", "beam ring");
      r.style.setProperty("--sd", (i * 0.14).toFixed(2) + "s");
      ov.appendChild(r);
    }
    for (let i = 0; i < 12; i++) {
      const a = el("div", "beam shield-arc");
      a.style.setProperty("--rot", (i * 30).toFixed(0) + "deg");
      ov.appendChild(a);
    }
  }

  function chaosFx(ov) {
    for (let i = 0; i < 12; i++) {
      const w = el("div", "beam wisp");
      w.style.setProperty("--rot", (i * 30).toFixed(0) + "deg");
      w.style.setProperty("--sd", (Math.random() * 0.5).toFixed(2) + "s");
      ov.appendChild(w);
    }
  }

  function spinFx(ov) {
    ov.appendChild(el("div", "beam spin-ring"));
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2;
      const s = el("div", "spin-star");
      s.style.left = (50 + Math.cos(a) * 40).toFixed(1) + "%";
      s.style.top = (50 + Math.sin(a) * 40).toFixed(1) + "%";
      s.style.setProperty("--sd", (i * 0.03).toFixed(2) + "s");
      ov.appendChild(s);
    }
  }

  function shadowFx(ov) {
    for (let i = 0; i < 16; i++) {
      const p = el("div", "beam puff");
      p.style.left = Math.random() * 100 + "%";
      p.style.setProperty("--sd", (Math.random() * 0.7).toFixed(2) + "s");
      p.style.setProperty("--sc", (Math.random() * 0.6 + 0.3).toFixed(2));
      ov.appendChild(p);
    }
  }

  return {
    init: init,
    assemble: assemble,
    openCharacter: openCharacter,
    playSpecialMove: playSpecialMove
  };
})();
