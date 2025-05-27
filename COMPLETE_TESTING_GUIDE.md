# 🧪 Graph8 Chrome Extension - Complete Testing Guide

## 🎯 **All Systems Ready!**

### **✅ Server Status:**
- **Graph8 Backend**: Running on `localhost:8000` (Production)
- **WebSocket Test Server**: Running on `localhost:8001` (Development)
- **PostgreSQL & Redis**: Healthy and connected
- **Webhook Endpoint**: Tested and responding

---

## 🚀 **Step-by-Step Testing Process**

### **Phase 1: Extension Installation**

1. **Load Extension**:
   ```
   1. Open Chrome → chrome://extensions/
   2. Enable "Developer mode"
   3. Click "Load unpacked"
   4. Select: /Users/thomascornelius/CascadeProjects/graph8-Platform/g8browser/dist
   ```

2. **Verify Installation**:
   - Graph8 extension appears in extensions list
   - Extension icon visible in Chrome toolbar
   - No error messages in extension details

### **Phase 2: WebSocket Integration Testing**

#### **Option A: Production Backend (Recommended)**
1. **Open Side Panel**: Click Graph8 extension icon
2. **Access WebSocket Config**: Click "WS" indicator (gray circle)
3. **Configure Connection**:
   ```
   Backend WebSocket URL: ws://localhost:8000/api/websocket/agent
   User ID: user_1
   Auth Token: (leave empty)
   ```
4. **Connect**: Click blue "Connect" button
5. **Verify Connection**: WS indicator should turn blue

#### **Option B: Test Server (Simple Testing)**
1. **Same steps as above but use**:
   ```
   Backend WebSocket URL: ws://localhost:8001/api/websocket/agent
   User ID: user_1
   Auth Token: (leave empty)
   ```

### **Phase 3: Webhook Integration Testing**

1. **Access Webhook Config**: Click "G8" indicator in side panel
2. **Configure Webhook**:
   ```
   Webhook URL: http://localhost:8000/api/websocket/webhook/results
   Authentication Token: user_1
   ```
3. **Test Connection**: Click "Test Connection" button
4. **Verify**: Should show "200 OK" response

### **Phase 4: LinkedIn Action Testing**

1. **Navigate to LinkedIn**: Open any LinkedIn page
2. **Perform Actions**: Try these actions while monitoring:
   - Visit a profile
   - Send a connection request
   - Like a post
   - Follow a company
   - Submit a comment
   - Send a message

3. **Monitor Results**:
   - Check webhook endpoint receives results
   - Verify action detection in background console
   - Confirm Graph8-compatible JSON format

---

## 🔍 **Monitoring & Verification**

### **WebSocket Connection Events**
```javascript
// Background Console (chrome://extensions/ → Graph8 → Inspect views)
// Look for these log messages:
✅ "WebSocket connected to Graph8 backend"
✅ "Agent registered with ID: agent_xxxxx"
✅ "Task received: task_xxxxx"
✅ "Task acknowledged: task_xxxxx"
✅ "Task result sent: task_xxxxx"
```

### **Webhook Result Format**
```json
{
  "task_id": "task_12345",
  "success": true,
  "agent_id": "agent_xxxxx",
  "timestamp": "2025-05-26T20:13:41Z",
  "results": {
    "connection_made": "yes",
    "submitted_comment": "no",
    "liked_post": "no",
    "followed_company": "no",
    "followed_profile": "no",
    "sent_message": "no",
    "visited_profile": "yes",
    "action_performed": "connection_request",
    "url_visited": "https://linkedin.com/in/example",
    "details": "Successfully sent connection request"
  }
}
```

### **Backend Monitoring**
```bash
# Watch Graph8 backend logs
docker logs sequencer_backend -f

# Watch test server (if using)
# Check terminal running test_websocket_server.cjs
```

---

## 🎯 **Test Scenarios**

### **Scenario 1: Basic WebSocket Flow**
1. ✅ Connect to WebSocket
2. ✅ Agent registration
3. ✅ Receive test task (automatic)
4. ✅ Task acknowledgment
5. ✅ Task completion reporting

### **Scenario 2: LinkedIn Action Detection**
1. ✅ Navigate to LinkedIn profile
2. ✅ Send connection request
3. ✅ Verify action detection
4. ✅ Check webhook result delivery
5. ✅ Confirm Graph8 format compliance

### **Scenario 3: Error Handling**
1. ✅ Disconnect WebSocket
2. ✅ Verify reconnection attempts
3. ✅ Test webhook retry mechanism
4. ✅ Check error logging

### **Scenario 4: Multi-Action Testing**
1. ✅ Perform multiple LinkedIn actions
2. ✅ Verify individual action tracking
3. ✅ Check cumulative result reporting
4. ✅ Validate task completion logic

---

## 🚨 **Troubleshooting Guide**

### **Connection Issues**
| Problem | Solution |
|---------|----------|
| WS indicator stays gray | Check backend running: `curl localhost:8000/api/health/detailed` |
| Connect button missing | Reload extension, check React imports |
| WebSocket fails | Verify URL format: `ws://localhost:8000/api/websocket/agent` |
| Agent registration fails | Check background console for errors |

### **Action Detection Issues**
| Problem | Solution |
|---------|----------|
| Actions not detected | Ensure on LinkedIn domain |
| Webhook not sending | Check G8 configuration and test connection |
| Wrong result format | Verify Graph8-compatible JSON structure |
| Missing task ID | Check task creation and storage |

### **Backend Issues**
| Problem | Solution |
|---------|----------|
| Backend not responding | `docker-compose up -d` in sequencer directory |
| Database connection | Check PostgreSQL container health |
| Redis issues | Verify Redis container status |
| Webhook endpoint 404 | Confirm endpoint: `/api/websocket/webhook/results` |

---

## 📊 **Success Criteria Checklist**

### **WebSocket Integration**
- [ ] Extension connects to Graph8 backend
- [ ] Agent registration completes successfully
- [ ] Tasks received and acknowledged
- [ ] Results reported back to backend
- [ ] Connection status indicators work
- [ ] Automatic reconnection functions

### **Webhook Integration**
- [ ] Webhook configuration saves correctly
- [ ] Test connection returns 200 OK
- [ ] LinkedIn actions trigger webhooks
- [ ] Graph8-compatible JSON format
- [ ] Authentication token works
- [ ] Retry mechanism handles failures

### **LinkedIn Action Tracking**
- [ ] All 7 action types detected
- [ ] DOM-based detection works
- [ ] Action results accurate
- [ ] Task ID tracking functional
- [ ] Timestamp generation correct
- [ ] URL capture working

### **User Experience**
- [ ] Configuration modals open/close properly
- [ ] Status indicators show correct states
- [ ] Error messages are helpful
- [ ] Settings persist between sessions
- [ ] Performance is acceptable

---

## 🎉 **Ready for Production**

Once all test scenarios pass:

1. **Update Configuration**: Change URLs to production endpoints
2. **Security Review**: Implement proper authentication tokens
3. **Performance Testing**: Test with multiple concurrent tasks
4. **Documentation**: Update user guides and API documentation
5. **Deployment**: Package for distribution

**The Graph8 Chrome Extension is fully integrated and ready for comprehensive testing! 🚀**

---

## 📞 **Support**

- **Backend Logs**: `docker logs sequencer_backend -f`
- **Extension Console**: `chrome://extensions/` → Graph8 → Inspect views
- **Test Server**: Monitor terminal output
- **Health Check**: `curl localhost:8000/api/health/detailed`
