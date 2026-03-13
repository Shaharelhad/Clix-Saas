const flow = {
  // Page
  pageTitle: "Flow Builder",
  createFirst: "Create Your First Flow",
  createFirstDesc: "Build a visual WhatsApp conversation flow with drag-and-drop nodes.",
  newFlow: "New Flow",
  noFlowSelected: "Select a flow or create a new one",

  // Toolbar
  save: "Save",
  saved: "Saved",
  saving: "Saving...",
  unsaved: "Unsaved changes",
  active: "Active",
  paused: "Paused",
  draft: "Draft",
  activate: "Activate",
  pause: "Pause",
  publish: "Publish",
  unpublish: "Unpublish",
  live: "Live",
  publishConfirm: "This will make your flow live on your WhatsApp bot. Customers will start receiving messages based on this flow.",
  unpublishConfirm: "This will pause your flow. The bot will still respond using AI, but won't follow the flow steps.",
  cancel: "Cancel",
  confirmPublish: "Publish",
  confirmUnpublish: "Unpublish",
  deleteFlow: "Delete Flow",
  deleteConfirm: "Are you sure you want to delete this flow?",

  // Node types
  nodeStart: "Get Message",
  nodeText: "Text Message",
  nodeImage: "Image",
  nodeButtons: "Buttons",
  nodeDelay: "Delay",
  // Node descriptions (palette)
  nodeStartDesc: "Receives incoming messages",
  nodeTextDesc: "Send a text message",
  nodeImageDesc: "Send an image with caption",
  nodeButtonsDesc: "Show interactive buttons",
  nodeDelayDesc: "Wait before continuing",
  // Editor fields
  triggerText: "Keyword Filter",
  triggerTextHint: "Optional keyword to filter messages (leave empty for all)",
  message: "Message",
  messageHint: "Use {{variableName}} for dynamic values",
  imageUrl: "Image URL",
  imageUrlHint: "Direct link to the image",
  imageUpload: "Upload image",
  imageUploading: "Uploading...",
  imageRemove: "Remove image",
  imageUploadError: "Upload failed — please try again",
  expectedReply: "Expected Answer",
  expectedReplyHint: "Exact or similar text to match",
  continueAuto: "Continue on any reply",
  continueAutoHint: "Any message from the customer will continue the flow",
  delayMinutes: "Delay (minutes)",
  delayMinutesHint: "How long to wait (1-1440)",
  buttons: "Buttons",
  addButton: "Add Button",
  buttonLabel: "Button Label",
  maxButtons: "Maximum 10 buttons",

  // Help assistant
  helpTitle: "Flow Builder Assistant",
  helpStatus: "Ready to help",
  helpPlaceholder: "Ask about the flow builder...",
  helpGreeting: "Hi! 👋 I'm here to help you with the flow builder. Ask me about nodes, connections, publishing, settings, or anything else.",
  helpReset: "Reset chat",
  helpOpen: "Help",
  helpClose: "Close help",

  // Canvas
  canvasEmpty: "Drag nodes from the panel to start building your flow",

  // Workflow Settings
  settingsTitle: "Workflow Settings",
  settingsIgnoreGroups: "Ignore Group Chats",
  settingsIgnoreGroupsHint: "Skip messages from WhatsApp groups — only respond to private chats",
  settingsCooldown: "Human Takeover Cooldown",
  settingsCooldownHint: "When you reply manually, disable the bot for this chat temporarily",
  settingsCooldownMinutes: "Cooldown Duration (minutes)",
  settingsCooldownPreset30: "30 min",
  settingsCooldownPreset60: "1 hour",
  settingsCooldownPreset120: "2 hours",
  settingsAutoFollowUp: "Auto Follow-Up",
  settingsAutoFollowUpHint: "Send a smart follow-up message when a customer stops replying",
  settingsAutoFollowUpDelay: "Wait time before follow-up (minutes)",
  settingsAutoFollowUpPreset30: "30 min",
  settingsAutoFollowUpPreset60: "1 hour",
  settingsAutoFollowUpPreset120: "2 hours",
  settingsAutoFollowUpMaxCount: "Max follow-up messages",
  settingsAutoFollowUpMaxCountHint: "How many follow-ups to send before stopping",
  settingsDedup: "Duplicate Message Filter",
  settingsDedupHint: "Prevent double-processing from duplicate webhook deliveries",
  settingsSessionReset: "Session Auto-Reset",
  settingsSessionResetHint: "Restart the conversation from scratch when a customer hasn't messaged in a while",
  settingsSessionResetMinutes: "Reset after inactivity (minutes)",
  settingsSessionResetPreset60: "1 hour",
  settingsSessionResetPreset360: "6 hours",
  settingsSessionResetPreset1440: "24 hours",
  settingsDone: "Done",

  // Auto-save & lock
  autoSaved: "Auto-saved",
  lockedBanner: "Unpublish the workflow to edit",

  // Templates
  templatePickerTitle: "Choose a Template",
  templatePickerSubtitle: "Start with a ready-made template or create a blank flow",
  templateBlank: "Blank Flow",
  templateBlankDesc: "Start from scratch with a single start node",
  templateLeadCollection: "Lead Collection",
  templateLeadCollectionDesc: "Collect name, phone, and email from customers",
  templateAppointment: "Appointment Booking",
  templateAppointmentDesc: "Let customers book appointments",
  templateProductInquiry: "Product Inquiry",
  templateProductInquiryDesc: "Answer product questions and collect details",
  templateSteps: "{{count}} steps",

  // Strict Mode
  settingsStrictMode: "Strict Mode",
  settingsStrictModeHint: "Bot follows only the workflow steps — no AI freestyle responses",

  // Multi-workflow
  switchFlow: "Switch Flow",
  maxFlowsReached: "Maximum flows reached (5)",
  confirmDelete: "Delete",
  cannotDeleteActive: "Unpublish before deleting",

  // Open Bot
  nodeOpenBot: "AI Bot",
  openBotDesc: "Free AI conversation",
  openBotToggle: "Open Bot",
  openBotInfo: "When a customer clicks this button, they exit the flow and enter a free AI conversation using your business context.",

  // Misc
  deleteNode: "Delete Node",
  noNodeSelected: "Select a node to edit its properties",
  flowList: "My Flows",
};

export default flow;
