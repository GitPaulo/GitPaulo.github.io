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
let landscapeNotificationShown = false;

// Dialog state
let dialog = null;
let dialogEl = null;

const byId = (id) => document.getElementById(id);

function notify(text, cb) {
  Toastify({
    text,
    duration: 3000,
    className: "toast",
    gravity: "bottom",
    position: "center",
    stopOnFocus: true,
    callback: cb,
  }).showToast();
}

function debounce(fn, ms) {
  let t = null;
  return (...args) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// Bootstrap
document.body.classList.add("loaded");
loadingTask.promise
  .then((_pdf) => {
    pdf = _pdf;
    return getPage1();
  })
  .then(() => {
    fit();
    setupUI();
    setupInput();
  })
  .catch((err) => {
    console.error("Error loading PDF:", err);
    const spinner = byId("loading-spinner");
    if (spinner) {
      spinner.innerHTML =
        '<p style="color: var(--color-accent);">Failed to load resume. Please refresh the page.</p>';
    }
  });

function getPage1() {
  if (!pdf) throw new Error("PDF not ready");
  return pdf.getPage(1);
}

function showUI() {
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
  if (canvasWrap) canvasWrap.addEventListener("scroll", checkFittedState);
}

function setupUI() {
  setTimeout(showUI, 100);

  window.addEventListener(
    "resize",
    debounce(() => fit(), 100)
  );

  if (isMobile()) {
    toggleAttention(true);
    notify("Hi 📱, please use the controls above.", () => toggleAttention(false));
  }
}

function setupInput() {
  // Initialize dialog - DOM is already loaded when this is called
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
    const target = e.target;
    const inField =
      target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA");
    const linksOpen =
      byId("links-dialog")?.getAttribute("aria-hidden") === "false";
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
        if (byId("links-dialog")?.getAttribute("aria-hidden") === "false") {
          closeLinks();
        }
        break;
    }
  });

  const mq = window.matchMedia("(max-width: 750px)");
  mq.addEventListener("change", () => fit());
}

function toggleAttention(enable) {
  const buttons = document.getElementsByClassName("zoom-btn");
  for (const el of buttons) {
    el.classList.toggle("attention", !!enable);
  }
}

function fit() {
  const canvasWrap = byId("canvas-wrap");
  if (!canvasWrap || !pdf) return;

  canvasWrap.classList.add("centered");
  canvasWrap.style.removeProperty("overflow");

  getPage1().then((page) => {
    const viewport1 = page.getViewport({ scale: 1.0 });

    const w = canvasWrap.clientWidth * 0.99;
    const h = canvasWrap.clientHeight * 0.99;

    const scaleX = w / viewport1.width;
    const scaleY = h / viewport1.height;
    const fitScale = Math.min(scaleX, scaleY);

    // Allow smaller scales on mobile, cap at 2.0 for desktop
    const minScale = isMobile() ? 0.1 : 0.5;
    scale = Math.max(minScale, Math.min(2.0, fitScale));
    fittedScale = scale;

    renderDocument(page, scale).then(() => {
      canvasWrap.scrollTop = 0;
      canvasWrap.scrollLeft = 0;
      updateScaleMessages();
      checkFittedState();
      updateZoomButtonsAllowed();
    });
  });
}

function zoomIn(delta) {
  if (scale >= TOO_LARGE_SCALE) {
    const msg = byId("too-large-message");
    if (msg) msg.style.display = "block";
    return;
  }

  if (
    isMobile() &&
    !landscapeNotificationShown &&
    window.innerWidth < window.innerHeight
  ) {
    landscapeNotificationShown = true;
    notify("Better viewed in landscape.");
  }

  const wrap = byId("canvas-wrap");
  if (wrap && ((isMobile() && scale > MOBILE_SCALE) || scale > BROWSER_SCALE)) {
    wrap.style.overflow = "auto";
  }

  scale = Math.min(TOO_LARGE_SCALE, scale + delta);

  if (wrap) wrap.classList.remove("centered");

  requestAnimationFrame(() => {
    getPage1().then((page) => {
      renderDocument(page, scale).then(() => {
        updateScaleMessages();
        checkFittedState();
        updateZoomButtonsAllowed();
      });
    });
  });
}

