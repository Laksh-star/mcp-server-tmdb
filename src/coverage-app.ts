export function coveragePanel(): string {
  return `<section class="radar-panel" aria-labelledby="coverage-heading">
    <h4 id="coverage-heading">Streaming Service Coverage</h4>
    <p>Compare subscriptions for up to 50 unwatched saved titles. Sidebar services count as subscriptions you already have. Rentals and purchases are excluded from coverage.</p>
    <form id="coverage-form" class="library-tools">
      <div class="field"><label for="coverage-country">Availability country</label><select id="coverage-country" name="country"><option value="IN">India</option><option value="US">United States</option><option value="GB">United Kingdom</option><option value="CA">Canada</option><option value="AU">Australia</option><option value="SG">Singapore</option></select></div>
      <div class="field"><label for="coverage-additions">Maximum extra services</label><input id="coverage-additions" name="maxAdditionalServices" type="number" min="0" max="3" value="2" required></div>
      <button class="planning-button" type="submit">Compare services</button>
    </form>
    <div id="coverage-output" class="empty" aria-live="polite">Save movies or series, select your current services, then compare coverage.</div>
  </section>`;
}

export function coverageScript(): string {
  return String.raw`
    document.querySelector("#coverage-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const coverageForm = event.currentTarget;
      const button = coverageForm.querySelector('button[type="submit"]');
      const target = document.querySelector("#coverage-output");
      const eligible = savedWatchlist.items.filter((item) => item.status !== "watched" && item.preference !== "disliked");
      if (!eligible.length) {
        target.className = "empty";
        target.textContent = "No unwatched titles to compare. Save a movie or series, or mark an entry Want to watch.";
        return;
      }
      const data = new FormData(coverageForm);
      button.disabled = true;
      button.textContent = "Comparing…";
      target.className = "empty";
      target.textContent = "Checking subscription coverage for " + Math.min(eligible.length, 50) + " saved titles…";
      try {
        const result = await planningRequest("/api/streaming-coverage", {
          country: data.get("country"), maxAdditionalServices: Number(data.get("maxAdditionalServices")),
          services: selectedPlanningServices(), titles: eligible.slice(0, 50).map(({ id, mediaType, title }) => ({ id, mediaType, title })),
        });
        const additions = result.suggestion.additions;
        const overview = [
          ...(result.checkedTitles ? [
            "Current subscriptions: " + result.current.coveredCount + "/" + result.totalTitles + " titles (" + result.current.coveragePercent + "%).",
            "With suggested additions: " + result.suggestion.coveredCount + "/" + result.totalTitles + " (" + result.suggestion.coveragePercent + "%).",
          ] : ["Coverage could not be verified for these titles."]),
          "Checked " + result.checkedTitles + " titles; availability unknown for " + result.unknownTitles.length + ".",
          ...(result.current.services.length ? ["Selected subscriptions in these listings: " + result.current.services.map((service) => service.name).join(", ")] : []),
          ...(result.checkedTitles && result.unmatchedServices.length ? ["No subscription listings matched: " + result.unmatchedServices.join(", ") + "."] : []),
          ...(eligible.length > 50 ? ["Compared the first 50 of " + eligible.length + " unwatched titles. MCP clients can compare batches of up to 50."] : []),
        ];
        const suggestions = additions.length ? '<ol class="lab-list">' + additions.map((service) =>
          '<li class="lab-item"><strong>' + escapeHtml(service.name) + '</strong><span>' + service.additionalCount + ' additional titles at this step</span><span>' +
          escapeHtml(service.additionalTitles.map((title) => title.title + (title.mediaType === "tv" ? " [TV]" : " [Movie]")).join(", ")) + '</span></li>'
        ).join("") + '</ol>' : (result.checkedTitles ? '<p>No extra service improves the checked coverage within the chosen limit.</p>' : '<p>Not enough availability data to suggest services.</p>');
        const table = result.services.length ? '<div class="coverage-table-wrap"><table class="coverage-table"><caption>Subscription listings · top ' + result.services.length + ' of ' + result.totalServices + ' services</caption>' +
          '<thead><tr><th scope="col">Service</th><th scope="col">Titles</th><th scope="col">Already covered</th><th scope="col">Additional vs current</th></tr></thead><tbody>' +
          result.services.map((service) => '<tr><th scope="row">' + escapeHtml(service.name) + (service.alreadySubscribed ? ' <span class="radar-tag">Selected</span>' : '') +
            '<details><summary>Show titles</summary><ul>' + service.coveredTitles.map((title) => '<li>' + escapeHtml(title.title + (title.mediaType === "tv" ? " [TV]" : " [Movie]")) + '</li>').join("") + '</ul></details></th>' +
            '<td>' + service.coveredCount + '/' + result.totalTitles + '</td><td>' + service.overlapWithCurrentCount + '</td><td>' + service.additionalCount + '</td></tr>').join("") + '</tbody></table></div>' : '<p>No checked subscription provider data.</p>';
        target.className = "lab-output";
        target.innerHTML = renderDecisionSection("Coverage · " + result.country, overview) +
          '<article class="lab-section"><h4>Suggested additions</h4><p>Prioritizes the most extra titles at each step. Compare subscription prices separately.</p>' + suggestions + '</article>' + table +
          (result.uncoveredTitles.length ? renderDecisionSection("Outside selected and suggested subscriptions", result.uncoveredTitles.map((title) => title.title)) : '') +
          (result.unknownTitles.length ? renderDecisionSection("Unknown availability", result.unknownTitles.map((title) => title.title)) : '') +
          renderDecisionSection("Notes", result.notes);
      } catch (error) {
        target.className = "error";
        target.textContent = error.message || "Unable to compare subscription coverage.";
      } finally { button.disabled = false; button.textContent = "Compare services"; }
    });
  `;
}
