var pdfDoc = null;
var pageNum = 1;
var scale = 1.5;
var mode = 'move';
var selectedCanvas = null;
var draggedElement = null;
var isCreatingCheckbox = false; // מצב לבדיקת יצירת Checkboxes

// פונקציה לזיהוי מספר העמוד על פי מיקום האלמנט
function getPageNumberFromPosition(element) {
    if (element.classList.contains('page-canvas')) {
        return element.getAttribute('data-page-number');
    }
    let canvasElement = element.closest('.page-wrapper')?.querySelector('.page-canvas');
    return canvasElement ? canvasElement.getAttribute('data-page-number') : null;
}

// פונקציה לטעינת ה-PDF
function loadPDF(pdfData) {
    const loadingTask = pdfjsLib.getDocument({ data: atob(pdfData.split(',')[1]) });
    loadingTask.promise.then(function(pdf) {
        pdfDoc = pdf;
        renderAllPages();
    }, function (reason) {
        console.error('Error loading PDF: ' + reason);
    });
}

function renderAllPages() {
    const viewer = document.getElementById('pdf-viewer');
    if (!viewer) return;
    viewer.innerHTML = ''; 
    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
        renderPage(pageNum);
    }
}

function renderPage(num) {
    pdfDoc.getPage(num).then(function(page) {
        const pdfViewer = document.getElementById('pdf-viewer');
        const viewport = page.getViewport({ scale: 1.0 });
        const containerWidth = pdfViewer.clientWidth;
        const scale = containerWidth / viewport.width;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = viewport.width * scale;
        canvas.height = viewport.height * scale;
        canvas.className = 'page-canvas';
        canvas.setAttribute('data-page-number', num);

        const pageWrapper = document.createElement('div');
        pageWrapper.className = 'page-wrapper';
        pageWrapper.style.width = '100%';
        pageWrapper.style.display = 'flex';
        pageWrapper.style.justifyContent = 'center';
        pageWrapper.style.position = 'relative';
        pageWrapper.setAttribute('data-page-number', num);
        pageWrapper.appendChild(canvas);

        document.getElementById('pdf-viewer').appendChild(pageWrapper);

        let renderContext = {
            canvasContext: ctx,
            viewport: page.getViewport({ scale: scale })
        };
        
        page.render(renderContext).promise.then(() => {
            console.log(`Page ${num} rendered successfully with data-page-number: ${canvas.getAttribute('data-page-number')}`);
        });
    });
}

// פונקציה ליצירת Checkbox בעת לחיצה על העמוד
function createCheckbox(event) {
    if (!isCreatingCheckbox) return; // אם לא במצב יצירה, אל תבצע כלום
    event.preventDefault();
    const pdfViewer = document.getElementById('pdf-viewer');

    // קביעת המיקום של העכבר
    const relativeX = event.clientX - pdfViewer.getBoundingClientRect().left;
    const relativeY = event.clientY - pdfViewer.getBoundingClientRect().top;

    // יצירת קונטיינר ל-Checkbox
    const checkboxWrapper = document.createElement('div');
    checkboxWrapper.style.position = 'absolute';
    checkboxWrapper.style.left = `${relativeX}px`;
    checkboxWrapper.style.top = `${relativeY}px`;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'checkbox';
    checkbox.style.width = '20px';
    checkbox.style.height = '20px';

    const label = document.createElement('label'); // הוספת תווית עבור ה-Checkbox
    label.appendChild(checkbox);

    // הוספת התווית לקונטיינר והקונטיינר ל-PDF
    checkboxWrapper.appendChild(label);
    pdfViewer.appendChild(checkboxWrapper); // הוספת הקונטיינר ל-PDF

    // הוספת פונקציות גרירה ל-Checkbox
    addDragFunctionality(checkboxWrapper); // קריאה לפונקציה להוספת גרירה

    console.log(`Checkbox successfully added at position: X=${relativeX}, Y=${relativeY}`);
}

// פונקציה להוספת גרירה לקונטיינר של ה-Checkbox
function addDragFunctionality(element) {
    let isDragging = false;
    let offsetX, offsetY;

    element.addEventListener('mousedown', function(e) {
        isDragging = true;
        offsetX = e.clientX - element.getBoundingClientRect().left;
        offsetY = e.clientY - element.getBoundingClientRect().top;
        e.preventDefault(); // מונע בחירת טקסט
    });

    document.addEventListener('mousemove', function(e) {
        if (isDragging) {
            const pdfViewer = document.getElementById('pdf-viewer');
            const relativeX = e.clientX - pdfViewer.getBoundingClientRect().left;
            const relativeY = e.clientY - pdfViewer.getBoundingClientRect().top;

            element.style.left = `${relativeX - offsetX}px`;
            element.style.top = `${relativeY - offsetY}px`;
        }
    });

    document.addEventListener('mouseup', function() {
        isDragging = false;
    });
}

