const rag = {
  knowledgeBase: "Knowledge Base",
  uploadTitle: "Upload Knowledge Document",
  uploadDesc:
    "Upload a PDF or TXT file to enrich your bot with additional knowledge. The bot will use this information when answering customers.",
  dragDrop: "Drag a file here or click to choose",
  supportedFormats: "PDF or TXT, up to 10MB",
  extractingText: "Extracting text...",
  uploadingFile: "Uploading file...",
  processingFile: "Processing and indexing...",
  currentDocument: "Current Document",
  fileName: "File name",
  fileSize: "Size",
  chunks: "Chunks",
  uploadDate: "Upload date",
  replaceFile: "Replace File",
  removeFile: "Remove File",
  removeConfirm: "Are you sure? All data from this document will be deleted.",
  statusReady: "Ready",
  statusProcessing: "Processing...",
  statusError: "Error",
  errorFileType: "Unsupported file type. Upload PDF or TXT only.",
  errorFileSize: "File is too large. Maximum 10MB.",
  errorEmptyText: "No text found in file. Try a different file.",
  errorUpload: "Upload failed. Please try again.",
  errorProcessing: "Processing failed. Please try again.",
  errorDelete: "Deletion failed. Please try again.",
  retry: "Try Again",

  // Google Sheets
  sheetsTitle: "Google Sheets",
  sheetsDesc:
    "Connect a public Google Sheet as a knowledge source. The bot will search this data when answering customers.",
  sheetsPlaceholder: "Paste public Google Sheet URL",
  sheetsConnect: "Connect",
  sheetsDisconnect: "Disconnect",
  sheetsDisconnectConfirm:
    "Are you sure? All data from this sheet will be removed.",
  sheetsSync: "Refresh",
  sheetsSyncing: "Syncing...",
  sheetsConnecting: "Connecting...",
  sheetsLastSync: "Last synced",
  sheetsRowCount: "Rows",
  sheetsNoChanges: "Sheet is up to date, no changes detected.",
  sheetsSyncSuccess: "Sheet synced successfully!",
  sheetsErrorUrl:
    "Invalid Google Sheet URL. Make sure it's a valid public sheet link.",
  sheetsErrorFetch:
    "Could not read sheet. Make sure it's set to 'Anyone with the link can view'.",
  sheetsErrorConnect: "Connection failed. Please try again.",
  sheetsErrorSync: "Sync failed. Please try again.",
  sheetsPublicHint:
    "The sheet must be shared as 'Anyone with the link can view'",
  sheetsAutoSync: "Auto-syncs every 10 minutes",
};

export default rag;
