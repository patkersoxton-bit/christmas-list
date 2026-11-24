(() => {
  "use strict";

  const cfg = window.LIST_CONFIG || {};
  const LIVE = Boolean(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);
  const TOKENS_KEY = "xmas-claim-tokens";      // { itemId: token } — your own claims
  const DEMO_KEY = "xmas-demo-claims";         // demo mode only

  const state = { items: [], claimed: new Set(), filter: "all" };
  const NAME_KEY = "xmas-claimer-name";
  const $ = (sel) => document.querySelector(sel);

  // ---------- Local storage helpers ----------
  const readJSON = (k, fallback) => {
    try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch { return fallback; }
  };
  const writeJSON = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const myTokens = () => readJSON(TOKENS_KEY, {});

  // ---------- Backend (Supabase RPC, or browser-only demo) ----------
  async function rpc(fn, args = {}) {
    const res = await fetch(`${cfg.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: cfg.SUPABASE_ANON_KEY,
        // Legacy anon keys are JWTs and also go in Authorization;
        // new sb_publishable_ keys must only be sent as apikey.
        ...(cfg.SUPABASE_ANON_KEY.startsWith("eyJ")
          ? { Authorization: `Bearer ${cfg.SUPABASE_ANON_KEY}` } : {}),
      },
      body: JSON.stringify(args),
    });
    if (!res.ok) {
      const err = new Error(`${fn} failed (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return res.json();
  }

  const backend = LIVE ? {
    async list() { return rpc("get_claimed_items"); },
    async claim(id, name) { return rpc("claim_item", { p_item_id: id, p_name: name }); },
    async unclaim(id, token) { return rpc("unclaim_item", { p_item_id: id, p_token: token }); },
  } : {
    async list() { return Object.keys(readJSON(DEMO_KEY, {})); },
    async claim(id, _name) {
      const all = readJSON(DEMO_KEY, {});
      if (all[id]) return null;
      const token = crypto.randomUUID();
      all[id] = token; writeJSON(DEMO_KEY, all);
      return token;
    },
    async unclaim(id, token) {
      const all = readJSON(DEMO_KEY, {});
      if (all[id] !== token) return false;
      delete all[id]; writeJSON(DEMO_KEY, all);
      return true;
    },
  };

  // ---------- Rendering ----------
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const safeUrl = (u) => (/^https?:\/\//i.test(u || "") ? u : "#");

  function cardHTML(item) {
    const mine = Boolean(myTokens()[item.id]);
    const taken = state.claimed.has(item.id);
    const cls = ["card", taken && "is-taken", mine && "is-mine"].filter(Boolean).join(" ");

    const img = item.image
      ? `<div class="card-img"><img src="${esc(safeUrl(item.image))}" alt="" loading="lazy"></div>`
      : `<div class="card-img placeholder" aria-hidden="true">🎁</div>`;

    const tags = [
      item.priority === "high" ? `<span class="tag top">★ Top pick</span>` : "",
      item.category ? `<span class="tag">${esc(item.category)}</span>` : "",
    ].join("");

    const links = (item.links || []).map((l) =>
      `<a href="${esc(safeUrl(l.url))}" target="_blank" rel="noopener noreferrer">Buy at ${esc(l.store || "store")} ↗</a>`
    ).join("");

    let action;
    if (mine) {
      action = `<span class="status mine">✓ You're getting this</span>
                <button class="btn btn-ghost" data-unclaim="${esc(item.id)}">Undo</button>`;
    } else if (taken) {
      action = `<span class="claimed-pill">✓ Claimed</span>`;
    } else {
      action = `<button class="btn btn-primary" data-claim="${esc(item.id)}">I'll get this</button>`;
    }

    return `<article class="${cls}">
      ${img}
      <div class="card-body">
        <div class="meta">${tags}</div>
        <h3>${esc(item.name)}</h3>
        ${item.price ? `<div class="price">${esc(item.price)}</div>` : ""}
        ${item.description ? `<p class="desc">${esc(item.description)}</p>` : ""}
        ${links ? `<div class="links">${links}</div>` : ""}
        <div class="actions">${action}</div>
      </div>
    </article>`;
  }

  function render() {
    const tokens = myTokens();
    const visible = state.items.filter((it) => {
      if (state.filter === "available") return !state.claimed.has(it.id);
      if (state.filter === "mine") return Boolean(tokens[it.id]);
      return true;
    });

    const available = state.items.filter((it) => !state.claimed.has(it.id)).length;
    $("#count").textContent = `${available} of ${state.items.length} still available`;

    const emptyMsg = {
      available: "Everything's been claimed. Thank you! 🎄",
      mine: "You haven't claimed anything yet (on this device).",
      all: "The list is empty for now. Check back soon!",
    }[state.filter];

    $("#list").innerHTML = visible.length
      ? visible.map(cardHTML).join("")
      : `<p class="empty">${emptyMsg}</p>`;
  }

  // ---------- UI helpers ----------
  let toastTimer;
  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg; el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.hidden = true), 3500);
  }

  function banner(msg, isError = false) {
    const el = $("#banner");
    el.innerHTML = msg; el.hidden = false;
    el.classList.toggle("error", isError);
  }

  // Resolves to the claimer's name, or null if cancelled.
  function confirmClaim(item) {
    return new Promise((resolve) => {
      const dlg = $("#confirm");
      const input = $("#claimer-name");
      $("#confirm-title").textContent = `Claim “${item.name}”?`;
      $("#confirm-body").textContent = item.price ? `Approx. ${item.price}.` : "";
      input.value = localStorage.getItem(NAME_KEY) || "";
      dlg.returnValue = "";
      dlg.addEventListener("close", () => {
        const name = input.value.trim();
        resolve(dlg.returnValue === "ok" && name ? name : null);
      }, { once: true });
      dlg.showModal();
      if (!input.value) input.focus();
    });
  }

  async function refreshClaims() {
    const ids = await backend.list();
    state.claimed = new Set(ids);
    // Drop tokens for claims that were reset by the owner.
    const tokens = myTokens();
    let changed = false;
    for (const id of Object.keys(tokens)) {
      if (!state.claimed.has(id)) { delete tokens[id]; changed = true; }
    }
    if (changed) writeJSON(TOKENS_KEY, tokens);
  }

  // ---------- Actions ----------
  async function onClaim(id, btn) {
    const item = state.items.find((i) => i.id === id);
    if (!item) return;
    const name = await confirmClaim(item);
    if (!name) return;
    try { localStorage.setItem(NAME_KEY, name); } catch {}
    btn.disabled = true;
    try {
      const token = await backend.claim(id, name);
      if (token) {
        writeJSON(TOKENS_KEY, { ...myTokens(), [id]: token });
        state.claimed.add(id);
        toast(`Thanks, ${name}! It's now marked as claimed. 🎁`);
      } else {
        state.claimed.add(id);
        toast("Ah, someone just claimed that one. Pick another?");
      }
    } catch (err) {
      console.error(err);
      toast(err.status === 404
        ? "This page is out of date. Please refresh and try again."
        : "Couldn't reach the list. Please try again.");
    }
    render();
  }

  async function onUnclaim(id, btn) {
    const token = myTokens()[id];
    if (!token) return;
    btn.disabled = true;
    try {
      await backend.unclaim(id, token);
      const tokens = myTokens(); delete tokens[id]; writeJSON(TOKENS_KEY, tokens);
      state.claimed.delete(id);
      toast("Released. It's back on the list.");
    } catch (err) {
      console.error(err);
      toast("Couldn't undo right now. Please try again.");
    }
    render();
  }

  // ---------- Boot ----------
  async function init() {
    const title = cfg.ownerName ? `${cfg.ownerName}'s Christmas List` : (cfg.title || "Christmas List");
    document.title = title;
    $("#title").textContent = title;
    $("#subtitle").textContent = cfg.subtitle || "";
    $("#eyebrow").textContent = `Christmas ${cfg.year || new Date().getFullYear()}`;

    if (!LIVE) {
      banner("<strong>Demo mode:</strong> claims are only saved in this browser. " +
             "Connect Supabase in <code>config.js</code> to share claims (see README).");
    }

    document.querySelector(".filters").addEventListener("click", (e) => {
      const chip = e.target.closest(".chip");
      if (!chip) return;
      state.filter = chip.dataset.filter;
      document.querySelectorAll(".chip").forEach((c) => {
        const on = c === chip;
        c.classList.toggle("is-active", on);
        c.setAttribute("aria-selected", on);
      });
      render();
    });

    $("#list").addEventListener("click", (e) => {
      const c = e.target.closest("[data-claim]");
      const u = e.target.closest("[data-unclaim]");
      if (c) onClaim(c.dataset.claim, c);
      if (u) onUnclaim(u.dataset.unclaim, u);
    });

    try {
      const res = await fetch("items.json", { cache: "no-store" });
      state.items = (await res.json()).filter((i) => i && i.id && !i.hidden);
    } catch (err) {
      console.error(err);
      banner("Couldn't load the gift list. Please refresh.", true);
      return;
    }

    try {
      await refreshClaims();
    } catch (err) {
      console.error(err);
      banner("Couldn't load which gifts are taken. Showing everything as available. Please refresh before claiming.", true);
    }
    render();

    // Keep in sync if someone else claims while the page is open.
    document.addEventListener("visibilitychange", async () => {
      if (document.visibilityState === "visible") {
        try { await refreshClaims(); render(); } catch {}
      }
    });
  }

  init();
})();