function updateScaleMessages() {
  const small = byId("too-small-message");
  const large = byId("too-large-message");

  if (small) {
    small.style.display = scale <= TOO_SMALL_SCALE ? "block" : "none";
  }
  if (large) {
    large.style.display = scale >= TOO_LARGE_SCALE ? "block" : "none";
  }
}

function updateZoomButtonsAllowed() {
  const wrap = byId("canvas-wrap");
  const zoomInBtn = byId("b1");
  const zoomOutBtn = byId("b5");

  if (!wrap || !zoomInBtn || !zoomOutBtn || !pdf) return;

  // Disable zoom out if at minimum scale
  if (scale <= TOO_SMALL_SCALE) {
    zoomOutBtn.disabled = true;
    zoomOutBtn.style.opacity = "0.5";
    zoomOutBtn.style.cursor = "not-allowed";
  } else {
    zoomOutBtn.disabled = false;
    zoomOutBtn.style.removeProperty("opacity");
    zoomOutBtn.style.removeProperty("cursor");
  }

  // Disable zoom in if at maximum scale or would exceed viewport
  if (scale >= TOO_LARGE_SCALE) {
    zoomInBtn.disabled = true;
    zoomInBtn.style.opacity = "0.5";
    zoomInBtn.style.cursor = "not-allowed";
    return;
  }

  // Check if next zoom would exceed viewport width
  getPage1().then((page) => {
    const viewport = page.getViewport({ scale: 1.0 });
    const nextScale = scale + 0.25; // Default zoom delta
    const nextWidth = viewport.width * nextScale;

    // Account for padding when not centered
    const isCentered = wrap.classList.contains("centered");
    const availableWidth = isCentered ? wrap.clientWidth : wrap.clientWidth;

    if (nextWidth >= availableWidth) {
      zoomInBtn.disabled = true;
      zoomInBtn.style.opacity = "0.5";
      zoomInBtn.style.cursor = "not-allowed";
    } else {
      zoomInBtn.disabled = false;
      zoomInBtn.style.removeProperty("opacity");
      zoomInBtn.style.removeProperty("cursor");
    }
  });
}

function zoomOut(delta) {
  if (scale <= TOO_SMALL_SCALE) {
    const msg = byId("too-small-message");
    if (msg) msg.style.display = "block";
    return;
  }

  if (
    isMobile() &&
    !landscapeNotificationShown &&
    window.innerWidth < window.innerHeight
  ) {
    landscapeNotificationShown = true;
    notify("Better viewed in landscape.");
  }

  scale = Math.max(TOO_SMALL_SCALE, scale - delta);

  const wrap = byId("canvas-wrap");
  if (wrap) wrap.classList.remove("centered");

  requestAnimationFrame(() => {
    getPage1().then((page) => {
      renderDocument(page, scale).then(() => {
        updateScaleMessages();
        checkFittedState();
        updateZoomButtonsAllowed();
      });
    });
  });
}

function checkFittedState() {
  const wrap = byId("canvas-wrap");
  const fitBtn = byId("b3");
  if (!wrap || !fitBtn || fittedScale == null) return;

  const isAtTop = wrap.scrollTop <= 10;
  const isAtFittedZoom = Math.abs(scale - fittedScale) < FIT_EPSILON;
  const shouldHideFit = isAtTop && isAtFittedZoom;

  if (shouldHideFit !== isFitted) {
    isFitted = shouldHideFit;
    fitBtn.classList.toggle("visible", !isFitted);
    fitBtn.classList.toggle("hidden", isFitted);
  }
}

