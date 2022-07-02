const pdfjsLib = require("pdfjs-dist");
const loadingTask = pdfjsLib.getDocument("./resources/paulo_resume.pdf");

let scale = 1.25;
let pdf = null;

loadingTask.promise.then((_pdf) => {
  pdf = _pdf;
  pdf.getPage(1).then((page) => {
    renderDocument(page, scale);
  });
});

function zoomIn(cscale) {
  pdf.getPage(1).then((page) => renderDocument(page, (scale += cscale)));
}

function zoomOut(cscale) {
  pdf.getPage(1).then((page) => renderDocument(page, (scale -= cscale)));
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

// media scale
// use deprecated because it doesnt fucking work on mobile?
window.matchMedia("(max-width: 750px)").addListener((media) => {
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
