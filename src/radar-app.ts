export function radarPanel(): string {
  return `<section class="radar-panel" aria-labelledby="radar-heading">
    <h4 id="radar-heading">Personal Availability Radar</h4>
    <p>Check up to 50 unwatched saved titles for streaming changes. Selected sidebar services highlight new subscription listings. The first check creates a baseline.</p>
    <form id="radar-form" class="library-tools">
      <div class="field"><label for="radar-country">Availability country</label><select id="radar-country" name="country"><option value="IN">India</option><option value="US">United States</option><option value="GB">United Kingdom</option><option value="CA">Canada</option><option value="AU">Australia</option><option value="SG">Singapore</option></select></div>
      <button class="planning-button" type="submit">Check saved titles</button>
      <button class="radar-reset" type="button" id="reset-radar">Reset country baseline</button>
    </form>
    <p id="radar-baseline" class="radar-caption"></p>
    <div id="radar-output" aria-live="polite" class="empty">Save a movie or series, then check its availability here.</div>
  </section>`;
}

export function radarScript(): string {
  return String.raw`
    const radarCountry = document.querySelector("#radar-country");
    const radarOutput = document.querySelector("#radar-output");
    const radarBaseline = document.querySelector("#radar-baseline");
    const radarStorageKey = () => "tmdbAvailabilityRadar.v1." + radarCountry.value;
    function readRadarSnapshot() {
      const raw = localStorage.getItem(radarStorageKey());
      if (!raw) return undefined;
      const snapshot = JSON.parse(raw);
      if (snapshot.version !== 1 || snapshot.country !== radarCountry.value || !Array.isArray(snapshot.items)) {
        throw new Error("Stored baseline is unreadable. Reset this country's baseline to start again.");
      }
      return snapshot;
    }
    function showRadarBaseline() {
      try {
        const snapshot = readRadarSnapshot();
        const checked = snapshot?.items.map((item) => item.checkedAt).filter(Boolean).sort();
        radarBaseline.textContent = checked?.length
          ? "Latest successful title check: " + new Date(checked[checked.length - 1]).toLocaleString() + ". Baselines are saved only in this browser, separately for each country."
          : "No baseline for " + radarCountry.value + " yet. The first successful check records current listings.";
      } catch { radarBaseline.textContent = "Baseline unavailable. Browser storage must be enabled; reset the country baseline if the stored data is unreadable."; }
    }
    radarCountry.addEventListener("change", () => {
      showRadarBaseline();
      radarOutput.className = "empty";
      radarOutput.textContent = "Country changed. Check saved titles to load availability for " + radarCountry.value + ".";
    });
    document.querySelector("#reset-radar").addEventListener("click", () => {
      try {
        localStorage.removeItem(radarStorageKey());
        showRadarBaseline();
        radarOutput.className = "empty";
        radarOutput.textContent = "Baseline reset for " + radarCountry.value + ". The next check creates a fresh baseline. Your watchlist is unchanged.";
      } catch { radarOutput.className = "error"; radarOutput.textContent = "Could not reset the baseline: browser storage is unavailable."; }
    });
    document.querySelector("#radar-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = event.currentTarget.querySelector('button[type="submit"]');
      const countryAtStart = radarCountry.value;
      const eligible = savedWatchlist.items.filter((item) => item.status !== "watched" && item.preference !== "disliked");
      if (!eligible.length) {
        radarOutput.className = "empty";
        radarOutput.textContent = "No unwatched titles to check. Save a movie or series, or change an entry to Want to watch.";
        return;
      }
      button.disabled = true;
      radarCountry.disabled = true;
      document.querySelector("#reset-radar").disabled = true;
      button.textContent = "Checking…";
      radarOutput.className = "empty";
      radarOutput.textContent = "Checking " + Math.min(eligible.length, 50) + " saved titles…";
      try {
        const previousSnapshot = readRadarSnapshot();
        const result = await planningRequest("/api/availability-radar", {
          country: countryAtStart, services: selectedPlanningServices(), previousSnapshot,
          titles: eligible.slice(0, 50).map(({ id, mediaType, title }) => ({ id, mediaType, title })),
        });
        let storageNote = "";
        try { localStorage.setItem(radarStorageKey(), JSON.stringify(result.snapshot)); }
        catch { storageNote = "This check completed, but its baseline could not be saved. Your next check may repeat these changes. Export your watchlist if browser storage is full."; }
        const priority = { changed: 0, baseline: 1, unchanged: 2, "no-data": 3, failed: 4 };
        const entries = [...result.entries].sort((a, b) => Boolean(b.newOnServices.length) - Boolean(a.newOnServices.length) || priority[a.status] - priority[b.status]);
        const summaryLines = [
          result.summary.newlyOnServices + (result.summary.newlyOnServices === 1 ? " title" : " titles") + (result.services.length ? " newly listed on selected services" : " with new subscription listings"),
          result.summary.changed + " changed · " + result.summary.baselines + " new baselines · " + result.summary.unchecked + " could not be checked",
          ...(eligible.length > 50 ? ["Checked the first 50 of " + eligible.length + " unwatched titles. Smaller lists can be checked together; MCP clients can send batches of up to 50."] : []),
          ...(storageNote ? [storageNote] : []),
        ];
        radarOutput.className = "lab-output";
        radarOutput.innerHTML = renderDecisionSection("Availability check · " + result.country, summaryLines) + '<ul class="lab-list">' + entries.map((entry) => {
          const labels = { baseline: "Baseline created", changed: "Listings changed", unchanged: "Unchanged", "no-data": "No country data", failed: "Check failed" };
          const providers = entry.providers;
          return '<li class="lab-item"><strong>' + escapeHtml(entry.title) + ' <span class="radar-tag">' + escapeHtml(labels[entry.status]) + '</span></strong>' +
            '<span>' + escapeHtml(entry.mediaType === "tv" ? "TV series" : "Movie") + '</span>' +
            (entry.newOnServices.length ? '<span class="radar-new">New subscription listings: ' + escapeHtml(entry.newOnServices.join(", ")) + '</span>' : '') +
            entry.changes.map((change) => '<span>' + escapeHtml(({ streaming: "Subscription", rent: "Rental", buy: "Purchase" })[change.category] + ": added " + (change.added.map((provider) => provider.name).join(", ") || "none") + "; removed " + (change.removed.map((provider) => provider.name).join(", ") || "none")) + '</span>').join("") +
            (providers ? planningProviders({ streaming: providers.streaming.map((provider) => provider.name), rent: providers.rent.map((provider) => provider.name), buy: providers.buy.map((provider) => provider.name), link: entry.link }) : '') +
            (entry.previousCheckedAt ? '<span>Compared with ' + escapeHtml(new Date(entry.previousCheckedAt).toLocaleString()) + '</span>' : '') +
            (entry.note ? '<span>' + escapeHtml(entry.note) + '</span>' : '') + '</li>';
        }).join("") + '</ul>' + renderDecisionSection("Notes", result.notes);
        showRadarBaseline();
      } catch (error) {
        radarOutput.className = "error";
        radarOutput.textContent = error.message || "Unable to check saved titles. Your previous baseline has been kept.";
      } finally {
        button.disabled = false;
        radarCountry.disabled = false;
        document.querySelector("#reset-radar").disabled = false;
        button.textContent = "Check saved titles";
      }
    });
    window.addEventListener("storage", (event) => { if (event.key === radarStorageKey() || event.key === null) showRadarBaseline(); });
    showRadarBaseline();
  `;
}