// Make the canvas' parent the positioning context for overlays.
// Do NOT set width/height here; that breaks centering.
function ensureOverlayParent() {
  const canvas = byId("resume-canvas");
  if (!canvas) return null;
  const parent = canvas.parentElement;
  if (!parent) return null;
  const cs = getComputedStyle(parent);
  if (cs.position === "static") parent.style.position = "relative";
  return parent;
}

function renderDocument(page, scaleValue) {
  if (currentRenderTask) {
    currentRenderTask.cancel();
    currentRenderTask = null;
  }

  const canvas = byId("resume-canvas");
  const wrap = byId("canvas-wrap");
  if (!canvas || !wrap) return Promise.resolve();

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

  return currentRenderTask.promise
    .then(() => {
      currentRenderTask = null;

      const widthRatio = viewport.width / prevWidth;
      const heightRatio = viewport.height / prevHeight;

      wrap.scrollLeft = prevCenterX * widthRatio - wrap.offsetWidth / 2;
      wrap.scrollTop = prevScrollTop * heightRatio;

      // Wait for layout to settle before calculating link positions
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          highlightLinks(page, viewport);
        });
      });
    })
    .catch((err) => {
      if (err?.name !== "RenderingCancelledException") {
        console.error("Rendering error:", err);
      }
      currentRenderTask = null;
    });
}

function highlightLinks(page, viewport) {
  document.querySelectorAll(".pdf-link-highlight").forEach((el) => el.remove());

  const canvas = byId("resume-canvas");
  const parent = ensureOverlayParent();
  if (!canvas || !parent) return;

  // Offsets from canvas to its parent, in CSS pixels.
  // Using getBoundingClientRect() handles transforms and flex centering.
  const parentRect = parent.getBoundingClientRect();
  const canvasRect = canvas.getBoundingClientRect();
  const offsetLeft = canvasRect.left - parentRect.left;
  const offsetTop = canvasRect.top - parentRect.top;

  page.getAnnotations().then((annotations) => {
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

      // Absolute to the canvas' parent, offset to the canvas' top-left.
      link.style.position = "absolute";
      link.style.left = `${offsetLeft + left}px`;
      link.style.top = `${offsetTop + top}px`;
      link.style.width = `${width}px`;
      link.style.height = `${height}px`;
      // Optional: keep above canvas
      link.style.zIndex = "1";

      parent.appendChild(link);
    }
  });
}

function populateLinksList() {
  if (!pdf) return;
  getPage1().then((page) =>
    page.getAnnotations().then((annotations) => {
      const linksAreaEl = byId("links-area");
      const linksCountEl = byId("links-count");
      if (!linksAreaEl || !linksCountEl) return;

      linksAreaEl.innerHTML = "";
      const unique = new Set();

      for (const a of annotations) {
        if (a.url) unique.add(a.url);
      }

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
        copyBtn.innerHTML = "<span>📋</span>";
        copyBtn.setAttribute("aria-label", `Copy ${url}`);

        copyBtn.onclick = async () => {
          document.querySelectorAll(".copy-btn").forEach((btn) => {
            btn.innerHTML = "<span>📋</span>";
            btn.classList.remove("copied");
          });
          try {
            await navigator.clipboard.writeText(url);
            copyBtn.innerHTML = "<span>✓</span>";
            copyBtn.classList.add("copied");
            setTimeout(() => {
              copyBtn.innerHTML = "<span>📋</span>";
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
    })
  );
}

function setupDragScroll() {
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
}

function setupCanvasKeyboardNav() {
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
}

function openLinks() {
  if (!dialogEl || !dialog) return;
  const open = dialogEl.getAttribute("aria-hidden") === "false";
  open ? dialog.hide() : dialog.show();
}

function closeLinks() {
  dialog?.hide();
}

function download() {
  window.open(PDF_URL, "_self");
}

// For webpack or inline handlers
window.zoomIn = zoomIn;
window.zoomOut = zoomOut;
window.fit = fit;
window.openLinks = openLinks;
window.closeLinks = closeLinks;
window.download = download;
