var pdfDoc = null;
var pageNum = 1;
var scale = 1.5;
var mode = 'move';
var selectedCanvas = null;
var draggedElement = null;
var isCreatingCheckbox = false; // מצב לבדיקת יצירת Checkboxes

// פתיחת קובץ PDF שנבחר על ידי המשתמש

// מאזינים לכפתורים אחרים
document.addEventListener('DOMContentLoaded', function() {
    initializeDragAndDrop();

    // מאזין ללחיצה על כפתור OPEN PDF
    document.getElementById('open-pdf-btn').addEventListener('click', function() {
        document.getElementById('pdf-input').click(); // פתיחת חלון בחירת קובץ PDF
    });

    // מאזין לבחירת קובץ PDF ושמירתו בזיכרון המקומי
    document.getElementById('pdf-input').addEventListener('change', function(event) {
        const file = event.target.files[0]; // קבלת הקובץ שנבחר
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const pdfData = e.target.result;
                localStorage.setItem('pdfData', pdfData); // שמירת הנתונים בזיכרון המקומי
                loadPDF(pdfData); // טעינת ה-PDF שנבחר
                console.log("PDF loaded successfully:", file.name);
            };
            reader.readAsDataURL(file);
        } else {
            alert('לא נבחר קובץ PDF');
        }
    });

    // טעינת ה-PDF מהזיכרון המקומי בעת לחיצה על OPEN PDF
    document.getElementById('open-pdf-btn').addEventListener('click', function() {
        const pdfData = localStorage.getItem('pdfData');
        if (!pdfData) {
            console.log('לא נבחר קובץ PDF');
            return;
        }
        loadPDF(pdfData); // טוען את הקובץ אם קיים בזיכרון המקומי
    });

    
});

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

// פונקציה ליצירת Checkbox בעת גרירה
function createCheckbox(event) {
    if (!isCreatingCheckbox) return; // אם לא במצב יצירה, אל תבצע כלום
    event.preventDefault();
    
    const pageWrapper = event.target.closest('.page-wrapper');
    const pageNumber = pageWrapper ? pageWrapper.getAttribute('data-page-number') : null;

    if (!pageNumber) {
        alert('לא ניתן לקבוע את העמוד');
        return;
    }

    // קביעת המיקום של העכבר
    const boundingRect = pageWrapper.getBoundingClientRect();
const relativeX = event.offsetX || (event.clientX - boundingRect.left);
const relativeY = event.offsetY || (event.clientY - boundingRect.top);
eWrapper.getBoundingClientRect().top;

    // יצירת קונטיינר ל-Checkbox
    const checkboxWrapper = document.createElement('div');
    checkboxWrapper.style.position = 'absolute';
    checkboxWrapper.style.left = `${relativeX}px`;
    checkboxWrapper.style.top = `${relativeY}px`;
    checkboxWrapper.setAttribute('data-page-number', pageNumber); // הוספת מספר העמוד

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'checkbox';
    checkbox.style.width = '20px';
    checkbox.style.height = '20px';

    checkboxWrapper.appendChild(checkbox);
    pageWrapper.appendChild(checkboxWrapper); // הוספת הקונטיינר ל-PDF

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
        console.log('Dragging started for Checkbox'); // הודעה בלוג להתחלת גרירה
    });

    document.addEventListener('mousemove', function(e) {
        if (isDragging) {
            const pdfViewer = document.getElementById('pdf-viewer');
            const relativeX = e.clientX - pdfViewer.getBoundingClientRect().left;
            const relativeY = e.clientY - pdfViewer.getBoundingClientRect().top;

            element.style.left = `${relativeX - offsetX}px`;
            element.style.top = `${relativeY - offsetY}px`;
            console.log(`Checkbox dragged to position: X=${relativeX}, Y=${relativeY}`); // הודעה בלוג על מיקום
        }
    });

    document.addEventListener('mouseup', function() {
        isDragging = false;
        console.log('Dragging ended for Checkbox'); // הודעה בלוג לסיום הגרירה
    });
}

// יצירת תיבת חתימה/טקסט/תאריך בעת שחרור אלמנט ב-PDF

function allowDrop(event) {
    event.preventDefault();
}

