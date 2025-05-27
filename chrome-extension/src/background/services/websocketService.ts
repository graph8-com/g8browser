import { createLogger } from '../log';

const logger = createLogger('websocket-service');

export interface Graph8WebSocketConfig {
  url: string;
  userId: string;
  authToken?: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export interface Graph8TaskMessage {
  type: 'task';
  task_id: string;
  instruction: string;
  timestamp: string;
  metadata?: {
    url?: string;
    priority?: 'high' | 'medium' | 'low';
    expected_actions?: string[];
  };
}

export interface Graph8AgentMessage {
  type: 'agent_register' | 'agent_status' | 'task_ack' | 'task_result';
  agent_id?: string;
  user_id: string;
  task_id?: string;
  status?: 'connected' | 'ready' | 'busy' | 'error';
  result?: any;
  timestamp: string;
}

export class Graph8WebSocketService {
  private ws: WebSocket | null = null;
  private config: Graph8WebSocketConfig | null = null;
  private agentId: string | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isConnecting = false;
  private messageHandlers = new Map<string, (message: any) => void>();

  constructor() {
    // Generate unique agent ID
    this.agentId = `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Connect to Graph8 WebSocket server
   */
  async connect(config: Graph8WebSocketConfig): Promise<boolean> {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      logger.info('Already connected or connecting to Graph8 WebSocket');
      return true;
    }

    this.config = {
      reconnectInterval: 5000,
      maxReconnectAttempts: 10,
      ...config
    };

    this.isConnecting = true;
    
    try {
      logger.info(`🔌 [DEBUG] Connecting to Graph8 backend: ${config.url}`);
      logger.info(`🔌 [DEBUG] Creating WebSocket object...`);
      
      this.ws = new WebSocket(config.url);
      
      logger.info(`🔌 [DEBUG] WebSocket created, readyState: ${this.ws.readyState}`);
      
      this.ws.onopen = () => {
        logger.info('✅ [DEBUG] WebSocket onopen triggered');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.registerAgent();
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          logger.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onclose = (event) => {
        logger.info(`❌ [DEBUG] WebSocket onclose: ${event.code} - ${event.reason}`);
        this.isConnecting = false;
        this.ws = null;
        
        if (!event.wasClean && this.config) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        logger.error('❌ [DEBUG] WebSocket onerror:', error);
        this.isConnecting = false;
      };

      // Wait for connection to open with timeout
      return new Promise((resolve) => {
        logger.info(`🔌 [DEBUG] Starting connection promise...`);
        
        const timeout = setTimeout(() => {
          logger.error('❌ [DEBUG] WebSocket connection timeout after 5 seconds');
          this.isConnecting = false;
          if (this.ws) {
            logger.info(`🔌 [DEBUG] Closing WebSocket due to timeout, readyState: ${this.ws.readyState}`);
            this.ws.close();
            this.ws = null;
          }
          resolve(false);
        }, 5000); // 5 second timeout

        const checkConnection = () => {
          logger.info(`🔌 [DEBUG] checkConnection - readyState: ${this.ws?.readyState}, isConnecting: ${this.isConnecting}`);
          
          if (this.ws?.readyState === WebSocket.OPEN) {
            logger.info(`✅ [DEBUG] Connection successful!`);
            clearTimeout(timeout);
            resolve(true);
          } else if (this.ws?.readyState === WebSocket.CLOSED || this.ws?.readyState === WebSocket.CLOSING) {
            logger.info(`❌ [DEBUG] Connection failed - WebSocket closed/closing`);
            clearTimeout(timeout);
            this.isConnecting = false;
            resolve(false);
          } else {
            setTimeout(checkConnection, 100);
          }
        };
        checkConnection();
      });

    } catch (error) {
      logger.error('Failed to connect to Graph8 WebSocket:', error);
      this.isConnecting = false;
      return false;
    }
  }

  /**
   * Disconnect from Graph8 WebSocket server
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close(1000, 'Manual disconnect');
      this.ws = null;
    }

    this.config = null;
    this.isConnecting = false;
    logger.info('Disconnected from Graph8 backend');
  }

  /**
   * Get connection status
   */
  getStatus(): { connected: boolean; agentId: string | null; readyState?: number } {
    return {
      connected: this.ws?.readyState === WebSocket.OPEN,
      agentId: this.agentId,
      readyState: this.ws?.readyState
    };
  }

  /**
   * Register message handler
   */
  onMessage(type: string, handler: (message: any) => void): void {
    this.messageHandlers.set(type, handler);
  }

  /**
   * Send message to Graph8 server
   */
  private sendMessage(message: Graph8AgentMessage): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      logger.info('Cannot send message: WebSocket not connected');
      return false;
    }

    try {
      this.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      logger.error('Error sending WebSocket message:', error);
      return false;
    }
  }

  /**
   * Register agent with Graph8 server
   */
  private registerAgent(): void {
    if (!this.config) return;

    const message: Graph8AgentMessage = {
      type: 'agent_register',
      agent_id: this.agentId!,
      user_id: this.config.userId,
      status: 'ready',
      timestamp: new Date().toISOString()
    };

    if (this.sendMessage(message)) {
      logger.info(`🆔 Graph8 agent registered: ${this.agentId}`);
    }
  }

  /**
   * Send task acknowledgment
   */
  sendTaskAck(taskId: string): boolean {
    if (!this.config) return false;

    const message: Graph8AgentMessage = {
      type: 'task_ack',
      agent_id: this.agentId!,
      user_id: this.config.userId,
      task_id: taskId,
      status: 'busy',
      timestamp: new Date().toISOString()
    };

    return this.sendMessage(message);
  }

  /**
   * Send task result
   */
  sendTaskResult(taskId: string, result: any, success: boolean): boolean {
    if (!this.config) return false;

    const message: Graph8AgentMessage = {
      type: 'task_result',
      agent_id: this.agentId!,
      user_id: this.config.userId,
      task_id: taskId,
      status: success ? 'ready' : 'error',
      result: result,
      timestamp: new Date().toISOString()
    };

    return this.sendMessage(message);
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(message: any): void {
    logger.info('Received Graph8 message:', message);

    // Handle different message types
    switch (message.type) {
      case 'task':
        this.handleTaskMessage(message as Graph8TaskMessage);
        break;
      
      case 'agent_registered':
        logger.info(`Agent registration confirmed: ${message.agent_id}`);
        break;
      
      case 'ping':
        // Respond to ping with pong
        this.sendMessage({
          type: 'agent_status',
          agent_id: this.agentId!,
          user_id: this.config!.userId,
          status: 'ready',
          timestamp: new Date().toISOString()
        });
        break;
      
      default:
        logger.info('Unknown message type:', message.type);
    }

    // Call registered handlers
    const handler = this.messageHandlers.get(message.type);
    if (handler) {
      handler(message);
    }
  }

  /**
   * Handle incoming task messages
   */
  private handleTaskMessage(message: Graph8TaskMessage): void {
    logger.info(`📋 Received Graph8 task: ${message.task_id}`);
    
    // Send acknowledgment
    this.sendTaskAck(message.task_id);
    
    // Trigger task execution via Chrome messaging
    chrome.runtime.sendMessage({
      type: 'new_task_graph8',
      task: message.instruction,
      graph8TaskId: message.task_id,
      url: message.metadata?.url,
      timestamp: message.timestamp,
      metadata: message.metadata
    }).catch(error => {
      logger.error('Error forwarding task to extension:', error);
    });
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (!this.config || this.reconnectAttempts >= this.config.maxReconnectAttempts!) {
      logger.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.config.reconnectInterval! * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff
    
    logger.info(`Scheduling reconnection attempt ${this.reconnectAttempts} in ${delay}ms`);
    
    this.reconnectTimer = setTimeout(() => {
      if (this.config) {
        this.connect(this.config);
      }
    }, delay);
  }

  /**
   * Get agent ID
   */
  getAgentId(): string | null {
    return this.agentId;
  }
}