// פונקציה ליצירת תיבת חתימה/טקסט/תאריך בעת שחרור אלמנט ב-PDF
function handleDrop(event) {
    event.preventDefault();
    const pdfViewer = document.getElementById('pdf-viewer');

    const targetElement = document.elementFromPoint(event.clientX, event.clientY);
    const pageNumber = getPageNumberFromPosition(targetElement);

    if (!pageNumber) {
        alert('לא ניתן לקבוע את העמוד של ה-PDF');
        return;
    }

    // יצירת תיבת חתימה
    if (draggedElement.id === 'create-signature-box-btn') {
        const newCanvas = document.createElement('canvas');
        newCanvas.className = 'signature-canvas';
        newCanvas.style.position = 'absolute';
        newCanvas.style.width = '150px';
        newCanvas.style.height = '75px';
        newCanvas.setAttribute('data-page-number', pageNumber);

        const pageWrapper = document.querySelector(`.page-wrapper[data-page-number='${pageNumber}']`);
        if (pageWrapper) {
            const relativeX = event.clientX - pageWrapper.getBoundingClientRect().left;
            const relativeY = event.clientY - pageWrapper.getBoundingClientRect().top;
            newCanvas.style.left = `${relativeX}px`;
            newCanvas.style.top = `${relativeY}px`;
            pageWrapper.appendChild(newCanvas);
            console.log(`Signature box successfully added to Page Number: ${pageNumber} at relative position: X=${relativeX}, Y=${relativeY}`);
        }
        newCanvas.addEventListener('click', () => selectCanvas(newCanvas));
        addMoveAndResizeFunctionality(newCanvas);
    }

    // יצירת תיבת טקסט
    if (draggedElement.id === 'create-text-box-btn') {
        const textBox = document.createElement('textarea');
        textBox.className = 'text-box';
        textBox.style.position = 'absolute';
        textBox.style.width = '150px';
        textBox.style.height = '50px';
        textBox.style.resize = 'both'; 
        textBox.style.overflow = 'auto';
        textBox.style.border = '2px solid #007bff'; // גבול כחול
        textBox.style.boxShadow = 'none'; // הסרת הצל
        textBox.style.borderRadius = '0'; // הסרת פינות מעוגלות
        textBox.setAttribute('data-page-number', pageNumber);

        const pageWrapper = document.querySelector(`.page-wrapper[data-page-number='${pageNumber}']`);
        if (pageWrapper) {
            const relativeX = event.clientX - pageWrapper.getBoundingClientRect().left;
            const relativeY = event.clientY - pageWrapper.getBoundingClientRect().top;
            textBox.style.left = `${relativeX}px`;
            textBox.style.top = `${relativeY}px`;
            pageWrapper.appendChild(textBox);
            console.log(`Text box successfully added to Page Number: ${pageNumber} at relative position: X=${relativeX}, Y=${relativeY}`);
        }
        textBox.addEventListener('click', () => selectCanvas(textBox));
        addMoveAndResizeFunctionality(textBox);
    }

    // יצירת תיבת תאריך
    if (draggedElement.id === 'create-date-box-btn') {
        const dateInput = document.createElement('input');
        dateInput.className = 'date-input';
        dateInput.style.position = 'absolute';
        dateInput.style.width = '80px';
        dateInput.style.height = '30px';
        dateInput.placeholder = 'Select Date';
        flatpickr(dateInput, { dateFormat: "d/m/Y" });
        dateInput.setAttribute('data-page-number', pageNumber);

        const pageWrapper = document.querySelector(`.page-wrapper[data-page-number='${pageNumber}']`);
        if (pageWrapper) {
            const relativeX = event.clientX - pageWrapper.getBoundingClientRect().left;
            const relativeY = event.clientY - pageWrapper.getBoundingClientRect().top;
            dateInput.style.left = `${relativeX}px`;
            dateInput.style.top = `${relativeY}px`;
            pageWrapper.appendChild(dateInput);
            console.log(`Date box successfully added to Page Number: ${pageNumber} at relative position: X=${relativeX}, Y=${relativeY}`);
        }
        dateInput.addEventListener('click', () => selectCanvas(dateInput));
        addMoveAndResizeFunctionality(dateInput);
    }
}

function allowDrop(event) {
    event.preventDefault();
}

function dragStart(event) {
    draggedElement = event.target;
}

