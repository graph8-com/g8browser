# Graph8 Browser Extension - Complete Graph8 Sequencer Integration

## 🌐 Graph8 Chrome Extension

Graph8 is a powerful browser extension that provides seamless integration with the Graph8 Sequencer platform for automated web task execution and LinkedIn action tracking.

**🎉 INTEGRATION STATUS: COMPLETE ✅**

- **Graph8 Sequencer Integration** - Full WebSocket and webhook support for real-time task execution
- **LinkedIn Action Tracking** - Comprehensive detection and reporting of 7 LinkedIn action types
- **Privacy-Focused** - Everything runs in your local browser. Your credentials stay with you, never shared with any cloud service.
- **Flexible LLM Options** - Connect to your preferred LLM providers with the freedom to choose different models for different agents.
- **Enterprise-Ready** - Production-ready with robust error handling, retry mechanisms, and security features.

> **Note:** We currently support OpenAI, Anthropic, Gemini, Ollama and custom OpenAI-Compatible providers, more providers will be supported.

## 📊 Key Features

### Core Extension Features
- **Multi-agent System**: Specialized AI agents collaborate to accomplish complex web workflows
- **Interactive Side Panel**: Intuitive chat interface with real-time status updates
- **Task Automation**: Seamlessly automate repetitive web automation tasks across websites
- **Follow-up Questions**: Ask contextual follow-up questions about completed tasks
- **Conversation History**: Easily access and manage your AI agent interaction history
- **Multiple LLM Support**: Connect your preferred LLM providers and assign different models to different agents

### Graph8 Sequencer Integration Features ⭐
- **Real-time WebSocket Communication**: Instant task reception and result reporting
- **LinkedIn Action Tracking**: Detects and tracks 7 LinkedIn action types:
  - Connection requests and acceptances
  - Post comments and likes
  - Company and profile follows
  - Direct messages
  - Profile visits
- **Task ID Management**: Reusable task IDs for efficient workflow management
- **Structured Result Reporting**: Graph8-compatible JSON format with detailed action metrics
- **Webhook Fallback**: HTTP-based communication with retry mechanisms
- **Configuration UI**: User-friendly setup for WebSocket and webhook connections
- **Connection Status Monitoring**: Real-time status indicators and health checks
- **Enterprise Security**: Bearer token authentication and secure communications

## 🚀 Quick Start

### Standard Installation

1. **Download**
    * Download the latest `graph8.zip` file from the official Github [release page](https://github.com/graph8-com/graph8/releases).

2. **Install**:
    * Unzip `graph8.zip`.
    * Open `chrome://extensions/` in Chrome
    * Enable `Developer mode` (top right)
    * Click `Load unpacked` (top left)
    * Select the unzipped `graph8` folder.

3. **Configure Agent Models**
    * Click the Graph8 icon in your toolbar to open the sidebar
    * Click the `Settings` icon (top right).
    * Add your LLM API keys.
    * Choose which model to use for different agents (Navigator, Planner, Validator)

4. **Configure Graph8 Sequencer** (Optional)
    * Click the Graph8 configuration icon in the side panel
    * Enter your Graph8 Sequencer WebSocket URL and authentication token
    * Test the connection and save configuration
    * Monitor connection status via the indicator in the side panel

5. **Upgrading**:
    * Download the latest `graph8.zip` file from the release page.
    * Unzip and replace your existing Graph8 files with the new ones.
    * Go to `chrome://extensions/` in Chrome and click the refresh icon on the Graph8 card.

## 🛠️ Build from Source

If you prefer to build Graph8 yourself, follow these steps:

1. **Prerequisites**:
   * [Node.js](https://nodejs.org/) (v22.12.0 or higher)
   * [pnpm](https://pnpm.io/installation) (v9.15.1 or higher)

2. **Clone the Repository**:
   ```bash
   git clone https://github.com/graph8-com/graph8.git
   cd graph8
   ```

3. **Install Dependencies**:
   ```bash
   pnpm install
   ```

4. **Build the Extension**:
   ```bash
   pnpm build
   ```

5. **Load the Extension**:
   * The built extension will be in the `dist` directory
   * Follow the installation steps from the Manually Install section to load the extension into your browser

6. **Development Mode** (optional):
   ```bash
   pnpm dev
   ```

## 🤖 Choosing Your Models

Graph8 allows you to configure different LLM models for each agent to balance performance and cost. Here are recommended configurations:

### Better Performance
- **Planner & Validator**: Claude 3.7 Sonnet
  - Better reasoning and planning capabilities
  - More reliable task validation
- **Navigator**: Claude 3.5 Haiku
  - Efficient for web navigation tasks
  - Good balance of performance and cost

### Cost-Effective Configuration
- **Planner & Validator**: Claude Haiku or GPT-4o
  - Reasonable performance at lower cost
  - May require more iterations for complex tasks
- **Navigator**: Gemini 2.0 Flash or GPT-4o-mini
  - Lightweight and cost-efficient
  - Suitable for basic navigation tasks

### Local Models
- **Setup Options**:
  - Use Ollama or other custom OpenAI-compatible providers to run models locally
  - Zero API costs and complete privacy with no data leaving your machine

- **Recommended Models**:
  - **Falcon3 10B**
  - **Qwen 2.5 Coder 14B**
  - **Mistral Small 24B**

- **Prompt Engineering**:
  - Local models require more specific and cleaner prompts
  - Avoid high-level, ambiguous commands
  - Break complex tasks into clear, detailed steps
  - Provide explicit context and constraints

> **Note**: The cost-effective configuration may produce less stable outputs and require more iterations for complex tasks.

## 💡 See It In Action

Here are some powerful tasks you can accomplish with just a sentence:

1. **News Summary**:
   > "Go to TechCrunch and extract top 10 headlines from the last 24 hours"

2. **GitHub Research**:
   > "Look for the trending Python repositories on GitHub with most stars"

3. **Shopping Research**:
   > "Find a portable Bluetooth speaker on Amazon with a water-resistant design, under $50. It should have a minimum battery life of 10 hours"

## 👏 Acknowledgments

Graph8 builds on top of other awesome open-source projects:

- [Browser Use](https://github.com/browser-use/browser-use)
- [Puppeteer](https://github.com/EmergenceAI/Agent-E)
- [Chrome Extension Boilerplate](https://github.com/Jonghakseo/chrome-extension-boilerplate-react-vite)
- [LangChain](https://github.com/langchain-ai/langchainjs)

Huge thanks to their creators and contributors!

## 📄 License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

Made with ❤️ by the Graph8 Team.
