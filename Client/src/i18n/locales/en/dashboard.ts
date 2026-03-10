const dashboard = {
  welcome: "Welcome back, {{name}}!",
  subtitle: "Here's an overview of your bot",

  // Edit Bot Page
  editBotPageTitle: "Edit Your Bot",
  editBotPageSubtitle: "Customize your bot's behavior, content, and FAQ all in one place.",

  botStatus: "Bot Status",
  botConnected: "Connected",
  botDisconnected: "Disconnected",
  botStatusDesc: "Your WhatsApp bot is active and responding to customers",
  botDisconnectedDesc: "Connect your bot to start serving customers",
  botPaused: "Paused",
  botPausedDesc: "Your bot is paused and not responding to messages",
  pauseBot: "Pause Bot",
  resumeBot: "Resume Bot",
  disconnectBot: "Disconnect",
  reconnectBot: "Reconnect",
  pauseSuccess: "Bot paused successfully",
  resumeSuccess: "Bot resumed successfully",
  disconnectSuccess: "Bot disconnected successfully",
  pauseError: "Failed to pause bot. Please try again.",
  resumeError: "Failed to resume bot. Please try again.",
  disconnectError: "Failed to disconnect bot. Please try again.",
  disconnectConfirm: "Are you sure? You'll need to scan a QR code to reconnect.",
  scanToReconnect: "Scan the QR code to reconnect your bot",
  waitingForScan: "Waiting for scan...",
  refreshQr: "Refresh QR Code",
  connecting: "Connecting...",

  // Conversations Section
  conversationsTitle: "Active Chats",
  conversationsEmpty: "No active conversations yet",
  conversationsSelectPrompt: "Select a conversation to view messages",
  noMessages: "No messages in this conversation yet",
  sessionActive: "Active",
  sessionCompleted: "Completed",
  sessionWaiting: "Waiting",
  phoneLabel: "Contacts",

  // Demo Chat Section
  demoChatTitle: "Test Your Bot",
  demoChatStatus: "Online",
  demoChatPlaceholder: "Type a message to test...",
  demoChatGreeting:
    "Hi! Send me a message to test your bot.",
  newConversation: "New conversation",

  // Edit Bot Section
  editBotTitle: "Edit Bot Behavior",
  editBotStatus: "AI Editor",
  editBotPlaceholder: "Describe how to change the bot...",
  editBotGreeting:
    "Tell me what you'd like to change about your bot's behavior. I'll apply the changes for you.",
  editBotSuccess: "Changes applied successfully!",
  editBotError: "Something went wrong. Please try again.",

  changesSaved: "Changes saved",

  // Business Content Section
  businessContentTitle: "Business Content",
  businessContentSubtitle: "Edit the business information your bot uses to respond to customers.",
  businessName: "Business Name",
  businessDescription: "Business Description",
  targetAudience: "Target Audience",
  tone: "Tone / Style",
  websiteUrl: "Website URL",
  additionalInfo: "Additional Info",
  saveChanges: "Save Changes",
  saving: "Saving...",
  savedSuccessfully: "Saved successfully!",
  saveError: "Failed to save. Please try again.",
  updatingBot: "Updating Your Bot...",
  updatingBotDesc: "We're updating your bot's AI with the new information.",
  scrapingWebsite: "Scanning Your Website...",
  scrapingDesc: "We're scanning your website to update the information.",
  botUpdated: "Bot Updated!",
  botUpdatedDesc: "Your bot has been updated with the new information.",
  pagesScraped: "Pages scanned",
  productsFound: "Products found",
  noFormData: "No business content found. Please create your bot first.",
  goToCreateBot: "Create Bot",

  // Business Content Categories
  categoryAbout: "About the Business",
  categoryAudience: "Audience & Tone",
  categoryRules: "Rules & Boundaries",
  categoryCommunication: "Communication",
  categoryMedia: "Media & Links",
  categoryOther: "Additional Info",
  cancelChanges: "Cancel",
  categorySaved: "Saved!",
};

export default dashboard;
