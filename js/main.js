// css
import "../css/style.css";

// libs
import Toastify from "toastify-js";
import isMobile from "is-mobile";
import * as pdfjsLib from "pdfjs-dist";
import A11yDialog from "a11y-dialog";

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = "build/main.bundle.worker.js";

const loadingTask = pdfjsLib.getDocument("resources/paulo_resume.pdf");

const MOBILE_SCALE = 0.75;
const BROWSER_SCALE = 1.5;
const TOO_SMALL_SCALE = 0.25;

let scale;
let pdf;
let currentRenderTask = null;

loadingTask.promise.then((_pdf) => {
  pdf = _pdf;
  pdf.getPage(1).then((page) => {
    toggleAttention(true);
    if (isMobile()) {
      renderDocument(page, (scale = MOBILE_SCALE));
      notify("👋 Hi 📱, please use zoom buttons!", () =>
        toggleAttention(false)
      );
    } else {
      renderDocument(page, (scale = BROWSER_SCALE));
      notify("👋 Hey there, please use the zoom buttons!", () =>
        toggleAttention(false)
      );
    }
  });
});

function toggleAttention(shouldAttention) {
  for (let element of document.getElementsByClassName("zoom-btn")) {
    if (shouldAttention) {
      element.classList.add("attention");
    } else {
      element.classList.remove("attention");
    }
  }
}

function zoomIn(cscale) {
  if ((isMobile() && scale > MOBILE_SCALE) || scale > BROWSER_SCALE) {
    document.getElementById("canvas-wrap").style["overflow"] = "auto";
  }

  if (scale <= TOO_SMALL_SCALE) {
    document.getElementById("too-small-message").style["display"] = "none";
  }

  scale += cscale;

  pdf.getPage(1).then((page) => {
    renderDocument(page, scale);
  });
}

function zoomOut(cscale) {
  if (scale <= TOO_SMALL_SCALE) {
    document.getElementById("too-small-message").style["display"] = "block";
    return;
  }

  scale -= cscale;

  pdf.getPage(1).then((page) => {
    renderDocument(page, scale);
  });
}

function center() {
  const canvasWrap = document.getElementById("canvas-wrap");

  // Calculate zoom to fit width with reasonable padding (90% of viewport width)
  const targetWidth = canvasWrap.offsetWidth * 0.9;

  pdf.getPage(1).then((page) => {
    const viewport = page.getViewport({ scale: 1.0 });
    const fitScale = targetWidth / viewport.width;

    // Set reasonable bounds for scale
    const reasonableScale = Math.max(0.5, Math.min(2.0, fitScale));

    renderDocument(page, (scale = reasonableScale));

    // Scroll to top
    setTimeout(() => {
      canvasWrap.scrollTop = 0;
      canvasWrap.scrollLeft = Math.max(
        0,
        (document.getElementById("resume-canvas").offsetWidth -
          canvasWrap.offsetWidth) /
        2
      );
    }, 50);
  });
}

function renderDocument(page, scale) {
  // Cancel any pending render task
  if (currentRenderTask) {
    currentRenderTask.cancel();
    currentRenderTask = null;
  }

  let viewport = page.getViewport({ scale: scale });
  let canvas = document.getElementById("resume-canvas");
  let context = canvas.getContext("2d");

  const resolution = 1.4;
  canvas.height = resolution * viewport.height;
  canvas.width = resolution * viewport.width;

  canvas.style.height = `${viewport.height}px`; //showing size will be smaller size
  canvas.style.width = `${viewport.width}px`;

  currentRenderTask = page.render({
    canvasContext: context,
    viewport,
    transform: [resolution, 0, 0, resolution, 0, 0],
  });

  currentRenderTask.promise
    .then(() => {
      currentRenderTask = null;
      // Highlight links after rendering
      highlightLinks(page, viewport);
    })
    .catch((err) => {
      if (err.name !== "RenderingCancelledException") {
        console.error("Rendering error:", err);
      }
      currentRenderTask = null;
    });
}

function highlightLinks(page, viewport) {
  // Remove existing link highlights
  const existingHighlights = document.querySelectorAll(".pdf-link-highlight");
  existingHighlights.forEach((el) => el.remove());

  page.getAnnotations().then((annotations) => {
    const pdfContainer = document.getElementById("pdf-container");

    annotations.forEach((annotation) => {
      if (annotation.subtype === "Link" && annotation.url) {
        const rect = annotation.rect;
        const [x1, y1, x2, y2] = viewport.convertToViewportRectangle(rect);

        // Create a clickable overlay for the link
        const linkDiv = document.createElement("a");
        linkDiv.href = annotation.url;
        linkDiv.target = "_blank";
        linkDiv.rel = "noopener noreferrer";
        linkDiv.className = "pdf-link-highlight";
        linkDiv.setAttribute("aria-label", `Link to ${annotation.url}`);

        // Position the link overlay
        linkDiv.style.position = "absolute";
        linkDiv.style.left = `${Math.min(x1, x2)}px`;
        linkDiv.style.top = `${Math.min(y1, y2)}px`;
        linkDiv.style.width = `${Math.abs(x2 - x1)}px`;
        linkDiv.style.height = `${Math.abs(y2 - y1)}px`;

        // Add to container
        pdfContainer.appendChild(linkDiv);
      }
    });
  });
}

