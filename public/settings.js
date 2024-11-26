// זהו קוד JavaScript שמנהל את טופס ההגדרות
document.getElementById('settings-form').addEventListener('submit', function(event) {
    event.preventDefault(); // מונע שליחה רגילה של הטופס
    
    // קבלת הערכים מהשדות
    const userName = document.getElementById('userName').value;
    const userEmail = document.getElementById('userEmail').value;
    
    // שמירת הפרטים ב-LocalStorage (אחסון מקומי של הדפדפן)
    localStorage.setItem('userName', userName);
    localStorage.setItem('userEmail', userEmail);
    
    // הודעת הצלחה
    alert('ההגדרות נשמרו בהצלחה!');
});
