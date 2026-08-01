const Chat = (function () {
  let pick;
  let head;
  let body;
  let input;
  let sendBtn;
  let layout;

  let currentId = null;
  let busy = false;
  let greeted = {};
  let pendingText = null;
  let typeTimer = null;

  function settings() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem("ma.settings") || "null"); } catch (e) { s = null; }
    if (!s || typeof s !== "object") s = { provider: "auto", apiKey: "" };
    return s;
  }

  function init() {
    pick = App.qs("#chat-pick");
    head = App.qs("#chat-head");
    body = App.qs("#chat-body");
    input = App.qs("#chat-input");
    sendBtn = App.qs("#chat-send");
    layout = App.qs("#chat-layout");
    renderPicker();
    sendBtn.addEventListener("click", send);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") send();
    });
    if (App.state.characters.length) {
      selectCharacter(App.state.characters[0].id);
    } else {
      head.innerHTML = '<div class="ch-text"><b>OFFLINE</b><span>No characters available.</span></div>';
    }
  }

  function renderPicker() {
    pick.innerHTML = App.state.characters.map(function (c, i) {
      return (
        '<button class="chat-pick-btn' + (i === 0 ? " active" : "") + '" data-id="' + App.esc(c.id) + '" onclick="Chat.selectCharacter(\'' + App.esc(c.id) + '\')">' +
        '<img src="/images/characters/' + App.esc(c.id) + '.jpg" alt="' + App.esc(c.name) + '" data-emoji="' + App.esc(App.emoji(c)) + '" data-color="' + App.esc(App.color(c)) + '" onerror="App.imgFallback(this)">' +
        "<span>" + App.esc(c.name) + "</span>" +
        "</button>"
      );
    }).join("");
  }

  function selectCharacter(id) {
    const c = App.state.charactersById[id];
    if (!c) return;
    currentId = id;
    const color = App.color(c);
    layout.style.setProperty("--chat-c", color);
    layout.classList.add("themed");
    renderHeader(c);
    App.qsa(".chat-pick-btn", pick).forEach(function (b) {
      b.classList.toggle("active", b.dataset.id === id);
    });
    if (!greeted[id]) {
      greeted[id] = true;
      const greeting = "You found me! I'm " + c.name + ". " + (c.catchphrase || c.quote || "Let's talk.") + " What's on your mind?";
      App.state.chatHistory.push({ role: "assistant", content: greeting });
      addBotMessage(greeting, true);
    }
    input.focus();
  }

  function renderHeader(c) {
    head.innerHTML =
      '<img src="/images/characters/' + App.esc(c.id) + '.jpg" alt="' + App.esc(c.name) + '" data-emoji="' + App.esc(App.emoji(c)) + '" data-color="' + App.esc(App.color(c)) + '" onerror="App.imgFallback(this)">' +
      '<div class="ch-text">' +
      "<b>" + App.esc(c.name) + "</b>" +
      "<span>" + App.esc(c.personalityDesc || c.personality || "Hero") + "</span>" +
      "<i>“" + App.esc(c.catchphrase || c.quote || "") + "”</i>" +
      "</div>";
  }

  function scrollDown() {
    body.scrollTop = body.scrollHeight;
  }

  function addUserMessage(text) {
    const d = document.createElement("div");
    d.className = "msg user";
    d.textContent = text;
    body.appendChild(d);
    scrollDown();
  }

  function addBotMessage(text, instant) {
    const d = document.createElement("div");
    d.className = "msg bot";
    d.setAttribute("data-name", (currentId && App.state.charactersById[currentId] ? App.state.charactersById[currentId].name : "HERO").toUpperCase());
    d.textContent = "";
    body.appendChild(d);
    scrollDown();
    if (instant) {
      d.textContent = text;
      scrollDown();
      return;
    }
    let i = 0;
    const caret = document.createElement("span");
    caret.className = "msg-caret";
    caret.textContent = "▌";
    d.appendChild(caret);
    const step = setInterval(function () {
      if (i < text.length) {
        d.insertBefore(document.createTextNode(text.charAt(i)), caret);
        i++;
        scrollDown();
      } else {
        clearInterval(step);
        caret.remove();
        scrollDown();
      }
    }, 14);
  }

  function showTyping() {
    const d = document.createElement("div");
    d.className = "msg bot typing";
    d.setAttribute("data-name", (currentId && App.state.charactersById[currentId] ? App.state.charactersById[currentId].name : "HERO").toUpperCase());
    d.innerHTML = '<span class="typing-dots"><span></span><span></span><span></span></span>';
    body.appendChild(d);
    scrollDown();
    return d;
  }

  function send() {
    const text = input.value.trim();
    if (!text || busy || !currentId) return;
    pendingText = text;
    input.value = "";
    addUserMessage(text);
    App.state.chatHistory.push({ role: "user", content: text });
    busy = true;
    const typing = showTyping();
    const history = App.state.chatHistory.slice();
    const s = settings();
    API.chat(currentId, history, s.provider, s.apiKey).then(function (res) {
      typing.remove();
      if (res && (res.error === "NO_KEY" || res.error === "NO_MODEL")) {
        App.state.chatHistory.push({ role: "assistant", content: res.message || "No AI configured." });
        addNoConfig(res);
      } else {
        const reply = (res && res.reply) || "…";
        App.state.chatHistory.push({ role: "assistant", content: reply });
        addBotMessage(reply);
        if (res && res.suggestedCharacterId && res.suggestedCharacterId !== currentId) {
          setTimeout(function () {
            showSuggestion(res.suggestedCharacterId);
          }, 350);
        }
      }
    }).catch(function (err) {
      console.error(err);
      typing.remove();
      addFallback();
    }).then(function () {
      busy = false;
    });
  }

  function addNoConfig(res) {
    const d = document.createElement("div");
    d.className = "msg bot noconfig";
    d.setAttribute("data-name", (currentId && App.state.charactersById[currentId] ? App.state.charactersById[currentId].name : "HERO").toUpperCase());
    d.innerHTML =
      "<p>" + App.esc(res.message || "No AI model is configured.") + "</p>" +
      '<button class="comic-btn" onclick="Chat.openSettings()">⚙ OPEN SETTINGS</button>';
    body.appendChild(d);
    scrollDown();
  }

  function showSuggestion(otherId) {
    const me = App.state.charactersById[currentId];
    const other = App.state.charactersById[otherId];
    if (!other) return;
    const d = document.createElement("div");
    d.className = "suggest";
    d.innerHTML =
      '<span class="suggest-icon">🔁</span>' +
      "<p><b>" + App.esc(me.name) + "</b> suggests you switch to <b>" + App.esc(other.name) + "</b></p>" +
      '<button onclick="Chat.switchTo(\'' + App.esc(otherId) + '\')">Switch to ' + App.esc(other.name) + "</button>";
    body.appendChild(d);
    scrollDown();
  }

  function switchTo(id) {
    const c = App.state.charactersById[id];
    if (!c) return;
    greeted[id] = true;
    const msg = "Switching lines to " + c.name + ". " + (c.catchphrase || "What's up?");
    App.state.chatHistory.push({ role: "assistant", content: msg });
    selectCharacter(id);
    addBotMessage(msg, true);
  }

  function addFallback() {
    const c = App.state.charactersById[currentId];
    const name = c ? c.name : "Your hero";
    const d = document.createElement("div");
    d.className = "msg bot";
    d.setAttribute("data-name", name.toUpperCase());
    d.innerHTML =
      "Comms are glitching — even the best tech in the galaxy drops a call now and then. " +
      '<span class="chat-fallback">(' + name + " looks at you expectantly)</span><br>" +
      '<button class="retry-btn" onclick="Chat.retry()">↻ RETRY</button>';
    body.appendChild(d);
    scrollDown();
  }

  function retry() {
    const last = App.qsa(".msg.bot");
    const fb = last[last.length - 1];
    if (fb && fb.querySelector(".retry-btn")) fb.remove();
    if (pendingText) {
      input.value = pendingText;
      send();
    }
  }

  function openSettings() {
    const s = settings();
    const prov = App.qs("#set-provider");
    const key = App.qs("#set-key");
    prov.value = s.provider;
    key.value = s.apiKey || "";
    App.qs("#settings-modal").hidden = false;
    const status = App.qs("#settings-status");
    status.innerHTML = "Checking backend…";
    API.config().then(function (cfg) {
      let html = "";
      if (cfg && cfg.ollama && cfg.ollama.available) {
        html += '<span class="ok-dot"></span> Ollama local model ready: <b>' + App.esc(cfg.ollama.model) + "</b> (free)<br>";
      } else {
        html += '<span class="bad-dot"></span> Ollama not detected (free local option)<br>';
      }
      if (cfg && cfg.envKeys) {
        Object.keys(cfg.envKeys).forEach(function (p) {
          html += '<span class="' + (cfg.envKeys[p] ? "ok-dot" : "bad-dot") + '"></span> ' + p + " server key: " + (cfg.envKeys[p] ? "configured" : "none") + "<br>";
        });
      }
      status.innerHTML = html;
    }).catch(function () {
      status.innerHTML = "Could not reach backend config.";
    });
  }

  function closeSettings() {
    App.qs("#settings-modal").hidden = true;
  }

  function saveSettings() {
    const provider = App.qs("#set-provider").value;
    const apiKey = App.qs("#set-key").value.trim();
    localStorage.setItem("ma.settings", JSON.stringify({ provider: provider, apiKey: apiKey }));
    closeSettings();
    const c = App.state.charactersById[currentId];
    const who = c ? c.name : "hero";
    const d = document.createElement("div");
    d.className = "msg bot";
    d.setAttribute("data-name", who.toUpperCase());
    d.textContent = "Settings saved. Running on " + provider + (apiKey ? " with your key." : " (free, no key).");
    body.appendChild(d);
    scrollDown();
  }

  return {
    init: init,
    selectCharacter: selectCharacter,
    switchTo: switchTo,
    send: send,
    retry: retry,
    openSettings: openSettings,
    closeSettings: closeSettings,
    saveSettings: saveSettings
  };
})();
