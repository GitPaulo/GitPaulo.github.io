const pdfjsLib = require("pdfjs-dist");
const loadingTask = pdfjsLib.getDocument("./resources/paulo_resume.pdf");

let scale = 1.25;
let pdf = null;

loadingTask.promise.then((_pdf) => {
  pdf = _pdf;
  pdf.getPage(1).then((page) => {
    renderDocument(page, scale);

    // for new browsers only
    let lastWidth = window.innerWidth;
    let lastHeight = window.innerHeight;
    window.addEventListener("resize", (event) => {
      let newWidth = window.innerWidth;
      let newHeight = window.innerHeight;

      if (newWidth < lastWidth || newHeight < lastHeight) {
        zoomIn(0.25);
      } else {
        zoomOut(0.25);
      }

      lastWidth = newWidth;
      lastHeight = newHeight;
    });
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

// for webpack
window.zoomIn = zoomIn;
window.zoomOut = zoomOut;
