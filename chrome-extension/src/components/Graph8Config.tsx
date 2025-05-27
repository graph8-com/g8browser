import React, { useState, useEffect, FC, ReactNode } from 'react';

interface Graph8ConfigProps {
  onConnect: (backendUrl: string, userId: string, authToken?: string) => Promise<boolean>;
  onDisconnect: () => Promise<void>;
  isConnected: boolean;
  agentId: string | null;
  currentBackendUrl: string;
  currentUserId: string;
}

export const Graph8ConfigComponent: React.FC<Graph8ConfigProps> = ({
  onConnect,
  onDisconnect,
  isConnected,
  agentId,
  currentBackendUrl,
  currentUserId
}) => {
  const [backendUrl, setBackendUrl] = useState(currentBackendUrl || 'ws://localhost:8000/api/websocket/agent');
  const [userId, setUserId] = useState(currentUserId || 'user_1');
  const [authToken, setAuthToken] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    setBackendUrl(currentBackendUrl || 'ws://localhost:8000/api/websocket/agent');
    setUserId(currentUserId || 'user_1');
  }, [currentBackendUrl, currentUserId]);

  const handleConnect = async () => {
    if (!backendUrl.trim() || !userId.trim()) {
      alert('Please enter both Backend URL and User ID');
      return;
    }

    setIsConnecting(true);
    try {
      const success = await onConnect(backendUrl.trim(), userId.trim(), authToken.trim() || undefined);
      if (!success) {
        alert('Failed to connect to Graph8 WebSocket. Please check your configuration.');
      }
    } catch (error) {
      console.error('Connection error:', error);
      alert('Connection failed. Please try again.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await onDisconnect();
    } catch (error) {
      console.error('Disconnect error:', error);
      alert('Failed to disconnect. Please try again.');
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-4 mb-4">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Graph8 WebSocket Configuration</h3>
      
      {/* Connection Status */}
      <div className="mb-4 p-3 rounded-lg bg-gray-50">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Status:</span>
          <div className="flex items-center">
            <div 
              className={`w-3 h-3 rounded-full mr-2 ${
                isConnected ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            <span className={`text-sm font-medium ${
              isConnected ? 'text-green-700' : 'text-red-700'
            }`}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
        {isConnected && agentId && (
          <div className="mt-2 text-xs text-gray-600">
            Agent ID: <code className="bg-gray-200 px-1 rounded">{agentId}</code>
          </div>
        )}
      </div>

      {/* Configuration Form */}
      <div className="space-y-4">
        <div>
          <label htmlFor="backendUrl" className="block text-sm font-medium text-gray-700 mb-1">
            Backend WebSocket URL
          </label>
          <input
            type="text"
            id="backendUrl"
            value={backendUrl}
            onChange={(e) => setBackendUrl(e.target.value)}
            placeholder="ws://localhost:8000/api/websocket/agent"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isConnected}
          />
          <p className="text-xs text-gray-500 mt-1">
            The WebSocket endpoint for the Graph8 Sequencer
          </p>
        </div>

        <div>
          <label htmlFor="userId" className="block text-sm font-medium text-gray-700 mb-1">
            User ID
          </label>
          <input
            type="text"
            id="userId"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="user_1"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isConnected}
          />
          <p className="text-xs text-gray-500 mt-1">
            Your unique user identifier for task assignment
          </p>
        </div>

        <div>
          <label htmlFor="authToken" className="block text-sm font-medium text-gray-700 mb-1">
            Auth Token (Optional)
          </label>
          <input
            type="password"
            id="authToken"
            value={authToken}
            onChange={(e) => setAuthToken(e.target.value)}
            placeholder="Leave empty for local development"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isConnected}
          />
          <p className="text-xs text-gray-500 mt-1">
            Authentication token (not required for localhost)
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 mt-6">
        {!isConnected ? (
          <button
            onClick={handleConnect}
            disabled={isConnecting}
            style={{
              flex: '1',
              backgroundColor: isConnecting ? '#9CA3AF' : '#2563EB',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              fontSize: '14px',
              fontWeight: '500',
              cursor: isConnecting ? 'not-allowed' : 'pointer',
              opacity: isConnecting ? 0.5 : 1
            }}
          >
            {isConnecting ? 'Connecting...' : 'Connect'}
          </button>
        ) : (
          <button
            onClick={handleDisconnect}
            style={{
              flex: '1',
              backgroundColor: '#DC2626',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Disconnect
          </button>
        )}
      </div>

      {/* Help Text */}
      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
        <h4 className="text-sm font-medium text-blue-800 mb-2">Quick Setup:</h4>
        <ul className="text-xs text-blue-700 space-y-1">
          <li>• For local development, use: <code className="bg-blue-100 px-1 rounded">ws://localhost:8000/api/websocket/agent</code></li>
          <li>• User ID can be any identifier like <code className="bg-blue-100 px-1 rounded">user_1</code></li>
          <li>• Auth token is not required for localhost connections</li>
          <li>• Make sure the Graph8 backend is running before connecting</li>
        </ul>
      </div>
    </div>
  );
};
