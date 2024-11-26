console.log("Starting client.js");

if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.worker.min.js';
}

if (window.hasRun) {
    console.log("client.js already loaded once");
    throw new Error("client.js loaded twice");
}
window.hasRun = true;

const currentPath = window.location.pathname;
console.log("Current Path:", currentPath);

if (currentPath.includes("signer.html") || currentPath.includes("sign")) {
    console.log("Signer Page Loaded");
    initializeSignerPage();
} else {
    console.log("Preparation Page Loaded");
    initializePreparationPage();
}

function initializePreparationPage() {
    console.log("Initializing preparation page...");
}

function initializeSignerPage() {
    console.log("Initializing signer page...");
    const documentId = window.location.pathname.split('/').pop();
    console.log("Document ID for Signer:", documentId);
    loadPDFAndFields(documentId);

    document.getElementById('save-pdf-btn').addEventListener('click', function() {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();

    const pages = document.querySelectorAll('.page-wrapper');
    const promises = [];

    console.log("Starting to process pages...");

    pages.forEach((pageWrapper, index) => {
        const promise = html2canvas(pageWrapper, { scale: 2 }).then(canvas => {
            const imgData = canvas.toDataURL('image/jpeg', 1.0);
            if (index > 0) {
                pdf.addPage();
            }
            pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297); // קנה מידה של A4
        });
        promises.push(promise);
    });

    Promise.all(promises).then(() => {
        const fileName = `signed_document_${Date.now()}`;
        const pdfData = pdf.output('datauristring');
        console.log("PDF Data generated");

        // שליחת המסמך לשרת
        fetch('/saveFields', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                pdfData: pdfData, 
                fileName: fileName,
                fields: JSON.stringify(capturedFields || []), // כל השדות שנלכדו
                recipientEmail: 'example@example.com' // ניתן להחליף באימייל דינמי
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error in server response: ${response.statusText}`);
            }
            return response.text();
        })
        .then(data => {
            console.log('Document saved and response:', data);
        })
        .catch(error => {
            console.error('Error saving document:', error);
        });
    });
});




function loadPDFAndFields(documentId) {
    console.log("Trying to load PDF for document ID:", documentId);
    fetch(`/saved_documents/${documentId}.pdf`)
        .then(response => {
            if (!response.ok) {
                console.error("Failed to load PDF:", response.statusText);
                throw new Error('Network response was not ok: ' + response.statusText);
            }
            return response.blob();
        })
        .then(blob => {
            console.log("PDF blob received.");
            const reader = new FileReader();
            reader.onload = function(event) {
                console.log("Reading PDF blob.");
                const pdfData = event.target.result;
                const loadingTask = pdfjsLib.getDocument({ data: atob(pdfData.split(',')[1]) });
                loadingTask.promise.then(function(pdf) {
                    pdfDoc = pdf;
                    console.log("PDF Loaded with", pdf.numPages, "pages.");
                    renderAllPages(); // רנדור כל העמודים אחרי שה-PDF נטען
                });
            };
            reader.readAsDataURL(blob);
        })
        .catch(error => console.error('Error loading PDF:', error));
}

function renderAllPages() {
    const viewer = document.getElementById('pdf-viewer');
    viewer.innerHTML = ''; 

    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
        renderPage(pageNum); // רינדור כל עמוד
    }
}

function renderPage(pageNum) {
    pdfDoc.getPage(pageNum).then(function(page) {
        const viewer = document.getElementById('pdf-viewer');
        const viewport = page.getViewport({ scale: 1.0 });

        const containerWidth = viewer.clientWidth; // קבלת רוחב המיכל
        const scale = containerWidth / viewport.width; // התאמת קנה המידה לפי רוחב המיכל

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = viewport.width * scale;
        canvas.height = viewport.height * scale;
        canvas.className = 'page-canvas';

        const pageWrapper = document.createElement('div');
        pageWrapper.className = 'page-wrapper';
        pageWrapper.style.display = 'flex';
        pageWrapper.style.justifyContent = 'center';
        pageWrapper.style.position = 'relative';
        pageWrapper.appendChild(canvas);

        viewer.appendChild(pageWrapper);

        const renderContext = {
            canvasContext: context,
        };

        page.render(renderContext);
    });
}
