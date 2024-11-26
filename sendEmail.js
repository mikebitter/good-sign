const nodemailer = require('nodemailer');

// יצירת טרנספורטר ל-SMTP
const transporter = nodemailer.createTransport({
    host: 'good-sign.co.il',  // כתובת ה-SMTP שלך
    port: 25,  // הפורט ששימושי עבור SMTP ללא הצפנה
    secure: false,  // אין שימוש ב-SSL/TLS
    auth: {
        user: 'pdf_sign@Good-Sign.co.il',  // כתובת הדוא"ל שלך
        pass: 'Qwer@1234'  // הסיסמה שלך
    }
});

// הגדרת אפשרויות המייל
const mailOptions = {
    from: 'pdf_sign@Good-Sign.co.il',  // הכתובת שממנה המייל נשלח
    to: 'mike@halsoft.co.il',  // כתובת המייל של הנמען
    subject: 'Test Email',  // נושא המייל
    text: 'This is a test email sent from Node.js using your Webmail!'  // תוכן המייל
};

// שליחת המייל
transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
        return console.log('Error occurred: ' + error.message);
    }
    console.log('Email sent: ' + info.response);
});
