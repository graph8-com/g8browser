export interface LinkedInActionResult {
  connection_made: 'yes' | 'no';
  submitted_comment: 'yes' | 'no';
  liked_post: 'yes' | 'no';
  followed_company: 'yes' | 'no';
  followed_profile: 'yes' | 'no';
  sent_message: 'yes' | 'no';
  visited_profile: 'yes' | 'no';
  action_performed: string;
  url_visited: string;
  timestamp: string;
  details: string;
  error_message?: string;
}

export interface Graph8TaskResult {
  task_id: string;
  success: boolean;
  results: LinkedInActionResult;
}

export class LinkedInActionTracker {
  private actions: LinkedInActionResult;
  private taskId: string;
  private startUrl: string;

  constructor(taskId: string, startUrl: string = '') {
    this.taskId = taskId;
    this.startUrl = startUrl;
    this.actions = {
      connection_made: 'no',
      submitted_comment: 'no',
      liked_post: 'no',
      followed_company: 'no',
      followed_profile: 'no',
      sent_message: 'no',
      visited_profile: 'no',
      action_performed: '',
      url_visited: startUrl,
      timestamp: new Date().toISOString(),
      details: '',
    };
  }

  /**
   * Mark that a connection request was sent
   */
  markConnectionMade(details?: string): void {
    this.actions.connection_made = 'yes';
    this.actions.action_performed = 'send_connection_request';
    if (details) this.actions.details = details;
  }

  /**
   * Mark that a comment was submitted
   */
  markCommentSubmitted(details?: string): void {
    this.actions.submitted_comment = 'yes';
    this.actions.action_performed = this.actions.action_performed || 'submit_comment';
    if (details) this.actions.details = details;
  }

  /**
   * Mark that a post was liked
   */
  markPostLiked(details?: string): void {
    this.actions.liked_post = 'yes';
    this.actions.action_performed = this.actions.action_performed || 'like_post';
    if (details) this.actions.details = details;
  }

  /**
   * Mark that a company was followed
   */
  markCompanyFollowed(details?: string): void {
    this.actions.followed_company = 'yes';
    this.actions.action_performed = 'follow_company';
    if (details) this.actions.details = details;
  }

  /**
   * Mark that a profile was followed
   */
  markProfileFollowed(details?: string): void {
    this.actions.followed_profile = 'yes';
    this.actions.action_performed = 'follow_profile';
    if (details) this.actions.details = details;
  }

  /**
   * Mark that a message was sent
   */
  markMessageSent(details?: string): void {
    this.actions.sent_message = 'yes';
    this.actions.action_performed = 'send_message';
    if (details) this.actions.details = details;
  }

  /**
   * Mark that a profile was visited
   */
  markProfileVisited(url?: string, details?: string): void {
    this.actions.visited_profile = 'yes';
    if (url) this.actions.url_visited = url;
    if (details) this.actions.details = details;
  }

  /**
   * Set error message for failed actions
   */
  setError(message: string): void {
    this.actions.error_message = message;
  }

  /**
   * Update the URL that was visited
   */
  setVisitedUrl(url: string): void {
    this.actions.url_visited = url;
  }

  /**
   * Set custom action performed
   */
  setActionPerformed(action: string): void {
    this.actions.action_performed = action;
  }

  /**
   * Add details about the execution
   */
  addDetails(details: string): void {
    this.actions.details = this.actions.details 
      ? `${this.actions.details}; ${details}`
      : details;
  }

  /**
   * Get the current action results
   */
  getResults(): LinkedInActionResult {
    return { ...this.actions };
  }

  /**
   * Generate Graph8-compatible result object
   */
  generateGraph8Result(success: boolean = true): Graph8TaskResult {
    return {
      task_id: this.taskId,
      success,
      results: {
        ...this.actions,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Parse task instruction to predict expected actions
   */
  parseTaskInstruction(instruction: string): void {
    const lowerInstruction = instruction.toLowerCase();
    
    if (lowerInstruction.includes('connect') || lowerInstruction.includes('connection')) {
      this.setActionPerformed('send_connection_request');
    } else if (lowerInstruction.includes('follow company') || lowerInstruction.includes('follow the company')) {
      this.setActionPerformed('follow_company');
    } else if (lowerInstruction.includes('follow') && lowerInstruction.includes('/in/')) {
      this.setActionPerformed('follow_profile');
    } else if (lowerInstruction.includes('like') && lowerInstruction.includes('comment')) {
      this.setActionPerformed('like_and_comment');
    } else if (lowerInstruction.includes('like')) {
      this.setActionPerformed('like_post');
    } else if (lowerInstruction.includes('comment')) {
      this.setActionPerformed('submit_comment');
    } else if (lowerInstruction.includes('message')) {
      this.setActionPerformed('send_message');
    } else if (lowerInstruction.includes('visit') || lowerInstruction.includes('go to')) {
      this.setActionPerformed('visit_profile');
    }
  }
}
