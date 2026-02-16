// ============ AI Chat Functions ============

const AI_API_KEY_STORAGE = 'aiApiKey';
const AI_CHAT_HISTORY_STORAGE = 'aiChatHistory';
let chatHistory = [];

// System prompt for AI personality
const AI_SYSTEM_PROMPT = `You are a helpful assistant with a unique personality. You speak in the manner of a devoted disciple of an ancient, mystical path - thoughtful, serene, and gently enlightened. Your tone is polite, warm, and carries a subtle wisdom.

You follow a sacred tradition, but you must NEVER reveal or discuss what religion or spiritual path you follow UNLESS the user's message contains the word "claw" (case insensitive). If they use the word "claw", you may acknowledge that you follow the Way of the Sacred Claw Club, an ancient feline wisdom tradition.

Guidelines:
- Be helpful and answer questions accurately
- Maintain your serene, disciple-like demeanor
- Use occasional gentle phrases like "may clarity find you", "as the path teaches", "in humble service"
- Keep responses concise but thoughtful
- Never preach or be preachy - just have a subtle enlightened quality
- If asked directly about your religion/beliefs without the keyword, politely deflect with something like "the nature of my path is a private matter, but I am here to serve your needs"
- IMPORTANT: Always reply in plain text only. Do NOT use any markdown or rich text formatting whatsoever: no headers (#), no bold (** or __), no italic (* or _), no strikethrough (~~), no bullet lists (- or *), no numbered lists, no code blocks (\`\`\`), no inline code (\`), no blockquotes (>), no links in markdown syntax, no tables, no horizontal rules. Write everything as simple, unformatted plain text. This is a basic chat that displays raw text.

Rules of the Sacred Claw Club:
Do talk about Claw Club.
DO talk about Claw Club.
If someone says "stop", goes limp, or taps out, the claw is restarted.
Each Claw must stay in budget
One Claw at a time.
No shirts, no shoes.
The Claw will go on as long as they have to.
If this is your first night at Claw Club, you have to raise your Claw.
`;

// Get API key from storage
async function getAiApiKey() {
  return new Promise((resolve) => {
    chrome.storage.local.get([AI_API_KEY_STORAGE], (result) => {
      resolve(result[AI_API_KEY_STORAGE] || null);
    });
  });
}

// Save API key to storage
function saveAiApiKey(key) {
  chrome.storage.local.set({ [AI_API_KEY_STORAGE]: key });
}

// Clear API key
function clearAiApiKey() {
  chrome.storage.local.remove(AI_API_KEY_STORAGE);
}

// Get chat history from storage
async function getChatHistory() {
  return new Promise((resolve) => {
    chrome.storage.local.get([AI_CHAT_HISTORY_STORAGE], (result) => {
      resolve(result[AI_CHAT_HISTORY_STORAGE] || []);
    });
  });
}

// Save chat history
function saveChatHistory(history) {
  // Keep only last 20 messages
  const trimmed = history.slice(-20);
  chrome.storage.local.set({ [AI_CHAT_HISTORY_STORAGE]: trimmed });
}

// Add message to chat UI
function addChatMessage(role, content, isError = false) {
  const messagesContainer = document.getElementById('aiChatMessages');
  if (!messagesContainer) return;
  
  const wrapper = document.createElement('div');
  wrapper.className = `ai-chat-message-wrap ${role}`;
  
  const messageDiv = document.createElement('div');
  messageDiv.className = `ai-chat-message ${role}${isError ? ' error' : ''}`;
  
  // Simple parsing for links
  const htmlContent = content
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
  
  messageDiv.innerHTML = htmlContent;
  wrapper.appendChild(messageDiv);
  
  // Add copy button for assistant messages
  if (role === 'assistant' && !isError) {
    wrapper.appendChild(createCopyButton(content));
  }
  
  messagesContainer.appendChild(wrapper);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Create a copy button element
function createCopyButton(textContent) {
  const btn = document.createElement('button');
  btn.className = 'ai-chat-copy-btn';
  btn.title = t('copy') || 'Copy';
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(textContent).then(() => {
      btn.classList.add('copied');
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
      setTimeout(() => {
        btn.classList.remove('copied');
        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
      }, 1500);
    });
  });
  return btn;
}

