#!/usr/bin/env node
/**
 * Simple WebSocket test server for Graph8 Chrome extension testing
 */

const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

class Graph8TestServer {
  constructor(port = 8001) {
    this.port = port;
    this.clients = new Set();
    this.wss = null;
  }

  start() {
    console.log('🧪 Graph8 WebSocket Integration Test Server');
    console.log('=' .repeat(50));
    
    this.wss = new WebSocket.Server({ 
      port: this.port,
      path: '/api/websocket/agent'
    });

    this.wss.on('connection', (ws, req) => {
      console.log(`🔌 New client connected from ${req.socket.remoteAddress}`);
      this.clients.add(ws);

      ws.on('message', (message) => {
        this.handleMessage(ws, message);
      });

      ws.on('close', () => {
        console.log(`📤 Client disconnected`);
        this.clients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error(`❌ WebSocket error:`, error);
        this.clients.delete(ws);
      });
    });

    console.log(`🚀 Starting Graph8 test server on ws://localhost:${this.port}/api/websocket/agent`);
    console.log('✅ Server started! Waiting for Chrome extension connections...');
    console.log('\n📋 Instructions:');
    console.log('1. Open Chrome and load the Graph8 extension');
    console.log('2. Open the side panel and click the WebSocket (WS) indicator');
    console.log('3. Configure connection to: ws://localhost:8001/api/websocket/agent');
    console.log('4. Set User ID to: user_1');
    console.log('5. Click Connect');
    console.log('\n🔍 Watch this console for connection and task events...\n');
  }

  handleMessage(ws, message) {
    try {
      const data = JSON.parse(message.toString());
      console.log(`📨 Received message:`, data);

      const messageType = data.type;

      switch (messageType) {
        case 'agent_register':
          this.handleAgentRegister(ws, data);
          break;
        
        case 'task_ack':
          console.log(`📋 Task acknowledged: ${data.task_id} by ${data.agent_id}`);
          break;
        
        case 'task_result':
          console.log(`✅ Task result received: ${data.task_id}`);
          console.log(`   Success: ${data.success}`);
          console.log(`   Results:`, data.results);
          break;
        
        case 'heartbeat':
          this.handleHeartbeat(ws, data);
          break;
        
        default:
          console.log(`❓ Unknown message type: ${messageType}`);
      }
    } catch (error) {
      console.error(`❌ Invalid JSON received:`, message.toString());
    }
  }

  handleAgentRegister(ws, data) {
    // Send registration confirmation
    const response = {
      type: 'agent_registered',
      agent_id: data.agent_id,
      user_id: data.user_id,
      timestamp: new Date().toISOString()
    };
    
    ws.send(JSON.stringify(response));
    console.log(`✅ Agent registered: ${data.agent_id}`);

    // Send a test task after 2 seconds
    setTimeout(() => {
      this.sendTestTask(ws, data.agent_id, data.user_id);
    }, 2000);
  }

  handleHeartbeat(ws, data) {
    const response = {
      type: 'heartbeat_ack',
      timestamp: new Date().toISOString()
    };
    ws.send(JSON.stringify(response));
  }

  sendTestTask(ws, agentId, userId) {
    const task = {
      type: 'task',
      task_id: `test_task_${uuidv4().substring(0, 8)}`,
      agent_id: agentId,
      user_id: userId,
      instruction: 'Visit the LinkedIn profile and send a connection request with a personalized message',
      metadata: {
        url: 'https://www.linkedin.com/in/example-profile',
        priority: 'high',
        timeout: 300
      },
      timestamp: new Date().toISOString()
    };

    try {
      ws.send(JSON.stringify(task));
      console.log(`📤 Sent test task: ${task.task_id}`);
    } catch (error) {
      console.error(`❌ Failed to send test task:`, error);
    }
  }
}

// Start the server
const server = new Graph8TestServer(8001);

process.on('SIGINT', () => {
  console.log('\n🛑 Server stopped by user');
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Server error:', error);
  process.exit(1);
});

server.start();
