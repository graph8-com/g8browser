# 🚀 Graph8 Chrome Extension - Installation & Testing Guide

## ✅ **FIXED: Connect Button Issue**

**Issue Resolved**: The WebSocket configuration modal now includes the Connect/Disconnect buttons.

**What was fixed**:
- Added missing React imports to Graph8Config component
- Updated default WebSocket URL to match test server (port 8001)
- Rebuilt extension with fixes

## 📦 **Extension Build Complete!**

The Chrome extension has been successfully built with WebSocket integration. Here's how to install and test it:

## 🔧 **Installation Steps**

### 1. **Load Extension in Chrome**
1. Open Google Chrome
2. Navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top-right corner)
4. Click "Load unpacked"
5. Select the `dist` folder: `/Users/thomascornelius/CascadeProjects/graph8-Platform/g8browser/dist`
6. The Graph8 extension should now appear in your extensions list

### 2. **Pin the Extension**
1. Click the puzzle piece icon (🧩) in Chrome toolbar
2. Find "Graph8" extension
3. Click the pin icon to pin it to your toolbar

## 🧪 **Testing WebSocket Integration**

### 1. **WebSocket Test Server is Running**
✅ Test server is currently running on: `ws://localhost:8001/api/websocket/agent`

### 2. **Connect Extension to Test Server**
1. **Open Side Panel**: Click the Graph8 extension icon in Chrome toolbar
2. **Access WebSocket Config**: Click the "WS" indicator in the side panel header (gray circle)
3. **Configure Connection**:
   - **Backend WebSocket URL**: `ws://localhost:8001/api/websocket/agent`
   - **User ID**: `user_1`
   - **Auth Token**: Leave empty (not required for localhost)
4. **Connect**: Click the "Connect" button

### 3. **Expected Test Flow**
1. ✅ **Connection**: Extension connects to test server
2. ✅ **Registration**: Agent registers with unique ID
3. ✅ **Test Task**: Server automatically sends a test LinkedIn task
4. ✅ **Task Acknowledgment**: Extension acknowledges task receipt
5. ✅ **Task Execution**: Extension processes the task (simulated)
6. ✅ **Result Reporting**: Extension sends results back to server

## 📊 **Monitoring**

### **WebSocket Server Console**
Watch the terminal running `test_websocket_server.cjs` for:
- Connection events
- Agent registration
- Task sending/receiving
- Result reporting

### **Chrome Extension Console**
1. Go to `chrome://extensions/`
2. Find Graph8 extension
3. Click "Inspect views: background page"
4. Check Console tab for WebSocket logs

### **Side Panel Status Indicators**
- **G8** (Green/Gray): Webhook configuration status
- **WS** (Blue/Gray): WebSocket connection status

## 🔍 **Status Indicators**

### **WebSocket Status (WS Badge)**
- 🔵 **Blue**: Connected to WebSocket server
- ⚫ **Gray**: Disconnected or not configured

### **Webhook Status (G8 Badge)**  
- 🟢 **Green**: Webhook configured and enabled
- ⚫ **Gray**: Webhook not configured

## 🛠️ **Troubleshooting**

### **Connection Issues**
1. **Check Server**: Ensure test server is running on port 8001
2. **Check URL**: Verify WebSocket URL is exactly `ws://localhost:8001/api/websocket/agent`
3. **Check Console**: Look for error messages in browser console
4. **Reload Extension**: Try disabling and re-enabling the extension

### **Task Execution Issues**
1. **Check LinkedIn Page**: Make sure you're on a LinkedIn page for task testing
2. **Check Permissions**: Ensure extension has necessary permissions
3. **Check Background Script**: Inspect background page console for errors

## 🎯 **Test Scenarios**

### **Basic WebSocket Test**
1. Connect to test server
2. Verify agent registration
3. Receive and acknowledge test task
4. Check task result reporting

### **LinkedIn Integration Test**
1. Navigate to any LinkedIn page
2. Connect to WebSocket server
3. Receive LinkedIn automation task
4. Perform manual LinkedIn actions
5. Verify action detection and reporting

## 📋 **Next Steps**

### **Production Deployment**
1. Update WebSocket URL to production Graph8 backend
2. Configure proper authentication tokens
3. Enable SSL/TLS for secure connections

### **Advanced Testing**
1. Test with multiple concurrent tasks
2. Test reconnection scenarios
3. Test error handling and recovery

---

## 🎉 **Success Criteria**

✅ Extension loads without errors  
✅ WebSocket connection establishes  
✅ Agent registration completes  
✅ Test tasks are received and acknowledged  
✅ Results are reported back to server  
✅ Status indicators show correct states  

**The Graph8 Chrome extension with WebSocket integration is ready for testing!** 🚀
