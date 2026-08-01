const Timeline = (function () {
  let track;
  let scroll;

  const NODE_W = 250;

  function init() {
    track = App.qs("#tl-track");
    scroll = App.qs("#tl-scroll");
    enableDrag();
    render();
  }

  function enableDrag() {
    let down = false;
    let moved = 0;
    let startX = 0;
    let startL = 0;
    scroll.addEventListener("mousedown", function (e) {
      down = true;
      moved = 0;
      startX = e.pageX;
      startL = scroll.scrollLeft;
    });
    window.addEventListener("mousemove", function (e) {
      if (!down) return;
      const dx = e.pageX - startX;
      if (Math.abs(dx) > Math.abs(moved)) moved = dx;
      scroll.scrollLeft = startL - dx;
    });
    window.addEventListener("mouseup", function () {
      down = false;
    });
    scroll.addEventListener("click", function (e) {
      if (Math.abs(moved) > 10) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);
  }

  function phaseColor(m) {
    return App.phaseColors[m.phase] || "#888";
  }

  function render() {
    const movies = App.state.movies;
    if (!movies.length) {
      track.innerHTML = "";
      scroll.innerHTML = '<div class="loading-box">No movies on the radar yet…</div>';
      return;
    }
    track.style.width = movies.length * NODE_W + 200 + "px";
    const phaseSpan = {};
    movies.forEach(function (m, i) {
      const ph = m.phase;
      if (!phaseSpan[ph]) phaseSpan[ph] = [i, i];
      else phaseSpan[ph][1] = i;
    });

    let html = '<div class="tl-spine"></div>';
    Object.keys(phaseSpan).forEach(function (ph) {
      const a = phaseSpan[ph][0];
      const b = phaseSpan[ph][1];
      const left = a * NODE_W + 100;
      const width = (b - a + 1) * NODE_W;
      const col = App.phaseColors[ph] || "#333";
      html +=
        '<div class="tl-phase" style="--pc:' + App.esc(col) + ";left:" + left + "px;width:" + width + 'px"><span>PHASE ' + App.esc(ph) + "</span></div>";
    });

    movies.forEach(function (m, i) {
      const top = i % 2 === 0;
      html +=
        '<button class="tl-node ' + (top ? "top" : "bottom") + '" data-id="' + App.esc(m.id) + '" style="left:' + (i * NODE_W + 100) + 'px" onclick="Timeline.openMovie(\'' + App.esc(m.id) + '\')">' +
        '<div class="tl-dot" style="--c:' + App.esc(phaseColor(m)) + '"></div>' +
        '<div class="tl-year">' + App.esc(m.year) + "</div>" +
        '<div class="tl-poster">' +
        '<img src="' + App.esc(m.poster || "/images/posters/" + m.id + ".jpg") + '" alt="' + App.esc(m.title) + '" loading="lazy" data-emoji="🎬" data-color="' + App.esc(phaseColor(m)) + '" onerror="App.imgFallback(this)">' +
        "</div>" +
        '<div class="tl-title">' + App.esc(m.title) + "</div>" +
        '<div class="tl-label">' + App.esc(m.timelineLabel || "") + "</div>" +
        "</button>";
    });
    track.innerHTML = html;

    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            en.target.classList.add("in");
            io.unobserve(en.target);
          }
        });
      }, { root: scroll, threshold: 0.4 });
      App.qsa(".tl-node", track).forEach(function (n) { io.observe(n); });
    } else {
      App.qsa(".tl-node", track).forEach(function (n) { n.classList.add("in"); });
    }
  }

  function openMovie(id) {
    const m = App.state.moviesById[id];
    if (!m) return;
    const color = phaseColor(m);
    const chars = (m.characters || []).map(function (cid) {
      return App.state.charactersById[cid];
    }).filter(Boolean);
    const chips = chars.map(function (c) {
      return (
        '<button class="chip" style="--c:' + App.esc(App.color(c)) + '" onclick="App.openCharacter(\'' + App.esc(c.id) + '\')">' +
        '<span class="chip-emoji">' + App.emoji(c) + "</span>" + App.esc(c.name) +
        "</button>"
      );
    }).join("");
    const villains = (m.villains || []).map(function (v) {
      return "<li>" + App.esc(v) + "</li>";
    }).join("");

    const html =
      '<div class="movie-modal" style="--c:' + App.esc(color) + '">' +
      '<button class="modal-x" data-close>✕</button>' +
      '<div class="mm-top">' +
      '<div class="mm-poster">' +
      '<img src="' + App.esc(m.poster || "/images/posters/" + m.id + ".jpg") + '" alt="' + App.esc(m.title) + '" data-emoji="🎬" data-color="' + App.esc(color) + '" onerror="App.imgFallback(this)">' +
      "</div>" +
      '<div class="mm-info">' +
      '<div class="mm-phase" style="background:' + App.esc(color) + '">PHASE ' + App.esc(m.phase) + "</div>" +
      '<h3 class="mm-title">' + App.esc(m.title) + "</h3>" +
      '<div class="mm-year">' + App.esc(m.year) + " · " + App.esc(m.timelineLabel || "MCU") + "</div>" +
      '<div class="mm-rows">' +
      "<div><b>DIRECTOR</b>" + App.esc(m.director || "Unknown") + "</div>" +
      "<div><b>BOX OFFICE</b>" + App.esc(m.boxOffice || "Unknown") + "</div>" +
      "<div><b>RUNTIME</b>" + App.esc(m.runtime || "Unknown") + "</div>" +
      "</div>" +
      "</div>" +
      "</div>" +
      '<p class="mm-synopsis">' + App.esc(m.synopsis || "Synopsis coming soon.") + "</p>" +
      '<div class="mm-block"><h4>VILLAINS</h4><ul class="mm-villains">' + (villains || "<li>Unknown</li>") + "</ul></div>" +
      '<div class="mm-block"><h4>APPEARING HEROES</h4><div class="chip-row">' + (chips || "<span>No heroes listed.</span>") + "</div></div>" +
      "</div>";
    App.bindModal = function () {};
    App.openModal(html);
  }

  function highlightMovie(id) {
    const node = track.querySelector('.tl-node[data-id="' + id + '"]');
    if (!node) return;
    node.classList.remove("flash");
    void node.offsetWidth;
    node.classList.add("flash");
    const target = node.offsetLeft - (scroll.clientWidth - node.offsetWidth) / 2;
    scroll.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  }

  return {
    init: init,
    openMovie: openMovie,
    highlightMovie: highlightMovie
  };
})();