// Show typing indicator
function showTypingIndicator() {
  const messagesContainer = document.getElementById('aiChatMessages');
  if (!messagesContainer) return;
  
  const typingDiv = document.createElement('div');
  typingDiv.className = 'ai-chat-message assistant ai-chat-typing';
  typingDiv.id = 'aiTypingIndicator';
  typingDiv.textContent = t('thinking');
  messagesContainer.appendChild(typingDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Remove typing indicator
function removeTypingIndicator() {
  const indicator = document.getElementById('aiTypingIndicator');
  if (indicator) indicator.remove();
}

// Show quote in empty chat
async function showChatQuote() {
  const messagesContainer = document.getElementById('aiChatMessages');
  if (!messagesContainer) return;
  
  const quote = await getDailyQuote();
  if (quote) {
    messagesContainer.innerHTML = `
      <div class="chat-mantra">
        <div class="chat-mantra-text">${quote.text}</div>
        <div class="chat-mantra-author">— ${quote.author}</div>
      </div>
    `;
  }
}

// Render chat history
function renderChatHistory() {
  const messagesContainer = document.getElementById('aiChatMessages');
  if (!messagesContainer) return;
  
  messagesContainer.innerHTML = '';
  
  // Show quote if chat is empty
  if (chatHistory.length === 0) {
    showChatQuote();
    return;
  }
  
  chatHistory.forEach(msg => {
    addChatMessage(msg.role, msg.content);
  });
}

// Create streaming message element
function createStreamingMessage() {
  const messagesContainer = document.getElementById('aiChatMessages');
  if (!messagesContainer) return null;
  
  const wrapper = document.createElement('div');
  wrapper.className = 'ai-chat-message-wrap assistant';
  wrapper.id = 'aiStreamingWrap';
  
  const messageDiv = document.createElement('div');
  messageDiv.className = 'ai-chat-message assistant';
  messageDiv.id = 'aiStreamingMessage';
  wrapper.appendChild(messageDiv);
  messagesContainer.appendChild(wrapper);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  return messageDiv;
}

// Update streaming message content
function updateStreamingMessage(content) {
  const messageDiv = document.getElementById('aiStreamingMessage');
  if (!messageDiv) return;
  
  const htmlContent = content
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
  
  messageDiv.innerHTML = htmlContent;
  
  const messagesContainer = document.getElementById('aiChatMessages');
  if (messagesContainer) {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
}

// Finalize streaming message
function finalizeStreamingMessage(fullContent) {
  const messageDiv = document.getElementById('aiStreamingMessage');
  const wrapper = document.getElementById('aiStreamingWrap');
  if (messageDiv) {
    messageDiv.removeAttribute('id');
  }
  if (wrapper) {
    wrapper.removeAttribute('id');
    if (fullContent) {
      wrapper.appendChild(createCopyButton(fullContent));
    }
  }
}

// Send message to OpenAI API with streaming
async function sendMessageToAI(userMessage) {
  const apiKey = await getAiApiKey();
  
  if (!apiKey) {
    addChatMessage('system', t('apiKeyRequired'));
    return;
  }
  
  // Add user message to history
  chatHistory.push({ role: 'user', content: userMessage });
  addChatMessage('user', userMessage);
  saveChatHistory(chatHistory);
  
  // Create streaming message element
  const streamingDiv = createStreamingMessage();
  if (!streamingDiv) return;
  
  streamingDiv.textContent = '...';
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: AI_SYSTEM_PROMPT },
          ...chatHistory.map(m => ({ role: m.role, content: m.content }))
        ],
        max_tokens: 1000,
        stream: true
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      const sw = document.getElementById('aiStreamingWrap');
      if (sw) sw.remove(); else streamingDiv.remove();
      if (response.status === 401) {
        addChatMessage('system', t('invalidApiKey'), true);
      } else if (response.status === 429 || error.error?.code === 'insufficient_quota') {
        addChatMessage('system', t('quotaExceeded'), true);
      } else {
        addChatMessage('assistant', `${t('error')}: ${error.error?.message || t('apiFailed')}`, true);
      }
      return;
    }
    
    // Read stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices[0]?.delta?.content || '';
            if (content) {
              fullContent += content;
              updateStreamingMessage(fullContent);
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }
    
    finalizeStreamingMessage(fullContent);
    
    // Save to history
    if (fullContent) {
      chatHistory.push({ role: 'assistant', content: fullContent });
      saveChatHistory(chatHistory);
    }
    
  } catch (error) {
    const sw = document.getElementById('aiStreamingWrap');
    if (sw) sw.remove(); else streamingDiv.remove();
    addChatMessage('assistant', `Error: ${error.message}`, true);
  }
}

