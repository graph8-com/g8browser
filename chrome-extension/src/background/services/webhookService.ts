import { LinkedInActionTracker, Graph8TaskResult } from './linkedinActionTracker';
import { ConfigService } from './configService';

export interface WebhookTaskPayload {
  id: string;
  task: string;
  tabId: number;
  timestamp: number;
  url?: string;
  metadata?: {
    isReused: boolean;
    executionCount: number;
    taskId?: string; // Graph8 task ID
  };
}

export interface WebhookResponse {
  success: boolean;
  error?: string;
  data?: any;
}

export interface WebhookConfig {
  enabled: boolean;
  url: string;
  authToken?: string;
  retryAttempts: number;
  retryDelay: number;
  timeout: number;
  headers?: Record<string, string>;
}

export class WebhookService {
  private configService: ConfigService;

  constructor() {
    this.configService = new ConfigService();
  }

  /**
   * Generate a unique task ID based on task content and context
   */
  generateTaskId(task: string, tabId: number): string {
    const timestamp = Date.now();
    const taskHash = this.hashString(task);
    return `task_${tabId}_${timestamp}_${taskHash}`;
  }

  /**
   * Simple string hash function
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36).substring(0, 6);
  }

  /**
   * Send a task to the webhook endpoint
   */
  async sendTask(payload: WebhookTaskPayload): Promise<WebhookResponse> {
    const config = await this.configService.getWebhookConfig();
    
    if (!config.enabled || !config.url) {
      return { success: false, error: 'Webhook not configured' };
    }

    return this.sendRequest(config.url, payload, config);
  }

  /**
   * Send Graph8-compatible task result
   */
  async sendGraph8TaskResult(result: Graph8TaskResult): Promise<WebhookResponse> {
    const config = await this.configService.getWebhookConfig();
    
    if (!config.enabled || !config.url) {
      return { success: false, error: 'Webhook not configured' };
    }

    const payload = {
      ...result,
      timestamp: new Date().toISOString(),
      source: 'chrome_extension'
    };

    return this.sendRequest(config.url, payload, config);
  }

  /**
   * Send task with LinkedIn action tracking
   */
  async sendTaskWithTracking(
    task: string, 
    tabId: number, 
    graph8TaskId?: string,
    url?: string
  ): Promise<{ taskId: string; tracker: LinkedInActionTracker }> {
    const taskId = this.generateTaskId(task, tabId);
    const tracker = new LinkedInActionTracker(graph8TaskId || taskId, url);
    
    // Parse instruction to predict expected actions
    tracker.parseTaskInstruction(task);
    
    const payload: WebhookTaskPayload = {
      id: taskId,
      task,
      tabId,
      timestamp: Date.now(),
      url,
      metadata: {
        isReused: false,
        executionCount: 1,
        taskId: graph8TaskId
      }
    };

    try {
      await this.sendTask(payload);
      return { taskId, tracker };
    } catch (error) {
      tracker.setError(`Failed to send task: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Send task update (completion, status change, etc.)
   */
  async sendTaskUpdate(taskId: string, update: any): Promise<WebhookResponse> {
    const config = await this.configService.getWebhookConfig();
    
    if (!config.enabled || !config.url) {
      return { success: false, error: 'Webhook not configured' };
    }

    const payload = {
      type: 'task_update',
      taskId,
      timestamp: Date.now(),
      update
    };

    return this.sendRequest(config.url, payload, config);
  }

  /**
   * Send HTTP request with retry logic
   */
  private async sendRequest(url: string, payload: any, config: WebhookConfig): Promise<WebhookResponse> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...config.headers
    };

    if (config.authToken) {
      headers['Authorization'] = `Bearer ${config.authToken}`;
    }

    for (let attempt = 1; attempt <= config.retryAttempts; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), config.timeout);

        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log(`Webhook sent successfully (attempt ${attempt}):`, { url, payload, response: data });
        
        return { success: true, data };

      } catch (error) {
        console.error(`Webhook attempt ${attempt} failed:`, error);
        
        if (attempt === config.retryAttempts) {
          return { 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          };
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, config.retryDelay));
      }
    }

    return { success: false, error: 'All retry attempts failed' };
  }

  /**
   * Test webhook connection
   */
  async testWebhook(): Promise<WebhookResponse> {
    const config = await this.configService.getWebhookConfig();
    
    if (!config.enabled || !config.url) {
      return { success: false, error: 'Webhook not configured' };
    }

    const testPayload = {
      type: 'test',
      timestamp: Date.now(),
      message: 'Test webhook connection from Chrome extension'
    };

    return this.sendRequest(config.url, testPayload, config);
  }
}
