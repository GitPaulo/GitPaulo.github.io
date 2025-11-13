import "../css/style.css";

import * as pdfjsLib from "pdfjs-dist";
import A11yDialog from "a11y-dialog";
import isMobile from "is-mobile";
import Toastify from "toastify-js";

// PDF worker
pdfjsLib.GlobalWorkerOptions.workerSrc = "build/main.bundle.worker.js";

const PDF_URL = "resources/paulo_resume.pdf";
const loadingTask = pdfjsLib.getDocument(PDF_URL);

const MOBILE_SCALE = 0.75;
const BROWSER_SCALE = 1.5;
const TOO_SMALL_SCALE = 0.25;
const TOO_LARGE_SCALE = 5.0;
const RENDER_RESOLUTION = 1.6;
const FIT_EPSILON = 0.01;

let pdf = null;
let scale = 1;
let fittedScale = null;
let isFitted = false;
let currentRenderTask = null;

// Dialog state
let dialog = null;
let dialogEl = null;

const byId = (id) => document.getElementById(id);

const notify = (text, cb) => {
  Toastify({
    text,
    duration: 3000,
    className: "toast",
    gravity: "bottom",
    position: "center",
    stopOnFocus: true,
    callback: cb,
  }).showToast();
};

const debounce = (fn, ms) => {
  let t = null;
  return (...args) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
};

const isMobilePortrait = () => isMobile() && window.innerHeight > window.innerWidth;
const isLinksDialogOpen = () => dialogEl?.getAttribute("aria-hidden") === "false";

const getPage1 = async () => {
  if (!pdf) throw new Error("PDF not ready");
  return pdf.getPage(1);
};

const hideLinkHighlights = () => {
  document.querySelectorAll(".pdf-link-highlight").forEach((el) => {
    el.remove();
  });
};

const showLinkHighlights = () => {
  document.querySelectorAll(".pdf-link-highlight").forEach((el) => {
    el.style.opacity = "1";
  });
};

const updateScaleMessages = () => {
  const small = byId("too-small-message");
  const large = byId("too-large-message");

  if (small) small.style.display = scale <= TOO_SMALL_SCALE ? "block" : "none";
  if (large) large.style.display = scale >= TOO_LARGE_SCALE ? "block" : "none";
};

const checkFittedState = () => {
  const wrap = byId("canvas-wrap");
  const fitBtn = byId("b3");

  if (!wrap || !fitBtn || fittedScale == null) return;
  if (wrap.scrollTop < 0) return;

  const isAtTop = wrap.scrollTop <= 10;
  const isAtFittedZoom = Math.abs(scale - fittedScale) < FIT_EPSILON;
  const isCentered = wrap.classList.contains("centered");
  const shouldHideFit = isAtTop && isAtFittedZoom && isCentered;

  if (shouldHideFit === isFitted) return;

  isFitted = shouldHideFit;
  fitBtn.classList.toggle("visible", !isFitted);
  fitBtn.classList.toggle("hidden", isFitted);
};

const updateZoomButtonsAllowed = async () => {
  const wrap = byId("canvas-wrap");
  const zoomInBtn = byId("b1");
  const zoomOutBtn = byId("b5");
  if (!wrap || !zoomInBtn || !zoomOutBtn || !pdf) return;

  if (isMobilePortrait()) {
    zoomInBtn.disabled = true;
    zoomOutBtn.disabled = true;
    return;
  }

  zoomOutBtn.disabled = scale <= TOO_SMALL_SCALE;

  if (scale >= TOO_LARGE_SCALE) {
    zoomInBtn.disabled = true;
    return;
  }

  try {
    const page = await getPage1();
    const viewport = page.getViewport({ scale: 1.0 });
    const nextScale = scale + 0.25;
    const nextWidth = viewport.width * nextScale;

    // Account for 4rem padding on each side when not centered
    const isCentered = wrap.classList.contains("centered");
    const paddingPx = isCentered ? 0 : parseFloat(getComputedStyle(wrap).fontSize) * 8;
    const availableWidth = wrap.clientWidth - paddingPx;

    zoomInBtn.disabled = !isCentered && nextWidth >= availableWidth;
  } catch (err) {
    console.error("Update zoom buttons error:", err);
  }
};

const renderWithCurrentScale = () => {
  requestAnimationFrame(() => {
    (async () => {
      try {
        const page = await getPage1();
        await renderDocument(page, scale);
        updateScaleMessages();
        checkFittedState();
        updateZoomButtonsAllowed();
      } catch (err) {
        console.error("Render with current scale error:", err);
      }
    })();
  });
};

