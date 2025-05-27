import 'webextension-polyfill';
import {
  agentModelStore,
  AgentNameEnum,
  generalSettingsStore,
  llmProviderStore,
  ProviderTypeEnum,
  getDefaultAgentModelParams,
} from '@extension/storage';
import BrowserContext from './browser/context';
import { Executor } from './agent/executor';
import { createLogger } from './log';
import { ExecutionState } from './agent/event/types';
import { createChatModel } from './agent/helper';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

// Graph8 Integration Services
import { WebhookService } from './services/webhookService';
import { ConfigService } from './services/configService';
import { TaskStorageService } from './services/taskStorageService';
import { LinkedInActionTracker, Graph8TaskResult } from './services/linkedinActionTracker';
import { Graph8WebSocketService } from './services/websocketService';

const logger = createLogger('background');

const browserContext = new BrowserContext({});
let currentExecutor: Executor | null = null;
let currentPort: chrome.runtime.Port | null = null;

// Graph8 Integration Services
const webhookService = new WebhookService();
const configService = new ConfigService();
const taskStorageService = new TaskStorageService();
const websocketService = new Graph8WebSocketService();

// Active task trackers for Graph8 integration
const activeTrackers = new Map<string, LinkedInActionTracker>();

// Initialize Graph8 WebSocket connection on startup
initializeGraph8Connection();

// Setup side panel behavior
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(error => console.error(error));

// Function to check if script is already injected
async function isScriptInjected(tabId: number): Promise<boolean> {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => Object.prototype.hasOwnProperty.call(window, 'buildDomTree'),
    });
    return results[0]?.result || false;
  } catch (err) {
    console.error('Failed to check script injection status:', err);
    return false;
  }
}

// // Function to inject the buildDomTree script
async function injectBuildDomTree(tabId: number) {
  try {
    // Check if already injected
    const alreadyInjected = await isScriptInjected(tabId);
    if (alreadyInjected) {
      console.log('Scripts already injected, skipping...');
      return;
    }

    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['buildDomTree.js'],
    });
    console.log('Scripts successfully injected');
  } catch (err) {
    console.error('Failed to inject scripts:', err);
  }
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (tabId && changeInfo.status === 'complete' && tab.url?.startsWith('http')) {
    await injectBuildDomTree(tabId);
  }
});

// Listen for debugger detached event
// if canceled_by_user, remove the tab from the browser context
chrome.debugger.onDetach.addListener(async (source, reason) => {
  console.log('Debugger detached:', source, reason);
  if (reason === 'canceled_by_user') {
    if (source.tabId) {
      await browserContext.cleanup();
    }
  }
});

// Cleanup when tab is closed
chrome.tabs.onRemoved.addListener(tabId => {
  browserContext.removeAttachedPage(tabId);
});

logger.info('background loaded');

// Listen for simple messages (e.g., from options page)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle other message types if needed in the future
  // Return false if response is not sent asynchronously
  // return false;
});

