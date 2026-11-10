import { radarPanel } from "./radar-app.js";

export function watchlistPane(): string {
  return `<div class="planning-pane" data-planning-pane="library" hidden>
    <p>Saved in this browser on this site. Export a backup to move your list or keep it before clearing browser data. Watched and disliked entries are excluded from new movie and TV recommendations.</p>
    <div class="library-tools">
      <button class="planning-button" type="button" id="export-watchlist">Export JSON</button>
      <label class="library-import" for="import-watchlist">Import JSON<input id="import-watchlist" type="file" accept=".json,application/json"></label>
      <button class="planning-button" type="button" id="use-saved-taste">Use saved movie tastes</button>
    </div>
    <p id="library-message" role="status" aria-live="polite"></p>
    <div id="library-output" class="lab-output"></div>
    ${radarPanel()}
  </div>`;
}

/** Pure model code is also exercised offline; keep it independent of DOM/storage APIs. */
export function watchlistModelScript(): string {
  return String.raw`
    function watchlistKey(item) { return item.mediaType + ":" + item.id; }
    function parseWatchlist(value) {
      if (!value || value.version !== 1 || !Array.isArray(value.items) || value.items.length > 2000) {
        throw new Error("Expected watchlist JSON version 1 with at most 2,000 items.");
      }
      const items = new Map();
      for (const entry of value.items) {
        if (!entry || !Number.isSafeInteger(entry.id) || entry.id < 1 ||
            !["movie", "tv"].includes(entry.mediaType) || typeof entry.title !== "string" ||
            !entry.title.trim() || entry.title.length > 300 ||
            typeof entry.year !== "string" || !/^(\d{4}|unknown)$/.test(entry.year) ||
            !["watchlist", "watched"].includes(entry.status) ||
            !["none", "liked", "disliked"].includes(entry.preference || "none") ||
            typeof entry.updatedAt !== "string" || !Number.isFinite(Date.parse(entry.updatedAt))) {
          throw new Error("Invalid watchlist entry. Nothing was imported.");
        }
        const item = {
          id: entry.id, mediaType: entry.mediaType, title: entry.title.trim(), year: entry.year,
          status: entry.status, preference: entry.preference || "none", updatedAt: new Date(entry.updatedAt).toISOString(),
        };
        const previous = items.get(watchlistKey(item));
        if (!previous || item.updatedAt >= previous.updatedAt) items.set(watchlistKey(item), item);
      }
      return { version: 1, items: Array.from(items.values()) };
    }
    function mergeWatchlists(current, incoming) {
      const byKey = new Map(current.items.map((item) => [watchlistKey(item), item]));
      for (const item of incoming.items) {
        const previous = byKey.get(watchlistKey(item));
        if (!previous || item.updatedAt >= previous.updatedAt) byKey.set(watchlistKey(item), item);
      }
      if (byKey.size > 2000) throw new Error("This import would exceed 2,000 saved entries. Nothing was imported.");
      return parseWatchlist({ version: 1, items: Array.from(byKey.values()) });
    }
  `;
}

