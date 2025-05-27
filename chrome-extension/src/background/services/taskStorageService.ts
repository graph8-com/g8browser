export interface StoredTask {
  id: string;
  task: string;
  tabId: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  createdAt: number;
  updatedAt?: number;
  completedAt?: number;
  url?: string;
  result?: any;
  error?: string;
  metadata?: {
    graph8TaskId?: string;
    isReused: boolean;
    executionCount: number;
    originalTaskId?: string;
  };
}

export interface TaskSearchOptions {
  status?: StoredTask['status'];
  tabId?: number;
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'completedAt';
  sortOrder?: 'asc' | 'desc';
}

export class TaskStorageService {
  private static readonly STORAGE_KEY = 'graph8_stored_tasks';
  private static readonly MAX_TASKS = 1000; // Limit stored tasks to prevent storage bloat

  /**
   * Store a new task
   */
  async storeTask(task: StoredTask): Promise<void> {
    try {
      const tasks = await this.getAllTasks();
      
      // Add new task
      tasks[task.id] = {
        ...task,
        updatedAt: Date.now()
      };

      // Clean up old tasks if we exceed the limit
      await this.cleanupOldTasks(tasks);

      await chrome.storage.local.set({
        [TaskStorageService.STORAGE_KEY]: tasks
      });

      console.log(`Task ${task.id} stored successfully`);
    } catch (error) {
      console.error('Error storing task:', error);
      throw error;
    }
  }

  /**
   * Get a specific task by ID
   */
  async getTask(taskId: string): Promise<StoredTask | null> {
    try {
      const tasks = await this.getAllTasks();
      return tasks[taskId] || null;
    } catch (error) {
      console.error('Error getting task:', error);
      return null;
    }
  }

  /**
   * Update task status
   */
  async updateTaskStatus(taskId: string, status: StoredTask['status'], result?: any, error?: string): Promise<void> {
    try {
      const tasks = await this.getAllTasks();
      const task = tasks[taskId];
      
      if (!task) {
        throw new Error(`Task ${taskId} not found`);
      }

      task.status = status;
      task.updatedAt = Date.now();
      
      if (result !== undefined) {
        task.result = result;
      }
      
      if (error) {
        task.error = error;
      }

      if (status === 'completed' || status === 'failed' || status === 'cancelled') {
        task.completedAt = Date.now();
      }

      await chrome.storage.local.set({
        [TaskStorageService.STORAGE_KEY]: tasks
      });

      console.log(`Task ${taskId} status updated to ${status}`);
    } catch (error) {
      console.error('Error updating task status:', error);
      throw error;
    }
  }

  /**
   * Find existing task for reuse based on similarity
   */
  async findSimilarTask(task: string, tabId: number, similarityThreshold: number = 0.8): Promise<StoredTask | null> {
    try {
      const tasks = await this.getAllTasks();
      const taskList = Object.values(tasks);
      
      // Filter tasks from the same tab that are completed
      const candidateTasks = taskList.filter(t => 
        t.tabId === tabId && 
        t.status === 'completed' &&
        t.task
      );

      let bestMatch: StoredTask | null = null;
      let bestSimilarity = 0;

      for (const candidateTask of candidateTasks) {
        const similarity = this.calculateSimilarity(task, candidateTask.task);
        if (similarity > bestSimilarity && similarity >= similarityThreshold) {
          bestSimilarity = similarity;
          bestMatch = candidateTask;
        }
      }

      return bestMatch;
    } catch (error) {
      console.error('Error finding similar task:', error);
      return null;
    }
  }