function initializeDragAndDrop() {
    const createSignatureBoxButton = document.getElementById('create-signature-box-btn');
    const createTextBoxButton = document.getElementById('create-text-box-btn');
    const createDateBoxButton = document.getElementById('create-date-box-btn');
    const createCheckboxButton = document.getElementById('create-checkbox-btn');

    createSignatureBoxButton.setAttribute('draggable', 'true');
    createTextBoxButton.setAttribute('draggable', 'true');
    createDateBoxButton.setAttribute('draggable', 'true');
    createCheckboxButton.setAttribute('draggable', 'true');

    createSignatureBoxButton.addEventListener('dragstart', dragStart);
    createTextBoxButton.addEventListener('dragstart', dragStart);
    createDateBoxButton.addEventListener('dragstart', dragStart);
    createCheckboxButton.addEventListener('dragstart', dragStart);

    const pdfViewer = document.getElementById('pdf-viewer');
    pdfViewer.addEventListener('dragover', allowDrop);
    pdfViewer.addEventListener('drop', handleDrop);
}

function addMoveAndResizeFunctionality(element) {
    let isDragging = false;
    let offsetX, offsetY;

    // הוספת פונקציית גרירה
    element.addEventListener('mousedown', function(e) {
        if (mode === 'move') {
            isDragging = true;
            offsetX = e.clientX - element.offsetLeft;
            offsetY = e.clientY - element.offsetTop;
        }
    });

    document.addEventListener('mousemove', function(e) {
        if (isDragging && mode === 'move') {
            element.style.left = `${e.clientX - offsetX}px`;
            element.style.top = `${e.clientY - offsetY}px`;
        }
    });

    document.addEventListener('mouseup', function() {
        isDragging = false;
    });

    // הוספת פונקציית שינוי גודל
    const resizer = document.createElement('div');
    resizer.className = 'resizer';
    resizer.style.width = '10px';
    resizer.style.height = '10px';
    resizer.style.backgroundColor = 'blue';
    resizer.style.position = 'absolute';
    resizer.style.right = '0';
    resizer.style.bottom = '0';
    resizer.style.cursor = 'nwse-resize';
    element.appendChild(resizer);

    resizer.addEventListener('mousedown', function(e) {
        e.stopPropagation(); // עצור את ההפעלה של mouseup ו-mousemove על האלמנט הראשי
        isDragging = false; // עצור את הגרירה

        let originalWidth = parseFloat(getComputedStyle(element).width.replace('px', ''));
        let originalHeight = parseFloat(getComputedStyle(element).height.replace('px', ''));
        let originalX = e.clientX;
        let originalY = e.clientY;

        function resize(e) {
            const newWidth = originalWidth + (e.clientX - originalX);
            const newHeight = originalHeight + (e.clientY - originalY);
            element.style.width = newWidth + 'px';
            element.style.height = newHeight + 'px';
        }

        function stopResize() {
            document.removeEventListener('mousemove', resize);
            document.removeEventListener('mouseup', stopResize);
        }

        document.addEventListener('mousemove', resize);
        document.addEventListener('mouseup', stopResize);
    });
}

// פונקציה לבחירת קנבס
function selectCanvas(canvas) {
    if (selectedCanvas) {
        selectedCanvas.classList.remove('selected'); // הסרת הבחירה מקנבס קיים
    }
    selectedCanvas = canvas; // הגדרת הקנבס שנבחר
    selectedCanvas.classList.add('selected'); // הוספת סגנון לבחירה
}

// פונקציה למחיקת הקנבס הנבחר
document.getElementById('delete-btn').addEventListener('click', function() {
    if (selectedCanvas) {
        selectedCanvas.remove(); // הסרת הקנבס הנבחר
        selectedCanvas = null; // נקה את הבחירה
        console.log('Selected canvas deleted.');
    } else {
        alert('נא לבחור קנבס קודם.');
    }
});

// פונקציות להגדלה והקטנה של התיבות
function increaseHeight() {
    if (selectedCanvas) {
        let currentHeight = parseFloat(selectedCanvas.style.height);
        selectedCanvas.style.height = `${currentHeight + 10}px`; // הגדל ב-10 פיקסלים
    } else {
        alert('נא לבחור קנבס קודם.');
    }
}

function decreaseHeight() {
    if (selectedCanvas) {
        let currentHeight = parseFloat(selectedCanvas.style.height);
        if (currentHeight > 10) { // ודא שהגודל לא יהפוך לקטן מדי
            selectedCanvas.style.height = `${currentHeight - 5}px`; // הקטן ב-5 פיקסלים
        }
    } else {
        alert('נא לבחור קנבס קודם.');
    }
}

function increaseWidth() {
    if (selectedCanvas) {
        let currentWidth = parseFloat(selectedCanvas.style.width);
        selectedCanvas.style.width = `${currentWidth + 10}px`; // הגדל ב-10 פיקסלים
    } else {
        alert('נא לבחור קנבס קודם.');
    }
}

