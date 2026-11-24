(() => {
  "use strict";

  const cfg = window.LIST_CONFIG || {};
  const KEY_STORE = "xmas-admin-key";
  const $ = (s) => document.querySelector(s);
  const state = { items: [], claims: [], view: "people", key: "" };

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmtDate = (d) => new Date(d).toLocaleString(undefined,
    { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  async function rpc(fn, args) {
    const key = cfg.SUPABASE_ANON_KEY;
    const res = await fetch(`${cfg.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: key,
        ...(key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}),
      },
      body: JSON.stringify(args),
    });
    if (!res.ok) {
      const err = new Error(`${fn} failed (${res.status})`);
      err.body = await res.text().catch(() => "");
      throw err;
    }
    return res.json();
  }

  let toastTimer;
  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg; el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.hidden = true), 3000);
  }
  function banner(msg) {
    const el = $("#banner");
    el.textContent = msg; el.hidden = !msg; el.classList.add("error");
  }

  // ---------- Rendering ----------
  function render() {
    const byId = new Map(state.items.map((i) => [i.id, i]));
    const claimById = new Map(state.claims.map((c) => [c.item_id, c]));
    const people = new Set(state.claims.map((c) => (c.claimer_name || "").trim().toLowerCase()));

    $("#stats").innerHTML = [
      [state.claims.length, "gifts claimed"],
      [state.items.length - state.items.filter((i) => claimById.has(i.id)).length, "still open"],
      [people.size, people.size === 1 ? "person" : "people"],
    ].map(([n, l]) => `<div class="stat"><b>${n}</b><span>${l}</span></div>`).join("");

    const itemName = (id) => byId.get(id)?.name || `Unknown item (${id})`;
    const release = (id) => `<button class="btn btn-ghost" data-release="${esc(id)}">Release</button>`;

    if (state.view === "people") {
      const groups = new Map();
      for (const c of state.claims) {
        const name = (c.claimer_name || "(no name)").trim();
        const k = name.toLowerCase();
        if (!groups.has(k)) groups.set(k, { name, claims: [] });
        groups.get(k).claims.push(c);
      }
      const sorted = [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
      $("#view").innerHTML = sorted.length ? sorted.map((g) => `
        <div class="panel person">
          <h3>${esc(g.name)} <small>${g.claims.length} gift${g.claims.length === 1 ? "" : "s"}</small></h3>
          <ul class="rows">${g.claims.map((c) => `
            <li class="${byId.has(c.item_id) ? "" : "unknown"}">
              <span class="name">${esc(itemName(c.item_id))}</span>
              <span class="muted">${esc(byId.get(c.item_id)?.price || "")}</span>
              <span class="when">${fmtDate(c.claimed_at)}</span>
              ${release(c.item_id)}
            </li>`).join("")}
          </ul>
        </div>`).join("")
        : `<p class="empty">Nobody has claimed anything yet.</p>`;
    } else {
      const extra = state.claims.filter((c) => !byId.has(c.item_id))
        .map((c) => ({ id: c.item_id, name: itemName(c.item_id) }));
      const all = [...state.items, ...extra];
      $("#view").innerHTML = `<div class="panel"><ul class="rows">${all.map((i) => {
        const c = claimById.get(i.id);
        return `<li class="${byId.has(i.id) ? "" : "unknown"}">
          <span class="name">${esc(i.name)}</span>
          ${c ? `<span class="who">${esc(c.claimer_name || "(no name)")}</span>
                 <span class="when">${fmtDate(c.claimed_at)}</span>${release(i.id)}`
              : `<span class="open">Not claimed yet</span>`}
        </li>`;
      }).join("")}</ul></div>`;
    }
  }

  // ---------- Data ----------
  async function load() {
    const [items, claims] = await Promise.all([
      fetch("items.json", { cache: "no-store" }).then((r) => r.json()),
      rpc("admin_get_claims", { p_key: state.key }),
    ]);
    state.items = items.filter((i) => i && i.id && !i.hidden);
    state.claims = claims;
    render();
  }

  async function unlock(key, remember) {
    state.key = key;
    try {
      await load();
    } catch (err) {
      console.error(err);
      state.key = "";
      localStorage.removeItem(KEY_STORE);
      banner(/invalid admin key/.test(err.body || "")
        ? "That passphrase isn't right."
        : "Couldn't reach the database. Please try again.");
      $("#login").hidden = false; $("#dash").hidden = true;
      return;
    }
    banner("");
    if (remember) localStorage.setItem(KEY_STORE, key);
    $("#login").hidden = true; $("#dash").hidden = false;
  }

  // ---------- Events ----------
  $("#login").addEventListener("submit", (e) => {
    e.preventDefault();
    unlock($("#key").value.trim(), $("#remember").checked);
  });

  document.querySelector("#dash .filters").addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    state.view = chip.dataset.view;
    document.querySelectorAll("#dash .chip").forEach((c) => c.classList.toggle("is-active", c === chip));
    render();
  });

  $("#refresh").addEventListener("click", async () => {
    try { await load(); toast("Up to date."); } catch { toast("Couldn't refresh."); }
  });

  $("#logout").addEventListener("click", () => {
    localStorage.removeItem(KEY_STORE);
    state.key = ""; state.claims = [];
    $("#key").value = "";
    $("#dash").hidden = true; $("#login").hidden = false;
  });

  $("#view").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-release]");
    if (!b) return;
    const id = b.dataset.release;
    const c = state.claims.find((x) => x.item_id === id);
    if (!confirm(`Release "${state.items.find((i) => i.id === id)?.name || id}" from ${c?.claimer_name || "this person"}? It'll go back on the list.`)) return;
    b.disabled = true;
    try {
      await rpc("admin_release", { p_key: state.key, p_item_id: id });
      await load();
      toast("Released.");
    } catch (err) {
      console.error(err); b.disabled = false; toast("Couldn't release it.");
    }
  });

  // ---------- Boot ----------
  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
    banner("Supabase isn't configured in config.js, so there's nothing to show.");
    $("#login").hidden = true;
    return;
  }
  const saved = localStorage.getItem(KEY_STORE);
  if (saved) unlock(saved, true);
})();
