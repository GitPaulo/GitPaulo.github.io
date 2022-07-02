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
      });
    } else {
      renderDocument(page, (scale = BROWSER_SCALE));
      document.getElementById("b1").style.border = "2px solid red";
      document.getElementById("b2").style.border = "2px solid red";
      notify("👋 Hey there, please use the zoom buttons!", () => {
        document.getElementById("b1").style.border = "1px solid black";
        document.getElementById("b2").style.border = "1px solid black";
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
