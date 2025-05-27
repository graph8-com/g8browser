# Graph8 Sequencer Integration Plan for Chrome Extension AI

## Overview

We are integrating your existing Chrome extension with the **Graph8 Sequencer** platform to enable real-time task distribution and automated LinkedIn actions. This document explains what we need from your AI system.

## Current Extension Architecture

Your extension currently works with:
- **Chat interface** where users send instructions like `"go to https://www.linkedin.com/company/graph8 and follow the company page"`
- **AI processing** that understands and executes these natural language commands
- **LinkedIn automation** that performs the requested actions
- **Result reporting** back to the user

## What We're Adding

### 1. WebSocket Integration
- **Graph8 backend** will send structured tasks via WebSocket
- **Task conversion** from structured format to your natural language format
- **Task ID tracking** for each request
- **Result reporting** back to Graph8 with specific success/failure data

### 2. Task Flow Example

#### Input from Graph8:
```json
{
  "task_id": "task_12345",
  "action": "follow_company", 
  "target_url": "https://www.linkedin.com/company/graph8",
  "message": null
}
```

#### Converted to Your Format:
```
"go to https://www.linkedin.com/company/graph8 and follow the company page"
```

#### What We Need Back:
```json
{
  "task_id": "task_12345",
  "success": true,
  "results": {
    "connection_made": "yes",
    "submitted_comment": "no", 
    "liked_post": "no",
    "followed_company": "yes",
    "action_performed": "follow_company",
    "url_visited": "https://www.linkedin.com/company/graph8",
    "timestamp": "2025-05-26T18:56:29Z",
    "details": "Successfully followed Graph8 company page"
  }
}
```

## Required AI Capabilities

### 1. Task ID Handling
- **Accept task ID** with each instruction
- **Track task ID** throughout execution
- **Return task ID** with results

### 2. Structured Result Reporting
Your AI needs to report these specific metrics for each task:

|
 Metric 
|
 Values 
|
 Description 
|
|
--------
|
--------
|
-------------
|
|
`connection_made`
|
`"yes"/"no"`
|
 Did we send a connection request? 
|
|
`submitted_comment`
|
`"yes"/"no"`
|
 Did we comment on a post? 
|
|
`liked_post`
|
`"yes"/"no"`
|
 Did we like a post? 
|
|
`followed_company`
|
`"yes"/"no"`
|
 Did we follow a company page? 
|
|
`followed_profile`
|
`"yes"/"no"`
|
 Did we follow a personal profile? 
|
|
`sent_message`
|
`"yes"/"no"`
|
 Did we send a direct message? 
|
|
`visited_profile`
|
`"yes"/"no"`
|
 Did we visit a profile page? 
|

### 3. Enhanced Result Object
```json
{
  "task_id": "task_12345",
  "success": true,
  "results": {
    "connection_made": "yes/no",
    "submitted_comment": "yes/no",
    "liked_post": "yes/no", 
    "followed_company": "yes/no",
    "followed_profile": "yes/no",
    "sent_message": "yes/no",
    "visited_profile": "yes/no",
    "action_performed": "follow_company",
    "url_visited": "https://www.linkedin.com/company/graph8",
    "timestamp": "2025-05-26T18:56:29Z",
    "details": "Successfully followed Graph8 company page",
    "error_message": null
  }
}
```

## API Interface Changes Needed

### Current Interface:
```javascript
// How your extension currently works
sendInstruction("go to URL and do action")
// Returns: general success/failure
```

### New Interface Needed:
```javascript
// What we need for Graph8 integration
sendInstruction("go to URL and do action", {
  taskId: "task_12345",
  onComplete: (result) => {
    // result should include task_id and structured metrics
  }
})
```

## Example Task Scenarios

### Scenario 1: Follow Company
**Input:** `"go to https://www.linkedin.com/company/graph8 and follow the company page"`
**Task ID:** `task_001`
**Expected Result:**
```json
{
  "task_id": "task_001",
  "success": true,
  "results": {
    "connection_made": "no",
    "submitted_comment": "no",
    "liked_post": "no",
    "followed_company": "yes",
    "followed_profile": "no", 
    "sent_message": "no",
    "visited_profile": "no",
    "action_performed": "follow_company",
    "url_visited": "https://www.linkedin.com/company/graph8"
  }
}
```

### Scenario 2: Send Connection Request
**Input:** `"go to https://www.linkedin.com/in/john-doe and connect to profile with note 'Hi John!'"`
**Task ID:** `task_002`
**Expected Result:**
```json
{
  "task_id": "task_002", 
  "success": true,
  "results": {
    "connection_made": "yes",
    "submitted_comment": "no",
    "liked_post": "no",
    "followed_company": "no",
    "followed_profile": "no",
    "sent_message": "no", 
    "visited_profile": "yes",
    "action_performed": "send_connection_request",
    "url_visited": "https://www.linkedin.com/in/john-doe"
  }
}
```

### Scenario 3: Like and Comment on Post
**Input:** `"go to https://www.linkedin.com/in/jane-smith and like last post and comment 'Great insights!'"`
**Task ID:** `task_003`
**Expected Result:**
```json
{
  "task_id": "task_003",
  "success": true, 
  "results": {
    "connection_made": "no",
    "submitted_comment": "yes",
    "liked_post": "yes",
    "followed_company": "no",
    "followed_profile": "no",
    "sent_message": "no",
    "visited_profile": "yes", 
    "action_performed": "like_and_comment",
    "url_visited": "https://www.linkedin.com/in/jane-smith"
  }
}
```

## Questions for Your AI System

### 1. Task ID Tracking
**Can your AI system:**
- Accept a task ID parameter with each instruction?
- Track that task ID throughout the execution process?
- Return the same task ID with the completion results?

### 2. Structured Result Reporting  
**Can your AI system:**
- Track which specific actions were performed during execution?
- Report boolean (yes/no) results for each action type?
- Provide structured JSON results instead of just success/failure?

### 3. Action Detection
**Can your AI system:**
- Detect when a LinkedIn connection request was sent?
- Detect when a post was liked?
- Detect when a comment was submitted?
- Detect when a company/profile was followed?
- Detect when a profile was visited?
- Detect when a message was sent?

### 4. Error Handling
**Can your AI system:**
- Distinguish between different types of failures?
- Report partial success (e.g., visited profile but couldn't follow)?
- Provide meaningful error messages when actions fail?

## Integration Benefits

✅ **Real-time task distribution** from Graph8 platform
✅ **Automated LinkedIn outreach** at scale  
✅ **Detailed success tracking** for each action
✅ **Centralized task management** and reporting
✅ **Webhook notifications** for external systems
✅ **Task queue management** with priority handling

## Next Steps

1. **Review this plan** - Does your AI system support these capabilities?
2. **Identify gaps** - What modifications are needed?
3. **Test task ID handling** - Can you track and return task IDs?
4. **Test result structure** - Can you provide the detailed metrics?
5. **Integration testing** - Connect with Graph8 WebSocket system

Please confirm if your AI system can handle these requirements, or let us know what modifications would be needed to support this integration.