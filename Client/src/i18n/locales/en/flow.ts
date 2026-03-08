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
  publishConfirm: "Publish this flow to your WhatsApp bot?",
  deleteFlow: "Delete Flow",
  deleteConfirm: "Are you sure you want to delete this flow?",

  // Node types
  nodeStart: "Start",
  nodeText: "Text Message",
  nodeImage: "Image",
  nodeButtons: "Buttons",
  nodeCollectInput: "Collect Input",
  nodeDelay: "Delay",
  nodeFollowUp: "Follow Up",
  nodeCondition: "Condition",

  // Node descriptions (palette)
  nodeStartDesc: "Trigger word to start the flow",
  nodeTextDesc: "Send a text message",
  nodeImageDesc: "Send an image with caption",
  nodeButtonsDesc: "Show interactive buttons",
  nodeCollectInputDesc: "Ask and save user input",
  nodeDelayDesc: "Wait before continuing",
  nodeFollowUpDesc: "Send a scheduled follow-up",
  nodeConditionDesc: "Branch based on a condition",

  // Editor fields
  triggerText: "Trigger Text",
  triggerTextHint: "The word/phrase that starts this flow",
  message: "Message",
  messageHint: "Use {{variableName}} for dynamic values",
  imageUrl: "Image URL",
  imageUrlHint: "Direct link to the image",
  expectedReply: "Expected Reply",
  expectedReplyHint: "Exact text to match (optional)",
  continueAuto: "Wait for any reply",
  continueAutoHint: "Continue the flow after user responds",
  variableName: "Variable Name",
  variableNameHint: "Name to store the user's answer",
  delayMinutes: "Delay (minutes)",
  delayMinutesHint: "How long to wait (1-1440)",
  followUpMessage: "Follow-up Message",
  followUpMessageHint: "Message to send after the delay",
  buttons: "Buttons",
  addButton: "Add Button",
  buttonLabel: "Button Label",
  maxButtons: "Maximum 3 buttons",
  conditionVariable: "Variable",
  conditionOperator: "Operator",
  conditionValue: "Value",
  operatorEquals: "Equals",
  operatorContains: "Contains",
  operatorNotEmpty: "Not Empty",

  // Preview simulator
  previewTitle: "Flow Preview",
  previewStatus: "Simulating",
  previewPlaceholder: "Type a message...",
  previewGreeting: "Send a trigger word to start the flow.",
  previewReset: "Reset",
  previewOpen: "Test Flow",
  previewClose: "Close Preview",

  // Canvas
  canvasEmpty: "Drag nodes from the panel to start building your flow",

  // Misc
  deleteNode: "Delete Node",
  noNodeSelected: "Select a node to edit its properties",
  flowList: "My Flows",
};

export default flow;
