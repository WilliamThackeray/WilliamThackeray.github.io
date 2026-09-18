(() => {
  const SECTIONS = ["me", "stuff", "words", "contact", "fun"];
  const MOBILE_MQ = "(max-width: 767px)";

  const viewport = document.getElementById("graph-viewport");
  const world = document.getElementById("graph-world");
  const edgesSvg = document.getElementById("graph-edges");
  const homeColumn = document.getElementById("home-column");
  const detailColumn = document.getElementById("detail-column");
  const detailTitle = document.getElementById("detail-title");
  const detailHeading = document.querySelector(".detail-heading");
  const detailSignature = document.getElementById("detail-signature");
  const backBtn = document.getElementById("back-btn");
  const navNodes = Array.from(document.querySelectorAll(".nav-node"));

  let activeSection = null;
  let traveling = false;

  const prefersReducedMotion = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const isMobile = () => window.matchMedia(MOBILE_MQ).matches;

  const panMs = () => {
    if (prefersReducedMotion()) return 0;
    const raw = getComputedStyle(document.documentElement)
      .getPropertyValue("--pan-duration")
      .trim();
    if (raw.endsWith("ms")) return parseFloat(raw) || 0;
    if (raw.endsWith("s")) return (parseFloat(raw) || 0) * 1000;
    return 850;
  };

  function ensureMarker() {
    if (edgesSvg.querySelector("#edge-arrow")) return;

    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
    marker.setAttribute("id", "edge-arrow");
    marker.setAttribute("viewBox", "0 0 10 10");
    marker.setAttribute("refX", "8");
    marker.setAttribute("refY", "5");
    marker.setAttribute("markerWidth", "6");
    marker.setAttribute("markerHeight", "6");
    marker.setAttribute("orient", "auto-start-reverse");

    const tip = document.createElementNS("http://www.w3.org/2000/svg", "path");
    tip.setAttribute("d", "M 0 0 L 10 5 L 0 10 z");
    tip.setAttribute("fill", "rgba(180, 186, 198, 0.75)");
    marker.appendChild(tip);
    defs.appendChild(marker);
    edgesSvg.appendChild(defs);
  }

  function clearEdges() {
    edgesSvg.querySelectorAll("path.edge").forEach((p) => p.remove());
  }

  function pointInWorld(el, side) {
    const wr = world.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const x =
      side === "right"
        ? r.right - wr.left
        : side === "left"
          ? r.left - wr.left
          : r.left + r.width / 2 - wr.left;
    const y = r.top + r.height / 2 - wr.top;
    return { x, y };
  }

  function curvePath(from, to) {
    const dx = Math.max(80, (to.x - from.x) * 0.55);
    return `M ${from.x} ${from.y} C ${from.x + dx} ${from.y}, ${to.x - dx} ${to.y}, ${to.x} ${to.y}`;
  }

  function sizeSvg() {
    const w = Math.max(world.scrollWidth, world.offsetWidth);
    const h = Math.max(world.scrollHeight, viewport.clientHeight);
    edgesSvg.setAttribute("width", String(w));
    edgesSvg.setAttribute("height", String(h));
    edgesSvg.style.width = `${w}px`;
    edgesSvg.style.height = `${h}px`;
  }

  function drawEdges({ animate = false } = {}) {
    clearEdges();
    if (!activeSection || isMobile()) return;

    const parent = document.querySelector(
      `.nav-node[data-section="${activeSection}"]`
    );
    const section = document.getElementById(activeSection);
    if (!parent || !section || section.hidden) return;

    const cards = section.querySelectorAll(".leaf-card");
    if (!cards.length) return;

    ensureMarker();
    sizeSvg();

    const from = pointInWorld(parent, "right");

    cards.forEach((card) => {
      const to = pointInWorld(card, "left");
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("class", "edge");
      path.setAttribute("d", curvePath(from, to));
      path.setAttribute("marker-end", "url(#edge-arrow)");
      edgesSvg.appendChild(path);

      if (animate && !prefersReducedMotion()) {
        const length = path.getTotalLength();
        path.style.setProperty("--path-length", String(length));
        path.classList.add("is-drawing");
      }
    });
  }

  /** Retract existing edges back toward the parent (reverse of draw). */
  function eraseEdges() {
    const paths = Array.from(edgesSvg.querySelectorAll("path.edge"));
    if (!paths.length || prefersReducedMotion()) {
      clearEdges();
      return Promise.resolve();
    }

    paths.forEach((path) => {
      const length = path.getTotalLength();
      path.style.setProperty("--path-length", String(length));
      path.style.strokeDasharray = String(length);
      path.style.strokeDashoffset = "0";
      path.classList.remove("is-drawing");
      path.removeAttribute("marker-end");
      // Restart erase animation cleanly
      path.classList.remove("is-erasing");
      void path.getBoundingClientRect();
      path.classList.add("is-erasing");
    });

    return new Promise((resolve) => {
      setTimeout(() => {
        clearEdges();
        resolve();
      }, panMs() + 40);
    });
  }

  /** Side padding so the first/last column can sit alone in the center. */
  function syncCameraPadding() {
    if (isMobile()) {
      world.style.paddingLeft = "";
      world.style.paddingRight = "";
      world.style.gap = "";
      return;
    }

    const side = Math.ceil(viewport.clientWidth);
    world.style.paddingLeft = `${side}px`;
    world.style.paddingRight = `${side}px`;

    // Gap large enough that when detail is centered, home is fully off-screen
    const col = homeColumn.offsetWidth;
    const needed = viewport.clientWidth / 2 - col / 2 + 64;
    world.style.gap = `${Math.max(needed, 520)}px`;
  }

  function scrollLeftFor(el) {
    return el.offsetLeft - (viewport.clientWidth - el.offsetWidth) / 2;
  }

  function travelTo(el, { instant = false } = {}) {
    if (isMobile()) {
      return Promise.resolve();
    }

    syncCameraPadding();
    const target = Math.max(0, scrollLeftFor(el));

    if (instant || prefersReducedMotion()) {
      viewport.scrollLeft = target;
      return Promise.resolve();
    }

    viewport.scrollTo({ left: target, behavior: "smooth" });

    return new Promise((resolve) => {
      const ms = panMs();
      let frames = 0;
      let last = viewport.scrollLeft;

      const tick = () => {
        frames += 1;
        const now = viewport.scrollLeft;
        const settled = Math.abs(now - target) < 1;
        const stalled = now === last && frames > 10;
        last = now;

        if (settled || stalled || frames > ms / 8) {
          viewport.scrollLeft = target;
          resolve();
          return;
        }
        requestAnimationFrame(tick);
      };

      requestAnimationFrame(tick);
      setTimeout(() => {
        viewport.scrollLeft = target;
        resolve();
      }, ms + 120);
    });
  }

  function setNavState(sectionId) {
    navNodes.forEach((node) => {
      const on = node.dataset.section === sectionId;
      node.classList.toggle("is-active", on);
      node.setAttribute("aria-expanded", on ? "true" : "false");
    });
  }

  function showSection(sectionId) {
    SECTIONS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.hidden = id !== sectionId;
    });

    const section = document.getElementById(sectionId);
    if (section) {
      detailTitle.textContent = section.dataset.title || "";
    }
    setSignatureVisible(sectionId === "me");
  }

  function setSignatureVisible(show) {
    if (detailSignature) detailSignature.hidden = !show;
    if (detailHeading) detailHeading.classList.toggle("has-signature", !!show);
  }

  async function openSection(sectionId, { pushHash = true, instant = false } = {}) {
    if (!SECTIONS.includes(sectionId) || traveling) return;

    const switching = activeSection !== null && activeSection !== sectionId;
    activeSection = sectionId;
    traveling = true;

    try {
      detailColumn.hidden = false;
      showSection(sectionId);
      setNavState(sectionId);
      viewport.classList.add("is-open");
      syncCameraPadding();

      if (pushHash) {
        const next = `#${sectionId}`;
        if (location.hash !== next) {
          history.pushState({ section: sectionId }, "", next);
        }
      }

      if (isMobile()) {
        clearEdges();
        detailColumn.scrollIntoView({
          behavior: prefersReducedMotion() ? "auto" : "smooth",
          block: "start",
        });
        return;
      }

      void detailColumn.offsetWidth;
      drawEdges({ animate: !instant && !switching });
      await travelTo(detailColumn, { instant: instant || prefersReducedMotion() });
      drawEdges({ animate: false });
    } finally {
      traveling = false;
    }
  }

  async function closeToHome({ pushHash = true, instant = false } = {}) {
    if (traveling) return;
    traveling = true;

    const returningFrom = activeSection;

    try {
      activeSection = null;
      setNavState(null);
      viewport.classList.remove("is-open");

      if (pushHash && location.hash) {
        history.pushState({ section: null }, "", location.pathname + location.search);
      }

      if (isMobile()) {
        clearEdges();
        detailColumn.hidden = true;
        SECTIONS.forEach((id) => {
          const el = document.getElementById(id);
          if (el) el.hidden = true;
        });
        detailTitle.textContent = "";
        setSignatureVisible(false);
        homeColumn.scrollIntoView({
          behavior: prefersReducedMotion() ? "auto" : "smooth",
          block: "start",
        });
        return;
      }

      // Keep edges while traveling back; retract them like the reverse of the open draw
      const shouldAnimate =
        returningFrom && !instant && !prefersReducedMotion();

      if (returningFrom && !shouldAnimate) {
        clearEdges();
      }

      const erasePromise = shouldAnimate ? eraseEdges() : Promise.resolve();
      await travelTo(homeColumn, { instant: instant || prefersReducedMotion() });
      await erasePromise;

      clearEdges();
      detailColumn.hidden = true;
      SECTIONS.forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.hidden = true;
      });
      detailTitle.textContent = "";
      setSignatureVisible(false);
      syncCameraPadding();
      await travelTo(homeColumn, { instant: true });
    } finally {
      traveling = false;
    }
  }

  function applyHash({ instant = false } = {}) {
    const hash = location.hash.replace(/^#/, "").toLowerCase();
    if (SECTIONS.includes(hash)) {
      openSection(hash, { pushHash: false, instant });
    } else if (activeSection) {
      closeToHome({ pushHash: false, instant });
    } else if (!isMobile()) {
      requestAnimationFrame(() => {
        syncCameraPadding();
        travelTo(homeColumn, { instant: true });
      });
    }
  }

  navNodes.forEach((node) => {
    node.addEventListener("click", () => {
      const section = node.dataset.section;
      if (activeSection === section) {
        closeToHome();
      } else {
        openSection(section);
      }
    });
  });

  backBtn.addEventListener("click", () => {
    closeToHome();
  });

  window.addEventListener("popstate", () => {
    applyHash();
  });

  window.addEventListener("hashchange", () => {
    applyHash();
  });

  window.addEventListener("resize", () => {
    if (traveling) return;
    if (isMobile()) {
      clearEdges();
      syncCameraPadding();
      return;
    }
    syncCameraPadding();
    travelTo(activeSection ? detailColumn : homeColumn, { instant: true });
    if (activeSection) drawEdges({ animate: false });
  });

  window.addEventListener("fun-stats-updated", () => {
    if (activeSection === "fun" && !isMobile()) {
      drawEdges({ animate: false });
    }
  });

  // Boot
  if (SECTIONS.includes(location.hash.replace(/^#/, "").toLowerCase())) {
    applyHash({ instant: true });
  } else {
    requestAnimationFrame(() => {
      syncCameraPadding();
      travelTo(homeColumn, { instant: true });
    });
  }
})();