  /**
   * Get tasks with search options
   */
  async searchTasks(options: TaskSearchOptions = {}): Promise<StoredTask[]> {
    try {
      const tasks = await this.getAllTasks();
      let taskList = Object.values(tasks);

      // Apply filters
      if (options.status) {
        taskList = taskList.filter(task => task.status === options.status);
      }

      if (options.tabId !== undefined) {
        taskList = taskList.filter(task => task.tabId === options.tabId);
      }

      // Sort
      const sortBy = options.sortBy || 'createdAt';
      const sortOrder = options.sortOrder || 'desc';
      
      taskList.sort((a, b) => {
        const aValue = a[sortBy] || 0;
        const bValue = b[sortBy] || 0;
        return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
      });

      // Apply pagination
      const offset = options.offset || 0;
      const limit = options.limit || taskList.length;
      
      return taskList.slice(offset, offset + limit);
    } catch (error) {
      console.error('Error searching tasks:', error);
      return [];
    }
  }

  /**
   * Get task history for a specific tab
   */
  async getTaskHistory(tabId: number, limit: number = 50): Promise<StoredTask[]> {
    return this.searchTasks({
      tabId,
      limit,
      sortBy: 'createdAt',
      sortOrder: 'desc'
    });
  }

  /**
   * Delete a task
   */
  async deleteTask(taskId: string): Promise<void> {
    try {
      const tasks = await this.getAllTasks();
      delete tasks[taskId];
      
      await chrome.storage.local.set({
        [TaskStorageService.STORAGE_KEY]: tasks
      });

      console.log(`Task ${taskId} deleted`);
    } catch (error) {
      console.error('Error deleting task:', error);
      throw error;
    }
  }

  /**
   * Clear all tasks
   */
  async clearAllTasks(): Promise<void> {
    try {
      await chrome.storage.local.set({
        [TaskStorageService.STORAGE_KEY]: {}
      });
      console.log('All tasks cleared');
    } catch (error) {
      console.error('Error clearing tasks:', error);
      throw error;
    }
  }

  /**
   * Get all tasks from storage
   */
  private async getAllTasks(): Promise<Record<string, StoredTask>> {
    try {
      const result = await chrome.storage.local.get(TaskStorageService.STORAGE_KEY);
      return result[TaskStorageService.STORAGE_KEY] || {};
    } catch (error) {
      console.error('Error getting all tasks:', error);
      return {};
    }
  }

  /**
   * Clean up old completed tasks to prevent storage bloat
   */
  private async cleanupOldTasks(tasks: Record<string, StoredTask>): Promise<void> {
    const taskList = Object.values(tasks);
    
    if (taskList.length <= TaskStorageService.MAX_TASKS) {
      return;
    }

    // Sort by completion time, keeping most recent
    const completedTasks = taskList
      .filter(task => task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled')
      .sort((a, b) => (b.completedAt || b.updatedAt || 0) - (a.completedAt || a.updatedAt || 0));

    // Keep only the most recent completed tasks
    const tasksToKeep = TaskStorageService.MAX_TASKS * 0.8; // Keep 80% of max
    const tasksToDelete = completedTasks.slice(tasksToKeep);

    for (const task of tasksToDelete) {
      delete tasks[task.id];
    }

    console.log(`Cleaned up ${tasksToDelete.length} old tasks`);
  }

  /**
   * Calculate similarity between two task strings
   */
  private calculateSimilarity(str1: string, str2: string): number {
    // Simple similarity calculation using Levenshtein distance
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) {
      return 1.0;
    }

    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Get task statistics
   */
  async getTaskStats(): Promise<{
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
    cancelled: number;
  }> {
    try {
      const tasks = await this.getAllTasks();
      const taskList = Object.values(tasks);

      return {
        total: taskList.length,
        pending: taskList.filter(t => t.status === 'pending').length,
        running: taskList.filter(t => t.status === 'running').length,
        completed: taskList.filter(t => t.status === 'completed').length,
        failed: taskList.filter(t => t.status === 'failed').length,
        cancelled: taskList.filter(t => t.status === 'cancelled').length,
      };
    } catch (error) {
      console.error('Error getting task stats:', error);
      return {
        total: 0,
        pending: 0,
        running: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
      };
    }
  }
}