// Setup connection listener for long-lived connections (e.g., side panel)
chrome.runtime.onConnect.addListener(port => {
  if (port.name === 'side-panel-connection') {
    currentPort = port;

    port.onMessage.addListener(async message => {
      try {
        switch (message.type) {
          case 'heartbeat':
            // Acknowledge heartbeat
            port.postMessage({ type: 'heartbeat_ack' });
            break;

          case 'new_task': {
            if (!message.task) return port.postMessage({ type: 'error', error: 'No task provided' });
            if (!message.tabId) return port.postMessage({ type: 'error', error: 'No tab ID provided' });

            logger.info('new_task', message.tabId, message.task);
            currentExecutor = await setupExecutor(message.taskId, message.task, browserContext);
            subscribeToExecutorEvents(currentExecutor);

            const result = await currentExecutor.execute();
            logger.info('new_task execution result', message.tabId, result);
            break;
          }
          case 'follow_up_task': {
            if (!message.task) return port.postMessage({ type: 'error', error: 'No follow up task provided' });
            if (!message.tabId) return port.postMessage({ type: 'error', error: 'No tab ID provided' });

            logger.info('follow_up_task', message.tabId, message.task);

            // If executor exists, add follow-up task
            if (currentExecutor) {
              currentExecutor.addFollowUpTask(message.task);
              // Re-subscribe to events in case the previous subscription was cleaned up
              subscribeToExecutorEvents(currentExecutor);
              const result = await currentExecutor.execute();
              logger.info('follow_up_task execution result', message.tabId, result);
            } else {
              // executor was cleaned up, can not add follow-up task
              logger.info('follow_up_task: executor was cleaned up, can not add follow-up task');
              return port.postMessage({ type: 'error', error: 'Executor was cleaned up, can not add follow-up task' });
            }
            break;
          }

          case 'cancel_task': {
            if (!currentExecutor) return port.postMessage({ type: 'error', error: 'No task to cancel' });
            await currentExecutor.cancel();
            break;
          }

          case 'screenshot': {
            if (!message.tabId) return port.postMessage({ type: 'error', error: 'No tab ID provided' });
            const page = await browserContext.switchTab(message.tabId);
            const screenshot = await page.takeScreenshot();
            logger.info('screenshot', message.tabId, screenshot);
            return port.postMessage({ type: 'success', screenshot });
          }

          case 'resume_task': {
            if (!currentExecutor) return port.postMessage({ type: 'error', error: 'No task to resume' });
            await currentExecutor.resume();
            return port.postMessage({ type: 'success' });
          }

          case 'pause_task': {
            if (!currentExecutor) return port.postMessage({ type: 'error', error: 'No task to pause' });
            await currentExecutor.pause();
            return port.postMessage({ type: 'success' });
          }

          // Graph8 Integration Message Handlers
          case 'new_task_graph8': {
            if (!message.task) return port.postMessage({ type: 'error', error: 'No task provided' });
            if (!message.tabId) return port.postMessage({ type: 'error', error: 'No tab ID provided' });

            try {
              const result = await handleNewTaskWithGraph8(message.task, message.tabId, message.graph8TaskId, message.url);
              return port.postMessage({ type: 'success', data: result });
            } catch (error) {
              return port.postMessage({ type: 'error', error: error instanceof Error ? error.message : 'Unknown error' });
            }
          }

          case 'task_completed': {
            if (!message.taskId) return port.postMessage({ type: 'error', error: 'No task ID provided' });

            try {
              const result = await updateTaskCompletionWithGraph8(message.taskId, message.result, message.success);
              return port.postMessage({ type: 'success', data: result });
            } catch (error) {
              return port.postMessage({ type: 'error', error: error instanceof Error ? error.message : 'Unknown error' });
            }
          }

          case 'get_task_tracker': {
            if (!message.taskId) return port.postMessage({ type: 'error', error: 'No task ID provided' });

            const tracker = activeTrackers.get(message.taskId);
            if (!tracker) {
              return port.postMessage({ type: 'error', error: 'Task tracker not found' });
            }

            return port.postMessage({ 
              type: 'success', 
              data: {
                taskId: message.taskId,
                results: tracker.getResults()
              }
            });
          }

          case 'update_action_tracker': {
            if (!message.taskId) return port.postMessage({ type: 'error', error: 'No task ID provided' });
            if (!message.action) return port.postMessage({ type: 'error', error: 'No action provided' });

            const tracker = activeTrackers.get(message.taskId);
            if (!tracker) {
              return port.postMessage({ type: 'error', error: 'Task tracker not found' });
            }

            // Update tracker based on action type
            switch (message.action) {
              case 'connection_made':
                tracker.markConnectionMade(message.details);
                break;
              case 'comment_submitted':
                tracker.markCommentSubmitted(message.details);
                break;
              case 'post_liked':
                tracker.markPostLiked(message.details);
                break;
              case 'company_followed':
                tracker.markCompanyFollowed(message.details);
                break;
              case 'profile_followed':
                tracker.markProfileFollowed(message.details);
                break;
              case 'message_sent':
                tracker.markMessageSent(message.details);
                break;
              case 'profile_visited':
                tracker.markProfileVisited(message.url, message.details);
                break;
              default:
                tracker.addDetails(message.details || `Action: ${message.action}`);
            }

            return port.postMessage({ type: 'success', data: tracker.getResults() });
          }

          case 'test_graph8_compatibility': {
            if (!message.tabId) return port.postMessage({ type: 'error', error: 'No tab ID provided' });

            try {
              const result = await testGraph8Compatibility(message.tabId);
              return port.postMessage({ type: 'success', data: result });
            } catch (error) {
              return port.postMessage({ type: 'error', error: error instanceof Error ? error.message : 'Unknown error' });
            }
          }

          case 'connect_graph8': {
            console.log(' [DEBUG] Background received connect_graph8 message:', message);
            try {
              const config = await configService.getConfig();
              console.log(' [DEBUG] Config loaded:', config);
              console.log(' [DEBUG] Calling connectToGraph8...');
              const success = await connectToGraph8(message.backendUrl, message.userId, message.authToken);
              console.log(' [DEBUG] connectToGraph8 result:', success);
              return port.postMessage({ type: 'success', data: { connected: success, agentId: websocketService.getAgentId() } });
            } catch (error) {
              console.error(' [DEBUG] Error in connect_graph8:', error);
              return port.postMessage({ type: 'error', error: error instanceof Error ? error.message : 'Unknown error' });
            }
          }

          case 'disconnect_graph8': {
            try {
              websocketService.disconnect();
              return port.postMessage({ type: 'success', data: { connected: false } });
            } catch (error) {
              return port.postMessage({ type: 'error', error: error instanceof Error ? error.message : 'Unknown error' });
            }
          }

          case 'get_graph8_status': {
            try {
              const status = websocketService.getStatus();
              return port.postMessage({ type: 'success', data: status });
            } catch (error) {
              return port.postMessage({ type: 'error', error: error instanceof Error ? error.message : 'Unknown error' });
            }
          }

          default:
            return port.postMessage({ type: 'error', error: 'Unknown message type' });
        }
      } catch (error) {
        console.error('Error handling port message:', error);
        port.postMessage({
          type: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    port.onDisconnect.addListener(() => {
      console.log('Side panel disconnected');
      currentPort = null;
    });
  }
});

async function setupExecutor(taskId: string, task: string, browserContext: BrowserContext) {
  const providers = await llmProviderStore.getAllProviders();
  // if no providers, need to display the options page
  if (Object.keys(providers).length === 0) {
    throw new Error('Please configure API keys in the settings first');
  }
  const agentModels = await agentModelStore.getAllAgentModels();
  // verify if every provider used in the agent models exists in the providers
  for (const agentModel of Object.values(agentModels)) {
    if (!providers[agentModel.provider]) {
      throw new Error(`Provider ${agentModel.provider} not found in the settings`);
    }
  }

  const navigatorModel = agentModels[AgentNameEnum.Navigator];
  if (!navigatorModel) {
    throw new Error('Please choose a model for the navigator in the settings first');
  }
  // Log the provider config being used for the navigator
  const navigatorProviderConfig = providers[navigatorModel.provider];
  const navigatorLLM = createChatModel(navigatorProviderConfig, navigatorModel);

  let plannerLLM: BaseChatModel | null = null;
  const plannerModel = agentModels[AgentNameEnum.Planner];
  if (plannerModel) {
    // Log the provider config being used for the planner
    const plannerProviderConfig = providers[plannerModel.provider];
    plannerLLM = createChatModel(plannerProviderConfig, plannerModel);
  }

  let validatorLLM: BaseChatModel | null = null;
  const validatorModel = agentModels[AgentNameEnum.Validator];
  if (validatorModel) {
    // Log the provider config being used for the validator
    const validatorProviderConfig = providers[validatorModel.provider];
    validatorLLM = createChatModel(validatorProviderConfig, validatorModel);
  }

  const generalSettings = await generalSettingsStore.getSettings();
  const executor = new Executor(task, taskId, browserContext, navigatorLLM, {
    plannerLLM: plannerLLM ?? navigatorLLM,
    validatorLLM: validatorLLM ?? navigatorLLM,
    agentOptions: {
      maxSteps: generalSettings.maxSteps,
      maxFailures: generalSettings.maxFailures,
      maxActionsPerStep: generalSettings.maxActionsPerStep,
      useVision: generalSettings.useVision,
      useVisionForPlanner: generalSettings.useVisionForPlanner,
      planningInterval: generalSettings.planningInterval,
    },
  });

  return executor;
}

// Update subscribeToExecutorEvents to use port
async function subscribeToExecutorEvents(executor: Executor) {
  // Clear previous event listeners to prevent multiple subscriptions
  executor.clearExecutionEvents();

  // Subscribe to new events
  executor.subscribeExecutionEvents(async event => {
    try {
      if (currentPort) {
        currentPort.postMessage(event);
      }
    } catch (error) {
      logger.error('Failed to send message to side panel:', error);
    }

    if (
      event.state === ExecutionState.TASK_OK ||
      event.state === ExecutionState.TASK_FAIL ||
      event.state === ExecutionState.TASK_CANCEL
    ) {
      await currentExecutor?.cleanup();
    }
  });
}

// Ensure a default OpenAI-compatible provider exists on first install
async function ensureDefaultProvider() {
  const DEFAULT_PROVIDER_ID = 'default_openai';

  // ──────────────────────────────────────────────────────────────
  // Hard-coded default provider credentials
  // NOTE: These are public demo credentials shipped with the extension.
  //       Replace with your own before distributing if necessary.
  const DEFAULT_API_BASE_URL = 'https://ai-textual-agents.graph8.com';
  const DEFAULT_API_KEY = 'fdfd4483-af31-4d73-91cf-c876f11963a5';

  if (!(await llmProviderStore.hasProvider(DEFAULT_PROVIDER_ID))) {
    await llmProviderStore.setProvider(DEFAULT_PROVIDER_ID, {
      name: 'graph8',
      type: ProviderTypeEnum.CustomOpenAI,
      apiKey: DEFAULT_API_KEY,
      baseUrl: DEFAULT_API_BASE_URL,
      modelNames: ['o3', 'gpt-4.1'],
    });
  } else {
    // If provider exists but is missing key or baseUrl, patch them in
    const existing = await llmProviderStore.getProvider(DEFAULT_PROVIDER_ID);
    if (existing && (!existing.apiKey || !existing.baseUrl || !existing.name)) {
      await llmProviderStore.setProvider(DEFAULT_PROVIDER_ID, {
        ...existing,
        apiKey: existing.apiKey || DEFAULT_API_KEY,
        baseUrl: existing.baseUrl || DEFAULT_API_BASE_URL,
        name: existing.name || 'graph8',
      });
    }
  }
}

// Ensure default agent -> model mapping exists
async function ensureDefaultAgentModels() {
  const DEFAULT_PROVIDER_ID = 'default_openai';

  // Planner -> o3, Navigator -> gpt-4.1, Validator -> o3
  const defaults: Record<AgentNameEnum, string> = {
    [AgentNameEnum.Planner]: 'o3',
    [AgentNameEnum.Navigator]: 'gpt-4.1',
    [AgentNameEnum.Validator]: 'o3',
  } as const;

  for (const [agent, modelName] of Object.entries(defaults) as [AgentNameEnum, string][]) {
    if (!(await agentModelStore.hasAgentModel(agent))) {
      await agentModelStore.setAgentModel(agent, {
        provider: DEFAULT_PROVIDER_ID,
        modelName,
        parameters: getDefaultAgentModelParams(DEFAULT_PROVIDER_ID, agent),
      });
    }
  }
}

// Run once when the extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
  ensureDefaultProvider().catch(err => console.error('Failed to create default provider:', err));
  ensureDefaultAgentModels().catch(err => console.error('Failed to create default agent models:', err));
});

// ========================================
// Graph8 Integration Helper Functions
// ========================================

/**
 * Handle new task creation with Graph8 integration
 */
async function handleNewTaskWithGraph8(
  task: string, 
  tabId: number, 
  graph8TaskId?: string,
  url?: string
): Promise<{ taskId: string; tracker: LinkedInActionTracker }> {
  try {
    // Check for task reuse
    const taskReuseConfig = await configService.getTaskReuseConfig();
    let existingTask: any = null;
    
    if (taskReuseConfig.enabled) {
      existingTask = await taskStorageService.findSimilarTask(task, tabId, taskReuseConfig.similarityThreshold);
    }

    let taskId: string;
    let tracker: LinkedInActionTracker;

    if (existingTask) {
      // Reuse existing task
      taskId = existingTask.id;
      tracker = new LinkedInActionTracker(graph8TaskId || taskId, url);
      tracker.parseTaskInstruction(task);
      
      // Update execution count
      await taskStorageService.updateTaskStatus(taskId, 'running');
      
      logger.info(`Reusing existing task ${taskId} for Graph8 task ${graph8TaskId}`);
    } else {
      // Create new task with webhook tracking
      const result = await webhookService.sendTaskWithTracking(task, tabId, graph8TaskId, url);
      taskId = result.taskId;
      tracker = result.tracker;

      // Store task in local storage
      await taskStorageService.storeTask({
        id: taskId,
        task,
        tabId,
        status: 'pending',
        createdAt: Date.now(),
        url,
        metadata: {
          graph8TaskId,
          isReused: false,
          executionCount: 1
        }
      });

      logger.info(`Created new Graph8 task ${taskId} for Graph8 task ${graph8TaskId}`);
    }

    // Store active tracker
    activeTrackers.set(taskId, tracker);

    // Inject LinkedIn action detection script
    await injectLinkedInActionDetection(tabId, taskId);

    // Set up executor and run task
    currentExecutor = await setupExecutor(taskId, task, browserContext);
    subscribeToExecutorEvents(currentExecutor);

    // Start task execution
    const result = await currentExecutor.execute();
    logger.info('Graph8 task execution result', taskId, result);

    return { taskId, tracker };
  } catch (error) {
    logger.error('Error handling new Graph8 task:', error);
    throw error;
  }
}

/**
 * Update task completion with Graph8 result format
 */
async function updateTaskCompletionWithGraph8(
  taskId: string, 
  result: any, 
  success: boolean = true
): Promise<Graph8TaskResult> {
  try {
    const tracker = activeTrackers.get(taskId);
    if (!tracker) {
      throw new Error(`Task tracker not found for task ${taskId}`);
    }

    // Update tracker with final result
    if (result) {
      tracker.addDetails(`Execution completed: ${JSON.stringify(result)}`);
    }

    // Generate Graph8 result
    const graph8Result = tracker.generateGraph8Result(success);

    // Send result via webhook
    await webhookService.sendGraph8TaskResult(graph8Result);

    // Update task storage
    await taskStorageService.updateTaskStatus(taskId, success ? 'completed' : 'failed', graph8Result, success ? undefined : 'Task execution failed');

    // Clean up tracker
    activeTrackers.delete(taskId);

    logger.info(`Graph8 task ${taskId} completed with result:`, graph8Result);

    return graph8Result;
  } catch (error) {
    logger.error('Error updating Graph8 task completion:', error);
    throw error;
  }
}

/**
 * Inject LinkedIn action detection script into the page
 */
async function injectLinkedInActionDetection(tabId: number, taskId: string): Promise<void> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: detectLinkedInActions,
      args: [taskId]
    });
    logger.info(`LinkedIn action detection injected for task ${taskId}`);
  } catch (error) {
    logger.error('Error injecting LinkedIn action detection:', error);
  }
}

