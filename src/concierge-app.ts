export function renderConciergeApp(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Weekend Watch Concierge</title>
  <style>
    :root {
      color-scheme: light;
      --ink: #161616;
      --muted: #626262;
      --line: #d8d2c8;
      --paper: #f8f5ef;
      --panel: #ffffff;
      --accent: #0b6b5d;
      --accent-2: #b73e2f;
      --gold: #c18b1a;
      --shadow: 0 18px 48px rgba(24, 24, 24, 0.12);
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      min-height: 100vh;
      background: var(--paper);
      color: var(--ink);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    button,
    input,
    select {
      font: inherit;
    }

    .shell {
      display: grid;
      grid-template-columns: minmax(300px, 380px) minmax(0, 1fr);
      min-height: 100vh;
    }

    .controls {
      position: sticky;
      top: 0;
      height: 100vh;
      overflow: auto;
      padding: 28px;
      background: #fffdf8;
      border-right: 1px solid var(--line);
    }

    .brand {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 24px;
    }

    h1 {
      margin: 0;
      font-size: 24px;
      line-height: 1.1;
      letter-spacing: 0;
    }

    .status-pill {
      min-width: 70px;
      padding: 7px 10px;
      border: 1px solid var(--line);
      border-radius: 999px;
      color: var(--muted);
      background: #f4efe7;
      text-align: center;
      font-size: 12px;
      white-space: nowrap;
    }

    form {
      display: grid;
      gap: 18px;
    }

    .field {
      display: grid;
      gap: 8px;
    }

    label,
    legend {
      color: #343434;
      font-weight: 700;
      font-size: 13px;
    }

    select,
    input[type="text"],
    input[type="number"] {
      width: 100%;
      height: 42px;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 0 12px;
      color: var(--ink);
      background: var(--panel);
      outline: none;
    }

    select:focus,
    input:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(11, 107, 93, 0.14);
    }

    fieldset {
      margin: 0;
      padding: 0;
      border: 0;
    }

    .moods {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-top: 8px;
    }

    .mood {
      min-height: 42px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--panel);
      color: var(--ink);
      cursor: pointer;
    }

    .mood[aria-pressed="true"] {
      border-color: var(--accent);
      background: #e9f5f1;
      color: #06493f;
      font-weight: 700;
    }

    .service-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }

    .check {
      display: flex;
      align-items: center;
      gap: 8px;
      min-height: 38px;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 0 10px;
      background: var(--panel);
      font-size: 13px;
    }

    .check input {
      accent-color: var(--accent);
    }

    .actions {
      display: flex;
      gap: 10px;
      padding-top: 4px;
    }

    .primary,
    .secondary {
      height: 44px;
      border: 0;
      border-radius: 8px;
      padding: 0 14px;
      cursor: pointer;
      font-weight: 800;
    }

    .primary {
      flex: 1;
      color: #ffffff;
      background: var(--accent);
    }

    .primary:disabled {
      cursor: wait;
      background: #7c9992;
    }

    .secondary {
      width: 48px;
      border: 1px solid var(--line);
      background: var(--panel);
      color: var(--accent-2);
    }

    .content {
      padding: 30px clamp(18px, 4vw, 48px) 44px;
    }

    .topbar {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 20px;
      margin-bottom: 22px;
      border-bottom: 1px solid var(--line);
      padding-bottom: 18px;
    }

    .topbar h2 {
      margin: 0;
      font-size: clamp(25px, 4vw, 44px);
      line-height: 1;
      letter-spacing: 0;
    }

    .summary {
      max-width: 520px;
      color: var(--muted);
      line-height: 1.5;
      margin: 8px 0 0;
    }

    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: flex-end;
    }

    .chip {
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 7px 10px;
      color: #3e3a34;
      background: #fffdf8;
      font-size: 12px;
      font-weight: 700;
    }

    .results {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 18px;
      align-items: start;
    }

    .pick {
      overflow: hidden;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--panel);
      box-shadow: var(--shadow);
    }

    .poster {
      position: relative;
      aspect-ratio: 2 / 3;
      background: #223834;
      overflow: hidden;
    }

    .poster img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .poster-fallback {
      display: grid;
      place-items: center;
      width: 100%;
      height: 100%;
      padding: 22px;
      color: #fffdf8;
      text-align: center;
      font-weight: 800;
      background: linear-gradient(135deg, #0b6b5d, #2d2926 60%, #b73e2f);
    }

    .score {
      position: absolute;
      top: 10px;
      right: 10px;
      min-width: 42px;
      padding: 7px 8px;
      border-radius: 999px;
      color: #161616;
      background: #f4c542;
      text-align: center;
      font-weight: 900;
      font-size: 13px;
    }

    .pick-body {
      display: grid;
      gap: 12px;
      padding: 16px;
    }

    .title-row {
      display: flex;
      align-items: start;
      justify-content: space-between;
      gap: 12px;
    }

    .pick h3 {
      margin: 0;
      font-size: 18px;
      line-height: 1.2;
      letter-spacing: 0;
    }

    .rating {
      color: var(--gold);
      font-weight: 900;
      white-space: nowrap;
    }

    .facts,
    .providers,
    .reasons {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .fact,
    .provider,
    .reason {
      border-radius: 999px;
      padding: 5px 8px;
      font-size: 12px;
      line-height: 1.2;
    }

    .fact {
      background: #f0ece4;
      color: #49433b;
    }

    .provider {
      background: #e9f5f1;
      color: #06493f;
      font-weight: 700;
    }

    .reason {
      background: #fff2de;
      color: #6c3e00;
    }

    .overview {
      margin: 0;
      color: #343434;
      font-size: 14px;
      line-height: 1.45;
    }

    .credits {
      color: var(--muted);
      font-size: 13px;
      line-height: 1.4;
    }

    .empty,
    .error {
      border: 1px dashed var(--line);
      border-radius: 8px;
      padding: 24px;
      background: #fffdf8;
      color: var(--muted);
      line-height: 1.5;
    }

    .error {
      border-color: #e2a29a;
      background: #fff4f1;
      color: #813126;
    }

    .notes {
      margin-top: 18px;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.5;
    }

    @media (max-width: 860px) {
      .shell {
        grid-template-columns: 1fr;
      }

      .controls {
        position: relative;
        height: auto;
        border-right: 0;
        border-bottom: 1px solid var(--line);
      }

      .topbar {
        align-items: flex-start;
        flex-direction: column;
      }

      .meta {
        justify-content: flex-start;
      }
    }

    @media (max-width: 460px) {
      .controls,
      .content {
        padding-left: 16px;
        padding-right: 16px;
      }

      .moods,
      .service-grid {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <main class="shell">
    <aside class="controls">
      <div class="brand">
        <h1>Weekend Watch Concierge</h1>
        <div id="status" class="status-pill">Ready</div>
      </div>

      <form id="concierge-form">
        <fieldset>
          <legend>Mood</legend>
          <div class="moods" id="moods">
            <button class="mood" type="button" data-mood="crowd" aria-pressed="true">Crowd</button>
            <button class="mood" type="button" data-mood="thriller" aria-pressed="false">Thriller</button>
            <button class="mood" type="button" data-mood="thoughtful" aria-pressed="false">Drama</button>
            <button class="mood" type="button" data-mood="funny" aria-pressed="false">Funny</button>
            <button class="mood" type="button" data-mood="family" aria-pressed="false">Family</button>
            <button class="mood" type="button" data-mood="mindbend" aria-pressed="false">Sci-fi</button>
          </div>
        </fieldset>

        <div class="field">
          <label for="country">Country</label>
          <select id="country" name="country">
            <option value="IN">India</option>
            <option value="US">United States</option>
            <option value="GB">United Kingdom</option>
            <option value="CA">Canada</option>
            <option value="AU">Australia</option>
            <option value="SG">Singapore</option>
          </select>
        </div>

        <div class="field">
          <label for="language">Original language</label>
          <select id="language" name="language">
            <option value="any">Any language</option>
            <option value="en">English</option>
            <option value="hi">Hindi</option>
            <option value="ta">Tamil</option>
            <option value="te">Telugu</option>
            <option value="ml">Malayalam</option>
            <option value="kn">Kannada</option>
            <option value="ko">Korean</option>
            <option value="ja">Japanese</option>
            <option value="fr">French</option>
            <option value="es">Spanish</option>
          </select>
        </div>

        <div class="field">
          <label for="runtime">Max runtime</label>
          <select id="runtime" name="runtime">
            <option value="any">Any length</option>
            <option value="95">Under 95 min</option>
            <option value="120">Under 2 hours</option>
            <option value="150">Under 2.5 hours</option>
          </select>
        </div>

        <div class="field">
          <label for="minRating">Minimum TMDB rating</label>
          <input id="minRating" name="minRating" type="number" min="0" max="9" step="0.1" value="6.5">
        </div>

        <div class="field">
          <label for="accessToken">Access token</label>
          <input id="accessToken" name="accessToken" type="text" autocomplete="off" placeholder="Only needed on protected deployments">
        </div>

        <fieldset>
          <legend>Services</legend>
          <div class="service-grid">
            <label class="check"><input type="checkbox" name="services" value="Netflix">Netflix</label>
            <label class="check"><input type="checkbox" name="services" value="Prime Video">Prime</label>
            <label class="check"><input type="checkbox" name="services" value="Disney">Disney</label>
            <label class="check"><input type="checkbox" name="services" value="Apple TV">Apple TV</label>
            <label class="check"><input type="checkbox" name="services" value="JioCinema">JioCinema</label>
            <label class="check"><input type="checkbox" name="services" value="Hotstar">Hotstar</label>
          </div>
        </fieldset>

        <div class="actions">
          <button class="primary" id="submit" type="submit">Find picks</button>
          <button class="secondary" id="reset" type="button" title="Reset filters">R</button>
        </div>
      </form>
    </aside>

    <section class="content">
      <div class="topbar">
        <div>
          <h2 id="headline">Tonight's shortlist</h2>
          <p class="summary" id="summary">Choose a mood and country, then generate a ranked watchlist with posters, ratings, cast, and streaming availability.</p>
        </div>
        <div class="meta" id="meta"></div>
      </div>

      <div id="output" class="empty">No picks generated yet.</div>
      <div id="notes" class="notes"></div>
    </section>
  </main>

  <script>
    const form = document.querySelector("#concierge-form");
    const statusEl = document.querySelector("#status");
    const output = document.querySelector("#output");
    const notes = document.querySelector("#notes");
    const meta = document.querySelector("#meta");
    const headline = document.querySelector("#headline");
    const summary = document.querySelector("#summary");
    const submit = document.querySelector("#submit");
    const accessToken = document.querySelector("#accessToken");
    let selectedMood = "crowd";

    accessToken.value = sessionStorage.getItem("tmdbConciergeAccessToken") || "";

    document.querySelectorAll(".mood").forEach((button) => {
      button.addEventListener("click", () => {
        selectedMood = button.dataset.mood;
        document.querySelectorAll(".mood").forEach((item) => {
          item.setAttribute("aria-pressed", String(item === button));
        });
      });
    });

    document.querySelector("#reset").addEventListener("click", () => {
      form.reset();
      selectedMood = "crowd";
      document.querySelectorAll(".mood").forEach((item) => {
        item.setAttribute("aria-pressed", String(item.dataset.mood === "crowd"));
      });
      output.className = "empty";
      output.textContent = "No picks generated yet.";
      notes.textContent = "";
      meta.innerHTML = "";
      headline.textContent = "Tonight's shortlist";
      summary.textContent = "Choose a mood and country, then generate a ranked watchlist with posters, ratings, cast, and streaming availability.";
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const payload = {
        mood: selectedMood,
        country: data.get("country"),
        language: data.get("language"),
        runtime: data.get("runtime"),
        minRating: data.get("minRating"),
        services: data.getAll("services"),
      };
      const token = String(data.get("accessToken") || "").trim();
      if (token) {
        sessionStorage.setItem("tmdbConciergeAccessToken", token);
      } else {
        sessionStorage.removeItem("tmdbConciergeAccessToken");
      }

      submit.disabled = true;
      statusEl.textContent = "Loading";
      output.className = "empty";
      output.textContent = "Checking TMDB...";
      notes.textContent = "";

      try {
        const response = await fetch("/api/concierge", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(token ? { authorization: "Bearer " + token } : {}),
          },
          body: JSON.stringify(payload),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Request failed");
        renderResult(result);
        statusEl.textContent = "Done";
      } catch (error) {
        output.className = "error";
        output.textContent = error instanceof Error ? error.message : "Unable to generate picks.";
        statusEl.textContent = "Error";
      } finally {
        submit.disabled = false;
      }
    });

    function text(value) {
      return String(value || "");
    }

    function chip(value, className = "chip") {
      return "<span class=\\"" + className + "\\">" + escapeHtml(value) + "</span>";
    }

    function renderResult(result) {
      headline.textContent = result.mood + " picks";
      summary.textContent = "Ranked for " + result.country + " with " + result.language + " preference.";
      meta.innerHTML = [
        chip(result.country),
        chip(result.language),
        chip(new Date(result.generatedAt).toLocaleString()),
      ].join("");

      if (!result.picks || result.picks.length === 0) {
        output.className = "empty";
        output.textContent = "No matching picks found. Try a lower rating, broader language, or longer runtime.";
        return;
      }

      output.className = "results";
      output.innerHTML = result.picks.map(renderPick).join("");
      notes.innerHTML = (result.notes || []).map((note) => "<div>" + escapeHtml(note) + "</div>").join("");
    }

    function renderPick(pick) {
      const poster = pick.posterUrl
        ? "<img src=\\"" + escapeHtml(pick.posterUrl) + "\\" alt=\\"" + escapeHtml(pick.title) + " poster\\" loading=\\"lazy\\">"
        : "<div class=\\"poster-fallback\\">" + escapeHtml(pick.title) + "</div>";
      const facts = [
        pick.year,
        pick.runtime ? pick.runtime + " min" : null,
        ...(pick.genres || []).slice(0, 3),
      ].filter(Boolean).map((item) => chip(item, "fact")).join("");
      const providers = [
        ...(pick.providers.streaming || []),
        ...(pick.providers.rent || []).slice(0, 2),
        ...(pick.providers.buy || []).slice(0, 1),
      ].slice(0, 5).map((item) => chip(item, "provider")).join("");
      const reasons = (pick.reasons || []).map((item) => chip(item, "reason")).join("");
      const cast = (pick.cast || []).length ? "Cast: " + pick.cast.join(", ") : "";
      const director = pick.director ? "Director: " + pick.director : "";

      return "<article class=\\"pick\\">" +
        "<div class=\\"poster\\">" + poster + "<div class=\\"score\\">" + escapeHtml(pick.score) + "</div></div>" +
        "<div class=\\"pick-body\\">" +
          "<div class=\\"title-row\\"><h3>" + escapeHtml(pick.title) + "</h3><div class=\\"rating\\">" + Number(pick.rating || 0).toFixed(1) + "</div></div>" +
          "<div class=\\"facts\\">" + facts + "</div>" +
          "<p class=\\"overview\\">" + escapeHtml(text(pick.overview).slice(0, 260)) + "</p>" +
          "<div class=\\"credits\\">" + escapeHtml([director, cast].filter(Boolean).join(" | ")) + "</div>" +
          (providers ? "<div class=\\"providers\\">" + providers + "</div>" : "") +
          "<div class=\\"reasons\\">" + reasons + "</div>" +
        "</div>" +
      "</article>";
    }

    function escapeHtml(value) {
      return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll("\\"", "&quot;")
        .replaceAll("'", "&#039;");
    }
  </script>
</body>
</html>`;
}
