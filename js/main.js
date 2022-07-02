// css
require("../css/style.css");

// libs
const Toastify = require("toastify-js");
const isMobile = require("is-mobile");
const pdfjsLib = require("pdfjs-dist");
const loadingTask = pdfjsLib.getDocument("./resources/paulo_resume.pdf");

let scale;
let pdf;

const MOBILE_SCALE = 0.7;
const BROWSER_SCALE = 1.25;

loadingTask.promise.then((_pdf) => {
  pdf = _pdf;
  pdf.getPage(1).then((page) => {
    if (isMobile()) {
      renderDocument(page, (scale = MOBILE_SCALE));
      document.getElementById("btn_label").innerText = "📱 GitHub";
      notify("👋 Hi 📱, please use zoom buttons!", () => {
        document.getElementById("b1").style.border = "1px solid black";
        document.getElementById("b2").style.border = "1px solid black";
        document.getElementById("b3").style.border = "1px solid black";
      });
    } else {
      renderDocument(page, (scale = BROWSER_SCALE));
      document.getElementById("btn_label").innerText = "Return to GitHub";
      document.getElementById("b1").style.border = "2px solid red";
      document.getElementById("b2").style.border = "2px solid red";
      document.getElementById("b3").style.border = "2px solid red";
      notify("👋 Hey there, please use the zoom buttons!", () => {
        document.getElementById("b1").style.border = "1px solid black";
        document.getElementById("b2").style.border = "1px solid black";
        document.getElementById("b3").style.border = "1px solid black";
      });
    }
  });
});

function zoomIn(cscale) {
  if ((isMobile() && scale > MOBILE_SCALE) || scale > BROWSER_SCALE) {
    document.getElementById("canvas_wrap").style["overflow"] = "auto";
  }

  if (scale === 0) {
    document.getElementById("too_small_message").style["display"] = "none";
  }

  pdf.getPage(1).then((page) => renderDocument(page, (scale += cscale)));
}

function zoomOut(cscale) {
  if (scale <= 0) {
    document.getElementById("too_small_message").style["display"] = "block";
    scale = 0;
    return;
  } else {
    pdf.getPage(1).then((page) => renderDocument(page, (scale -= cscale)));
  }
}

function center() {
  document.getElementById('canvas_wrap').scrollLeft = (document.getElementById('resume_canvas').offsetWidth - document.getElementById('canvas_wrap').offsetWidth) / 2
  document.getElementById('canvas_wrap').scrollTop = 0;
}

function renderDocument(page, scale) {
  let viewport = page.getViewport({ scale: scale });
  let canvas = document.getElementById("resume_canvas");
  let context = canvas.getContext("2d");
  canvas.height = viewport.height;
  canvas.width = viewport.width;

  page.render({
    canvasContext: context,
    viewport,
  });
}

function notify(message, cb) {
  Toastify({
    text: message,
    duration: 2000,
    gravity: "top", // `top` or `bottom`
    position: "center", // `left`, `center` or `right`
    stopOnFocus: true, // Prevents dismissing of toast on hover
    callback: cb,
  }).showToast();
}

// drago scroll
document.addEventListener('DOMContentLoaded', function () {
  const canvasWrap = document.getElementById('canvas_wrap');
  let pos = { top: 0, left: 0, x: 0, y: 0 };

  const mouseDownHandler = function (e) {
    canvasWrap.style.cursor = 'grabbing';
    canvasWrap.style.userSelect = 'none';

    pos = {
      left: canvasWrap.scrollLeft,
      top: canvasWrap.scrollTop,
      // Get the current mouse position
      x: e.clientX,
      y: e.clientY,
    };

    document.addEventListener('mousemove', mouseMoveHandler);
    document.addEventListener('mouseup', mouseUpHandler);
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
    canvasWrap.style.cursor = 'grab';
    canvasWrap.style.removeProperty('user-select');

    document.removeEventListener('mousemove', mouseMoveHandler);
    document.removeEventListener('mouseup', mouseUpHandler);
  };

  // Attach the handler
  canvasWrap.addEventListener('mousedown', mouseDownHandler);
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
