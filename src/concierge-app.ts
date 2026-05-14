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

    .mode-toggle {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      padding: 4px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #f4efe7;
    }

    .mode-option {
      height: 36px;
      border: 0;
      border-radius: 6px;
      background: transparent;
      color: var(--muted);
      cursor: pointer;
      font-weight: 800;
    }

    .mode-option[aria-pressed="true"] {
      background: var(--panel);
      color: #06493f;
      box-shadow: 0 1px 5px rgba(24, 24, 24, 0.12);
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

    .party-only[hidden] {
      display: none;
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

    .trend-panel {
      display: grid;
      gap: 14px;
      margin-bottom: 24px;
      padding-bottom: 22px;
      border-bottom: 1px solid var(--line);
    }

    .trend-head,
    .mcp-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
    }

    .trend-title,
    .mcp-title {
      display: grid;
      gap: 4px;
    }

    .trend-title h3,
    .mcp-title h3 {
      margin: 0;
      font-size: 18px;
      line-height: 1.2;
      letter-spacing: 0;
    }

    .trend-title p,
    .mcp-title p {
      margin: 0;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.4;
    }

    .trend-button,
    .mcp-button {
      min-width: 112px;
      height: 36px;
      border: 1px solid var(--line);
      border-radius: 8px;
      color: #06493f;
      background: #e9f5f1;
      cursor: pointer;
      font-weight: 800;
    }

    .trend-button:disabled,
    .mcp-button:disabled {
      cursor: wait;
      color: var(--muted);
      background: #f0ece4;
    }

    .trend-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }

    .trend-grid > .empty,
    .trend-grid > .error {
      grid-column: 1 / -1;
    }

    .trend-group {
      min-height: 132px;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 12px;
      background: #fffdf8;
    }

    .trend-group h4 {
      margin: 0 0 10px;
      font-size: 13px;
      line-height: 1.2;
      letter-spacing: 0;
    }

    .trend-list {
      display: grid;
      gap: 8px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .trend-item {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px;
      align-items: start;
      color: #343434;
      font-size: 13px;
      line-height: 1.3;
    }

    .trend-name {
      min-width: 0;
      overflow-wrap: anywhere;
    }

    .trend-rating {
      color: var(--gold);
      font-weight: 900;
      white-space: nowrap;
    }

    .trend-empty {
      color: var(--muted);
      font-size: 13px;
      line-height: 1.4;
    }

    .mcp-panel {
      display: grid;
      gap: 14px;
      margin-bottom: 24px;
      padding-bottom: 22px;
      border-bottom: 1px solid var(--line);
    }

    .workflow-panel {
      display: grid;
      gap: 14px;
      margin-bottom: 24px;
      padding-bottom: 22px;
      border-bottom: 1px solid var(--line);
    }

    .planning-panel {
      display: grid;
      gap: 14px;
      margin-bottom: 24px;
      padding-bottom: 22px;
      border-bottom: 1px solid var(--line);
    }

    .workflow-head,
    .planning-head {
      display: grid;
      gap: 4px;
    }

    .workflow-head h3,
    .planning-head h3 {
      margin: 0;
      font-size: 18px;
      line-height: 1.2;
      letter-spacing: 0;
    }

    .workflow-head p,
    .planning-head p {
      margin: 0;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.4;
    }

    .planning-form {
      display: grid;
      grid-template-columns: minmax(180px, 1.2fr) minmax(180px, 1.4fr) repeat(2, minmax(120px, 0.7fr)) auto;
      gap: 10px;
      align-items: end;
    }

    .planning-button {
      min-width: 112px;
      height: 42px;
      border: 0;
      border-radius: 8px;
      color: #ffffff;
      background: var(--accent);
      cursor: pointer;
      font-weight: 800;
    }

    .planning-button:disabled {
      cursor: wait;
      background: #7c9992;
    }

    .gap-output {
      display: grid;
      gap: 12px;
    }

    .gap-kpis {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
    }

    .gap-kpi,
    .gap-section {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #fffdf8;
      padding: 12px;
    }

    .gap-kpi span {
      display: block;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.3;
    }

    .gap-kpi strong {
      display: block;
      margin-top: 5px;
      color: #06493f;
      font-size: 22px;
      line-height: 1.1;
    }

    .gap-columns {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }

    .gap-section h4 {
      margin: 0 0 10px;
      font-size: 13px;
      line-height: 1.2;
      letter-spacing: 0;
    }

    .gap-list {
      display: grid;
      gap: 10px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .gap-item {
      display: grid;
      gap: 6px;
      color: #343434;
      font-size: 13px;
      line-height: 1.35;
    }

    .gap-item strong {
      color: var(--ink);
    }

    .workflow-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }

    .workflow-card {
      display: grid;
      grid-template-rows: auto auto 1fr auto;
      gap: 10px;
      min-height: 210px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #fffdf8;
      padding: 12px;
    }

    .workflow-card h4 {
      margin: 0;
      font-size: 14px;
      line-height: 1.2;
      letter-spacing: 0;
    }

    .workflow-card p {
      margin: 0;
      color: #343434;
      font-size: 13px;
      line-height: 1.4;
    }

    .workflow-command {
      min-height: 76px;
      margin: 0;
      overflow: auto;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      border-radius: 8px;
      padding: 10px;
      color: #23312f;
      background: #f0ece4;
      font-size: 12px;
      line-height: 1.4;
    }

    .workflow-artifact {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.35;
      overflow-wrap: anywhere;
    }

    .mcp-output {
      display: grid;
      gap: 12px;
    }

    .mcp-kpis {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
    }

    .mcp-kpi,
    .mcp-sample {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #fffdf8;
      padding: 12px;
    }

    .mcp-kpi {
      min-height: 74px;
    }

    .mcp-kpi span {
      display: block;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.3;
    }

    .mcp-kpi strong {
      display: block;
      margin-top: 5px;
      color: #06493f;
      font-size: 22px;
      line-height: 1.1;
    }

    .mcp-samples {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }

    .mcp-sample h4 {
      margin: 0 0 8px;
      font-size: 13px;
      line-height: 1.2;
      letter-spacing: 0;
    }

    .mcp-sample pre {
      margin: 0;
      max-height: 230px;
      overflow: auto;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      color: #343434;
      font-size: 12px;
      line-height: 1.4;
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

    .role {
      width: fit-content;
      border-radius: 999px;
      padding: 5px 8px;
      color: #06493f;
      background: #e9f5f1;
      font-size: 12px;
      font-weight: 900;
      line-height: 1.2;
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

      .trend-grid {
        grid-template-columns: 1fr;
      }

      .mcp-kpis,
      .mcp-samples,
      .gap-kpis,
      .gap-columns,
      .planning-form,
      .workflow-grid {
        grid-template-columns: 1fr;
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

      .trend-head,
      .mcp-head {
        align-items: stretch;
        flex-direction: column;
      }

      .trend-button,
      .mcp-button {
        width: 100%;
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
          <legend>Mode</legend>
          <div class="mode-toggle" id="mode-toggle">
            <button class="mode-option" type="button" data-mode="solo" aria-pressed="true">Solo</button>
            <button class="mode-option" type="button" data-mode="party" aria-pressed="false">Watch Party</button>
          </div>
        </fieldset>

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

        <div class="field party-only" hidden>
          <label for="groupSize">Group size</label>
          <input id="groupSize" name="groupSize" type="number" min="1" max="20" step="1" value="5">
        </div>

        <div class="field party-only" hidden>
          <label for="avoidTitles">Avoid titles</label>
          <input id="avoidTitles" name="avoidTitles" type="text" autocomplete="off" placeholder="Comma-separated titles already seen">
        </div>

        <div class="field">
          <label for="minRating">Minimum TMDB rating</label>
          <input id="minRating" name="minRating" type="number" min="0" max="9" step="0.1" value="6.5">
        </div>

        <label class="check"><input type="checkbox" name="familySafe" value="true">Family-safe</label>

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

      <section class="trend-panel" aria-labelledby="trend-heading">
        <div class="trend-head">
          <div class="trend-title">
            <h3 id="trend-heading">Weekly trend scan</h3>
            <p id="trend-summary">Live TMDB weekly trending movies grouped by original language.</p>
          </div>
          <button class="trend-button" id="load-trends" type="button">Load trends</button>
        </div>
        <div id="trend-output" class="trend-grid">
          <div class="empty">Load weekly trends to compare English, Hindi, and Telugu momentum.</div>
        </div>
      </section>

      <section class="mcp-panel" aria-labelledby="mcp-heading">
        <div class="mcp-head">
          <div class="mcp-title">
            <h3 id="mcp-heading">MCP tool surface</h3>
            <p id="mcp-summary">Verify the remote MCP route and sample the main workflow tools.</p>
          </div>
          <button class="mcp-button" id="run-mcp-smoke" type="button">Run smoke</button>
        </div>
        <div id="mcp-output" class="empty">Run the smoke check to confirm the deployed MCP endpoint exposes the expected workflow tools.</div>
      </section>

      <section class="planning-panel" aria-labelledby="planning-heading">
        <div class="planning-head">
          <h3 id="planning-heading">Planning Lab</h3>
          <p>Build a franchise completion plan from watched titles, provider availability, and remaining runtime.</p>
        </div>
        <form id="collection-gap-form" class="planning-form">
          <div class="field">
            <label for="gapQuery">Franchise/title</label>
            <input id="gapQuery" name="query" type="text" autocomplete="off" value="The Matrix">
          </div>
          <div class="field">
            <label for="watchedTitles">Watched titles or IDs</label>
            <input id="watchedTitles" name="watchedTitles" type="text" autocomplete="off" placeholder="The Matrix, 604">
          </div>
          <div class="field">
            <label for="gapCountry">Country</label>
            <select id="gapCountry" name="country">
              <option value="IN">India</option>
              <option value="US" selected>United States</option>
              <option value="GB">United Kingdom</option>
              <option value="CA">Canada</option>
              <option value="AU">Australia</option>
              <option value="SG">Singapore</option>
            </select>
          </div>
          <div class="field">
            <label for="maxMovies">Max entries</label>
            <input id="maxMovies" name="maxMovies" type="number" min="2" max="20" step="1" value="12">
          </div>
          <button class="planning-button" id="run-gap-plan" type="submit">Build plan</button>
        </form>
        <div id="gap-output" class="empty">Enter a franchise and watched titles to generate a collection gap plan.</div>
      </section>

      <section class="workflow-panel" aria-labelledby="workflow-heading">
        <div class="workflow-head">
          <h3 id="workflow-heading">Workflow demos</h3>
          <p>Script-first workflows that generate local Markdown artifacts without adding more MCP tools.</p>
        </div>
        <div class="workflow-grid">
          <article class="workflow-card">
            <h4>Weekly Streaming Radar</h4>
            <p>Trends, language momentum, action-ready picks, family-safe picks, and taste-profile probes.</p>
            <pre class="workflow-command">npm run demo:weekly-radar -- --country US</pre>
            <div class="workflow-artifact">Writes examples/weekly-streaming-radar.md</div>
          </article>
          <article class="workflow-card">
            <h4>Provider Change Monitor</h4>
            <p>Compares streaming, rental, and purchase providers against the previous JSON snapshot.</p>
            <pre class="workflow-command">npm run demo:provider-monitor -- --country US --titles "The Matrix,Inception"</pre>
            <div class="workflow-artifact">Writes examples/provider-change-monitor.md and examples/provider-change-snapshot.json</div>
          </article>
          <article class="workflow-card">
            <h4>Collection Gap Finder</h4>
            <p>Finds watched and missing franchise entries, remaining runtime, provider availability, and completion path.</p>
            <pre class="workflow-command">npm run demo:collection-gaps -- --franchise "The Matrix" --watched "The Matrix" --country US</pre>
            <div class="workflow-artifact">Writes examples/collection-gap-finder.md</div>
          </article>
        </div>
      </section>

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
    const loadTrends = document.querySelector("#load-trends");
    const trendOutput = document.querySelector("#trend-output");
    const trendSummary = document.querySelector("#trend-summary");
    const runMcpSmoke = document.querySelector("#run-mcp-smoke");
    const mcpOutput = document.querySelector("#mcp-output");
    const mcpSummary = document.querySelector("#mcp-summary");
    const collectionGapForm = document.querySelector("#collection-gap-form");
    const runGapPlan = document.querySelector("#run-gap-plan");
    const gapOutput = document.querySelector("#gap-output");
    let selectedMode = "solo";
    let selectedMood = "crowd";
    let selectedMoods = new Set(["crowd"]);
    const expectedTools = [
      "advanced_search",
      "build_collection_gap_plan",
      "build_franchise_watch_order",
      "compare_movies",
      "find_where_to_watch",
      "get_movie_details",
      "get_now_playing",
      "build_person_watch_path",
      "get_person_details",
      "plan_watch_party",
      "recommend_from_taste_profile",
      "get_recommendations",
      "get_similar_movies",
      "get_trending",
      "get_trending_tv",
      "get_watch_providers",
      "get_weekend_watchlist",
      "get_weekly_trending_by_language",
      "search_by_genre",
      "search_by_keyword",
      "search_movies",
      "search_person",
      "search_tv_shows",
    ];

    accessToken.value = sessionStorage.getItem("tmdbConciergeAccessToken") || "";

    document.querySelectorAll(".mode-option").forEach((button) => {
      button.addEventListener("click", () => {
        selectedMode = button.dataset.mode;
        document.querySelectorAll(".mode-option").forEach((item) => {
          item.setAttribute("aria-pressed", String(item === button));
        });
        document.querySelectorAll(".party-only").forEach((item) => {
          item.hidden = selectedMode !== "party";
        });
        summary.textContent = selectedMode === "party"
          ? "Balance a few moods for the group, then generate a primary pick, backup, and wildcard."
          : "Choose a mood and country, then generate a ranked watchlist with posters, ratings, cast, and streaming availability.";
      });
    });

    document.querySelectorAll(".mood").forEach((button) => {
      button.addEventListener("click", () => {
        const mood = button.dataset.mood;
        if (selectedMode === "party") {
          if (selectedMoods.has(mood) && selectedMoods.size > 1) {
            selectedMoods.delete(mood);
          } else {
            selectedMoods.add(mood);
          }
          if (selectedMoods.size > 3) {
            selectedMoods.delete(selectedMoods.values().next().value);
          }
          selectedMood = selectedMoods.values().next().value || "crowd";
          document.querySelectorAll(".mood").forEach((item) => {
            item.setAttribute("aria-pressed", String(selectedMoods.has(item.dataset.mood)));
          });
        } else {
          selectedMood = mood;
          selectedMoods = new Set([mood]);
          document.querySelectorAll(".mood").forEach((item) => {
            item.setAttribute("aria-pressed", String(item === button));
          });
        }
      });
    });

    document.querySelector("#reset").addEventListener("click", () => {
      form.reset();
      selectedMode = "solo";
      selectedMood = "crowd";
      selectedMoods = new Set(["crowd"]);
      document.querySelectorAll(".mode-option").forEach((item) => {
        item.setAttribute("aria-pressed", String(item.dataset.mode === "solo"));
      });
      document.querySelectorAll(".party-only").forEach((item) => {
        item.hidden = true;
      });
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

    loadTrends.addEventListener("click", loadWeeklyTrends);
    runMcpSmoke.addEventListener("click", runMcpToolSmoke);
    collectionGapForm.addEventListener("submit", buildCollectionGapPlan);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const sharedPayload = {
        country: data.get("country"),
        language: data.get("language"),
        runtime: data.get("runtime"),
        minRating: data.get("minRating"),
        services: data.getAll("services"),
        familySafe: data.get("familySafe") ? "true" : "false",
      };
      const payload = selectedMode === "party"
        ? {
            ...sharedPayload,
            moods: Array.from(selectedMoods),
            groupSize: data.get("groupSize"),
            avoidTitles: String(data.get("avoidTitles") || "")
              .split(",")
              .map((title) => title.trim())
              .filter(Boolean),
          }
        : {
            ...sharedPayload,
            mood: selectedMood,
          };
      const endpoint = selectedMode === "party" ? "/api/watch-party" : "/api/concierge";
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
        const response = await fetch(endpoint, {
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

    async function loadWeeklyTrends() {
      const token = String(accessToken.value || "").trim();
      if (token) {
        sessionStorage.setItem("tmdbConciergeAccessToken", token);
      }

      loadTrends.disabled = true;
      loadTrends.textContent = "Loading";
      trendOutput.className = "empty";
      trendOutput.textContent = "Checking weekly TMDB trends...";

      try {
        const response = await fetch("/api/weekly-trending-languages", {
          headers: {
            ...(token ? { authorization: "Bearer " + token } : {}),
          },
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Request failed");
        renderWeeklyTrends(result);
        statusEl.textContent = "Done";
      } catch (error) {
        trendOutput.className = "error";
        trendOutput.textContent = error instanceof Error ? error.message : "Unable to load weekly trends.";
        statusEl.textContent = "Error";
      } finally {
        loadTrends.disabled = false;
        loadTrends.textContent = "Refresh";
      }
    }

    async function runMcpToolSmoke() {
      const token = String(accessToken.value || "").trim();
      if (token) {
        sessionStorage.setItem("tmdbConciergeAccessToken", token);
      }

      runMcpSmoke.disabled = true;
      runMcpSmoke.textContent = "Running";
      mcpOutput.className = "empty";
      mcpOutput.textContent = "Calling /mcp and sampling workflow tools...";

      try {
        const client = createMcpClient(token);
        await client.rpc("initialize", {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: {
            name: "weekend-watch-concierge-browser",
            version: "1.0.0",
          },
        });
        const toolsResult = await client.rpc("tools/list", {});
        const toolNames = (toolsResult.tools || []).map((tool) => tool.name).sort();
        const missing = expectedTools.filter((tool) => !toolNames.includes(tool));
        if (missing.length) throw new Error("Missing expected tools: " + missing.join(", "));

        const samples = await Promise.all([
          client.rpc("tools/call", {
            name: "compare_movies",
            arguments: { movieIds: ["603", "155"], country: "US" },
          }),
          client.rpc("tools/call", {
            name: "find_where_to_watch",
            arguments: { titles: ["The Matrix", "The Dark Knight"], country: "US", services: ["HBO", "Netflix"] },
          }),
          client.rpc("tools/call", {
            name: "get_weekend_watchlist",
            arguments: {
              mood: "thriller",
              country: "US",
              language: "any",
              runtime: "150",
              minRating: "6.5",
              services: ["Netflix", "Prime Video"],
              familySafe: "true",
            },
          }),
          client.rpc("tools/call", {
            name: "plan_watch_party",
            arguments: {
              moods: ["crowd", "thriller"],
              groupSize: "5",
              country: "US",
              language: "any",
              runtime: "135",
              minRating: "6.8",
              services: ["Netflix", "Prime Video"],
              avoidTitles: ["The Matrix"],
              familySafe: "true",
            },
          }),
          client.rpc("tools/call", {
            name: "build_franchise_watch_order",
            arguments: { query: "The Matrix", country: "US", maxMovies: "5" },
          }),
          client.rpc("tools/call", {
            name: "build_collection_gap_plan",
            arguments: { query: "The Matrix", watchedTitles: ["The Matrix"], country: "US", services: ["Netflix", "Prime Video"], maxMovies: "5" },
          }),
          client.rpc("tools/call", {
            name: "recommend_from_taste_profile",
            arguments: {
              likedTitles: ["The Matrix", "Inception"],
              dislikedTitles: ["The Notebook"],
              country: "US",
              services: ["Netflix", "Prime Video"],
              language: "any",
              runtime: "160",
              minRating: "6.7",
              maxResults: "5",
            },
          }),
          client.rpc("tools/call", {
            name: "build_person_watch_path",
            arguments: { name: "Keanu Reeves", country: "US", services: ["Netflix", "Prime Video"], maxTitles: "5" },
          }),
        ]);

        const sampleData = [
          { name: "compare_movies", text: textFromToolResult(samples[0]) },
          { name: "find_where_to_watch", text: textFromToolResult(samples[1]) },
          { name: "get_weekend_watchlist", text: textFromToolResult(samples[2]) },
          { name: "plan_watch_party", text: textFromToolResult(samples[3]) },
          { name: "build_franchise_watch_order", text: textFromToolResult(samples[4]) },
          { name: "build_collection_gap_plan", text: textFromToolResult(samples[5]) },
          { name: "recommend_from_taste_profile", text: textFromToolResult(samples[6]) },
          { name: "build_person_watch_path", text: textFromToolResult(samples[7]) },
        ];
        renderMcpSmoke(toolNames, sampleData);
        statusEl.textContent = "Done";
      } catch (error) {
        mcpOutput.className = "error";
        mcpOutput.textContent = error instanceof Error ? error.message : "Unable to run MCP smoke.";
        statusEl.textContent = "Error";
      } finally {
        runMcpSmoke.disabled = false;
        runMcpSmoke.textContent = "Run smoke";
      }
    }

    async function buildCollectionGapPlan(event) {
      event.preventDefault();
      const data = new FormData(collectionGapForm);
      const token = String(accessToken.value || "").trim();
      if (token) {
        sessionStorage.setItem("tmdbConciergeAccessToken", token);
      }

      const selectedServices = Array.from(form.querySelectorAll('input[name="services"]:checked')).map((item) => item.value);
      const payload = {
        query: String(data.get("query") || "").trim(),
        watchedTitles: String(data.get("watchedTitles") || "")
          .split(",")
          .map((title) => title.trim())
          .filter(Boolean),
        country: data.get("country"),
        services: selectedServices,
        maxMovies: String(data.get("maxMovies") || "12"),
      };

      runGapPlan.disabled = true;
      runGapPlan.textContent = "Building";
      gapOutput.className = "empty";
      gapOutput.textContent = "Checking collection, watched entries, and provider availability...";

      try {
        const response = await fetch("/api/collection-gap-plan", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(token ? { authorization: "Bearer " + token } : {}),
          },
          body: JSON.stringify(payload),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Request failed");
        renderCollectionGapPlan(result);
        statusEl.textContent = "Done";
      } catch (error) {
        gapOutput.className = "error";
        gapOutput.textContent = error instanceof Error ? error.message : "Unable to build collection gap plan.";
        statusEl.textContent = "Error";
      } finally {
        runGapPlan.disabled = false;
        runGapPlan.textContent = "Build plan";
      }
    }

    function createMcpClient(token) {
      let id = 1;
      return {
        async rpc(method, params) {
          const response = await fetch("/mcp", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              accept: "application/json, text/event-stream",
              ...(token ? { authorization: "Bearer " + token } : {}),
            },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: id++,
              method,
              params,
            }),
          });
          const raw = await response.text();
          if (!response.ok) throw new Error(method + " failed with " + response.status + ": " + raw);
          const payload = parseMcpPayload(raw);
          if (payload.error) throw new Error(method + " returned error: " + JSON.stringify(payload.error));
          return payload.result;
        },
      };
    }

    function parseMcpPayload(raw) {
      if (!raw.startsWith("event:")) return JSON.parse(raw);
      const dataLine = raw.split("\\n").find((line) => line.startsWith("data: "));
      return JSON.parse(dataLine ? dataLine.slice(6) : "{}");
    }

    function textFromToolResult(result) {
      if (result.isError) throw new Error("MCP tool returned an error.");
      const item = (result.content || []).find((content) => content.type === "text" && "text" in content);
      if (!item) throw new Error("MCP tool response did not include text content.");
      return item.text || "";
    }

    function text(value) {
      return String(value || "");
    }

    function chip(value, className = "chip") {
      return "<span class=\\"" + className + "\\">" + escapeHtml(value) + "</span>";
    }

    function renderResult(result) {
      const isParty = Array.isArray(result.moods);
      headline.textContent = isParty ? "Watch party plan" : result.mood + " picks";
      summary.textContent = isParty
        ? "Primary pick, backup, and wildcard for a group of " + result.groupSize + "."
        : "Ranked for " + result.country + " with " + result.language + " preference.";
      meta.innerHTML = [
        isParty ? chip("Group " + result.groupSize) : null,
        chip(result.country),
        chip(result.language),
        chip(new Date(result.generatedAt).toLocaleString()),
      ].filter(Boolean).join("");

      if (!result.picks || result.picks.length === 0) {
        output.className = "empty";
        output.textContent = "No matching picks found. Try a lower rating, broader language, or longer runtime.";
        return;
      }

      output.className = "results";
      output.innerHTML = result.picks.map(renderPick).join("");
      const decision = isParty && result.decision
        ? "<div><strong>Decision</strong></div>" + result.decision.map((line) => "<div>" + escapeHtml(line) + "</div>").join("")
        : "";
      const noteHtml = (result.notes || []).map((note) => "<div>" + escapeHtml(note) + "</div>").join("");
      notes.innerHTML = [decision, noteHtml].filter(Boolean).join("");
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
      const role = pick.partyRole ? "<div class=\\"role\\">" + escapeHtml(pick.partyRole) + "</div>" : "";
      const partyFit = pick.partyFit ? chip("Party fit: " + pick.partyFit, "reason") : "";

      return "<article class=\\"pick\\">" +
        "<div class=\\"poster\\">" + poster + "<div class=\\"score\\">" + escapeHtml(pick.score) + "</div></div>" +
        "<div class=\\"pick-body\\">" +
          role +
          "<div class=\\"title-row\\"><h3>" + escapeHtml(pick.title) + "</h3><div class=\\"rating\\">" + Number(pick.rating || 0).toFixed(1) + "</div></div>" +
          "<div class=\\"facts\\">" + facts + "</div>" +
          "<p class=\\"overview\\">" + escapeHtml(text(pick.overview).slice(0, 260)) + "</p>" +
          "<div class=\\"credits\\">" + escapeHtml([director, cast].filter(Boolean).join(" | ")) + "</div>" +
          (providers ? "<div class=\\"providers\\">" + providers + "</div>" : "") +
          "<div class=\\"reasons\\">" + partyFit + reasons + "</div>" +
        "</div>" +
      "</article>";
    }

    function renderWeeklyTrends(result) {
      trendSummary.textContent = result.source + " · " + new Date(result.generatedAt).toLocaleString();
      trendOutput.className = "trend-grid";
      trendOutput.innerHTML = (result.groups || []).map((group) => {
        const movies = group.movies || [];
        const visibleMovies = movies.slice(0, 8);
        const extraCount = Math.max(0, movies.length - visibleMovies.length);
        const body = movies.length
          ? "<ol class=\\"trend-list\\">" + visibleMovies.map((movie) =>
              "<li class=\\"trend-item\\">" +
                "<span class=\\"trend-name\\">" + escapeHtml(movie.title) + " (" + escapeHtml(movie.year) + ")</span>" +
                "<span class=\\"trend-rating\\">" + Number(movie.rating || 0).toFixed(1) + "</span>" +
              "</li>"
            ).join("") + "</ol>" +
            (extraCount ? "<div class=\\"trend-empty\\">+" + extraCount + " more in this group</div>" : "")
          : "<div class=\\"trend-empty\\">No movies in the current weekly trending top results.</div>";

        return "<article class=\\"trend-group\\">" +
          "<h4>" + escapeHtml(group.label) + " (" + escapeHtml(group.code) + ")</h4>" +
          body +
        "</article>";
      }).join("");
    }

    function renderMcpSmoke(toolNames, samples) {
      mcpSummary.textContent = "MCP route verified · " + new Date().toLocaleString();
      mcpOutput.className = "mcp-output";
      const kpis = [
        { label: "Expected tools", value: expectedTools.length },
        { label: "Actual tools", value: toolNames.length },
        { label: "Workflow calls", value: samples.length },
      ].map((item) =>
        "<div class=\\"mcp-kpi\\"><span>" + escapeHtml(item.label) + "</span><strong>" + escapeHtml(item.value) + "</strong></div>"
      ).join("");
      const sampleHtml = samples.map((sample) =>
        "<article class=\\"mcp-sample\\">" +
          "<h4>" + escapeHtml(sample.name) + "</h4>" +
          "<pre>" + escapeHtml(sample.text.split("\\n").slice(0, 14).join("\\n")) + "</pre>" +
        "</article>"
      ).join("");
      mcpOutput.innerHTML =
        "<div class=\\"mcp-kpis\\">" + kpis + "</div>" +
        "<div class=\\"mcp-samples\\">" + sampleHtml + "</div>";
    }

    function renderCollectionGapPlan(result) {
      gapOutput.className = "gap-output";
      const kpis = [
        { label: "Completion", value: result.completionPercent + "%" },
        { label: "Watched", value: (result.watched || []).length },
        { label: "Missing", value: (result.missing || []).length },
        { label: "Remaining", value: formatMinutes(result.remainingRuntimeMinutes) },
      ].map((item) =>
        "<div class=\\"gap-kpi\\"><span>" + escapeHtml(item.label) + "</span><strong>" + escapeHtml(item.value) + "</strong></div>"
      ).join("");
      gapOutput.innerHTML =
        "<div class=\\"gap-kpis\\">" + kpis + "</div>" +
        "<div class=\\"gap-columns\\">" +
          renderGapSection("Completion path", result.completionPath || []) +
          renderGapSection("Missing", result.missing || []) +
          renderGapSection("Watched", result.watched || []) +
        "</div>";
    }

    function renderGapSection(title, movies) {
      const body = movies.length
        ? "<ol class=\\"gap-list\\">" + movies.slice(0, 8).map((movie) =>
            "<li class=\\"gap-item\\">" +
              "<strong>" + escapeHtml(movie.title) + " (" + escapeHtml(movie.year) + ")</strong>" +
              "<span>" + Number(movie.rating || 0).toFixed(1) + "/10 · " + (movie.runtime ? escapeHtml(movie.runtime + " min") : "runtime unknown") + "</span>" +
              renderGapProviders(movie) +
            "</li>"
          ).join("") + "</ol>"
        : "<div class=\\"trend-empty\\">No entries.</div>";
      return "<article class=\\"gap-section\\"><h4>" + escapeHtml(title) + "</h4>" + body + "</article>";
    }

    function renderGapProviders(movie) {
      const providers = Array.from(new Set([
        ...(movie.providers?.streaming || []),
        ...(movie.providers?.rent || []).slice(0, 2),
        ...(movie.providers?.buy || []).slice(0, 1),
      ])).slice(0, 4);
      const matches = movie.providerMatch || [];
      const chips = [
        ...providers.map((provider) => chip(provider, matches.includes(provider) ? "reason" : "provider")),
        movie.availableNow ? chip("streaming now", "provider") : null,
      ].filter(Boolean).join("");
      return chips ? "<div class=\\"providers\\">" + chips + "</div>" : "<span>Availability: no providers found</span>";
    }

    function formatMinutes(minutes) {
      const value = Number(minutes || 0);
      if (!value) return "unknown";
      const hours = Math.floor(value / 60);
      const rest = value % 60;
      return hours > 0 ? hours + "h " + rest + "m" : rest + "m";
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
