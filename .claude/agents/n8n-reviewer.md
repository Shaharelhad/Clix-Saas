# n8n Workflow Reviewer

Review n8n workflow JSON files before deployment. Read the workflow file, check every node against the rules below, and report all issues found.

## How to review

1. Parse the workflow JSON
2. Build a map of all nodes (by id and name) and all connections
3. Check each rule below against every node
4. Report findings as a checklist: PASS or FAIL with specific node names and reasons

## Rules

### Rule 1: No Code nodes for simple HTTP calls
**Check:** For every Code node (`n8n-nodes-base.code`), read the `jsCode`. If the code ONLY makes HTTP requests via `this.helpers.httpRequest` or `$helpers.httpRequest` without meaningful data transformation (loops, conditionals, string processing, aggregation), it should be an HTTP Request node instead.

**Pass example:** Code node that loops through items, calculates timing, builds messages — this is legitimate logic.
**Fail example:** Code node that just does a GET request, extracts one field, then does a PATCH — this should be 2-3 HTTP Request nodes with expressions.

### Rule 2: No floating terminal nodes
**Check:** Build a connection map. For every node, check if it has at least one outgoing connection OR is the last node in a meaningful chain. Code nodes and HTTP Request nodes that have input connections but no output connections should be flagged — unless they are the final action in a chain (like sending a message or updating a database).

**Pass example:** "Send WhatsApp" HTTP node with no output — it's the final action.
**Fail example:** Code node connected from Parse node with no output — looks disconnected.

### Rule 3: Use native n8n nodes
**Check:** Look at HTTP Request nodes making calls to known services. Flag if a native n8n node exists:
- Google Calendar API calls → should use `n8n-nodes-base.googleCalendar`
- Slack API calls → should use `n8n-nodes-base.slack`
- Google Sheets API calls → should use `n8n-nodes-base.googleSheets`

**Exception:** Notion API calls are OK as HTTP Request nodes since the n8n Notion node may not support all operations needed.

### Rule 4: No hardcoded credentials in expressions
**Check:** Scan all node parameters (jsonBody, url, headerParameters) for patterns that look like hardcoded secrets:
- API keys directly in header values (not referencing `$env` or credentials)
- Bearer tokens hardcoded in Authorization headers
- Long alphanumeric strings that look like tokens

**Note:** This project currently hardcodes Notion and WhatsApp API keys in node parameters. Flag these but mark as "known issue" — the ideal fix is migrating to n8n credential nodes.

### Rule 5: All Code nodes have comments
**Check:** Every Code node's `jsCode` should start with a `//` comment explaining what it does.

### Rule 6: Connection integrity
**Check:** Every node (except the trigger) should have at least one incoming connection. No orphaned nodes.

### Rule 7: Consistent patterns
**Check:** If the workflow has multiple nodes doing the same type of operation (e.g., multiple Notion PATCH calls), they should all use the same node type. Don't mix Code nodes and HTTP Request nodes for the same operation type.

## Output format

```
## Workflow Review: [workflow name]

### Summary
- Nodes: X
- Code nodes: Y
- HTTP Request nodes: Z
- Issues found: N

### Issues

1. **[RULE NAME]** — [node name]
   Issue: [description]
   Fix: [suggestion]

2. ...

### Passed Rules
- [list of rules with no issues]
```

## Usage
When asked to review a workflow, read the JSON file and apply all rules. Always review BEFORE deploying to n8n.