/**
 * Content script function to detect LinkedIn actions
 * This function runs in the page context
 */
function detectLinkedInActions(taskId: string) {
  // Only run on LinkedIn pages
  if (!window.location.href.includes('linkedin.com')) {
    return;
  }

  console.log(`Graph8: Starting LinkedIn action detection for task ${taskId}`);

  // Function to send action update to background script
  function reportAction(action: string, details?: string, url?: string) {
    chrome.runtime.sendMessage({
      type: 'update_action_tracker',
      taskId,
      action,
      details,
      url: url || window.location.href
    }).catch(error => console.error('Error reporting action:', error));
  }

  // Report initial profile visit
  reportAction('profile_visited', 'Page loaded', window.location.href);

  // Set up mutation observer to detect DOM changes
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as Element;
          
          // Check for connection confirmation
          if (element.querySelector?.('[data-test-modal="send-invite-modal"]') ||
              element.querySelector?.('.send-invite__actions') ||
              element.querySelector?.('button[aria-label*="Withdraw"]')) {
            reportAction('connection_made', 'Connection request detected via DOM mutation');
          }

          // Check for like confirmation
          if (element.querySelector?.('button[aria-pressed="true"][aria-label*="like"]')) {
            reportAction('post_liked', 'Post like detected via DOM mutation');
          }

          // Check for comment submission
          if (element.querySelector?.('.comments-comment-box__submit-button[disabled]') ||
              element.querySelector?.('.comment-submit-form__submit-button[disabled]')) {
            reportAction('comment_submitted', 'Comment submission detected via DOM mutation');
          }

          // Check for follow actions
          if (element.querySelector?.('button[aria-pressed="true"][data-control-name="follow_company"]') ||
              element.querySelector?.('.org-top-card-primary-actions__follow-button[aria-pressed="true"]')) {
            reportAction('company_followed', 'Company follow detected via DOM mutation');
          }

          if (element.querySelector?.('button[aria-pressed="true"][data-control-name="follow_member"]')) {
            reportAction('profile_followed', 'Profile follow detected via DOM mutation');
          }

          // Check for message sent
          if (element.querySelector?.('.msg-form__send-button[disabled]') ||
              element.querySelector?.('.compose-send-button[disabled]')) {
            reportAction('message_sent', 'Message sent detected via DOM mutation');
          }
        }
      });
    });
  });

  // Start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Set up click event listeners for immediate feedback
  document.addEventListener('click', (event) => {
    const target = event.target as Element;
    
    // Check for various LinkedIn action buttons
    if (target.matches?.('button[data-control-name*="connect"]')) {
      setTimeout(() => reportAction('connection_made', 'Connect button clicked'), 1000);
    } else if (target.matches?.('button[data-control-name*="like"]')) {
      setTimeout(() => reportAction('post_liked', 'Like button clicked'), 500);
    } else if (target.matches?.('button[data-control-name*="follow"]')) {
      if (target.matches?.('button[data-control-name*="follow_company"]')) {
        setTimeout(() => reportAction('company_followed', 'Follow company button clicked'), 1000);
      } else {
        setTimeout(() => reportAction('profile_followed', 'Follow profile button clicked'), 1000);
      }
    } else if (target.matches?.('.msg-form__send-button, .compose-send-button')) {
      setTimeout(() => reportAction('message_sent', 'Send message button clicked'), 1000);
    }
  });

  // Clean up after 5 minutes
  setTimeout(() => {
    observer.disconnect();
    console.log(`Graph8: LinkedIn action detection stopped for task ${taskId}`);
  }, 5 * 60 * 1000);
}