function notify(message, cb) {
  Toastify({
    text: message,
    duration: 3000,
    className: "toast",
    gravity: "bottom", // `top` or `bottom`
    position: "center", // `left`, `center` or `right`
    stopOnFocus: true, // Prevents dismissing of toast on hover
    callback: cb,
  }).showToast();
}

function openLinks() {
  // Toggle: if already open, close it
  if (dialogEl.getAttribute("aria-hidden") === "false") {
    dialog.hide();
  } else {
    dialog.show();
  }
}

function closeLinks() {
  dialog.hide();
}

function download() {
  window.open("resources/paulo_resume.pdf", "_self");
}

// links
var dialog;
var dialogEl;

// Make sure dialogEl is accessible to openLinks
window.addEventListener("load", function () {
  dialogEl = document.getElementById("links-dialog");
});

document.addEventListener("DOMContentLoaded", function () {
  // links dialog
  dialogEl = document.getElementById("links-dialog");
  dialog = new A11yDialog(dialogEl);
  const linksBtn = document.getElementById("b4");

  dialog.on("show", function () {
    // Add outline to links button when modal is open
    if (linksBtn) {
      linksBtn.classList.add("active");
    }

    pdf.getPage(1).then((page) => {
      page.getAnnotations().then((annotations) => {
        const linksAreaEl = document.getElementById("links-area");
        linksAreaEl.innerHTML = ""; // destroy to avoid collecting

        // Remove duplicates using Set
        const uniqueUrls = new Set();

        for (let annotation of annotations) {
          if (annotation.url && !uniqueUrls.has(annotation.url)) {
            uniqueUrls.add(annotation.url);
            const linkEl = document.createElement("a");
            linkEl.innerText = annotation.url;
            linkEl.href = annotation.url;
            linksAreaEl.appendChild(linkEl);
          }
        }
      });
    });
  });

  dialog.on("hide", function () {
    // Remove outline from links button when modal is closed
    if (linksBtn) {
      linksBtn.classList.remove("active");
    }
  });
});

// drag scroll
document.addEventListener("DOMContentLoaded", function () {
  const canvasWrap = document.getElementById("canvas-wrap");
  let pos = { top: 0, left: 0, x: 0, y: 0 };

  const mouseDownHandler = function (e) {
    canvasWrap.style.cursor = "grabbing";
    canvasWrap.style.userSelect = "none";

    pos = {
      left: canvasWrap.scrollLeft,
      top: canvasWrap.scrollTop,
      // Get the current mouse position
      x: e.clientX,
      y: e.clientY,
    };

    document.addEventListener("mousemove", mouseMoveHandler);
    document.addEventListener("mouseup", mouseUpHandler);
  };

  const mouseMoveHandler = function (e) {
    // How far the mouse has been moved
    const dx = e.clientX - pos.x;
    const dy = e.clientY - pos.y;

    // Scroll the element
    canvasWrap.scrollTop = pos.top - dy;
    canvasWrap.scrollLeft = pos.left - dx;
  };

  const mouseUpHandler = function () {
    canvasWrap.style.cursor = "grab";
    canvasWrap.style.removeProperty("user-select");

    document.removeEventListener("mousemove", mouseMoveHandler);
    document.removeEventListener("mouseup", mouseUpHandler);
  };

  // Attach the handler
  canvasWrap.addEventListener("mousedown", mouseDownHandler);

  // Keyboard navigation for canvas (only when focused)
  // Note: tabindex removed to not interfere with button tabbing
  canvasWrap.addEventListener("keydown", function (e) {
    const scrollAmount = 50;

    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        canvasWrap.scrollTop -= scrollAmount;
        break;
      case "ArrowDown":
        e.preventDefault();
        canvasWrap.scrollTop += scrollAmount;
        break;
      case "ArrowLeft":
        e.preventDefault();
        canvasWrap.scrollLeft -= scrollAmount;
        break;
      case "ArrowRight":
        e.preventDefault();
        canvasWrap.scrollLeft += scrollAmount;
        break;
      case "Home":
        e.preventDefault();
        canvasWrap.scrollTop = 0;
        break;
      case "End":
        e.preventDefault();
        canvasWrap.scrollTop = canvasWrap.scrollHeight;
        break;
      case "PageUp":
        e.preventDefault();
        canvasWrap.scrollTop -= canvasWrap.offsetHeight;
        break;
      case "PageDown":
        e.preventDefault();
        canvasWrap.scrollTop += canvasWrap.offsetHeight;
        break;
    }
  });
});

// Keyboard shortcuts
document.addEventListener("keydown", function (e) {
  // Don't trigger if user is in an input or modal
  if (
    e.target.tagName === "INPUT" ||
    e.target.tagName === "TEXTAREA" ||
    document.getElementById("links-dialog").getAttribute("aria-hidden") ===
    "false"
  ) {
    return;
  }

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
      center();
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
      if (
        document.getElementById("links_dialog").getAttribute("aria-hidden") ===
        "false"
      ) {
        closeLinks();
      }
      break;
  }
});

// media scale
window.matchMedia("(max-width: 750px)").addEventListener("change", (media) => {
  let pagePromise = pdf.getPage(1);
  if (media.matches) {
    pagePromise.then((page) => renderDocument(page, (scale = 0.7)));
  } else {
    pagePromise.then((page) => renderDocument(page, (scale = 1.25)));
  }
});

// for webpack
window.zoomIn = zoomIn;
window.zoomOut = zoomOut;
window.center = center;
window.openLinks = openLinks;
window.closeLinks = closeLinks;
window.download = download;
