(() => {
  const GITHUB_USER = "WilliamThackeray";
  const LANG_COLORS = {
    JavaScript: "#f1e05a",
    TypeScript: "#3178c6",
    Python: "#3572a5",
    HTML: "#e34c26",
    CSS: "#563d7c",
    SCSS: "#c6538c",
    Shell: "#89e051",
    Go: "#00add8",
    Rust: "#dea584",
    Java: "#b07219",
    Ruby: "#701516",
    C: "#555555",
    "C++": "#f34b7d",
    "C#": "#178600",
    Swift: "#f05138",
    Kotlin: "#a97bff",
    PHP: "#4f5d95",
    Dart: "#00b4ab",
    Vue: "#41b883",
    Dockerfile: "#384d54",
    Markdown: "#083fa1",
  };

  const bars = document.getElementById("lang-bars");
  const commitsEl = document.querySelector('[data-fun="commits"]');

  function notifyUpdated() {
    window.dispatchEvent(new CustomEvent("fun-stats-updated"));
  }

  function renderLanguages(entries) {
    if (!bars) return;

    if (!entries.length) {
      bars.innerHTML = `<p class="fun-loading">No public language data found.</p>`;
      notifyUpdated();
      return;
    }

    bars.innerHTML = entries
      .map(
        ([name, pct]) => `
      <div class="lang-row">
        <div class="lang-label">
          <span class="lang-swatch" style="background:${LANG_COLORS[name] || "#fcbf49"}"></span>
          <span class="lang-name">${name}</span>
        </div>
        <span class="lang-pct">${pct}%</span>
        <div class="lang-track" aria-hidden="true">
          <div class="lang-fill" style="width:${pct}%; --lang-color:${LANG_COLORS[name] || "#fcbf49"}"></div>
        </div>
      </div>`
      )
      .join("");

    notifyUpdated();
  }

  async function loadLanguages() {
    if (!bars) return;

    try {
      const reposRes = await fetch(
        `https://api.github.com/users/${GITHUB_USER}/repos?per_page=100&type=owner&sort=updated`
      );
      if (!reposRes.ok) throw new Error(`repos ${reposRes.status}`);
      const repos = await reposRes.json();

      const totals = {};
      const languageFetches = repos
        .filter((repo) => !repo.fork && !repo.archived)
        .slice(0, 40)
        .map(async (repo) => {
          const res = await fetch(repo.languages_url);
          if (!res.ok) return;
          const langs = await res.json();
          Object.entries(langs).forEach(([lang, bytes]) => {
            totals[lang] = (totals[lang] || 0) + bytes;
          });
        });

      await Promise.all(languageFetches);

      const grand = Object.values(totals).reduce((a, b) => a + b, 0);
      if (!grand) {
        renderLanguages([]);
        return;
      }

      const ranked = Object.entries(totals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, bytes]) => [name, Math.max(1, Math.round((bytes / grand) * 100))]);

      // Keep percentages from looking like they sum past 100 after rounding
      const sum = ranked.reduce((a, [, p]) => a + p, 0);
      if (sum > 100 && ranked.length) {
        ranked[0][1] = Math.max(1, ranked[0][1] - (sum - 100));
      }

      renderLanguages(ranked);
    } catch (err) {
      console.warn("GitHub languages fetch failed:", err);
      bars.innerHTML = `<p class="fun-loading">Couldn’t load GitHub languages right now.</p>`;
      notifyUpdated();
    }
  }

  async function loadCommits() {
    if (!commitsEl) return;

    try {
      const res = await fetch("./data/fun-stats.json", { cache: "no-store" });
      if (!res.ok) throw new Error(`fun-stats ${res.status}`);
      const data = await res.json();
      const total = data && data.lifetimeCommits;

      if (typeof total === "number" && Number.isFinite(total)) {
        commitsEl.textContent = total.toLocaleString();
      } else {
        commitsEl.textContent = "—";
      }
      notifyUpdated();
    } catch (err) {
      console.warn("fun-stats.json fetch failed:", err);
      commitsEl.textContent = "—";
      notifyUpdated();
    }
  }

  loadLanguages();
  loadCommits();
})();
