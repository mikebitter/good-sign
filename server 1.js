const express = require('express');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');

const app = express();
const port = 3000;

const DOCUMENTS_DIR = path.join(__dirname, 'saved_documents');
app.use(express.json({ limit: '50mb' }));  // הגדרת מגבלת גודל ל-50MB
app.use(express.static('public'));

// יצירת תקיות אם לא קיימות
if (!fs.existsSync(DOCUMENTS_DIR)) {
    fs.mkdirSync(DOCUMENTS_DIR);
}

// מסלול לשמירת מסמכים ושליחת המייל
// מסלול לשמירת מסמכים
app.post('/saveFields', (req, res) => {
    const { pdfData, fileName } = req.body;

    // בדיקה שהקלטים קיימים
    if (!pdfData || !fileName) {
        return res.status(400).send('Missing data');
    }

    // שמירת קובץ PDF
    const pdfPath = path.join(DOCUMENTS_DIR, `${fileName}.pdf`);
    const base64Data = pdfData.split(',')[1]; // חילוץ החלק של הנתונים בלבד

    fs.writeFileSync(pdfPath, base64Data, 'base64', (err) => {
        if (err) {
            console.error("Error writing PDF file:", err);
            return res.status(500).send('Error saving PDF');
        }
    });

    console.log(`PDF saved to: ${pdfPath}`);

    // החזרת תגובה ללקוח
    res.send(`Document saved successfully at ${pdfPath}`);
});


// מסלול לשליפת קבצי PDF
app.get('/saved_documents/:fileName', (req, res) => {
    const fileName = req.params.fileName;
    const filePath = path.join(DOCUMENTS_DIR, fileName);

    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).send('File not found');
    }
});

// מסלול לפתיחת דף החתימה
app.get('/sign/:documentId', (req, res) => {
    console.log(`Loading signer page for document ID: ${req.params.documentId}`);
    res.sendFile(path.join(__dirname, 'public', 'signer.html'));
});

// הוספת מסלול כללי לתצוגת הקבצים, ניתן להרחיב לפי הצורך
app.use(express.static(path.join(__dirname, 'public')));

// האזנה לשרת
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
