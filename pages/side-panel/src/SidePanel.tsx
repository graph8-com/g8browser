/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback, useRef } from 'react';
import { PiPlusBold } from 'react-icons/pi';
import { GrHistory } from 'react-icons/gr';
import { type Message, Actors, chatHistoryStore } from '@extension/storage';
import MessageList from './components/MessageList';
import ChatInput from './components/ChatInput';
import ChatHistoryList from './components/ChatHistoryList';
import TemplateList from './components/TemplateList';
import { WebhookConfigComponent } from '../../../chrome-extension/src/components/WebhookConfig';
import { Graph8ConfigComponent } from '../../../chrome-extension/src/components/Graph8Config';
import { EventType, type AgentEvent, ExecutionState } from './types/event';
import { defaultTemplates } from './templates';
import './SidePanel.css';

const SidePanel = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputEnabled, setInputEnabled] = useState(true);
  const [showStopButton, setShowStopButton] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [chatSessions, setChatSessions] = useState<Array<{ id: string; title: string; createdAt: number }>>([]);
  const [isFollowUpMode, setIsFollowUpMode] = useState(false);
  const [isHistoricalSession, setIsHistoricalSession] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isGraph8LoggedIn, setIsGraph8LoggedIn] = useState<boolean>(true);
  const [webhookConfig, setWebhookConfig] = useState<{ url: string; enabled: boolean }>({ url: '', enabled: false });
  const [showWebhookConfig, setShowWebhookConfig] = useState(false);
  const [graph8Connection, setGraph8Connection] = useState<{ connected: boolean; agentId: string | null; backendUrl: string; userId: string }>({ 
    connected: false, 
    agentId: null, 
    backendUrl: '', 
    userId: '' 
  });
  const [showGraph8Config, setShowGraph8Config] = useState(false);
  const sessionIdRef = useRef<string | null>(null);
  const portRef = useRef<chrome.runtime.Port | null>(null);
  const heartbeatIntervalRef = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const setInputTextRef = useRef<((text: string) => void) | null>(null);

  // Check for dark mode preference
  useEffect(() => {
    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkMode(darkModeMediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setIsDarkMode(e.matches);
    };

    darkModeMediaQuery.addEventListener('change', handleChange);
    return () => darkModeMediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    sessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  const appendMessage = useCallback((newMessage: Message, sessionId?: string | null) => {
    // Don't save progress messages
    const isProgressMessage = newMessage.content === 'Showing progress...';

    setMessages(prev => {
      const filteredMessages = prev.filter(
        (msg, idx) => !(msg.content === 'Showing progress...' && idx === prev.length - 1),
      );
      return [...filteredMessages, newMessage];
    });

    // Use provided sessionId if available, otherwise fall back to sessionIdRef.current
    const effectiveSessionId = sessionId !== undefined ? sessionId : sessionIdRef.current;

    console.log('sessionId', effectiveSessionId);

    // Save message to storage if we have a session and it's not a progress message
    if (effectiveSessionId && !isProgressMessage) {
      chatHistoryStore
        .addMessage(effectiveSessionId, newMessage)
        .catch(err => console.error('Failed to save message to history:', err));
    }
  }, []);

  const handleTaskState = useCallback(
    (event: AgentEvent) => {
      const { actor, state, timestamp, data } = event;
      const content = data?.details;
      let skip = true;
      let displayProgress = false;

      switch (actor) {
        case Actors.SYSTEM:
          switch (state) {
            case ExecutionState.TASK_START:
              // Reset historical session flag when a new task starts
              setIsHistoricalSession(false);
              break;
            case ExecutionState.TASK_OK:
              setIsFollowUpMode(true);
              setInputEnabled(true);
              setShowStopButton(false);
              break;
            case ExecutionState.TASK_FAIL:
              setIsFollowUpMode(true);
              setInputEnabled(true);
              setShowStopButton(false);
              skip = false;
              break;
            case ExecutionState.TASK_CANCEL:
              setIsFollowUpMode(false);
              setInputEnabled(true);
              setShowStopButton(false);
              skip = false;
              break;
            case ExecutionState.TASK_PAUSE:
              break;
            case ExecutionState.TASK_RESUME:
              break;
            default:
              console.error('Invalid task state', state);
              return;
          }
          break;
        case Actors.USER:
          break;
        case Actors.PLANNER:
          switch (state) {
            case ExecutionState.STEP_START:
              displayProgress = true;
              break;
            case ExecutionState.STEP_OK:
              skip = false;
              break;
            case ExecutionState.STEP_FAIL:
              skip = false;
              break;
            case ExecutionState.STEP_CANCEL:
              break;
            default:
              console.error('Invalid step state', state);
              return;
          }
          break;
        case Actors.NAVIGATOR:
          switch (state) {
            case ExecutionState.STEP_START:
              displayProgress = true;
              break;
            case ExecutionState.STEP_OK:
              displayProgress = false;
              break;
            case ExecutionState.STEP_FAIL:
              skip = false;
              displayProgress = false;
              break;
            case ExecutionState.STEP_CANCEL:
              displayProgress = false;
              break;
            case ExecutionState.ACT_START:
              if (content !== 'cache_content') {
                // skip to display caching content
                skip = false;
              }
              break;
            case ExecutionState.ACT_OK:
              skip = true;
              break;
            case ExecutionState.ACT_FAIL:
              skip = false;
              break;
            default:
              console.error('Invalid action', state);
              return;
          }
          break;
        case Actors.VALIDATOR:
          switch (state) {
            case ExecutionState.STEP_START:
              displayProgress = true;
              break;
            case ExecutionState.STEP_OK:
              skip = false;
              break;
            case ExecutionState.STEP_FAIL:
              skip = false;
              break;
            default:
              console.error('Invalid validation', state);
              return;
          }
          break;
        default:
          console.error('Unknown actor', actor);
          return;
      }

      if (!skip) {
        appendMessage({
          actor,
          content: content || '',
          timestamp: timestamp,
        });
      }

      if (displayProgress) {
        appendMessage({
          actor,
          content: 'Showing progress...',
          timestamp: timestamp,
        });
      }
    },
    [appendMessage],
  );

  // Stop heartbeat and close connection
  const stopConnection = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    if (portRef.current) {
      portRef.current.disconnect();
      portRef.current = null;
    }
  }, []);

  // Setup connection management
  const setupConnection = useCallback(() => {
    // Only setup if no existing connection
    if (portRef.current) {
      return;
    }

    try {
      portRef.current = chrome.runtime.connect({ name: 'side-panel-connection' });

      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      portRef.current.onMessage.addListener((message: any) => {
        // Add type checking for message
        if (message && message.type === EventType.EXECUTION) {
          handleTaskState(message);
        } else if (message && message.type === 'error') {
          // Handle error messages from service worker
          appendMessage({
            actor: Actors.SYSTEM,
            content: message.error || 'Unknown error occurred',
            timestamp: Date.now(),
          });
          setInputEnabled(true);
          setShowStopButton(false);
        } else if (message && message.type === 'heartbeat_ack') {
          console.log('Heartbeat acknowledged');
        }
      });

      portRef.current.onDisconnect.addListener(() => {
        const error = chrome.runtime.lastError;
        console.log('Connection disconnected', error ? `Error: ${error.message}` : '');
        portRef.current = null;
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = null;
        }
        setInputEnabled(true);
        setShowStopButton(false);
      });

      // Setup heartbeat interval
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }

      heartbeatIntervalRef.current = window.setInterval(() => {
        if (portRef.current?.name === 'side-panel-connection') {
          try {
            portRef.current.postMessage({ type: 'heartbeat' });
          } catch (error) {
            console.error('Heartbeat failed:', error);
            stopConnection(); // Stop connection if heartbeat fails
          }
        } else {
          stopConnection(); // Stop if port is invalid
        }
      }, 25000);
    } catch (error) {
      console.error('Failed to establish connection:', error);
      appendMessage({
        actor: Actors.SYSTEM,
        content: 'Failed to connect to service worker',
        timestamp: Date.now(),
      });
      // Clear any references since connection failed
      portRef.current = null;
    }
  }, [handleTaskState, appendMessage, stopConnection]);

  // Add safety check for message sending
  const sendMessage = useCallback(
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    (message: any) => {
      if (portRef.current?.name !== 'side-panel-connection') {
        throw new Error('No valid connection available');
      }
      try {
        portRef.current.postMessage(message);
      } catch (error) {
        console.error('Failed to send message:', error);
        stopConnection(); // Stop connection when message sending fails
        throw error;
      }
    },
    [stopConnection],
  );

  const handleSendMessage = async (text: string) => {
    console.log('handleSendMessage', text);

    if (!text.trim()) return;

    // Block sending messages in historical sessions
    if (isHistoricalSession) {
      console.log('Cannot send messages in historical sessions');
      return;
    }

    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tabId = tabs[0]?.id;
      if (!tabId) {
        throw new Error('No active tab found');
      }

      setInputEnabled(false);
      setShowStopButton(true);

      // Create a new chat session for this task if not in follow-up mode
      if (!isFollowUpMode) {
        const newSession = await chatHistoryStore.createSession(
          text.substring(0, 50) + (text.length > 50 ? '...' : ''),
        );
        console.log('newSession', newSession);

        // Store the session ID in both state and ref
        const sessionId = newSession.id;
        setCurrentSessionId(sessionId);
        sessionIdRef.current = sessionId;
      }

      const userMessage = {
        actor: Actors.USER,
        content: text,
        timestamp: Date.now(),
      };

      // Pass the sessionId directly to appendMessage
      appendMessage(userMessage, sessionIdRef.current);

      // Setup connection if not exists
      if (!portRef.current) {
        setupConnection();
      }

      // Send message using the utility function
      if (isFollowUpMode) {
        // Send as follow-up task
        await sendMessage({
          type: 'follow_up_task',
          task: text,
          taskId: sessionIdRef.current,
          tabId,
        });
        console.log('follow_up_task sent', text, tabId, sessionIdRef.current);
      } else {
        // Send as new task
        await sendMessage({
          type: 'new_task',
          task: text,
          taskId: sessionIdRef.current,
          tabId,
        });
        console.log('new_task sent', text, tabId, sessionIdRef.current);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('Task error', errorMessage);
      appendMessage({
        actor: Actors.SYSTEM,
        content: errorMessage,
        timestamp: Date.now(),
      });
      setInputEnabled(true);
      setShowStopButton(false);
      stopConnection();
    }
  };

  const handleStopTask = async () => {
    try {
      portRef.current?.postMessage({
        type: 'cancel_task',
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('cancel_task error', errorMessage);
      appendMessage({
        actor: Actors.SYSTEM,
        content: errorMessage,
        timestamp: Date.now(),
      });
    }
    setInputEnabled(true);
    setShowStopButton(false);
  };

  const handleNewChat = () => {
    // Clear messages and start a new chat
    setMessages([]);
    setCurrentSessionId(null);
    sessionIdRef.current = null;
    setInputEnabled(true);
    setShowStopButton(false);
    setIsFollowUpMode(false);
    setIsHistoricalSession(false);

    // Disconnect any existing connection
    stopConnection();
  };

  const loadChatSessions = useCallback(async () => {
    try {
      const sessions = await chatHistoryStore.getSessionsMetadata();
      setChatSessions(sessions.sort((a, b) => b.createdAt - a.createdAt));
    } catch (error) {
      console.error('Failed to load chat sessions:', error);
    }
  }, []);

  const handleLoadHistory = async () => {
    await loadChatSessions();
    setShowHistory(true);
  };

  const handleBackToChat = () => {
    setShowHistory(false);
  };

  const handleSessionSelect = async (sessionId: string) => {
    try {
      const fullSession = await chatHistoryStore.getSession(sessionId);
      if (fullSession && fullSession.messages.length > 0) {
        setCurrentSessionId(fullSession.id);
        setMessages(fullSession.messages);
        setIsFollowUpMode(false);
        setIsHistoricalSession(true); // Mark this as a historical session
      }
      setShowHistory(false);
    } catch (error) {
      console.error('Failed to load session:', error);
    }
  };

  const handleSessionDelete = async (sessionId: string) => {
    try {
      await chatHistoryStore.deleteSession(sessionId);
      await loadChatSessions();
      if (sessionId === currentSessionId) {
        setMessages([]);
        setCurrentSessionId(null);
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };

  const handleTemplateSelect = (content: string) => {
    console.log('handleTemplateSelect', content);
    if (setInputTextRef.current) {
      setInputTextRef.current(content);
    }
  };

  // ─────────────────────────────
  // Detect graph8 authentication
  // ─────────────────────────────
  const checkGraph8Login = useCallback(() => {
    // Any cookie under *.graph8.com counts as a logged-in session
    chrome.cookies.getAll({ domain: '.graph8.com' }, cookies => {
      setIsGraph8LoggedIn(cookies.length > 0);
    });
  }, []);

  useEffect(() => {
    checkGraph8Login();
    chrome.cookies.onChanged.addListener(checkGraph8Login);
    return () => chrome.cookies.onChanged.removeListener(checkGraph8Login);
  }, [checkGraph8Login]);

  // Load webhook configuration on mount
  useEffect(() => {
    const loadWebhookConfig = async () => {
      try {
        const result = await chrome.storage.local.get(['webhookConfig']);
        if (result.webhookConfig) {
          setWebhookConfig(result.webhookConfig);
        }
      } catch (error) {
        console.error('Failed to load webhook configuration:', error);
      }
    };
    
    loadWebhookConfig();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopConnection();
    };
  }, [stopConnection]);

  // Scroll to bottom when new messages arrive
  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load Graph8 WebSocket status on mount
  useEffect(() => {
    loadGraph8Status();
  }, []);

  const handleGraph8Connect = async (backendUrl: string, userId: string, authToken?: string) => {
    try {
      console.log('🔥 [DEBUG] SidePanel: Starting Graph8 connection...', { backendUrl, userId, authToken });
      
      const response = await new Promise<any>((resolve, reject) => {
        console.log('🔥 [DEBUG] SidePanel: Creating port connection...');
        const port = chrome.runtime.connect({ name: 'sidepanel' });
        
        const message = { 
          type: 'connect_graph8', 
          backendUrl, 
          userId, 
          authToken 
        };
        console.log('🔥 [DEBUG] SidePanel: Sending message to background:', message);
        
        port.postMessage(message);
        
        port.onMessage.addListener((message) => {
          console.log('🔥 [DEBUG] SidePanel: Received response from background:', message);
          if (message.type === 'success') {
            resolve(message.data);
          } else if (message.type === 'error') {
            reject(new Error(message.error));
          }
        });
      });

      console.log('🔥 [DEBUG] SidePanel: Connection response:', response);
      
      setGraph8Connection({
        connected: response.connected,
        agentId: response.agentId,
        backendUrl,
        userId
      });

      return response.connected;
    } catch (error) {
      console.error('🔥 [DEBUG] SidePanel: Failed to connect to Graph8:', error);
      return false;
    }
  };

  const handleGraph8Disconnect = async () => {
    try {
      await new Promise<void>((resolve, reject) => {
        const port = chrome.runtime.connect({ name: 'sidepanel' });
        port.postMessage({ type: 'disconnect_graph8' });
        
        port.onMessage.addListener((message) => {
          if (message.type === 'success') {
            resolve();
          } else if (message.type === 'error') {
            reject(new Error(message.error));
          }
        });
      });

      setGraph8Connection({
        connected: false,
        agentId: null,
        backendUrl: '',
        userId: ''
      });
    } catch (error) {
      console.error('Failed to disconnect from Graph8:', error);
    }
  };

  const loadGraph8Status = async () => {
    try {
      const response = await new Promise<any>((resolve, reject) => {
        const port = chrome.runtime.connect({ name: 'sidepanel' });
        port.postMessage({ type: 'get_graph8_status' });
        
        port.onMessage.addListener((message) => {
          if (message.type === 'success') {
            resolve(message.data);
          } else if (message.type === 'error') {
            reject(new Error(message.error));
          }
        });
      });

      setGraph8Connection(prev => ({
        ...prev,
        connected: response.connected,
        agentId: response.agentId
      }));
    } catch (error) {
      console.error('Failed to load Graph8 status:', error);
    }
  };

  // If the user is not logged in to graph8, show a login prompt in place of the chat UI.
  if (!isGraph8LoggedIn) {
    return (
      <div
        className={`flex h-screen items-center justify-center ${
          isDarkMode ? 'bg-slate-900 text-white' : 'bg-white text-black'
        }`}>
        <a
          href="https://graph8.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 underline">
          Please login to graph8.com
        </a>
      </div>
    );
  }

  const handleWebhookConfigChange = (newConfig: { url: string; enabled: boolean }) => {
    setWebhookConfig(newConfig);
  };

  const handleWebhookConfigSave = async () => {
    try {
      // Save the webhook configuration to storage
      await chrome.storage.local.set({ webhookConfig });
    } catch (error) {
      console.error('Failed to save webhook configuration:', error);
    }
  };

  const handleWebhookConfigSaveWithDebug = async () => {
    try {
      console.log('🔥 [DEBUG] SidePanel: Saving webhook configuration...');
      // Save the webhook configuration to storage
      await chrome.storage.local.set({ webhookConfig });
      console.log('🔥 [DEBUG] SidePanel: Webhook configuration saved:', webhookConfig);
    } catch (error) {
      console.error('🔥 [DEBUG] SidePanel: Failed to save webhook configuration:', error);
    }
  };

  return (
    <div>
      <div
        className={`flex h-screen flex-col ${isDarkMode ? 'bg-slate-900' : 'bg-white'} overflow-hidden border ${isDarkMode ? 'border-sky-800' : 'border-[#E2E8F0]'}`}>
        <header className="header flex items-center justify-between px-2 py-1">
          <div className="header-logo flex-shrink-0">
            {showHistory ? (
              <button
                type="button"
                onClick={handleBackToChat}
                className={`${isDarkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'} cursor-pointer`}
                aria-label="Back to chat">
                ← Back
              </button>
            ) : null}
          </div>
          <div className="header-icons flex flex-row gap-2 ml-auto">
            {!showHistory && (
              <>
                {/* Webhook Status Indicator */}
                <div 
                  className={`flex items-center px-2 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                    webhookConfig.enabled 
                      ? 'bg-green-100 text-green-800 border border-green-200 hover:bg-green-200' 
                      : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                  }`}
                  title={webhookConfig.enabled ? `Graph8 Webhook: ${webhookConfig.url}` : 'Graph8 Webhook: Disabled - Click to configure'}
                  onClick={() => setShowWebhookConfig(!showWebhookConfig)}
                >
                  <div 
                    className={`w-2 h-2 rounded-full mr-1 ${
                      webhookConfig.enabled ? 'bg-green-500' : 'bg-gray-400'
                    }`}
                  />
                  G8
                </div>

                {/* WebSocket Status Indicator */}
                <div 
                  className={`flex items-center px-2 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                    graph8Connection.connected 
                      ? 'bg-blue-100 text-blue-800 border border-blue-200 hover:bg-blue-200' 
                      : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                  }`}
                  title={graph8Connection.connected ? `WebSocket Connected: Agent ${graph8Connection.agentId}` : 'WebSocket Disconnected - Click to configure'}
                  onClick={() => setShowGraph8Config(!showGraph8Config)}
                >
                  <div 
                    className={`w-2 h-2 rounded-full mr-1 ${
                      graph8Connection.connected ? 'bg-blue-500' : 'bg-gray-400'
                    }`}
                  />
                  WS
                </div>
                <button
                  type="button"
                  onClick={handleNewChat}
                  onKeyDown={e => e.key === 'Enter' && handleNewChat()}
                  className={`header-icon ${isDarkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'} cursor-pointer`}
                  aria-label="New Chat"
                  tabIndex={0}>
                  <PiPlusBold size={20} />
                </button>
                <button
                  type="button"
                  onClick={handleLoadHistory}
                  onKeyDown={e => e.key === 'Enter' && handleLoadHistory()}
                  className={`header-icon ${isDarkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'} cursor-pointer`}
                  aria-label="Load History"
                  tabIndex={0}>
                  <GrHistory size={20} />
                </button>
              </>
            )}
          </div>
        </header>
        {showHistory ? (
          <div className="flex-1 overflow-hidden">
            <ChatHistoryList
              sessions={chatSessions}
              onSessionSelect={handleSessionSelect}
              onSessionDelete={handleSessionDelete}
              visible={true}
              isDarkMode={isDarkMode}
            />
          </div>
        ) : (
          <>
            {messages.length === 0 && (
              <>
                <div
                  className={`border-t ${isDarkMode ? 'border-sky-900' : 'border-sky-100'} mb-2 p-2 shadow-sm backdrop-blur-sm`}>
                  <ChatInput
                    onSendMessage={handleSendMessage}
                    onStopTask={handleStopTask}
                    disabled={!inputEnabled || isHistoricalSession}
                    showStopButton={showStopButton}
                    setContent={setter => {
                      setInputTextRef.current = setter;
                    }}
                    isDarkMode={isDarkMode}
                  />
                </div>
                <div>
                  <TemplateList
                    templates={defaultTemplates}
                    onTemplateSelect={handleTemplateSelect}
                    isDarkMode={isDarkMode}
                  />
                </div>
              </>
            )}
            <div
              className={`scrollbar-gutter-stable flex-1 overflow-x-hidden overflow-y-scroll scroll-smooth p-2 ${isDarkMode ? 'bg-slate-900/80' : ''}`}>
              <MessageList messages={messages} isDarkMode={isDarkMode} />
              <div ref={messagesEndRef} />
            </div>
            {messages.length > 0 && (
              <div
                className={`border-t ${isDarkMode ? 'border-sky-900' : 'border-sky-100'} p-2 shadow-sm backdrop-blur-sm`}>
                <ChatInput
                  onSendMessage={handleSendMessage}
                  onStopTask={handleStopTask}
                  disabled={!inputEnabled || isHistoricalSession}
                  showStopButton={showStopButton}
                  setContent={setter => {
                    setInputTextRef.current = setter;
                  }}
                  isDarkMode={isDarkMode}
                />
              </div>
            )}
          </>
        )}
      </div>
      {showWebhookConfig && (
        <div 
          className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50`}
          onClick={() => setShowWebhookConfig(false)}
        >
          <div 
            className={`max-w-md w-full mx-4 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-xl`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Graph8 Webhook Configuration
              </h3>
              <button
                onClick={() => setShowWebhookConfig(false)}
                className={`text-gray-400 hover:text-gray-600 ${isDarkMode ? 'hover:text-gray-300' : ''} text-xl font-bold`}
              >
                ✕
              </button>
            </div>
            <div className="p-4">
              <WebhookConfigComponent />
            </div>
          </div>
        </div>
      )}
      {showGraph8Config && (
        <div 
          className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50`}
          onClick={() => setShowGraph8Config(false)}
        >
          <div 
            className={`max-w-md w-full mx-4 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-xl`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Graph8 WebSocket Configuration
              </h3>
              <button
                onClick={() => setShowGraph8Config(false)}
                className={`text-gray-400 hover:text-gray-600 ${isDarkMode ? 'hover:text-gray-300' : ''} text-xl font-bold`}
              >
                ✕
              </button>
            </div>
            <div className="p-4">
              <Graph8ConfigComponent 
                onConnect={handleGraph8Connect}
                onDisconnect={handleGraph8Disconnect}
                isConnected={graph8Connection.connected}
                agentId={graph8Connection.agentId}
                currentBackendUrl={graph8Connection.backendUrl}
                currentUserId={graph8Connection.userId}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SidePanel;