function decreaseWidth() {
    if (selectedCanvas) {
        let currentWidth = parseFloat(selectedCanvas.style.width);
        if (currentWidth > 10) { // ודא שהגודל לא יהפוך לקטן מדי
            selectedCanvas.style.width = `${currentWidth - 5}px`; // הקטן ב-5 פיקסלים
        }
    } else {
        alert('נא לבחור קנבס קודם.');
    }
}

// הוספת מאזינים ללחצנים
document.getElementById('increase-height-btn').addEventListener('click', increaseHeight);
document.getElementById('decrease-height-btn').addEventListener('click', decreaseHeight);
document.getElementById('increase-width-btn').addEventListener('click', increaseWidth);
document.getElementById('decrease-width-btn').addEventListener('click', decreaseWidth);

// הוספת מאזין לכפתור Checkbox
document.getElementById('create-checkbox-btn').addEventListener('click', function() {
    const pdfViewer = document.getElementById('pdf-viewer');
    if (!isCreatingCheckbox) {
        isCreatingCheckbox = true; // הפעלת מצב יצירת Checkboxes
        this.textContent = "STOP CREATE CHECKBOX"; // שינוי הכותרת
    } else {
        isCreatingCheckbox = false; // הפסקת מצב יצירת Checkboxes
        this.textContent = "CREATE CHECKBOX"; // שינוי הכותרת חזרה
    }
});

// פונקציה לשליחת המסמך לשרת
function saveAndSendDocument(recipientEmail) {
    const pdfData = localStorage.getItem('pdfData');
    if (!pdfData) {
        alert("PDF לא נטען כראי.");
        return;
    }

    const fields = [];
    const signatureElements = document.querySelectorAll('.signature-canvas');
    signatureElements.forEach(el => fields.push({
        type: 'signature',
        left: el.style.left,
        top: el.style.top,
        width: el.style.width,
        height: el.style.height,
        pageNumber: el.getAttribute('data-page-number') // הוספת מספר העמוד
    }));

    const textElements = document.querySelectorAll('.text-box');
    textElements.forEach(el => fields.push({
        type: 'text',
        left: el.style.left,
        top: el.style.top,
        width: el.style.width,
        height: el.style.height,
        pageNumber: el.getAttribute('data-page-number') // הוספת מספר העמוד
    }));

    const dateElements = document.querySelectorAll('.date-input');
    dateElements.forEach(el => fields.push({
        type: 'date',
        left: el.style.left,
        top: el.style.top,
        width: el.style.width,
        height: el.style.height,
        pageNumber: el.getAttribute('data-page-number') // הוספת מספר העמוד
    }));

    const checkboxElements = document.querySelectorAll('.checkbox');
    checkboxElements.forEach(el => fields.push({
        type: 'checkbox',
        left: el.style.left,
        top: el.style.top,
        width: el.style.width,
        height: el.style.height,
        pageNumber: el.getAttribute('data-page-number') // הוספת מספר העמוד
    }));

    const now = new Date();
    const fileName = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}_${now.getHours()}-${now.getMinutes()}-${now.getSeconds()}.pdf`;

    fetch('http://localhost:3000/saveFields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            fields: JSON.stringify(fields),
            pdfData: pdfData,
            fileName: fileName,
            recipientEmail: recipientEmail
        })
    })
    .then(response => response.text())
    .then(data => {
        console.log('Success:', data);
        alert('המסמך נשמר ונשלח למייל: ' + recipientEmail);
    })
    .catch(error => {
        console.error('Error:', error);
        alert('שגיאה בשליחת המסמך למייל.');
    });
}

// מאזינים לכפתורים
document.addEventListener('DOMContentLoaded', function() {
    initializeDragAndDrop();

    document.getElementById('send-document-btn').addEventListener('click', function() {
        const recipientEmail = document.getElementById('recipient-email').value;

        if (!recipientEmail) {
            alert('נא להזין כתובת מייל תקינה.');
            return;
        }

        saveAndSendDocument(recipientEmail);
    });

    const pdfData = localStorage.getItem('pdfData');
    if (pdfData) {
        loadPDF(pdfData);
    } else {
        alert('לא נבחר קובץ PDF');
    }
});

// הוספת Tippy.js להוספת Tooltips
tippy('#create-signature-box-btn', {
    content: 'לחץ כאן כדי ליצור תיבת חתימה',
    placement: 'top',
    arrow: true,
});

tippy('#create-text-box-btn', {
    content: 'לחץ כאן כדי ליצור תיבת טקסט',
    placement: 'top',
    arrow: true,
});

tippy('#create-date-box-btn', {
    content: 'לחץ כאן כדי ליצור תיבת תאריך',
    placement: 'top',
    arrow: true,
});

tippy('#create-checkbox-btn', {
    content: 'לחץ כאן כדי ליצור תיבת Checkbox',
    placement: 'top',
    arrow: true,
});
