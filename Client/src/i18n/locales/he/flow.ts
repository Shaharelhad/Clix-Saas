const flow = {
  // Page
  pageTitle: "בונה תהליכים",
  createFirst: "צור את התהליך הראשון שלך",
  createFirstDesc: "בנה תהליך שיחה ויזואלי לוואטסאפ עם גרירה ושחרור.",
  newFlow: "תהליך חדש",
  noFlowSelected: "בחר תהליך או צור חדש",

  // Toolbar
  save: "שמור",
  saved: "נשמר",
  saving: "שומר...",
  unsaved: "שינויים לא שמורים",
  active: "פעיל",
  paused: "מושהה",
  draft: "טיוטה",
  activate: "הפעל",
  pause: "השהה",
  publish: "פרסם",
  unpublish: "Unpublish",
  live: "פעיל",
  publishConfirm: "התהליך יהיה פעיל בבוט הוואטסאפ שלך. לקוחות יתחילו לקבל הודעות לפי התהליך הזה.",
  unpublishConfirm: "התהליך יושהה. הבוט ימשיך לענות באמצעות AI, אבל לא יעקוב אחרי שלבי התהליך.",
  cancel: "ביטול",
  confirmPublish: "פרסם",
  confirmUnpublish: "השהה",
  deleteFlow: "מחק תהליך",
  deleteConfirm: "האם אתה בטוח שברצונך למחוק את התהליך?",

  // Node types
  nodeStart: "קבלת הודעה",
  nodeText: "הודעת טקסט",
  nodeImage: "תמונה",
  nodeButtons: "כפתורים",
  nodeDelay: "השהייה",
  // Node descriptions (palette)
  nodeStartDesc: "מקבל הודעות נכנסות",
  nodeTextDesc: "שלח הודעת טקסט",
  nodeImageDesc: "שלח תמונה עם כיתוב",
  nodeButtonsDesc: "הצג כפתורים אינטראקטיביים",
  nodeDelayDesc: "המתן לפני המשך",
  // Editor fields
  triggerText: "מסנן מילים",
  triggerTextHint: "מילת מפתח אופציונלית לסינון (השאר ריק לכולן)",
  message: "הודעה",
  messageHint: "השתמש ב-{{שםמשתנה}} לערכים דינמיים",
  imageUrl: "כתובת תמונה",
  imageUrlHint: "קישור ישיר לתמונה",
  imageUpload: "העלאת תמונה",
  imageUploading: "מעלה...",
  imageRemove: "הסרת תמונה",
  imageUploadError: "ההעלאה נכשלה — נסה שוב",
  expectedReply: "תשובה צפויה",
  expectedReplyHint: "טקסט מדויק או דומה להתאמה",
  continueAuto: "המשך בכל תשובה",
  continueAutoHint: "כל הודעה מהלקוח תמשיך את התהליך",
  delayMinutes: "השהייה (דקות)",
  delayMinutesHint: "כמה זמן להמתין (1-1440)",
  buttons: "כפתורים",
  addButton: "הוסף כפתור",
  buttonLabel: "תווית כפתור",
  maxButtons: "מקסימום 10 כפתורים",

  // Help assistant
  helpTitle: "עוזר בונה תהליכים",
  helpStatus: "מוכן לעזור",
  helpPlaceholder: "שאל שאלה על בונה התהליכים...",
  helpGreeting: "היי! 👋 אני כאן לעזור לך עם בונה התהליכים. שאל אותי על צמתים, חיבורים, פרסום, הגדרות, או כל דבר אחר.",
  helpReset: "אפס שיחה",
  helpOpen: "עזרה",
  helpClose: "סגור עזרה",

  // Canvas
  canvasEmpty: "גרור צמתים מהפאנל כדי להתחיל לבנות את התהליך",

  // Workflow Settings
  settingsTitle: "הגדרות תהליך",
  settingsIgnoreGroups: "התעלם משיחות קבוצתיות",
  settingsIgnoreGroupsHint: "דלג על הודעות מקבוצות וואטסאפ — הגב רק לשיחות פרטיות",
  settingsCooldown: "השתקה בעת מענה אנושי",
  settingsCooldownHint: "כשאתה משיב ידנית, השבת את הבוט באופן זמני לשיחה הזו",
  settingsCooldownMinutes: "משך ההשתקה (דקות)",
  settingsCooldownPreset30: "30 דק׳",
  settingsCooldownPreset60: "שעה",
  settingsCooldownPreset120: "שעתיים",
  settingsAutoFollowUp: "מעקב אוטומטי",
  settingsAutoFollowUpHint: "שלח הודעת מעקב חכמה כשלקוח מפסיק להגיב",
  settingsAutoFollowUpDelay: "זמן המתנה לפני מעקב (דקות)",
  settingsAutoFollowUpPreset30: "30 דק׳",
  settingsAutoFollowUpPreset60: "שעה",
  settingsAutoFollowUpPreset120: "שעתיים",
  settingsAutoFollowUpMaxCount: "מקסימום הודעות מעקב",
  settingsAutoFollowUpMaxCountHint: "כמה הודעות מעקב לשלוח לפני שמפסיקים",
  settingsDedup: "סינון הודעות כפולות",
  settingsDedupHint: "מנע עיבוד כפול מהודעות webhook שחוזרות על עצמן",
  settingsSessionReset: "איפוס שיחה אוטומטי",
  settingsSessionResetHint: "התחל את השיחה מחדש כשלקוח לא שלח הודעה זמן רב",
  settingsSessionResetMinutes: "איפוס לאחר חוסר פעילות (דקות)",
  settingsSessionResetPreset60: "שעה",
  settingsSessionResetPreset360: "6 שעות",
  settingsSessionResetPreset1440: "24 שעות",
  settingsDone: "סגור",

  // Auto-save & lock
  autoSaved: "נשמר אוטומטית",
  lockedBanner: "בטל פרסום התהליך כדי לערוך",

  // Templates
  templatePickerTitle: "בחר תבנית",
  templatePickerSubtitle: "התחל עם תבנית מוכנה או צור תהליך ריק",
  templateBlank: "תהליך ריק",
  templateBlankDesc: "התחל מאפס עם צומת התחלה אחד",
  templateLeadCollection: "איסוף לידים",
  templateLeadCollectionDesc: "אסוף שם, טלפון ומייל מלקוחות",
  templateAppointment: "קביעת תור",
  templateAppointmentDesc: "אפשר ללקוחות לקבוע תורים",
  templateProductInquiry: "בירור מוצר",
  templateProductInquiryDesc: "ענה על שאלות לגבי מוצרים ואסוף פרטים",
  templateSteps: "{{count}} שלבים",

  // Strict Mode
  settingsStrictMode: "מצב קפדני",
  settingsStrictModeHint: "הבוט עוקב רק אחרי שלבי התהליך — ללא תשובות AI חופשיות",

  // Multi-workflow
  switchFlow: "החלף תהליך",
  maxFlowsReached: "הגעת למקסימום תהליכים (5)",
  confirmDelete: "מחק",
  cannotDeleteActive: "בטל פרסום לפני מחיקה",

  // Misc
  deleteNode: "מחק צומת",
  noNodeSelected: "בחר צומת כדי לערוך את המאפיינים שלו",
  flowList: "התהליכים שלי",
};

export default flow;