const fit = async () => {
  const canvasWrap = byId("canvas-wrap");
  if (!canvasWrap || !pdf) return;

  hideLinkHighlights();
  canvasWrap.classList.add("centered");
  canvasWrap.style.removeProperty("overflow");

  try {
    const page = await getPage1();
    const viewport1 = page.getViewport({ scale: 1.0 });

    const w = canvasWrap.clientWidth * 0.99;
    const h = canvasWrap.clientHeight * 0.99;

    const scaleX = w / viewport1.width;
    const scaleY = h / viewport1.height;
    const fitScale = Math.min(scaleX, scaleY);

    const minScale = isMobile() ? 0.1 : 0.5;
    scale = Math.max(minScale, Math.min(2.0, fitScale));
    fittedScale = scale;

    await renderDocument(page, scale);
    canvasWrap.scrollTop = 0;
    canvasWrap.scrollLeft = 0;
    updateScaleMessages();
    checkFittedState();
    updateZoomButtonsAllowed();
  } catch (err) {
    console.error("Fit error:", err);
  }
};

const zoomIn = async (delta) => {
  if (isMobilePortrait()) return;

  if (scale >= TOO_LARGE_SCALE) {
    const msg = byId("too-large-message");
    if (msg) msg.style.display = "block";
    return;
  }

  const wrap = byId("canvas-wrap");
  if (!wrap || !pdf) return;

  // Check if next scale will fit in viewport (x-axis only)
  const page = await getPage1();
  const viewport = page.getViewport({ scale: 1.0 });
  const nextScale = Math.min(TOO_LARGE_SCALE, scale + delta);
  const nextWidth = viewport.width * nextScale;

  // Account for 4rem padding on each side when not centered
  const isCentered = wrap.classList.contains("centered");
  const paddingPx = isCentered ? 0 : parseFloat(getComputedStyle(wrap).fontSize) * 8;
  const availableWidth = wrap.clientWidth - paddingPx;

  // Prevent zoom if already scrollable and won't fit
  if (!isCentered && nextWidth >= availableWidth) return;

  hideLinkHighlights();

  if ((isMobile() && scale > MOBILE_SCALE) || scale > BROWSER_SCALE) {
    wrap.style.overflow = "auto";
  }

  scale = nextScale;
  wrap.classList.remove("centered");
  renderWithCurrentScale();
};

const zoomOut = (delta) => {
  if (isMobilePortrait()) return;

  if (scale <= TOO_SMALL_SCALE) {
    const msg = byId("too-small-message");
    if (msg) msg.style.display = "block";
    return;
  }

  hideLinkHighlights();
  scale = Math.max(TOO_SMALL_SCALE, scale - delta);

  const wrap = byId("canvas-wrap");
  if (wrap) wrap.classList.remove("centered");

  renderWithCurrentScale();
};

// Make the canvas' parent the positioning context for overlays.
const ensureOverlayParent = () => {
  const canvas = byId("resume-canvas");
  if (!canvas) return null;

  const parent = canvas.parentElement;
  if (!parent) return null;

  const cs = getComputedStyle(parent);
  if (cs.position === "static") parent.style.position = "relative";
  return parent;
};

const renderDocument = async (page, scaleValue) => {
  if (currentRenderTask) {
    currentRenderTask.cancel();
    currentRenderTask = null;
  }

  const canvas = byId("resume-canvas");
  const wrap = byId("canvas-wrap");
  if (!canvas || !wrap) return;

  const ctx = canvas.getContext("2d");

  const prevWidth = canvas.offsetWidth || 1;
  const prevHeight = canvas.offsetHeight || 1;
  const prevScrollLeft = wrap.scrollLeft;
  const prevScrollTop = wrap.scrollTop;
  const prevCenterX = prevScrollLeft + wrap.offsetWidth / 2;

  const viewport = page.getViewport({ scale: scaleValue });

  canvas.width = RENDER_RESOLUTION * viewport.width;
  canvas.height = RENDER_RESOLUTION * viewport.height;
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;

  currentRenderTask = page.render({
    canvasContext: ctx,
    viewport,
    transform: [RENDER_RESOLUTION, 0, 0, RENDER_RESOLUTION, 0, 0],
  });

  try {
    await currentRenderTask.promise;
  } catch (err) {
    if (err?.name !== "RenderingCancelledException") {
      console.error("Rendering error:", err);
    }
    return;
  } finally {
    currentRenderTask = null;
  }

  const widthRatio = viewport.width / prevWidth;
  const heightRatio = viewport.height / prevHeight;

  wrap.scrollLeft = prevCenterX * widthRatio - wrap.offsetWidth / 2;
  wrap.scrollTop = prevScrollTop * heightRatio;

  requestAnimationFrame(() => {
    highlightLinks(page, viewport);
  });
};

