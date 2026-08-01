const Vs = (function () {
  const bonus = {
    "thanos": 5,
    "captain marvel": 4,
    "doctor strange": 4,
    "scarlet witch": 4,
    "thor": 3,
    "hulk": 3,
    "iron man": 3,
    "loki": 3,
    "vision": 3,
    "captain america": 2,
    "spider-man": 2,
    "spider man": 2,
    "black panther": 2,
    "wanda maximoff": 4,
    "ant-man": 1,
    "ant man": 1,
    "wasp": 1,
    "star-lord": 1,
    "star lord": 1
  };

  function init() {
    const selA = App.qs("#vs-a");
    const selB = App.qs("#vs-b");
    App.state.characters.forEach(function (c) {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.name;
      selA.appendChild(opt);
      const opt2 = document.createElement("option");
      opt2.value = c.id;
      opt2.textContent = c.name;
      selB.appendChild(opt2);
    });
    if (App.state.characters.length > 1) selB.selectedIndex = 1;
    App.qs("#vs-fight").addEventListener("click", fight);
  }

  function powerScore(c) {
    const key = (c.name || "").toLowerCase();
    const b = bonus[key] || 0;
    return (c.powers || []).length + b + Math.random() * 5;
  }

  function fight() {
    const idA = App.qs("#vs-a").value;
    const idB = App.qs("#vs-b").value;
    const a = App.state.charactersById[idA];
    const b = App.state.charactersById[idB];
    if (!a || !b || a.id === b.id) {
      App.toast("Pick two different heroes!", "#e62429");
      return;
    }
    const stage = App.qs("#vs-stage");
    const winner = powerScore(a) >= powerScore(b) ? a : b;
    stage.innerHTML =
      '<div class="vs-avatar vs-av-a" style="--c:' + App.esc(App.color(a)) + '">' +
      '<img src="/images/characters/' + App.esc(a.id) + '.jpg" alt="' + App.esc(a.name) + '" data-emoji="' + App.esc(App.emoji(a)) + '" data-color="' + App.esc(App.color(a)) + '" onerror="App.imgFallback(this)">' +
      "</div>" +
      '<div class="vs-avatar vs-av-b" style="--c:' + App.esc(App.color(b)) + '">' +
      '<img src="/images/characters/' + App.esc(b.id) + '.jpg" alt="' + App.esc(b.name) + '" data-emoji="' + App.esc(App.emoji(b)) + '" data-color="' + App.esc(App.color(b)) + '" onerror="App.imgFallback(this)">' +
      "</div>" +
      '<div class="vs-clash"><div class="vs-burst">💥</div></div>' +
      '<div class="vs-winner">' +
      '<div class="winner-stamp">WINNER</div>' +
      '<div class="winner-name">' + App.emoji(winner) + " " + App.esc(winner.name) + "</div>" +
      "</div>" +
      '<button class="comic-btn vs-replay" onclick="Vs.fight()">↻ REMATCH</button>';
    stage.classList.remove("fight", "clash", "crowned");
    void stage.offsetWidth;
    requestAnimationFrame(function () {
      stage.classList.add("fight");
      setTimeout(function () { stage.classList.add("clash"); }, 760);
      setTimeout(function () {
        stage.classList.remove("clash");
        stage.classList.add("crowned");
      }, 1500);
    });
  }

  return {
    init: init,
    fight: fight
  };
})();
