const createBot = {
  // Stepper
  stepForm: "טופס",
  stepPreview: "תצוגה מקדימה",
  stepConnect: "חיבור",

  // Form Section — Header
  formTitle: "בואו ניצור את הבוט שלך",
  formSubtitle: "מלא את הפרטים שאנחנו צריכים כדי ליצור בוט AI מותאם אישית לעסק שלך",

  // Form Section — Knowledge Base
  knowledgeBaseTitle: "בואו נבנה את מאגר הידע של הבוט",
  knowledgeBaseDesc:
    "תן לי את האתר שלך, ואני אסרוק אותו כדי ללמוד הכל על העסק שלך — מוצרים, שירותים, מחירים ומידע על החנות.",
  knowledgeBaseItem1: "כל המידע על מוצרים ושירותים",
  knowledgeBaseItem2: "מחירים ומידע על החנות",
  knowledgeBaseItem3: "פרטי קשר ושעות פעילות",
  websiteUrlLabel: "קישור לאתר",
  websiteUrlPlaceholder: "https://www.yourwebsite.com",
  websiteUrlHelp: "ודא שהאתר נגיש ולא מוגן בסיסמה",
  consentCheckbox: "אני מסכים להעלאת תמונות של תוכן",

  // Form Section — Create AI
  createAiTitle: "יצירת ה-AI של הבוט",
  createAiStep1: "נסרוק את האתר שלך",
  createAiStep2: "נבנה מאגר ידע AI מותאם אישית",
  createAiStep3: "הבוט שלך יהיה מוכן לענות ללקוחות",

  // Form Section — Bot Purpose
  botPurposeTitle: "מה הבוט צריך לעשות?",
  botPurpose1: "לענות על שאלות לקוחות לגבי מוצרים ושירותים",
  botPurpose2: "לעזור ללקוחות לבצע הזמנות",
  botPurpose3: "לספק שירות ותמיכה ללקוחות",
  botPurpose4: "לתאם פגישות או ייעוצים",

  // Form Section — Extras
  extrasTitle: "רוצה עוד? יש לנו גם את אלה!",
  extra1: "איסוף ביקורות מלקוחות",
  extra2: "ניהול תורים",
  extra3: "אינטגרציות מותאמות",

  // Form Section — Response Style
  responseStyleTitle: "איך אתה רוצה שהבוט יגיב?",
  responseStyleFriendly: "ידידותי",
  responseStyleProfessional: "מקצועי",
  responseStyleCasual: "קז'ואל",
  responseStyleCustom: "מותאם אישית",

  // Form Section — Additional
  additionalNotesLabel: "הערות או הנחיות נוספות",
  additionalNotesPlaceholder: "משהו נוסף שתרצה שהבוט ידע...",

  // Form Section — Privacy & Submit
  privacyNotice:
    "המידע שהגשת ישמש אך ורק ליצירת הבוט שלך. לא נשתף את המידע שלך עם צדדים שלישיים.",
  privacyLink: "קרא את מדיניות הפרטיות המלאה שלנו",
  createBotBtn: "צור את הבוט",
  nextStep: "שלב הבא",
  letsStart: "בואו נתחיל",
  stepOf: "{{current}} מתוך {{total}}",
  missingFields: "נא למלא את כל השדות הנדרשים",
  createBotError: "משהו השתבש ביצירת הבוט. נסה שוב.",

  // Form Section — Submission Progress
  creatingBot: "יוצר את הבוט שלך...",
  creatingBotDesc: "אנחנו בונים את ה-AI של הבוט. זה עשוי לקחת רגע.",
  scrapingWebsite: "סורק את האתר שלך...",
  scrapingDesc: "אנחנו סורקים את האתר שלך כדי ללמוד על העסק שלך.",
  botCreated: "הבוט נוצר!",
  botReadyForPreview: "הבוט שלך מוכן. בוא נראה אותו בפעולה!",
  pagesScraped: "דפים נסרקו",
  productsFound: "מוצרים נמצאו",

  // Preview Section
  previewChangeTitle: "רוצה לשנות משהו?",
  chatbotDemo: "הדגמת צ'אטבוט",
  botMessage: "היי! אפשר לבדוק את הבוט כאן. שלח הודעה כדי לראות איך הוא מגיב.",
  systemMessage: "שלח הודעה כדי להתחיל את התהליך",
  typeMessage: "הקלד הודעה...",
  letsGo: "קדימה",
  tabDemo: "הדגמת צ'אט",
  tabEdit: "עריכת בוט",
  editBotTitle: "עריכת תגובות הבוט",
  editBotDesc: "תאר מה תרצה לשנות בהתנהגות או בתגובות הבוט",
  editBotPlaceholder: "למשל: להפוך את הבוט לרשמי יותר, להוסיף ברכה בערבית, לענות בקצרה...",
  editBotSubmit: "החל שינויים",
  editBotProcessing: "מחיל שינויים...",
  editBotSuccess: "הבוט עודכן בהצלחה! נסה אותו בצ'אט ההדגמה.",
  editBotError: "עדכון הבוט נכשל. נסה שוב.",
  proposedChanges: "שינויים שבוצעו:",
  typingIndicator: "הבוט מקליד...",
  newConversation: "שיחה חדשה",

  // Connect Section — Tutorial Slider
  connectTitle: "איך לחבר את הבוט לוואטסאפ",
  watchVideo: "צפה בהדרכה",
  tutorialStepAndroid1: "פתח את וואטסאפ, לחץ על תפריט שלוש הנקודות (⋮) ובחר 'מכשירים מקושרים'",
  tutorialStepAndroid2: "לחץ על 'קשר מכשיר' וסרוק את קוד ה-QR שמוצג למטה",
  tutorialStepIphone1: "פתח את וואטסאפ, עבור להגדרות ולחץ על 'מכשירים מקושרים'",
  tutorialStepIphone2: "לחץ על 'קשר מכשיר' וסרוק את קוד ה-QR שמוצג למטה",
  stepCounter: "שלב {{current}} מתוך {{total}}",
  platformAndroid: "אנדרואיד",
  platformIphone: "אייפון",
  gotIt: "הבנתי, בואו נמשיך",

  // Connect Section — WhatsApp Connect
  getQrCode: "קבל QR",
  linkWithPhone: "קשר עם מספר טלפון",
  sendQrToClient: "שלח קוד QR ללקוח",
  scanQrCode: "פתח את וואטסאפ בטלפון וסרוק את קוד ה-QR",
  waitingForScan: "ממתין לסריקה...",
  refreshQr: "רענן קוד QR",
  connecting: "מתחבר...",
  connectSuccess: "חיבור לוואטסאפ הצליח! הבוט שלך פעיל עכשיו.",
  connectError: "החיבור נכשל. נסה שוב.",
  alreadyConnected: "הבוט שלך כבר מחובר לוואטסאפ!",
  skipToDashboard: "דלג",
  skipForm: "דלג",
  logout: "התנתק",

  // Connect Section — Success Overlay
  connectSuccessTitle: "!אתה מחובר",
  connectSuccessSubtitle: "הבוט שלך פעיל בוואטסאפ ומוכן לשרת לקוחות",
  goToDashboard: "עבור ללוח הבקרה",
};

export default createBot;