const highlightLinks = (page, viewport) => {
  document.querySelectorAll(".pdf-link-highlight").forEach((el) => el.remove());

  const canvas = byId("resume-canvas");
  const parent = ensureOverlayParent();
  if (!canvas || !parent) return;

  const parentRect = parent.getBoundingClientRect();
  const canvasRect = canvas.getBoundingClientRect();
  const offsetLeft = canvasRect.left - parentRect.left;
  const offsetTop = canvasRect.top - parentRect.top;

  (async () => {
    try {
      const annotations = await page.getAnnotations();

      for (const a of annotations) {
        if (a.subtype !== "Link" || !a.url) continue;

        const [x1, y1, x2, y2] = viewport.convertToViewportRectangle(a.rect);
        const left = Math.min(x1, x2);
        const top = Math.min(y1, y2);
        const width = Math.abs(x2 - x1);
        const height = Math.abs(y2 - y1);

        const link = document.createElement("a");
        link.href = a.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.className = "pdf-link-highlight";
        link.setAttribute("aria-label", `Link to ${a.url}`);

        link.style.position = "absolute";
        link.style.left = `${offsetLeft + left}px`;
        link.style.top = `${offsetTop + top}px`;
        link.style.width = `${width}px`;
        link.style.height = `${height}px`;
        link.style.zIndex = "1";
        link.style.transition = "opacity 0.2s ease";
        link.style.opacity = "1";

        parent.appendChild(link);
      }
    } catch (err) {
      console.error("Highlight links error:", err);
    }
  })();
};

const populateLinksList = async () => {
  if (!pdf) return;

  try {
    const page = await getPage1();
    const annotations = await page.getAnnotations();

    const linksAreaEl = byId("links-area");
    const linksCountEl = byId("links-count");
    if (!linksAreaEl || !linksCountEl) return;

    linksAreaEl.innerHTML = "";
    const unique = new Set(
      annotations.filter((a) => a.url).map((a) => a.url)
    );

    const count = unique.size;
    linksCountEl.textContent = String(count);

    if (count === 0) {
      linksAreaEl.classList.add("empty");
      linksAreaEl.textContent = "No links found in document.";
      return;
    }

    linksAreaEl.classList.remove("empty");

    unique.forEach((url) => {
      const item = document.createElement("div");
      item.className = "link-item";

      const linkEl = document.createElement("a");
      linkEl.href = url;
      linkEl.target = "_blank";
      linkEl.rel = "noopener noreferrer";
      linkEl.innerHTML = `<span class="link-icon" aria-hidden="true">↗</span><span>${url}</span>`;

      const copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.className = "copy-btn";
      copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i>';
      copyBtn.setAttribute("aria-label", `Copy ${url}`);

      copyBtn.onclick = async () => {
        document.querySelectorAll(".copy-btn").forEach((btn) => {
          btn.innerHTML = '<i class="fa-regular fa-copy"></i>';
          btn.classList.remove("copied");
        });

        try {
          await navigator.clipboard.writeText(url);
          copyBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
          copyBtn.classList.add("copied");
          setTimeout(() => {
            copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i>';
            copyBtn.classList.remove("copied");
          }, 2000);
        } catch (e) {
          console.error("Copy failed:", e);
        }
      };

      item.appendChild(linkEl);
      item.appendChild(copyBtn);
      linksAreaEl.appendChild(item);
    });

    showLinkHighlights();
  } catch (err) {
    console.error("Populate links list error:", err);
  }
};

const showUI = () => {
  const pdfContainer = byId("pdf-container");
  const loadingSpinner = byId("loading-spinner");
  const buttonArea = byId("button-area");
  const controls = byId("controls");
  const canvasWrap = byId("canvas-wrap");

  if (loadingSpinner) {
    loadingSpinner.classList.add("hidden");
    setTimeout(() => (loadingSpinner.style.display = "none"), 300);
  }
  if (pdfContainer) pdfContainer.classList.add("loaded");
  if (buttonArea) buttonArea.classList.add("visible");
  if (controls) controls.classList.add("visible");
  if (canvasWrap) canvasWrap.addEventListener("scroll", debounce(checkFittedState, 150));
};

