// css
require("../css/style.css");

// libs
const Toastify = require("toastify-js");
const isMobile = require("is-mobile");
const pdfjsLib = require("pdfjs-dist");
const loadingTask = pdfjsLib.getDocument("./resources/paulo_resume.pdf");

// ?
import A11yDialog from "a11y-dialog";

const MOBILE_SCALE = 0.75;
const BROWSER_SCALE = 1.25;
const TOO_SMALL_SCALE = 0.25;

let scale;
let pdf;

loadingTask.promise.then((_pdf) => {
  pdf = _pdf;
  pdf.getPage(1).then((page) => {
    toggleAttention(true);
    if (isMobile()) {
      renderDocument(page, (scale = MOBILE_SCALE));
      document.getElementById("btn_label").innerText = "📱 GitHub";
      notify("👋 Hi 📱, please use zoom buttons!", () =>
        toggleAttention(false)
      );
    } else {
      renderDocument(page, (scale = BROWSER_SCALE));
      document.getElementById("btn_label").innerText = "Return to GitHub";
      notify("👋 Hey there, please use the zoom buttons!", () =>
        toggleAttention(false)
      );
    }
  });
});

function toggleAttention(shouldAttention) {
  for (let element of document.getElementsByClassName("zoom_btn")) {
    if (shouldAttention) {
      element.classList.add("attention");
    } else {
      element.classList.remove("attention");
    }
  }
}

function zoomIn(cscale) {
  if ((isMobile() && scale > MOBILE_SCALE) || scale > BROWSER_SCALE) {
    document.getElementById("canvas_wrap").style["overflow"] = "auto";
  }

  if (scale <= TOO_SMALL_SCALE) {
    document.getElementById("too_small_message").style["display"] = "none";
  }

  pdf.getPage(1).then((page) => {
    renderDocument(page, (scale += cscale));
    center();
  });
}

function zoomOut(cscale) {
  if (scale <= TOO_SMALL_SCALE) {
    document.getElementById("too_small_message").style["display"] = "block";
    return;
  }

  pdf.getPage(1).then((page) => {
    renderDocument(page, (scale -= cscale));
    center();
  });
}

function center() {
  document.getElementById("canvas_wrap").scrollLeft =
    (document.getElementById("resume_canvas").offsetWidth -
      document.getElementById("canvas_wrap").offsetWidth) /
    2;
  document.getElementById("canvas_wrap").scrollTop = 0;
}

function renderDocument(page, scale) {
  let viewport = page.getViewport({ scale: scale });
  let canvas = document.getElementById("resume_canvas");
  let context = canvas.getContext("2d");

  const resolution = 1.4;
  canvas.height = resolution * viewport.height;
  canvas.width = resolution * viewport.width;

  canvas.style.height = `${viewport.height}px`; //showing size will be smaller size
  canvas.style.width = `${viewport.width}px`;

  page.render({
    canvasContext: context,
    viewport,
    transform: [resolution, 0, 0, resolution, 0, 0],
  });
}

function notify(message, cb) {
  Toastify({
    text: message,
    duration: 2000,
    className: "toast",
    gravity: "top", // `top` or `bottom`
    position: "center", // `left`, `center` or `right`
    stopOnFocus: true, // Prevents dismissing of toast on hover
    callback: cb,
  }).showToast();
}

function openLinks() {
  dialog.show();
}

function closeLinks() {
  dialog.hide();
}

function download() {
  window.open("resources/paulo_resume.pdf", "_self");
}

// links
var dialog;
document.addEventListener("DOMContentLoaded", function () {
  // links dialog
  const dialogEl = document.getElementById("links_dialog");
  dialog = new A11yDialog(dialogEl);

  dialog.on("show", function (dialogEl, triggerEl) {
    pdf.getPage(1).then((page) => {
      page.getAnnotations().then((annotations) => {
        const linksAreaEl = document.getElementById("links_area");
        linksAreaEl.innerHTML = ""; // destroy to avoid collecting
        for (let annotation of annotations) {
          const linkEl = document.createElement("a");
          linkEl.classList.add("underline");
          linkEl.innerText = `🔗 ${annotation.url}`;
          linkEl.href = annotation.url;
          linksAreaEl.appendChild(linkEl);
        }
      });
    });
  });
});

// drag scroll
document.addEventListener("DOMContentLoaded", function () {
  const canvasWrap = document.getElementById("canvas_wrap");
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
});

// media scale
window.matchMedia("(max-width: 750px)").addEventListener("change", (media) => {
  let pagePromise = pdf.getPage(1);
  if (media.matches) {
    pagePromise.then((page) => renderDocument(page, (scale = 0.7)));
    document.getElementById("btn_label").innerText = "📱 GitHub";
  } else {
    pagePromise.then((page) => renderDocument(page, (scale = 1.25)));
    document.getElementById("btn_label").innerText = "Return to GitHub";
  }
});

// for webpack
window.zoomIn = zoomIn;
window.zoomOut = zoomOut;
window.center = center;
window.openLinks = openLinks;
window.closeLinks = closeLinks;
window.download = download;