function createRadioButton(pageWrapper, pageNumber, relativeX, relativeY, radioName = 'group1') {
    // יצירת אלמנט דיב שיאחסן את כפתור הרדיו
    const radioWrapper = document.createElement('div');
    radioWrapper.style.position = 'absolute';
    radioWrapper.style.width = '20px';
    radioWrapper.style.height = '20px';
    radioWrapper.style.left = `${relativeX}px`;
    radioWrapper.style.top = `${relativeY}px`;
    radioWrapper.setAttribute('data-page-number', pageNumber);

    // יצירת כפתור הרדיו
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = radioName;  // הגדרת שם הקבוצה של כפתור הרדיו
    radio.className = 'radio-button';
    radio.style.width = '20px';
    radio.style.height = '20px';

    // הוספת כפתור הרדיו ל-wrapper
    radioWrapper.appendChild(radio);
    pageWrapper.appendChild(radioWrapper);

    // הוספת פונקציות עיצוב וגרירה לכפתור הרדיו
    addMoveAndResizeFunctionality(radioWrapper);
    console.log(`Radio button added with name: ${radioName} to Page Number: ${pageNumber} at position: X=${relativeX}, Y=${relativeY}`);
}



// פונקציה ליצירת תיבת חתימה/טקסט/תאריך בעת שחרור אלמנט ב-PDF
function handleDrop(event) {
    event.preventDefault();
    const pdfViewer = document.getElementById('pdf-viewer');

    // זיהוי העמוד על בסיס מיקום העכבר
    const targetElement = document.elementFromPoint(event.clientX, event.clientY);
    const pageNumber = getPageNumberFromPosition(targetElement);

    if (!pageNumber) {
        alert('לא ניתן לקבוע את העמוד של ה-PDF');
        return;
    }

    const pageWrapper = document.querySelector(`.page-wrapper[data-page-number='${pageNumber}']`);
    if (!pageWrapper) {
        alert('שגיאה במציאת העמוד בתוך ה-PDF');
        return;
    }

    const relativeX = event.clientX - pageWrapper.getBoundingClientRect().left;
    const relativeY = event.clientY - pageWrapper.getBoundingClientRect().top;

    // יצירת אלמנטים על פי סוג האלמנט הנגרר
if (draggedElement.id === 'create-text-box-btn') {
    const textBox = document.createElement('textarea');
    textBox.className = 'text-box';
    textBox.style.position = 'absolute';
    textBox.style.width = '150px';
    textBox.style.height = '50px';
    textBox.style.left = `${relativeX}px`;
    textBox.style.top = `${relativeY}px`;
    textBox.id = `text-box-${Date.now()}`; // הגדרת ID ייחודי לתיבה
    textBox.setAttribute('data-page-number', pageNumber);

    // בקשה להזנת טקסט הוראה ושמירתו כ-placeholder
    const instructionText = prompt('Please enter the instruction to be displayed:', 'Write here');
    textBox.placeholder = instructionText || 'כאן יש להזין טקסט'; // הוספת placeholder במקום לכתוב בתיבה

    pageWrapper.appendChild(textBox);

    // שמירה ל-JSON
    textBox.setAttribute('data-instruction', instructionText); // הוספת הוראה כשדה מותאם אישית

    // הוספת אירוע לחיצה לבחירה
    textBox.addEventListener('click', () => selectCanvas(textBox));

    addMoveAndResizeFunctionality(textBox); // פונקציה לגרירה ושינוי גודל
    console.log(`Text box successfully added to Page Number: ${pageNumber} at relative position: X=${relativeX}, Y=${relativeY}`);

    // הוספת Tippy לתיבת הטקסט עם הטקסט שהוזן כהוראה ב-Tippy בלבד
    setTimeout(() => {
        tippy(`#${textBox.id}`, {
            content: instructionText || 'כאן יש להזין טקסט',
            placement: 'top',
            arrow: true,
        });
        console.log(`Tippy added to element: ${textBox.id}`);
    }, 100);
}
    if (draggedElement.id === 'create-checkbox-btn') {
      const checkboxWrapper = document.createElement('div');
    checkboxWrapper.style.position = 'absolute';
    checkboxWrapper.style.left = `${relativeX}px`;
    checkboxWrapper.style.top = `${relativeY}px`;
    checkboxWrapper.setAttribute('data-page-number', pageNumber);

    // הוסף ID ייחודי לתיבת ה-Checkbox
    checkboxWrapper.id = `checkbox-box-${Date.now()}`;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'checkbox';
    checkbox.style.width = '20px';
    checkbox.style.height = '20px';
    checkboxWrapper.appendChild(checkbox);
    pageWrapper.appendChild(checkboxWrapper);

    checkboxWrapper.addEventListener('click', () => selectCanvas(checkboxWrapper));
    addMoveAndResizeFunctionality(checkboxWrapper);

    console.log(`Checkbox successfully added to Page Number: ${pageNumber} at relative position: X=${relativeX}, Y=${relativeY}`);

    // הוספת Tippy לתיבת ה-Checkbox
    setTimeout(() => {
        // בדיקה שה-ID מוגדר
        if (checkboxWrapper.id) {
            tippy(`#${checkboxWrapper.id}`, {
                content: 'Settle in the desired location.',
                placement: 'top',
                arrow: true,
            });
            console.log(`Tippy added to element: ${checkboxWrapper.id}`);
        } else {
            console.error('Checkbox ID is not defined.');
        }
    }, 100); // עיכוב של 100ms כדי לוודא שהאלמנט נטען ב-DOM
}
// סוגר את התנאי `if` עבור checkbox

// ממשיכים בתנאי הבא
if (draggedElement.id === 'create-date-box-btn') {
    const dateInput = document.createElement('input');
    dateInput.type = 'date'; // תיבת התאריך נשארת כ-date
    dateInput.className = 'date-input';
    dateInput.style.position = 'absolute';
    dateInput.style.width = '100px';
    dateInput.style.height = '30px';
    dateInput.style.left = `${relativeX}px`;
    dateInput.style.top = `${relativeY}px`;
    dateInput.id = `date-box-${Date.now()}`; // הגדרת ID ייחודי לתיבת התאריך
    dateInput.setAttribute('data-page-number', pageNumber);
    dateInput.setAttribute('placeholder', 'Date'); // טקסט placeholder

    // הפיכת התיבה ל-read-only כדי למנוע שינוי
    dateInput.readOnly = true;

    pageWrapper.appendChild(dateInput);

    dateInput.addEventListener('click', () => selectCanvas(dateInput));
    addMoveAndResizeFunctionality(dateInput);

    console.log(`Date box successfully added to Page Number: ${pageNumber} at relative position: X=${relativeX}, Y=${relativeY}`);

    // הוספת Tippy לתיבת התאריך
    setTimeout(() => {
        tippy(`#${dateInput.id}`, {
            content: 'Place in the desired location',
            placement: 'top',
            arrow: true,
        });
        console.log(`Tippy added to element: ${dateInput.id}`);
    }, 100);
}

    if (draggedElement.id === 'create-radio-btn') {

const radioGroupName = document.getElementById('radio-group-name').value || 'group1';
       
 const radioWrapper = document.createElement('div');
          radioWrapper.id = `radio-wrapper-${Date.now()}`;  // הוספת ID ייחודי
 radioWrapper.style.position = 'absolute';
        radioWrapper.style.left = `${relativeX}px`;
        radioWrapper.style.top = `${relativeY}px`;
        radioWrapper.setAttribute('data-page-number', pageNumber);

        const radio = document.createElement('input');
        radio.type = 'radio';
	radio.name = radioGroupName;
        radio.className = 'radio-button';
        radio.style.width = '20px';
        radio.style.height = '20px';
        radioWrapper.appendChild(radio);
        pageWrapper.appendChild(radioWrapper);

        radioWrapper.addEventListener('click', () => selectCanvas(radioWrapper));
        addMoveAndResizeFunctionality(radioWrapper);
        console.log(`Radio button successfully added to Page Number: ${pageNumber} at relative position: X=${relativeX}, Y=${relativeY}`);
    

// הוספת Tippy לתיבת הרדיו
    setTimeout(() => {
        // בדיקה שה-ID מוגדר
        if (radioWrapper.id) {
            tippy(`#${radioWrapper.id}`, {
                content: 'כאן יש לבחור אופציה',
                placement: 'top',
                arrow: true,
            });
            console.log(`Tippy added to element: ${radioWrapper.id}`);
        } else {
            console.error('Radio Button ID is not defined.');
        }
    }, 100); // עיכוב של 100ms כדי לוודא שהאלמנט נטען ב-DOM
}   
if (draggedElement.id === 'create-signature-box-btn') {
    const signatureBox = document.createElement('div');
    signatureBox.className = 'signature-canvas';
    signatureBox.id = `signature-box-${Date.now()}`;
    signatureBox.style.position = 'absolute';
    signatureBox.style.width = '200px';
    signatureBox.style.height = '100px';
    signatureBox.style.left = `${relativeX}px`;
    signatureBox.style.top = `${relativeY}px`;
    signatureBox.style.border = '2px solid Blue';
    signatureBox.setAttribute('data-page-number', pageNumber);
    pageWrapper.appendChild(signatureBox);

    signatureBox.addEventListener('click', () => selectCanvas(signatureBox));
    addMoveAndResizeFunctionality(signatureBox);

    console.log(`Signature box successfully added to Page Number: ${pageNumber} at relative position: X=${relativeX}, Y=${relativeY}`);

    // הוספת Tippy לתיבת החתימה
    setTimeout(() => {
        tippy(`#${signatureBox.id}`, {
            content: 'Position yourself on the spot for signing.',
            placement: 'top',
            arrow: true,
        });
        console.log(`Tippy added to element: ${signatureBox.id}`);
    }, 100); // עיכוב של 100ms כדי לוודא שהאלמנט נטען ב-DOM
}

// כאן צריך להוסיף את הסוגר המסולסל כדי לסיים את פונקציית handleDrop
}

