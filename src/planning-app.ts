/** Planning Lab additions share the existing app's form controls and visual language. */
export function planningTabs(): string {
  return `<button class="planning-tab" type="button" data-planning-tab="calendar" aria-pressed="false">Release Calendar</button>
  <button class="planning-tab" type="button" data-planning-tab="tv" aria-pressed="false">TV Binge Planner</button>`;
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
  </div>
  <div class="planning-pane" data-planning-pane="tv" hidden>
    <p>Find a series that fits your time. Selected sidebar services are required subscription matches; leave them unchecked to search all services.</p>
    <form id="binge-form" class="planning-form">
      <div class="field"><label for="binge-country">Country</label><select id="binge-country" name="country"><option value="IN">India</option><option value="US">United States</option><option value="GB">United Kingdom</option><option value="CA">Canada</option><option value="AU">Australia</option><option value="SG">Singapore</option></select></div>
      <div class="field"><label for="binge-genre">Genre</label><select id="binge-genre" name="genre"><option value="">Any</option><option>Thriller</option><option>Drama</option><option>Comedy</option><option>Mystery</option><option>Crime</option><option>Animation</option><option>Documentary</option></select></div>
      <div class="field"><label for="binge-hours">Total hours available</label><input id="binge-hours" name="maxHours" type="number" min="1" max="300" value="12" required></div>
      <div class="field"><label for="binge-daily">Minutes per day</label><input id="binge-daily" name="minutesPerDay" type="number" min="15" max="720" value="120" required></div>
      <label class="check"><input id="binge-ended" name="completedOnly" type="checkbox" checked>Ended series only (excludes cancelled)</label>
      <button class="planning-button" type="submit">Find a series</button>
    </form>
    <div id="binge-output" class="empty" aria-live="polite">Set a viewing budget to find a series and estimate how long it will take.</div>
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

    document.querySelector("#binge-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const bingeForm = event.currentTarget;
      const button = bingeForm.querySelector('button[type="submit"]');
      const target = document.querySelector("#binge-output");
      button.disabled = true;
      button.textContent = "Finding…";
      target.className = "empty";
      target.textContent = "Checking series status, estimated viewing time, and subscriptions…";
      try {
        const data = new FormData(bingeForm);
        const result = await planningRequest("/api/tv-binge-plan", {
          country: data.get("country"), genre: data.get("genre"),
          maxHours: Number(data.get("maxHours")), minutesPerDay: Number(data.get("minutesPerDay")),
          completedOnly: data.has("completedOnly"), services: selectedPlanningServices(), language: form.elements.language.value,
        });
        target.className = "lab-output";
        target.innerHTML = renderDecisionSection("TV Binge Planner · " + result.country, result.decision) +
          '<ol class="lab-list">' + result.picks.map((pick) =>
            '<li class="lab-item"><strong>' + escapeHtml(pick.title + " (" + pick.year + ")") + '</strong><span>' +
            escapeHtml(pick.rating + "/10 · " + pick.status + " · " + pick.seasons + " seasons · " + pick.episodes + " episodes") +
            '</span><span>Estimated viewing time: ' + escapeHtml(formatMinutes(pick.estimatedRuntimeMinutes)) + '</span>' +
            '<span>' + escapeHtml(pick.reasons.join(" · ")) + '</span>' + planningProviders(pick.providers) + '</li>'
          ).join("") + '</ol>' + renderDecisionSection("Notes", result.notes);
      } catch (error) {
        target.className = "error";
        target.textContent = error.message || "Unable to find a series.";
      } finally {
        button.disabled = false;
        button.textContent = "Find a series";
      }
    });

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