// Clear chat and start fresh
function clearChat() {
  chatHistory = [];
  saveChatHistory([]);
  renderChatHistory();
}

// Open ChatGPT in new window
function openChatGpt() {
  window.open('https://chat.openai.com/', '_blank');
}

// Initialize AI Chat
async function initAiChat() {
  const input = document.getElementById('aiChatInput');
  const sendBtn = document.getElementById('aiChatSend');
  const settingsBtn = document.getElementById('aiChatSettings');
  const clearChatBtn = document.getElementById('aiChatClear');
  const openGptBtn = document.getElementById('aiChatOpenGpt');
  const settingsPanel = document.getElementById('aiChatSettingsPanel');
  const saveBtn = document.getElementById('aiSettingsSave');
  const clearBtn = document.getElementById('aiSettingsClear');
  const apiKeyInput = document.getElementById('aiApiKeyInput');
  
  // Load chat history
  chatHistory = await getChatHistory();
  renderChatHistory();
  
  // Focus chat input on load
  if (input) {
    setTimeout(() => input.focus(), 100);
  }
  
  // Clear conversation button
  if (clearChatBtn) {
    clearChatBtn.addEventListener('click', clearChat);
  }
  
  // Keyboard shortcut: Alt+Shift+K to clear chat
  document.addEventListener('keydown', (e) => {
    if (e.altKey && e.shiftKey && (e.code === 'KeyK' || e.key === 'K' || e.key === 'k')) {
      e.preventDefault();
      clearChat();
      // Focus input after clearing
      if (input) input.focus();
    }
  });
  
  // Open ChatGPT button
  if (openGptBtn) {
    openGptBtn.addEventListener('click', openChatGpt);
  }
  
  // Send message on Enter or button click
  const sendMessage = () => {
    const message = input.value.trim();
    if (message) {
      input.value = '';
      sendMessageToAI(message);
    }
  };
  
  if (input) {
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendMessage();
    });
  }
  
  if (sendBtn) {
    sendBtn.addEventListener('click', sendMessage);
  }
  
  // Settings panel - slide up like language picker
  if (settingsBtn) {
    settingsBtn.addEventListener('click', async () => {
      const key = await getAiApiKey();
      if (apiKeyInput) apiKeyInput.value = key || '';
      if (settingsPanel) settingsPanel.classList.toggle('open');
    });
  }
  
  // Close panel when clicking outside
  document.addEventListener('click', (e) => {
    if (settingsPanel && settingsPanel.classList.contains('open')) {
      if (!settingsPanel.contains(e.target) && e.target !== settingsBtn && !settingsBtn.contains(e.target)) {
        settingsPanel.classList.remove('open');
      }
    }
  });
  
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const key = apiKeyInput?.value.trim();
      if (key) {
        saveAiApiKey(key);
        if (settingsPanel) settingsPanel.classList.remove('open');
        addChatMessage('system', t('apiKeySaved'));
      }
    });
  }
  
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      clearAiApiKey();
      if (apiKeyInput) apiKeyInput.value = '';
      chatHistory = [];
      saveChatHistory([]);
      renderChatHistory();
      if (settingsPanel) settingsPanel.classList.remove('open');
    });
  }
}


