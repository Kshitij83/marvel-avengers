const Family = (function () {
  let tabs;
  let stage;

  const W = 1280;
  const PAD = 96;
  const LEVEL_GAP = 150;
  const NODE_R = 46;

  function init() {
    tabs = App.qs("#tree-tabs");
    stage = App.qs("#tree-stage");
    renderTabs();
  }

  function renderTabs() {
    const list = App.state.trees;
    if (!list.length) {
      tabs.innerHTML = "";
      stage.innerHTML = '<div class="loading-box">No lineages chronicled yet…</div>';
      return;
    }
    tabs.innerHTML = list.map(function (t, i) {
      return (
        '<button class="tree-tab' + (i === 0 ? " active" : "") + '" data-id="' + App.esc(t.id) + '" onclick="Family.selectTree(\'' + App.esc(t.id) + '\')">' +
        App.esc(t.title) +
        "</button>"
      );
    }).join("");
    selectTree(list[0].id);
  }

  function selectTree(id) {
    App.qsa(".tree-tab", tabs).forEach(function (b) {
      b.classList.toggle("active", b.dataset.id === id);
    });
    const tree = App.state.trees.find(function (t) { return t.id === id; });
    if (!tree) return;
    renderTree(tree);
  }

  function layoutTree(tree) {
    const nodes = tree.nodes || [];
    const edges = tree.edges || [];
    const byId = {};
    nodes.forEach(function (n) { byId[n.id] = n; });
    const children = {};
    edges.forEach(function (e) {
      if (!byId[e.from] || !byId[e.to]) return;
      if (!children[e.from]) children[e.from] = [];
      children[e.from].push(e.to);
    });
    const incoming = new Set(edges.map(function (e) { return e.to; }));
    const roots = nodes.filter(function (n) { return !incoming.has(n.id); });
    const level = {};
    const order = [];
    (roots.length ? roots : nodes.slice(0, 1)).forEach(function (r) {
      if (level[r.id] != null) return;
      level[r.id] = 0;
      const q = [r.id];
      while (q.length) {
        const cur = q.shift();
        order.push(cur);
        (children[cur] || []).forEach(function (ch) {
          if (level[ch] == null) {
            level[ch] = level[cur] + 1;
            q.push(ch);
          }
        });
      }
    });
    nodes.forEach(function (n) {
      if (level[n.id] == null) {
        level[n.id] = 0;
        order.push(n.id);
      }
    });
    const perLevel = {};
    order.forEach(function (id) {
      const l = level[id];
      if (!perLevel[l]) perLevel[l] = [];
      perLevel[l].push(id);
    });
    const maxLevel = Object.keys(perLevel).reduce(function (m, k) {
      return Math.max(m, Number(k));
    }, 0);
    const xPos = {};
    Object.keys(perLevel).forEach(function (l) {
      const ids = perLevel[l];
      ids.forEach(function (id, i) {
        xPos[id] = PAD + (i + 0.5) * ((W - PAD * 2) / ids.length);
      });
    });
    const yPos = function (id) {
      return PAD + 40 + level[id] * LEVEL_GAP;
    };
    return { nodes: nodes, edges: edges, byId: byId, children: children, level: level, xPos: xPos, yPos: yPos, maxLevel: maxLevel };
  }

  function renderTree(tree) {
    const L = layoutTree(tree);
    const H = L.maxLevel * LEVEL_GAP + 240;
    const emojiMap = {};
    L.nodes.forEach(function (n) {
      emojiMap[n.id] = n.emoji || "•";
    });

    let edgesSvg = "";
    L.edges.forEach(function (e) {
      const a = L.byId[e.from];
      const b = L.byId[e.to];
      if (!a || !b) return;
      const ax = L.xPos[a.id];
      const ay = L.yPos(a.id);
      const bx = L.xPos[b.id];
      const by = L.yPos(b.id);
      if (L.level[a.id] === L.level[b.id]) {
        const midY = ay + NODE_R + 14;
        edgesSvg +=
          '<path class="tree-edge partner" pathLength="1" d="M ' + ax + " " + midY + " C " + ax + " " + (midY + 26) + ", " + bx + " " + (midY + 26) + ", " + bx + " " + midY + '" />';
        edgesSvg +=
          '<text class="tree-edge-label" x="' + ((ax + bx) / 2) + '" y="' + (midY + 26) + '">' + App.esc(e.relation || "♥") + "</text>";
      } else {
        const fromY = ay + NODE_R;
        const toY = by - NODE_R;
        const ctrl = (fromY + toY) / 2;
        edgesSvg +=
          '<path class="tree-edge child" pathLength="1" d="M ' + ax + " " + fromY + " C " + ax + " " + ctrl + ", " + bx + " " + ctrl + ", " + bx + " " + toY + '" />';
      }
    });

    let nodesSvg = "";
    L.nodes.forEach(function (n) {
      const x = L.xPos[n.id];
      const y = L.yPos(n.id);
      const col = n.color || "#518cca";
      const isRoot = L.level[n.id] === 0;
      nodesSvg +=
        '<g class="tree-node" data-id="' + App.esc(n.id) + '" style="--nc:' + App.esc(col) + '" onclick="Family.nodeInfo(\'' + App.esc(tree.id) + "','" + App.esc(n.id) + '\')">' +
        '<g class="node-g">' +
        '<defs>' +
        '<radialGradient id="nodeGrad' + App.esc(n.id) + '" cx="0.35" cy="0.3" r="1">' +
        '<stop offset="0%" stop-color="' + App.esc(col) + '"></stop>' +
        '<stop offset="100%" stop-color="#0a0f22"></stop>' +
        "</radialGradient>" +
        "</defs>" +
        '<circle cx="' + x + '" cy="' + y + '" r="' + NODE_R + '" fill="url(#nodeGrad' + App.esc(n.id) + ')" />' +
        '<text class="node-face" x="' + x + '" y="' + (y + 8) + '" font-size="' + (isRoot ? 34 : 26) + '" text-anchor="middle">' + (n.emoji || "•") + "</text>" +
        '<text class="node-name" x="' + x + '" y="' + (y + NODE_R + 26) + '">' + App.esc(n.name || "") + "</text>" +
        '<text class="node-title" x="' + x + '" y="' + (y + NODE_R + 44) + '">' + App.esc(n.title || "") + "</text>" +
        "</g>" +
        "</g>";
    });

    stage.innerHTML =
      "<svg viewBox=\"0 0 " + W + " " + H + "\" role=\"img\" aria-label=\"" + App.esc(tree.title) + '">' +
      edgesSvg + nodesSvg +
      "</svg>";

    const items = stage.querySelectorAll(".tree-node .node-g");
    items.forEach(function (g, i) {
      setTimeout(function () {
        g.parentNode.classList.add("show");
      }, 80 + i * 70);
    });
  }

  function nodeInfo(treeId, nodeId) {
    const tree = App.state.trees.find(function (t) { return t.id === treeId; });
    if (!tree) return;
    const node = (tree.nodes || []).find(function (n) { return n.id === nodeId; });
    if (!node) return;
    const rels = (tree.edges || []).filter(function (e) { return e.from === nodeId || e.to === nodeId; });
    const items = rels.map(function (e) {
      const other = e.from === nodeId ? e.to : e.from;
      const otherNode = (tree.nodes || []).find(function (n) { return n.id === other; });
      return (
        "<li>" +
        '<span class="chip-emoji">' + (otherNode ? otherNode.emoji : "•") + "</span> " +
        App.esc(e.relation || "family") + ": " + App.esc(otherNode ? otherNode.name : other) +
        "</li>"
      );
    }).join("");
    let pop = stage.querySelector("#tree-pop");
    if (!pop) {
      pop = document.createElement("div");
      pop.id = "tree-pop";
      pop.className = "tree-pop";
      stage.appendChild(pop);
    }
    pop.innerHTML =
      "<b>" + (node.emoji || "") + " " + App.esc(node.name) + "</b>" +
      "<i>" + App.esc(node.title || "") + "</i>" +
      "<ul>" + (items || "<li>No known relations.</li>") + "</ul>" +
      "<button>CLOSE</button>";
    pop.classList.add("show");
    const btn = pop.querySelector("button");
    if (btn) btn.onclick = function () { pop.classList.remove("show"); };
  }

  return {
    init: init,
    selectTree: selectTree,
    nodeInfo: nodeInfo
  };
})();