export function watchlistScript(): string {
  return watchlistModelScript() + String.raw`
    const watchlistStorageKey = "tmdbConciergeWatchlist.v1";
    let savedWatchlist = { version: 1, items: [] };
    let watchlistLoaded = false;
    let rawWatchlistBackup = null;
    const watchlistCandidates = new Map();
    const libraryMessage = document.querySelector("#library-message");

    function watchlistNotice(message, isError = false) {
      libraryMessage.className = isError ? "error" : "";
      libraryMessage.textContent = message;
    }
    function loadWatchlist() {
      try {
        rawWatchlistBackup = localStorage.getItem(watchlistStorageKey);
        savedWatchlist = rawWatchlistBackup ? parseWatchlist(JSON.parse(rawWatchlistBackup)) : { version: 1, items: [] };
        watchlistLoaded = true;
      } catch {
        watchlistLoaded = false;
        watchlistNotice("Saved data could not be read. It has been preserved. Export a backup, then import a repaired file to restore it. Browser storage must be enabled.", true);
      }
      renderSavedWatchlist();
    }
    function storeWatchlist(next, restoring = false) {
      if (!watchlistLoaded && !restoring) throw new Error("Saved data is unreadable. Export a backup and import a repaired file before making changes.");
      const valid = parseWatchlist(next);
      try { localStorage.setItem(watchlistStorageKey, JSON.stringify(valid)); }
      catch { throw new Error("Could not save: browser storage is unavailable or full. Your previous list has been kept."); }
      savedWatchlist = valid;
      rawWatchlistBackup = JSON.stringify(valid);
      watchlistLoaded = true;
      renderSavedWatchlist();
      updateWatchlistButtons();
    }
    function watchedIds(mediaType) {
      return savedWatchlist.items.filter((item) => item.mediaType === mediaType && (item.status === "watched" || item.preference === "disliked")).map((item) => item.id);
    }
    function libraryWatchedMovieIds() {
      return savedWatchlist.items.filter((item) => item.mediaType === "movie" && item.status === "watched").map((item) => String(item.id));
    }
    function watchlistActions(pick, mediaType = "movie") {
      if (!Number.isSafeInteger(pick.id) || pick.id < 1 || !pick.title) return "";
      const item = { id: pick.id, title: String(pick.title).slice(0, 300), year: /^\d{4}$/.test(String(pick.year)) ? String(pick.year) : "unknown", mediaType };
      const key = watchlistKey(item);
      watchlistCandidates.set(key, item);
      const existing = savedWatchlist.items.find((entry) => watchlistKey(entry) === key);
      return '<div class="watchlist-actions"><button type="button" data-wl-action="save" data-wl-key="' + key + '"' + (existing ? ' disabled' : '') + '>' + (existing ? "Saved" : "Save") +
        '</button><button type="button" data-wl-action="watched" data-wl-key="' + key + '"' + (existing?.status === "watched" ? ' disabled' : '') + '>' +
        (existing?.status === "watched" ? "Watched" : "Mark watched") + '</button></div>';
    }
    function updateWatchlistButtons() {
      document.querySelectorAll("[data-wl-action]").forEach((button) => {
        const existing = savedWatchlist.items.find((entry) => watchlistKey(entry) === button.dataset.wlKey);
        if (button.dataset.wlAction === "save") { button.disabled = Boolean(existing); button.textContent = existing ? "Saved" : "Save"; }
        if (button.dataset.wlAction === "watched") { button.disabled = existing?.status === "watched"; button.textContent = button.disabled ? "Watched" : "Mark watched"; }
      });
    }
    function renderSavedWatchlist() {
      const target = document.querySelector("#library-output");
      if (!savedWatchlist.items.length) {
        target.innerHTML = '<p class="empty">Your watchlist is empty. Save titles from any planning result, or import a watchlist backup.</p>';
        return;
      }
      const watched = savedWatchlist.items.filter((item) => item.status === "watched").length;
      target.innerHTML = '<p>' + savedWatchlist.items.length + ' saved · ' + watched + ' watched</p><ul class="lab-list">' +
        [...savedWatchlist.items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((item) => {
          const key = watchlistKey(item);
          return '<li class="lab-item"><strong>' + escapeHtml(item.title + " (" + item.year + ")") + '</strong><span>' +
            escapeHtml(item.mediaType === "tv" ? "TV series" : "Movie") + ' · TMDB ID ' + item.id + '</span><div class="watchlist-actions">' +
            '<label>Status <select data-wl-field="status" data-wl-key="' + key + '"><option value="watchlist"' + (item.status === "watchlist" ? ' selected' : '') + '>Want to watch</option><option value="watched"' + (item.status === "watched" ? ' selected' : '') + '>Watched</option></select></label>' +
            '<label>Preference <select data-wl-field="preference" data-wl-key="' + key + '">' + [
              ["none", "No preference"], ["liked", "Liked"], ["disliked", "Disliked"],
            ].map(([value, label]) => '<option value="' + value + '"' + (item.preference === value ? ' selected' : '') + '>' + label + '</option>').join("") + '</select></label>' +
            '<button type="button" data-wl-action="remove" data-wl-key="' + key + '">Remove</button></div></li>';
        }).join("") + '</ul>';
    }
    document.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-wl-action]");
      if (!button) return;
      const key = button.dataset.wlKey;
      const action = button.dataset.wlAction;
      try {
        const items = [...savedWatchlist.items];
        const index = items.findIndex((item) => watchlistKey(item) === key);
        if (action === "remove") {
          storeWatchlist({ version: 1, items: items.filter((item) => watchlistKey(item) !== key) });
          watchlistNotice("Entry removed.");
          return;
        }
        const base = index >= 0 ? items[index] : watchlistCandidates.get(key);
        if (!base) return;
        const next = { ...base, status: action === "watched" ? "watched" : (base.status || "watchlist"), preference: base.preference || "none", updatedAt: new Date().toISOString() };
        if (index >= 0) items[index] = next; else items.push(next);
        storeWatchlist({ version: 1, items });
        watchlistNotice(next.title + (action === "watched" ? " marked watched. Future recommendations will skip it." : " saved."));
        button.textContent = action === "watched" ? "Watched" : "Saved";
      } catch (error) {
        watchlistNotice(error.message, true);
        statusEl.textContent = "Watchlist could not be saved";
      }
    });
    document.addEventListener("change", (event) => {
      const control = event.target.closest("select[data-wl-field]");
      if (!control) return;
      try {
        const items = savedWatchlist.items.map((item) => watchlistKey(item) === control.dataset.wlKey
          ? { ...item, [control.dataset.wlField]: control.value, updatedAt: new Date().toISOString() } : item);
        storeWatchlist({ version: 1, items });
        watchlistNotice("Watchlist updated.");
      } catch (error) { renderSavedWatchlist(); watchlistNotice(error.message, true); }
    });
    document.querySelector("#export-watchlist").addEventListener("click", () => {
      const value = watchlistLoaded ? JSON.stringify(savedWatchlist, null, 2) : rawWatchlistBackup;
      if (!value) { watchlistNotice("No saved data is available to export.", true); return; }
      const url = URL.createObjectURL(new Blob([value], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = watchlistLoaded ? "tmdb-watchlist.json" : "tmdb-watchlist-unreadable-backup.json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      watchlistNotice("Watchlist exported. Keep the file as your backup.");
    });
    document.querySelector("#import-watchlist").addEventListener("change", async (event) => {
      const file = event.target.files[0];
      if (!file) return;
      try {
        if (file.size > 2 * 1024 * 1024) throw new Error("Watchlist files must be smaller than 2 MB.");
        const imported = parseWatchlist(JSON.parse(await file.text()));
        // Merge by media type + ID. Newer timestamps win; movie and TV IDs never collide.
        storeWatchlist(mergeWatchlists(savedWatchlist, imported), true);
        watchlistNotice("Imported " + imported.items.length + " entries. Your list now has " + savedWatchlist.items.length + ".");
      } catch (error) { watchlistNotice("Import failed: " + error.message + " Your existing list was kept.", true); }
      finally { event.target.value = ""; }
    });
    document.querySelector("#use-saved-taste").addEventListener("click", () => {
      const movies = savedWatchlist.items.filter((item) => item.mediaType === "movie");
      const liked = movies.filter((item) => item.preference === "liked").slice(0, 5).map((item) => item.title);
      const disliked = movies.filter((item) => item.preference === "disliked").slice(0, 5).map((item) => item.title);
      if (!liked.length) { watchlistNotice("Mark at least one saved movie as Liked first.", true); return; }
      tasteForm.elements.likedTitles.value = liked.join(", ");
      tasteForm.elements.dislikedTitles.value = disliked.join(", ");
      document.querySelector('[data-planning-tab="taste"]').click();
      tasteOutput.textContent = "Loaded your saved movie preferences. Choose Recommend to find something new.";
      tasteOutput.className = "empty";
    });
    window.addEventListener("storage", (event) => {
      if (event.key === watchlistStorageKey || event.key === null) { loadWatchlist(); updateWatchlistButtons(); }
    });
    loadWatchlist();
  `;
}
