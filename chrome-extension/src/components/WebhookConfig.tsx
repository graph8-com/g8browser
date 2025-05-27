import React, { useState, useEffect } from 'react';
import { ConfigService } from '../background/services/configService';
import { WebhookService } from '../background/services/webhookService';

interface WebhookConfig {
  enabled: boolean;
  url: string;
  authToken?: string;
  retryAttempts: number;
  retryDelay: number;
  timeout: number;
  headers?: Record<string, string>;
}

export const WebhookConfigComponent: React.FC = () => {
  const [config, setConfig] = useState<WebhookConfig>({
    enabled: true,
    url: '',
    authToken: '',
    retryAttempts: 3,
    retryDelay: 1000,
    timeout: 10000,
    headers: {}
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const configService = new ConfigService();
  const webhookService = new WebhookService();

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setIsLoading(true);
      const webhookConfig = await configService.getWebhookConfig();
      setConfig(webhookConfig);
    } catch (error) {
      console.error('Error loading webhook config:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const validateConfig = async (): Promise<boolean> => {
    const validation = await configService.validateWebhookConfig();
    setValidationErrors(validation.errors);
    return validation.valid;
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setValidationErrors([]);

      // Save config first
      await configService.setWebhookConfig(config);

      // Then validate
      const isValid = await validateConfig();
      
      if (isValid) {
        setTestResult({ success: true, message: 'Configuration saved successfully!' });
      } else {
        setTestResult({ success: false, message: 'Configuration saved but has validation errors.' });
      }
    } catch (error) {
      console.error('Error saving webhook config:', error);
      setTestResult({ 
        success: false, 
        message: `Error saving configuration: ${error instanceof Error ? error.message : 'Unknown error'}` 
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    try {
      setIsTesting(true);
      setTestResult(null);

      // Save current config first
      await configService.setWebhookConfig(config);

      // Test the webhook
      const result = await webhookService.testWebhook();
      
      setTestResult({
        success: result.success,
        message: result.success 
          ? 'Webhook test successful! Connection is working.' 
          : `Webhook test failed: ${result.error}`
      });
    } catch (error) {
      console.error('Error testing webhook:', error);
      setTestResult({
        success: false,
        message: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleReset = async () => {
    try {
      await configService.resetConfig();
      await loadConfig();
      setTestResult({ success: true, message: 'Configuration reset to defaults.' });
      setValidationErrors([]);
    } catch (error) {
      console.error('Error resetting config:', error);
      setTestResult({ 
        success: false, 
        message: `Error resetting configuration: ${error instanceof Error ? error.message : 'Unknown error'}` 
      });
    }
  };

  if (isLoading) {
    return (
      <div className="webhook-config loading">
        <div className="loading-spinner">Loading webhook configuration...</div>
      </div>
    );
  }

  return (
    <div className="webhook-config">
      <div className="config-header">
        <h2>Graph8 Webhook Configuration</h2>
        <p>Configure webhook settings for Graph8 Sequencer integration</p>
      </div>

      <div className="config-form">
        {/* Enable/Disable Toggle */}
        <div className="form-group">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => setConfig(prev => ({ ...prev, enabled: e.target.checked }))}
            />
            <span className="toggle-slider"></span>
            Enable Webhook Integration
          </label>
          <p className="help-text">
            When enabled, tasks will be sent to the configured webhook URL for Graph8 processing.
          </p>
        </div>

        {/* Webhook URL */}
        <div className="form-group">
          <label htmlFor="webhook-url">Webhook URL *</label>
          <input
            id="webhook-url"
            type="url"
            value={config.url}
            onChange={(e) => setConfig(prev => ({ ...prev, url: e.target.value }))}
            placeholder="https://your-graph8-webhook.com/api/tasks"
            disabled={!config.enabled}
            required
          />
          <p className="help-text">
            The endpoint URL where tasks will be sent. Must be a valid HTTPS URL.
          </p>
        </div>

        {/* Authentication Token */}
        <div className="form-group">
          <label htmlFor="auth-token">Authentication Token</label>
          <input
            id="auth-token"
            type="password"
            value={config.authToken || ''}
            onChange={(e) => setConfig(prev => ({ ...prev, authToken: e.target.value }))}
            placeholder="Optional bearer token for authentication"
            disabled={!config.enabled}
          />
          <p className="help-text">
            Optional. If provided, will be sent as "Authorization: Bearer [token]" header.
          </p>
        </div>

        {/* Advanced Settings */}
        <details className="advanced-settings">
          <summary>Advanced Settings</summary>
          
          <div className="form-group">
            <label htmlFor="retry-attempts">Retry Attempts</label>
            <input
              id="retry-attempts"
              type="number"
              min="1"
              max="10"
              value={config.retryAttempts}
              onChange={(e) => setConfig(prev => ({ ...prev, retryAttempts: parseInt(e.target.value) }))}
              disabled={!config.enabled}
            />
            <p className="help-text">Number of retry attempts for failed webhook calls (1-10).</p>
          </div>

          <div className="form-group">
            <label htmlFor="retry-delay">Retry Delay (ms)</label>
            <input
              id="retry-delay"
              type="number"
              min="100"
              max="10000"
              step="100"
              value={config.retryDelay}
              onChange={(e) => setConfig(prev => ({ ...prev, retryDelay: parseInt(e.target.value) }))}
              disabled={!config.enabled}
            />
            <p className="help-text">Delay between retry attempts in milliseconds (100-10000).</p>
          </div>

          <div className="form-group">
            <label htmlFor="timeout">Timeout (ms)</label>
            <input
              id="timeout"
              type="number"
              min="1000"
              max="60000"
              step="1000"
              value={config.timeout}
              onChange={(e) => setConfig(prev => ({ ...prev, timeout: parseInt(e.target.value) }))}
              disabled={!config.enabled}
            />
            <p className="help-text">Request timeout in milliseconds (1000-60000).</p>
          </div>
        </details>

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <div className="validation-errors">
            <h4>Configuration Errors:</h4>
            <ul>
              {validationErrors.map((error, index) => (
                <li key={index} className="error-message">{error}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Test Result */}
        {testResult && (
          <div className={`test-result ${testResult.success ? 'success' : 'error'}`}>
            <strong>{testResult.success ? '✓' : '✗'}</strong>
            {testResult.message}
          </div>
        )}

        {/* Action Buttons */}
        <div className="form-actions">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !config.enabled}
            className="btn btn-primary"
          >
            {isSaving ? 'Saving...' : 'Save Configuration'}
          </button>

          <button
            type="button"
            onClick={handleTest}
            disabled={isTesting || !config.enabled || !config.url}
            className="btn btn-secondary"
          >
            {isTesting ? 'Testing...' : 'Test Connection'}
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="btn btn-danger"
          >
            Reset to Defaults
          </button>
        </div>
      </div>

      {/* Graph8 Integration Info */}
      <div className="integration-info">
        <h3>Graph8 Integration Features</h3>
        <ul>
          <li>✓ Task ID tracking and reuse</li>
          <li>✓ LinkedIn action detection and reporting</li>
          <li>✓ Structured JSON result format</li>
          <li>✓ Real-time webhook notifications</li>
          <li>✓ Automatic retry mechanism</li>
          <li>✓ DOM-based action verification</li>
        </ul>
        
        <h4>Expected Webhook Payload Format:</h4>
        <pre className="code-block">
{`{
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
    "url_visited": "https://linkedin.com/company/graph8",
    "timestamp": "2025-05-26T19:03:40Z",
    "details": "Successfully followed Graph8 company page"
  }
}`}
        </pre>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        .webhook-config {
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .config-header {
          margin-bottom: 30px;
          text-align: center;
        }

        .config-header h2 {
          color: #333;
          margin-bottom: 10px;
        }

        .config-header p {
          color: #666;
          font-size: 14px;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-group label {
          display: block;
          margin-bottom: 5px;
          font-weight: 500;
          color: #333;
        }

        .form-group input {
          width: 100%;
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
        }

        .form-group input:disabled {
          background-color: #f5f5f5;
          color: #999;
        }

        .help-text {
          font-size: 12px;
          color: #666;
          margin-top: 5px;
        }

        .toggle-label {
          display: flex;
          align-items: center;
          cursor: pointer;
        }

        .toggle-slider {
          position: relative;
          width: 50px;
          height: 24px;
          background-color: #ccc;
          border-radius: 12px;
          margin-right: 10px;
          transition: background-color 0.3s;
        }

        .toggle-slider::before {
          content: '';
          position: absolute;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background-color: white;
          top: 2px;
          left: 2px;
          transition: transform 0.3s;
        }

        input[type="checkbox"]:checked + .toggle-slider {
          background-color: #007cba;
        }

        input[type="checkbox"]:checked + .toggle-slider::before {
          transform: translateX(26px);
        }

        input[type="checkbox"] {
          display: none;
        }

        .advanced-settings {
          margin: 20px 0;
          border: 1px solid #ddd;
          border-radius: 4px;
          padding: 15px;
        }

        .advanced-settings summary {
          cursor: pointer;
          font-weight: 500;
          margin-bottom: 15px;
        }

        .validation-errors {
          background-color: #ffeaa7;
          border: 1px solid #fdcb6e;
          border-radius: 4px;
          padding: 15px;
          margin: 20px 0;
        }

        .validation-errors h4 {
          margin: 0 0 10px 0;
          color: #e17055;
        }

        .validation-errors ul {
          margin: 0;
          padding-left: 20px;
        }

        .error-message {
          color: #e17055;
        }

        .test-result {
          padding: 15px;
          border-radius: 4px;
          margin: 20px 0;
        }

        .test-result.success {
          background-color: #d4edda;
          border: 1px solid #c3e6cb;
          color: #155724;
        }

        .test-result.error {
          background-color: #f8d7da;
          border: 1px solid #f5c6cb;
          color: #721c24;
        }

        .form-actions {
          display: flex;
          gap: 10px;
          margin-top: 30px;
        }

        .btn {
          padding: 10px 20px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: background-color 0.3s;
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-primary {
          background-color: #007cba;
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background-color: #005a87;
        }

        .btn-secondary {
          background-color: #6c757d;
          color: white;
        }

        .btn-secondary:hover:not(:disabled) {
          background-color: #545b62;
        }

        .btn-danger {
          background-color: #dc3545;
          color: white;
        }

        .btn-danger:hover:not(:disabled) {
          background-color: #c82333;
        }

        .integration-info {
          margin-top: 40px;
          padding: 20px;
          background-color: #f8f9fa;
          border-radius: 4px;
        }

        .integration-info h3 {
          margin-top: 0;
          color: #333;
        }

        .integration-info ul {
          list-style-type: none;
          padding-left: 0;
        }

        .integration-info li {
          margin-bottom: 5px;
          color: #28a745;
        }

        .code-block {
          background-color: #f1f3f4;
          border: 1px solid #dadce0;
          border-radius: 4px;
          padding: 15px;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          font-size: 12px;
          overflow-x: auto;
          white-space: pre-wrap;
        }

        .loading {
          text-align: center;
          padding: 50px;
        }

        .loading-spinner {
          font-size: 16px;
          color: #666;
        }
        `
      }} />
    </div>
  );
};

export default WebhookConfigComponent;
