#!/usr/bin/env python3
"""
Test script to verify Graph8 WebSocket integration with Chrome extension
"""

import asyncio
import websockets
import json
import uuid
from datetime import datetime

class Graph8TestServer:
    def __init__(self, host='localhost', port=8000):
        self.host = host
        self.port = port
        self.clients = set()
        
    async def register_client(self, websocket, path):
        """Handle new client connections"""
        print(f"🔌 New client connected from {websocket.remote_address}")
        self.clients.add(websocket)
        
        try:
            async for message in websocket:
                await self.handle_message(websocket, message)
        except websockets.exceptions.ConnectionClosed:
            print(f"📤 Client {websocket.remote_address} disconnected")
        finally:
            self.clients.discard(websocket)
    
    async def handle_message(self, websocket, message):
        """Handle incoming messages from Chrome extension"""
        try:
            data = json.loads(message)
            print(f"📨 Received message: {data}")
            
            message_type = data.get('type')
            
            if message_type == 'agent_register':
                # Send registration confirmation
                response = {
                    'type': 'agent_registered',
                    'agent_id': data.get('agent_id'),
                    'user_id': data.get('user_id'),
                    'timestamp': datetime.now().isoformat()
                }
                await websocket.send(json.dumps(response))
                print(f"✅ Agent registered: {data.get('agent_id')}")
                
                # Send a test task after registration
                await asyncio.sleep(2)
                await self.send_test_task(websocket, data.get('agent_id'), data.get('user_id'))
                
            elif message_type == 'task_ack':
                print(f"📋 Task acknowledged: {data.get('task_id')} by {data.get('agent_id')}")
                
            elif message_type == 'task_result':
                print(f"✅ Task result received: {data.get('task_id')}")
                print(f"   Success: {data.get('success')}")
                print(f"   Results: {data.get('results')}")
                
            elif message_type == 'heartbeat':
                # Respond to heartbeat
                response = {
                    'type': 'heartbeat_ack',
                    'timestamp': datetime.now().isoformat()
                }
                await websocket.send(json.dumps(response))
                
        except json.JSONDecodeError:
            print(f"❌ Invalid JSON received: {message}")
        except Exception as e:
            print(f"❌ Error handling message: {e}")
    
    async def send_test_task(self, websocket, agent_id, user_id):
        """Send a test LinkedIn automation task"""
        task = {
            'type': 'task',
            'task_id': f"test_task_{uuid.uuid4().hex[:8]}",
            'agent_id': agent_id,
            'user_id': user_id,
            'instruction': 'Visit the LinkedIn profile and send a connection request with a personalized message',
            'metadata': {
                'url': 'https://www.linkedin.com/in/example-profile',
                'priority': 'high',
                'timeout': 300
            },
            'timestamp': datetime.now().isoformat()
        }
        
        try:
            await websocket.send(json.dumps(task))
            print(f"📤 Sent test task: {task['task_id']}")
        except Exception as e:
            print(f"❌ Failed to send test task: {e}")
    
    async def start_server(self):
        """Start the WebSocket server"""
        print(f"🚀 Starting Graph8 test server on ws://{self.host}:{self.port}/api/websocket/agent")
        
        async with websockets.serve(
            self.register_client, 
            self.host, 
            self.port,
            subprotocols=['graph8-agent']
        ):
            print("✅ Server started! Waiting for Chrome extension connections...")
            print("\n📋 Instructions:")
            print("1. Open Chrome and load the Graph8 extension")
            print("2. Open the side panel and click the WebSocket (WS) indicator")
            print("3. Configure connection to: ws://localhost:8000/api/websocket/agent")
            print("4. Set User ID to: user_1")
            print("5. Click Connect")
            print("\n🔍 Watch this console for connection and task events...")
            
            # Keep server running
            await asyncio.Future()  # Run forever

async def main():
    """Main function to run the test server"""
    server = Graph8TestServer()
    
    try:
        await server.start_server()
    except KeyboardInterrupt:
        print("\n🛑 Server stopped by user")
    except Exception as e:
        print(f"❌ Server error: {e}")

if __name__ == "__main__":
    print("🧪 Graph8 WebSocket Integration Test Server")
    print("=" * 50)
    asyncio.run(main())
