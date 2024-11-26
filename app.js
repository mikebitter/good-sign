const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const port = 3000;

app.use(express.json({ limit: '50mb' })); // כדי להתמודד עם קבצי PDF גדולים

// תיקיית שמירת המסמכים
const DOCUMENTS_DIR = path.join(__dirname, 'saved_documents');

// יצירת התיקייה אם היא לא קיימת
if (!fs.existsSync(DOCUMENTS_DIR)) {
    fs.mkdirSync(DOCUMENTS_DIR);
}

// פונקציה ליצירת שם קובץ ייחודי מבוסס תאריך ושעה
function generateUniqueFileName() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0'); // חודשים מתחילים מאפס
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
}

// שמירת השדות וה-PDF
app.post('/saveFields', (req, res) => {
    const fields = req.body.fields; // השדות (JSON)
    const pdfData = req.body.pdfData; // ה-PDF בצורה של DataURL

    const fileName = generateUniqueFileName(); // יצירת שם ייחודי
    const pdfFileName = path.join(DOCUMENTS_DIR, `${fileName}.pdf`);
    const jsonFileName = path.join(DOCUMENTS_DIR, `${fileName}.json`);

    // שמירת ה-PDF כקובץ
    const pdfBuffer = Buffer.from(pdfData.split(',')[1], 'base64');
    fs.writeFileSync(pdfFileName, pdfBuffer);

    // שמירת ה-JSON כקובץ
    fs.writeFileSync(jsonFileName, JSON.stringify(fields, null, 2));

    res.send('PDF and JSON saved successfully');
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