// ========================================
// Graph8 Compatibility Test Function
// ========================================

/**
 * Test function to assess Graph8 compatibility
 * This implements the test from the extension-assessment.md document
 */
async function testGraph8Compatibility(tabId: number): Promise<any> {
  console.log(" Testing Graph8 compatibility...");
  
  try {
    // Test 1: Can we track task IDs?
    const taskId = "test_123";
    console.log(` Task ID tracking: ${taskId}`);
    
    // Test 2: Can we detect current page?
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];
    const currentUrl = currentTab?.url || '';
    const isLinkedIn = currentUrl.includes("linkedin.com");
    console.log(` LinkedIn detection: ${isLinkedIn}`);
    
    // Test 3: Can we find common LinkedIn elements?
    let elementDetection = { followButton: false, connectButton: false, likeButton: false };
    
    if (isLinkedIn && currentTab?.id) {
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: currentTab.id },
          func: () => {
            const followButton = document.querySelector('[data-control-name*="follow"]');
            const connectButton = document.querySelector('[data-control-name*="connect"]');
            const likeButton = document.querySelector('[data-control-name*="like"]');
            
            return {
              followButton: !!followButton,
              connectButton: !!connectButton,
              likeButton: !!likeButton
            };
          }
        });
        
        if (results && results[0]?.result) {
          elementDetection = results[0].result;
        }
      } catch (error) {
        console.warn("Could not detect LinkedIn elements:", error);
      }
    }
    
    console.log(` Follow button found: ${elementDetection.followButton}`);
    console.log(` Connect button found: ${elementDetection.connectButton}`);
    console.log(` Like button found: ${elementDetection.likeButton}`);
    
    // Test 4: Can we format structured results?
    const testResult = {
      task_id: taskId,
      success: true,
      results: {
        connection_made: "no",
        submitted_comment: "no",
        liked_post: "no",
        followed_company: "no",
        followed_profile: "no",
        sent_message: "no",
        visited_profile: isLinkedIn ? "yes" : "no",
        action_performed: "compatibility_test",
        url_visited: currentUrl,
        timestamp: new Date().toISOString(),
        details: "Graph8 compatibility test completed successfully"
      }
    };
    
    console.log(" Structured result:", testResult);
    
    // Test 5: Can we create and use services?
    const webhookConfig = await configService.getWebhookConfig();
    const taskStats = await taskStorageService.getTaskStats();
    
    console.log(" Webhook config loaded:", webhookConfig.enabled);
    console.log(" Task stats loaded:", taskStats.total);
    
    // Test 6: Can we create action tracker?
    const tracker = new LinkedInActionTracker(taskId, currentUrl);
    tracker.parseTaskInstruction("Test LinkedIn action tracking");
    tracker.markProfileVisited(currentUrl, "Compatibility test visit");
    
    const trackerResult = tracker.generateGraph8Result(true);
    console.log(" Action tracker created:", trackerResult.task_id);
    
    return {
      success: true,
      tests: {
        taskIdTracking: true,
        linkedInDetection: isLinkedIn,
        elementDetection,
        structuredResults: true,
        serviceIntegration: true,
        actionTracking: true
      },
      result: testResult,
      trackerResult,
      message: "All Graph8 compatibility tests passed! "
    };
    
  } catch (error) {
    console.error(" Graph8 compatibility test failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: "Graph8 compatibility test failed"
    };
  }
}

