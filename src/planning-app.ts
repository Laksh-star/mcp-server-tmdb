/** Planning Lab additions share the existing app's form controls and visual language. */
export function planningTabs(): string {
  return `<button class="planning-tab" type="button" data-planning-tab="calendar" aria-pressed="false">Release Calendar</button>`;
}

export function planningPanes(): string {
  return `<div class="planning-pane" data-planning-pane="calendar" hidden>
    <p>Scan upcoming and recent movies. Service preferences come from the sidebar; release dates do not promise streaming availability.</p>
    <form id="calendar-form" class="planning-form">
      <div class="field"><label for="calendar-country">Country</label><select id="calendar-country" name="country"><option value="IN">India</option><option value="US">United States</option><option value="GB">United Kingdom</option><option value="CA">Canada</option><option value="AU">Australia</option><option value="SG">Singapore</option></select></div>
      <div class="field"><label for="calendar-genre">Genre (optional)</label><input id="calendar-genre" name="genre" placeholder="Action, comedy, drama" maxlength="80"></div>
      <div class="field"><label for="calendar-days">Upcoming days</label><input id="calendar-days" name="days" type="number" min="7" max="180" value="90" required></div>
      <div class="field"><label for="calendar-recent">Recent days</label><input id="calendar-recent" name="recentDays" type="number" min="0" max="90" value="30" required></div>
      <button class="planning-button" type="submit">Build calendar</button>
    </form>
    <div id="calendar-output" class="empty" aria-live="polite">Choose a release window to find upcoming and recently released movies.</div>
  </div>`;
}

export function planningScript(): string {
  return String.raw`
    async function planningRequest(endpoint, payload) {
      const token = String(accessToken.value || "").trim();
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", ...(token ? { authorization: "Bearer " + token } : {}) },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Request failed (" + response.status + ").");
      return result;
    }

    function planningProviders(providers) {
      const lines = [
        providers.streaming?.length ? "Subscription: " + providers.streaming.join(", ") : "Subscription: no availability listed",
        providers.rent?.length ? "Rent: " + providers.rent.join(", ") : "",
        providers.buy?.length ? "Buy: " + providers.buy.join(", ") : "",
      ].filter(Boolean);
      let html = "<span>" + escapeHtml(lines.join(" · ")) + "</span>";
      // TMDB links are navigation only. Never interpolate arbitrary protocols from external data.
      if (providers.link && /^https:\/\/(www\.)?themoviedb\.org\//i.test(providers.link)) {
        html += '<a target="_blank" rel="noopener noreferrer" href="' + escapeHtml(providers.link) + '">Where to watch on TMDB</a>';
      }
      return html;
    }

    document.querySelector("#calendar-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const calendarForm = event.currentTarget;
      const button = calendarForm.querySelector('button[type="submit"]');
      const target = document.querySelector("#calendar-output");
      button.disabled = true;
      button.textContent = "Building…";
      target.className = "empty";
      target.textContent = "Checking release dates and regional availability…";
      try {
        const data = new FormData(calendarForm);
        const result = await planningRequest("/api/release-calendar", {
          ...Object.fromEntries(data),
          language: form.elements.language.value,
          services: selectedPlanningServices(),
          minRating: "0", maxResults: "12",
        });
        target.className = "lab-output";
        target.innerHTML = renderDecisionSection(result.windowStart + " to " + result.windowEnd + " · " + result.country, result.decision || []) +
          '<ol class="lab-list">' + result.picks.map((pick) =>
            '<li class="lab-item"><strong>' + escapeHtml(pick.title + " (" + pick.year + ")") + '</strong><span>' +
            escapeHtml((pick.releaseDate || "Date unknown") + " · " + pick.releaseStatus) + '</span>' +
            planningProviders(pick.providers) + '<span>' + escapeHtml((pick.reasons || []).join(" · ")) + '</span></li>'
          ).join("") + '</ol>' + renderDecisionSection("Notes", [...(result.notes || []), "Availability data: TMDB / JustWatch."]);
      } catch (error) {
        target.className = "error";
        target.textContent = error.message || "Unable to build calendar.";
      } finally {
        button.disabled = false;
        button.textContent = "Build calendar";
      }
    });
  `;
}
