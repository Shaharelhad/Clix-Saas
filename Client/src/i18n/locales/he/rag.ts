const rag = {
  knowledgeBase: "בסיס ידע",
  uploadTitle: "העלאת מסמך ידע",
  uploadDesc:
    "העלה קובץ PDF או TXT כדי להעשיר את הבוט שלך במידע נוסף. הבוט ישתמש במידע הזה כשיענה ללקוחות.",
  dragDrop: "גרור קובץ לכאן או לחץ לבחירה",
  supportedFormats: "PDF או TXT, עד 10MB",
  extractingText: "מחלץ טקסט...",
  uploadingFile: "מעלה קובץ...",
  processingFile: "מעבד ויוצר אינדקס...",
  currentDocument: "מסמך נוכחי",
  fileName: "שם קובץ",
  fileSize: "גודל",
  chunks: "קטעים",
  uploadDate: "תאריך העלאה",
  replaceFile: "החלף קובץ",
  removeFile: "הסר קובץ",
  removeConfirm: "האם אתה בטוח? כל המידע מהמסמך יימחק.",
  statusReady: "מוכן",
  statusProcessing: "מעבד...",
  statusError: "שגיאה",
  errorFileType: "סוג קובץ לא נתמך. העלה PDF או TXT בלבד.",
  errorFileSize: "הקובץ גדול מדי. מקסימום 10MB.",
  errorEmptyText: "לא נמצא טקסט בקובץ. נסה קובץ אחר.",
  errorUpload: "ההעלאה נכשלה. נסה שוב.",
  errorProcessing: "העיבוד נכשל. נסה שוב.",
  errorDelete: "המחיקה נכשלה. נסה שוב.",
  retry: "נסה שוב",

  // Google Sheets
  sheetsTitle: "גיליון Google",
  sheetsDesc:
    "חבר גיליון Google ציבורי כמקור ידע. הבוט ישתמש בנתונים האלה כשיענה ללקוחות.",
  sheetsPlaceholder: "הדבק קישור ל-Google Sheet ציבורי",
  sheetsConnect: "חבר",
  sheetsDisconnect: "נתק",
  sheetsDisconnectConfirm: "האם אתה בטוח? כל הנתונים מהגיליון יימחקו.",
  sheetsSync: "רענן",
  sheetsSyncing: "מסנכרן...",
  sheetsConnecting: "מתחבר...",
  sheetsLastSync: "סנכרון אחרון",
  sheetsRowCount: "שורות",
  sheetsNoChanges: "הגיליון מעודכן, לא נמצאו שינויים.",
  sheetsSyncSuccess: "הגיליון סונכרן בהצלחה!",
  sheetsErrorUrl:
    "קישור לא תקין. ודא שזה קישור תקין ל-Google Sheet ציבורי.",
  sheetsErrorFetch:
    "לא ניתן לקרוא את הגיליון. ודא שהשיתוף מוגדר ל-'כל מי שיש לו קישור יכול לצפות'.",
  sheetsErrorConnect: "החיבור נכשל. נסה שוב.",
  sheetsErrorSync: "הסנכרון נכשל. נסה שוב.",
  sheetsPublicHint:
    "הגיליון חייב להיות משותף כ-'כל מי שיש לו קישור יכול לצפות'",
  sheetsAutoSync: "סנכרון אוטומטי כל 10 דקות",
};

export default rag;