const toggleAttention = (enable) => {
  for (const el of document.getElementsByClassName("zoom-btn")) {
    el.classList.toggle("attention", !!enable);
  }
};

const setupDragScroll = () => {
  const wrap = byId("canvas-wrap");
  if (!wrap) return;

  let pos = { top: 0, left: 0, x: 0, y: 0 };

  const onDown = (e) => {
    wrap.style.cursor = "grabbing";
    wrap.style.userSelect = "none";
    pos = {
      left: wrap.scrollLeft,
      top: wrap.scrollTop,
      x: e.clientX,
      y: e.clientY,
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const onMove = (e) => {
    const dx = e.clientX - pos.x;
    const dy = e.clientY - pos.y;
    wrap.scrollTop = pos.top - dy;
    wrap.scrollLeft = pos.left - dx;
  };

  const onUp = () => {
    wrap.style.cursor = "grab";
    wrap.style.removeProperty("user-select");
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
  };

  wrap.addEventListener("mousedown", onDown);
};

const setupCanvasKeyboardNav = () => {
  const wrap = byId("canvas-wrap");
  if (!wrap) return;

  wrap.addEventListener("keydown", (e) => {
    const step = 50;
    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        wrap.scrollTop -= step;
        break;
      case "ArrowDown":
        e.preventDefault();
        wrap.scrollTop += step;
        break;
      case "ArrowLeft":
        e.preventDefault();
        wrap.scrollLeft -= step;
        break;
      case "ArrowRight":
        e.preventDefault();
        wrap.scrollLeft += step;
        break;
      case "Home":
        e.preventDefault();
        wrap.scrollTop = 0;
        break;
      case "End":
        e.preventDefault();
        wrap.scrollTop = wrap.scrollHeight;
        break;
      case "PageUp":
        e.preventDefault();
        wrap.scrollTop -= wrap.offsetHeight;
        break;
      case "PageDown":
        e.preventDefault();
        wrap.scrollTop += wrap.offsetHeight;
        break;
    }
  });
};

const setupInput = () => {
  // Dialog
  dialogEl = byId("links-dialog");
  if (dialogEl) {
    dialog = new A11yDialog(dialogEl);
    const linksBtn = byId("b4");
    dialog.on("show", () => linksBtn && linksBtn.classList.add("active"));
    dialog.on("hide", () => linksBtn && linksBtn.classList.remove("active"));
    dialog.on("show", populateLinksList);
  }

  setupDragScroll();
  setupCanvasKeyboardNav();

  document.addEventListener("keydown", (e) => {
    const t = e.target;
    const inField = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA");
    const linksOpen = isLinksDialogOpen();
    if (inField || linksOpen) return;

    switch (e.key) {
      case "+":
      case "=":
        e.preventDefault();
        zoomIn(0.25);
        break;
      case "-":
        e.preventDefault();
        zoomOut(0.25);
        break;
      case "0":
        e.preventDefault();
        fit();
        break;
      case "l":
      case "L":
        e.preventDefault();
        openLinks();
        break;
      case "d":
      case "D":
        e.preventDefault();
        download();
        break;
      case "Escape":
        if (isLinksDialogOpen()) {
          closeLinks();
        }
        break;
    }
  });

  const mq = window.matchMedia("(max-width: 750px)");
  mq.addEventListener("change", fit);
};

const setupUI = () => {
  setTimeout(showUI, 100);
  window.addEventListener("resize", debounce(fit, 100));

  if (!isMobile()) return;

  toggleAttention(true);
  notify("Hi 📱, please use the controls above.", () => toggleAttention(false));
};

const openLinks = () => {
  if (!dialogEl || !dialog) return;
  const open = isLinksDialogOpen();
  if (open) {
    dialog.hide();
    return;
  }
  dialog.show();
};

const closeLinks = () => {
  dialog?.hide();
};

const download = () => {
  window.open(PDF_URL, "_self");
};

// For webpack or inline handlers
window.zoomIn = zoomIn;
window.zoomOut = zoomOut;
window.fit = fit;
window.openLinks = openLinks;
window.closeLinks = closeLinks;
window.download = download;

// Bootstrap
document.body.classList.add("loaded");
(async () => {
  try {
    pdf = await loadingTask.promise;
    await getPage1();
    await fit();
    setupUI();
    setupInput();
  } catch (err) {
    console.error("Error loading PDF:", err);
    const spinner = byId("loading-spinner");
    if (spinner) {
      spinner.innerHTML =
        '<p style="color: var(--color-accent);">Failed to load resume. Please refresh the page.</p>';
    }
  }
})();