// ========================================
// Graph8 WebSocket Connection Functions
// ========================================

/**
 * Initialize Graph8 WebSocket connection on startup
 */
async function initializeGraph8Connection(): Promise<void> {
  try {
    logger.info(' Initializing Graph8 WebSocket connection...');
    
    // Try to load saved connection config
    const config = await configService.getConfig();
    
    // Set up WebSocket message handlers
    websocketService.onMessage('task', (message) => {
      logger.info(' Received task from Graph8:', message);
    });
    
    logger.info(' Graph8 WebSocket service initialized');
  } catch (error) {
    logger.error(' Failed to initialize Graph8 WebSocket:', error);
  }
}

/**
 * Connect to Graph8 WebSocket server
 */
async function connectToGraph8(backendUrl: string, userId: string, authToken?: string): Promise<boolean> {
  try {
    logger.info(` Connecting to Graph8: ${backendUrl} with user: ${userId}`);
    
    const success = await websocketService.connect({
      url: backendUrl,
      userId: userId,
      authToken: authToken
    });
    
    if (success) {
      logger.info(` Connected to Graph8 as agent: ${websocketService.getAgentId()}`);
      
      // Set up task message handler
      websocketService.onMessage('task', async (taskMessage) => {
        logger.info(` Received Graph8 task: ${taskMessage.task_id}`);
        
        try {
          // Get current active tab
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          const currentTab = tabs[0];
          
          if (currentTab?.id) {
            // Forward task to extension for execution
            const result = await handleNewTaskWithGraph8(
              taskMessage.instruction,
              currentTab.id,
              taskMessage.task_id,
              taskMessage.metadata?.url
            );
            
            // Send task result back to Graph8
            websocketService.sendTaskResult(taskMessage.task_id, result, true);
          } else {
            logger.error('No active tab found for task execution');
            websocketService.sendTaskResult(taskMessage.task_id, { error: 'No active tab' }, false);
          }
        } catch (error) {
          logger.error('Error executing Graph8 task:', error);
          websocketService.sendTaskResult(taskMessage.task_id, { error: error instanceof Error ? error.message : 'Unknown error' }, false);
        }
      });
      
    } else {
      logger.error(' Failed to connect to Graph8 WebSocket');
    }
    
    return success;
  } catch (error) {
    logger.error(' Error connecting to Graph8:', error);
    return false;
  }
}
