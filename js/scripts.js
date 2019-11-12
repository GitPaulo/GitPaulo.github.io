console.log("Loading resume pfg...");

const pdfjsLib    = require('pdfjs-dist');
const loadingTask = pdfjsLib.getDocument('./resources/paulo_resume.pdf');

loadingTask.promise.then((pdf) => {
    pdf.getPage(1).then((page) => {
        let scale    = 1.5;
        let viewport = page.getViewport({
            scale: scale,
        });

        let canvas    = document.getElementById('resume_canvas');
        let context   = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width  = viewport.width;

        let renderContext = {
            canvasContext: context,
            viewport: viewport
        };

        page.render(renderContext);

        console.log("Completed!");
    });
});