// המשך הפונקציה כמו שהיה:
function dragStart(event) {
    draggedElement = event.target;
}

function initializeDragAndDrop() {
    // הגדרת כל כפתורי האלמנטים כ־draggable
    const createSignatureBoxButton = document.getElementById('create-signature-box-btn');
    const createTextBoxButton = document.getElementById('create-text-box-btn');
    const createDateBoxButton = document.getElementById('create-date-box-btn');
    const createCheckboxButton = document.getElementById('create-checkbox-btn');
 
 
  const createRadioButton = document.getElementById('create-radio-btn'); // כפתור הרדיו

    // הגדרת כל הכפתורים כ־draggable
    createSignatureBoxButton.setAttribute('draggable', 'true');
    createTextBoxButton.setAttribute('draggable', 'true');
    createDateBoxButton.setAttribute('draggable', 'true');
    createCheckboxButton.setAttribute('draggable', 'true');
    createRadioButton.setAttribute('draggable', 'true'); // כפתור רדיו

    // הוספת אירועים לכל כפתור לגרירה
    createSignatureBoxButton.addEventListener('dragstart', dragStart);
    createTextBoxButton.addEventListener('dragstart', dragStart);
    createDateBoxButton.addEventListener('dragstart', dragStart);
    createCheckboxButton.addEventListener('dragstart', dragStart);
    createRadioButton.addEventListener('dragstart', dragStart); // לא לשכוח את הרדיו

    // הגדרת אזור הגרירה
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

            // שינוי גודל של checkbox או radio button לפי הסוג
            const inputElement = element.querySelector('input[type="checkbox"], input[type="radio"]');
            if (inputElement) {
                inputElement.style.width = newWidth + 'px';
                inputElement.style.height = newHeight + 'px';
            }
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

// פונקציה לשליחת המסמך לשרת
function saveAndSendDocument(recipientEmail) {
    const now = new Date(); // הגדרת התאריך והשעה כאן בהתחלה
    const fileName = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}_${now.getHours()}-${now.getMinutes()}-${now.getSeconds()}.pdf`;

    const pdfData = localStorage.getItem('pdfData');
    if (!pdfData) {
        alert("PDF לא נטען כראי.");
        return;
    }

    const fields = [];

    // הוספת כתובת מייל של המשתמש ל-JSON
    const userEmail = document.getElementById('recipient-email').value || 'mike@good-sign.co.il';
    fields.push({
        type: 'userEmail',
        email: userEmail
    });

    const signatureElements = document.querySelectorAll('.signature-canvas');
    signatureElements.forEach(el => fields.push({
        type: 'signature',
        left: el.style.left,
        top: el.style.top,
        width: el.style.width,
        height: el.style.height,
        pageNumber: el.getAttribute('data-page-number'), 
        fileName: fileName 
    }));

    const textElements = document.querySelectorAll('.text-box');
    textElements.forEach(el => fields.push({
        type: 'text',
        left: el.style.left,
        top: el.style.top,
        width: el.style.width,
        height: el.style.height,
        pageNumber: el.getAttribute('data-page-number'),
        instruction: el.getAttribute('data-instruction') || '', // שמירת ההוראה
        fileName: fileName
    }));

    const dateElements = document.querySelectorAll('.date-input');
    dateElements.forEach(el => fields.push({
        type: 'date',
        left: el.style.left,
        top: el.style.top,
        width: el.style.width,
        height: el.style.height,
        pageNumber: el.getAttribute('data-page-number'), // הוספת מספר העמוד
        fileName: fileName // הוספת שם הקובץ
    }));

    // איסוף כל האלמנטים של ה-checkbox ושמירתם ב-JASON
    const checkboxElements = document.querySelectorAll('.checkbox');
    checkboxElements.forEach(el => {
        const wrapper = el.parentElement; // מקבל את האלמנט העוטף של ה-checkbox
        fields.push({
            type: 'checkbox',
            left: wrapper.style.left || '0px',
            top: wrapper.style.top || '0px',
            width: el.style.width || '20px',
            height: el.style.height || '20px',
            pageNumber: wrapper.getAttribute('data-page-number') || '1', // שמירת מספר העמוד
            fileName: fileName // הוספת שם הקובץ
        });
    });

    // שמירה של כפתורי רדיו
    const radioElements = document.querySelectorAll('.radio-button');
    radioElements.forEach(el => fields.push({
        type: 'radio',
        left: el.parentElement.style.left,
        top: el.parentElement.style.top,
        width: el.parentElement.style.width || '20px', // שמירת רוחב, ואם לא קיים – הגדר ברירת מחדל
        height: el.parentElement.style.height || '20px', // שמירת גובה, ואם לא קיים – הגדר ברירת מחדל
        pageNumber: el.parentElement.getAttribute('data-page-number'), // הוספת מספר העמוד
        name: el.name, // הוספת שם הקבוצה של כפתור הרדיו
        fileName: fileName // הוספת שם הקובץ
    }));

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
        alert('The document was saved and sent to email: ' + recipientEmail);
    })
    .catch(error => {
        console.error('Error:', error);
        alert('שגיאה בשליחת המסמך למייל.');
    });
}

// מאזינים לכפתורים
document.addEventListener('DOMContentLoaded', function() {
    initializeDragAndDrop();

    // הסר כל מאזין קודם לכפתור שליחת המסמך והוסף מאזין חדש
const sendDocumentBtn = document.getElementById('send-document-btn');

// מחיקה אם קיים מאזין קודם לאותו כפתור
sendDocumentBtn.removeEventListener('click', sendDocumentHandler); // הסרה אם קיימת

// הוספת מאזין חדש
sendDocumentBtn.addEventListener('click', sendDocumentHandler);

// פונקציה לשליחת המסמך
function sendDocumentHandler() {
    const recipientEmail = document.getElementById('recipient-email').value;
    if (!recipientEmail) {
        alert('נא להזין כתובת מייל תקינה.');
        return;
    }
    saveAndSendDocument(recipientEmail);
}


  const pdfData = localStorage.getItem('pdfData');
if (pdfData) {
    loadPDF(pdfData); // טוען את ה-PDF רק אם הנתון קיים
}

// פונקציה שתופעל בעת לחיצה על כפתור פתיחת הקובץ
document.getElementById('open-pdf-btn').addEventListener('click', function() {
    const pdfData = localStorage.getItem('pdfData');
    if (!pdfData) {
        alert('לא נבחר קובץ PDF');
        return;
    }

    loadPDF(pdfData); // טוען את הקובץ אם קיים
});

});