export interface WebhookConfig {
  enabled: boolean;
  url: string;
  authToken?: string;
  retryAttempts: number;
  retryDelay: number;
  timeout: number;
  headers?: Record<string, string>;
}

export interface TaskReuseConfig {
  enabled: boolean;
  similarityThreshold: number;
  maxAge: number; // in milliseconds
}

export interface ExtensionConfig {
  webhook: WebhookConfig;
  taskReuse: TaskReuseConfig;
  debug: boolean;
}

export class ConfigService {
  private static readonly STORAGE_KEY = 'graph8_extension_config';
  
  private defaultConfig: ExtensionConfig = {
    webhook: {
      enabled: true, // Changed to true so webhook URL field is enabled by default
      url: '',
      authToken: '',
      retryAttempts: 3,
      retryDelay: 1000,
      timeout: 10000,
      headers: {}
    },
    taskReuse: {
      enabled: true,
      similarityThreshold: 0.8,
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    },
    debug: false
  };

  /**
   * Get the current webhook configuration
   */
  async getWebhookConfig(): Promise<WebhookConfig> {
    const config = await this.getConfig();
    return config.webhook;
  }

  /**
   * Update webhook configuration
   */
  async setWebhookConfig(webhookConfig: Partial<WebhookConfig>): Promise<void> {
    const config = await this.getConfig();
    config.webhook = { ...config.webhook, ...webhookConfig };
    await this.setConfig(config);
  }

  /**
   * Get the current task reuse configuration
   */
  async getTaskReuseConfig(): Promise<TaskReuseConfig> {
    const config = await this.getConfig();
    return config.taskReuse;
  }

  /**
   * Update task reuse configuration
   */
  async setTaskReuseConfig(taskReuseConfig: Partial<TaskReuseConfig>): Promise<void> {
    const config = await this.getConfig();
    config.taskReuse = { ...config.taskReuse, ...taskReuseConfig };
    await this.setConfig(config);
  }

  /**
   * Get the complete configuration
   */
  async getConfig(): Promise<ExtensionConfig> {
    try {
      const result = await chrome.storage.local.get(ConfigService.STORAGE_KEY);
      const storedConfig = result[ConfigService.STORAGE_KEY];
      
      if (!storedConfig) {
        // Return default config if none exists
        await this.setConfig(this.defaultConfig);
        return this.defaultConfig;
      }

      // Merge with defaults to ensure all properties exist
      return this.mergeWithDefaults(storedConfig);
    } catch (error) {
      console.error('Error getting configuration:', error);
      return this.defaultConfig;
    }
  }

  /**
   * Set the complete configuration
   */
  async setConfig(config: ExtensionConfig): Promise<void> {
    try {
      await chrome.storage.local.set({
        [ConfigService.STORAGE_KEY]: config
      });
      console.log('Configuration saved:', config);
    } catch (error) {
      console.error('Error saving configuration:', error);
      throw error;
    }
  }

  /**
   * Reset configuration to defaults
   */
  async resetConfig(): Promise<void> {
    await this.setConfig(this.defaultConfig);
  }

  /**
   * Enable/disable webhook integration
   */
  async setWebhookEnabled(enabled: boolean): Promise<void> {
    await this.setWebhookConfig({ enabled });
  }

  /**
   * Set webhook URL
   */
  async setWebhookUrl(url: string): Promise<void> {
    await this.setWebhookConfig({ url });
  }

  /**
   * Set webhook authentication token
   */
  async setWebhookAuthToken(authToken: string): Promise<void> {
    await this.setWebhookConfig({ authToken });
  }

  /**
   * Enable/disable debug mode
   */
  async setDebugMode(debug: boolean): Promise<void> {
    const config = await this.getConfig();
    config.debug = debug;
    await this.setConfig(config);
  }

  /**
   * Export configuration for backup
   */
  async exportConfig(): Promise<string> {
    const config = await this.getConfig();
    return JSON.stringify(config, null, 2);
  }

  /**
   * Import configuration from backup
   */
  async importConfig(configJson: string): Promise<void> {
    try {
      const config = JSON.parse(configJson);
      const mergedConfig = this.mergeWithDefaults(config);
      await this.setConfig(mergedConfig);
    } catch (error) {
      console.error('Error importing configuration:', error);
      throw new Error('Invalid configuration format');
    }
  }

  /**
   * Merge stored config with defaults to ensure all properties exist
   */
  private mergeWithDefaults(storedConfig: any): ExtensionConfig {
    return {
      webhook: {
        ...this.defaultConfig.webhook,
        ...storedConfig.webhook
      },
      taskReuse: {
        ...this.defaultConfig.taskReuse,
        ...storedConfig.taskReuse
      },
      debug: storedConfig.debug ?? this.defaultConfig.debug
    };
  }

  /**
   * Validate webhook configuration
   */
  async validateWebhookConfig(): Promise<{ valid: boolean; errors: string[] }> {
    const config = await this.getWebhookConfig();
    const errors: string[] = [];

    if (config.enabled) {
      if (!config.url) {
        errors.push('Webhook URL is required when webhook is enabled');
      } else {
        try {
          new URL(config.url);
        } catch {
          errors.push('Webhook URL is not a valid URL');
        }
      }

      if (config.retryAttempts < 1 || config.retryAttempts > 10) {
        errors.push('Retry attempts must be between 1 and 10');
      }

      if (config.retryDelay < 100 || config.retryDelay > 10000) {
        errors.push('Retry delay must be between 100ms and 10000ms');
      }

      if (config.timeout < 1000 || config.timeout > 60000) {
        errors.push('Timeout must be between 1000ms and 60000ms');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
