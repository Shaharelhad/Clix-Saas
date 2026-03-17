const createBot = {
  // Stepper
  stepForm: "Form",
  stepPreview: "Preview",
  stepConnect: "Connect",

  // Form Section — Header
  formTitle: "Let's Create Your Bot",
  formSubtitle:
    "Fill in the details we need to create a custom AI bot for your business",

  // Form Section — Knowledge Base
  knowledgeBaseTitle: "Let's Build Bot's Knowledge Base",
  knowledgeBaseDesc:
    "Give me your website, and I'll scan it to learn everything about your business — products, services, prices, and store information.",
  knowledgeBaseItem1: "All info about products and services",
  knowledgeBaseItem2: "Prices and store information",
  knowledgeBaseItem3: "Contact details and business hours",
  websiteUrlLabel: "Link to website",
  websiteUrlPlaceholder: "https://www.yourwebsite.com",
  websiteUrlHelp: "Make sure the website is accessible and not password protected",
  consentCheckbox: "I agree to upload images of content",

  // Form Section — Create AI
  createAiTitle: "Create Bot's AI",
  createAiStep1: "We'll scan your website",
  createAiStep2: "Build a custom AI knowledge base",
  createAiStep3: "Your bot will be ready to answer customer questions",

  // Form Section — Bot Purpose
  botPurposeTitle: "What should the bot do?",
  botPurpose1: "Answer customer questions about products & services",
  botPurpose2: "Help customers place orders",
  botPurpose3: "Provide customer support",
  botPurpose4: "Schedule appointments or consultations",

  // Form Section — Extras
  extrasTitle: "Want more? We have these too in store!",
  extra1: "Collect customer reviews",
  extra2: "Manage appointments",
  extra3: "Custom integrations",

  // Form Section — Response Style
  responseStyleTitle: "How do you want the bot to respond?",
  responseStyleFriendly: "Friendly",
  responseStyleProfessional: "Professional",
  responseStyleCasual: "Casual",
  responseStyleCustom: "Custom",

  // Form Section — Additional
  additionalNotesLabel: "Additional notes or instructions",
  additionalNotesPlaceholder: "Anything else you'd like the bot to know...",

  // Form Section — Privacy & Submit
  privacyNotice:
    "The information you submitted will be used solely for creating your bot. We will not share your data with third parties.",
  privacyLink: "Read our full privacy policy",
  createBotBtn: "Create the Bot",
  nextStep: "Next Step",
  letsStart: "Let's Start",
  stepOf: "{{current}} of {{total}}",
  missingFields: "Please fill in all required fields",
  createBotError: "Something went wrong while creating your bot. Please try again.",

  // Form Section — Submission Progress
  creatingBot: "Creating Your Bot...",
  creatingBotDesc: "We're building your bot's AI. This might take a moment.",
  scrapingWebsite: "Scanning Your Website...",
  scrapingDesc: "We're scanning your website to learn about your business.",
  botCreated: "Bot Created!",
  botReadyForPreview: "Your bot is ready. Let's see it in action!",
  pagesScraped: "Pages scanned",
  productsFound: "Products found",

  // Preview Section
  previewChangeTitle: "Want to change something?",
  chatbotDemo: "Chatbot Demo",
  botMessage:
    "Hi! You can test your bot here. Send a message to see how it responds.",
  systemMessage: "Send a message to start the flow",
  typeMessage: "Type a message...",
  letsGo: "Let's go",
  tabDemo: "Chat Demo",
  tabEdit: "Edit Bot",
  editBotTitle: "Edit Bot Responses",
  editBotDesc: "Describe what you'd like to change about your bot's behavior or responses",
  editBotPlaceholder: "e.g. Make the bot more formal, add greeting in Arabic, respond shorter...",
  editBotSubmit: "Apply Changes",
  editBotProcessing: "Applying changes...",
  editBotSuccess: "Bot updated successfully! Try it out in the demo chat.",
  editBotError: "Failed to update bot. Please try again.",
  proposedChanges: "Changes Applied:",
  typingIndicator: "Bot is typing...",
  newConversation: "New Conversation",

  // Connect Section — Tutorial Slider
  connectTitle: "How to Connect the Bot to WhatsApp",
  watchVideo: "Watch Tutorial",
  tutorialStepAndroid1: "Open WhatsApp, tap the three-dot menu (⋮) and select 'Linked devices'",
  tutorialStepAndroid2: "Tap 'Link a device' and scan the QR code shown below",
  tutorialStepIphone1: "Open WhatsApp, go to Settings and tap 'Linked Devices'",
  tutorialStepIphone2: "Tap 'Link a Device' and scan the QR code shown below",
  stepCounter: "Step {{current}} of {{total}}",
  platformAndroid: "Android",
  platformIphone: "iPhone",
  gotIt: "Got it, let's continue",

  // Connect Section — WhatsApp Connect
  getQrCode: "Get QR",
  linkWithPhone: "Link with phone number",
  sendQrToClient: "Send QR-code to client",
  scanQrCode: "Open WhatsApp on your phone and scan this QR code",
  waitingForScan: "Waiting for you to scan...",
  refreshQr: "Refresh QR Code",
  connecting: "Connecting...",
  connectSuccess: "Successfully connected to WhatsApp! Your bot is now live.",
  connectError: "Failed to connect. Please try again.",
  alreadyConnected: "Your bot is already connected to WhatsApp!",
  skipToDashboard: "Skip",
  skipForm: "Skip",
  logout: "Logout",

  // Connect Section — Success Overlay
  connectSuccessTitle: "You're Connected!",
  connectSuccessSubtitle:
    "Your bot is live on WhatsApp and ready to serve customers",
  goToDashboard: "Go to Dashboard",
};

export default createBot;
