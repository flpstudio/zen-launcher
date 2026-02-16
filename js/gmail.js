// ============ Gmail Functions ============

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';
const MAX_EMAILS = 10;

// Get OAuth token (never interactive — sign-in only via explicit user action)
async function getAuthToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: false }, (token) => {
      if (chrome.runtime.lastError) {
        console.error('Auth error:', chrome.runtime.lastError);
        reject(new Error(chrome.runtime.lastError.message));
      } else if (!token) {
        reject(new Error('No token received'));
      } else {
        resolve(token);
      }
    });
  });
}

// Remove cached token (for re-auth)
async function removeCachedToken(token) {
  return new Promise((resolve) => {
    chrome.identity.removeCachedAuthToken({ token }, resolve);
  });
}

// Fetch from Gmail API
async function gmailFetch(endpoint, token) {
  const response = await fetch(`${GMAIL_API_BASE}${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (!response.ok) {
    const errorBody = await response.text();
    console.error('Gmail API error response:', errorBody);
    
    if (response.status === 401) {
      // Token expired, remove it
      await removeCachedToken(token);
      throw new Error('TOKEN_EXPIRED');
    }
    if (response.status === 403) {
      throw new Error('Gmail API not enabled or access denied. Enable it at console.cloud.google.com');
    }
    throw new Error(`Gmail API error ${response.status}: ${errorBody}`);
  }
  
  return response.json();
}

// Parse email header value
function getHeader(headers, name) {
  const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
  return header ? header.value : '';
}

// Parse sender name from "Name <email>" format
function parseSenderName(from) {
  const match = from.match(/^(.+?)\s*<.+>$/);
  return match ? match[1].replace(/"/g, '') : from;
}

// Fetch emails from Gmail
async function fetchEmails(token) {
  // Get list of message IDs - only from Inbox
  const listResponse = await gmailFetch(
    `/messages?maxResults=${MAX_EMAILS}&labelIds=INBOX`,
    token
  );
  
  if (!listResponse.messages || listResponse.messages.length === 0) {
    return [];
  }
  
  // Fetch each message's metadata
  const emails = await Promise.all(
    listResponse.messages.map(async (msg) => {
      const msgData = await gmailFetch(
        `/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`,
        token
      );
      
      const headers = msgData.payload.headers;
      const isUnread = msgData.labelIds.includes('UNREAD');
      
      return {
        id: msgData.id,
        threadId: msgData.threadId,
        subject: getHeader(headers, 'Subject') || t('noSubject'),
        from: parseSenderName(getHeader(headers, 'From')),
        snippet: msgData.snippet,
        isUnread
      };
    })
  );
  
  return emails;
}

// Render emails to the UI
function renderEmails(emails) {
  const content = document.getElementById('gmailContent');
  
  if (emails.length === 0) {
    content.innerHTML = `<div class="gmail-empty">${t('noEmailsInbox')}</div>`;
    return;
  }
  
  content.innerHTML = emails.map(email => `
    <div class="email-item ${email.isUnread ? 'unread' : ''}" data-id="${email.id}" data-thread="${email.threadId}">
      <div class="email-item-content">
        <div class="email-first-line">
          ${email.isUnread ? '<span class="email-unread-dot"></span>' : ''}
          <span class="email-from">${escapeHtml(email.from)}</span>
          <span class="email-subject">${escapeHtml(email.subject)}</span>
        </div>
        <div class="email-preview">${escapeHtml(email.snippet)}</div>
      </div>
      <button class="email-open-btn" data-thread="${email.threadId}" title="${t('openInGmail')}">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>
      </button>
    </div>
  `).join('');
  
  // Add click handlers to open email preview modal
  content.querySelectorAll('.email-item').forEach(item => {
    item.querySelector('.email-item-content').addEventListener('click', () => {
      openEmailPreview(item.dataset.id, item.dataset.thread);
    });
    item.querySelector('.email-open-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      window.open(`https://mail.google.com/mail/u/0/#inbox/${item.dataset.thread}`, 'gmail');
    });
  });
}

// ============ Email Preview Modal ============

// Fetch full email message with body
async function fetchFullEmail(messageId, token) {
  const msg = await gmailFetch(`/messages/${messageId}?format=full`, token);
  return msg;
}

// Decode base64url-encoded string
function decodeBase64Url(str) {
  if (!str) return '';
  // Replace base64url chars with standard base64
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  try {
    return decodeURIComponent(
      atob(base64).split('').map(c =>
        '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
      ).join('')
    );
  } catch (e) {
    try {
      return atob(base64);
    } catch (e2) {
      return '';
    }
  }
}

// Extract body from message payload (recursive for multipart)
function extractBody(payload) {
  let html = '';
  let text = '';

  if (payload.mimeType === 'text/html' && payload.body && payload.body.data) {
    html = decodeBase64Url(payload.body.data);
  } else if (payload.mimeType === 'text/plain' && payload.body && payload.body.data) {
    text = decodeBase64Url(payload.body.data);
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      const result = extractBody(part);
      if (result.html) html = result.html;
      if (result.text && !text) text = result.text;
    }
  }

  return { html, text };
}

// Extract attachments info from message payload (recursive)
function extractAttachments(payload, list = []) {
  if (payload.filename && payload.filename.length > 0 && payload.body) {
    list.push({
      filename: payload.filename,
      mimeType: payload.mimeType,
      size: payload.body.size || 0
    });
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      extractAttachments(part, list);
    }
  }
  return list;
}

// Format file size
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// Open email preview modal
async function openEmailPreview(messageId, threadId) {
  const modal = document.getElementById('emailModal');
  const subjectEl = document.getElementById('emailModalSubject');
  const metaEl = document.getElementById('emailModalMeta');
  const attachEl = document.getElementById('emailModalAttachments');
  const bodyEl = document.getElementById('emailModalBody');

  // Show modal with loading state
  subjectEl.textContent = t('loading');
  metaEl.innerHTML = '';
  attachEl.innerHTML = '';
  attachEl.classList.remove('has-attachments');
  bodyEl.innerHTML = `<div class="gmail-loading">${t('loadingEmail')}</div>`;
  modal.classList.add('visible');

  // Store current email context for action buttons
  modal.dataset.messageId = messageId;
  modal.dataset.threadId = threadId;

  try {
    const token = await getAuthToken();
    const msg = await fetchFullEmail(messageId, token);
    const headers = msg.payload.headers;

    const subject = getHeader(headers, 'Subject') || t('noSubject');
    const from = getHeader(headers, 'From');
    const to = getHeader(headers, 'To');
    const cc = getHeader(headers, 'Cc');
    const date = getHeader(headers, 'Date');

    // Subject
    subjectEl.textContent = subject;

    // Meta (addresses, date)
    let metaHtml = '';
    metaHtml += `<div class="meta-row"><span class="meta-label">${t('metaFrom')}</span><span class="meta-value">${escapeHtml(from)}</span></div>`;
    metaHtml += `<div class="meta-row"><span class="meta-label">${t('metaTo')}</span><span class="meta-value">${escapeHtml(to)}</span></div>`;
    if (cc) {
      metaHtml += `<div class="meta-row"><span class="meta-label">${t('metaCc')}</span><span class="meta-value">${escapeHtml(cc)}</span></div>`;
    }
    if (date) {
      try {
        const d = new Date(date);
        metaHtml += `<div class="meta-row"><span class="meta-label">${t('metaDate')}</span><span class="meta-value">${d.toLocaleString()}</span></div>`;
      } catch (_) {
        metaHtml += `<div class="meta-row"><span class="meta-label">${t('metaDate')}</span><span class="meta-value">${escapeHtml(date)}</span></div>`;
      }
    }
    metaEl.innerHTML = metaHtml;

    // Attachments
    const attachments = extractAttachments(msg.payload);
    if (attachments.length > 0) {
      attachEl.classList.add('has-attachments');
      attachEl.innerHTML = attachments.map(a => `
        <span class="attachment-chip">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/></svg>
          ${escapeHtml(a.filename)} (${formatFileSize(a.size)})
        </span>
      `).join('');
    } else {
      attachEl.classList.remove('has-attachments');
      attachEl.innerHTML = '';
    }

    // Body
    const { html, text } = extractBody(msg.payload);
    if (html) {
      // Render HTML body in a sandboxed iframe
      const iframe = document.createElement('iframe');
      iframe.sandbox = 'allow-same-origin';
      iframe.style.width = '100%';
      iframe.style.border = 'none';
      iframe.style.borderRadius = '6px';
      iframe.style.background = 'white';
      iframe.style.minHeight = '200px';
      bodyEl.innerHTML = '';
      bodyEl.appendChild(iframe);

      iframe.addEventListener('load', () => {
        try {
          const doc = iframe.contentDocument;
          doc.open();
          doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;line-height:1.6;color:#222;margin:12px;word-break:break-word;}img{max-width:100%;height:auto;}a{color:#1a73e8;}pre,code{white-space:pre-wrap;word-break:break-all;}</style></head><body>${html}</body></html>`);
          doc.close();
          // Auto-resize iframe to content
          const resizeIframe = () => {
            const h = doc.documentElement.scrollHeight;
            iframe.style.height = (h + 20) + 'px';
          };
          resizeIframe();
          // Resize again after images load
          doc.querySelectorAll('img').forEach(img => {
            img.addEventListener('load', resizeIframe);
          });
        } catch (e) {
          console.error('Iframe write error:', e);
        }
      });

      // Trigger load by setting srcdoc fallback
      iframe.srcdoc = '<html></html>';
    } else if (text) {
      bodyEl.innerHTML = `<div class="email-text-body">${escapeHtml(text)}</div>`;
    } else {
      bodyEl.innerHTML = `<div class="email-text-body" style="opacity:0.5;">${t('noContent')}</div>`;
    }

  } catch (err) {
    console.error('Failed to load email preview:', err);
    bodyEl.innerHTML = `<div class="gmail-error">${t('failedLoadEmail')}: ${escapeHtml(err.message)}</div>`;
  }
}

// Close email modal
function closeEmailModal() {
  const modal = document.getElementById('emailModal');
  modal.classList.remove('visible');
  // Clear iframe to stop any loading
  const bodyEl = document.getElementById('emailModalBody');
  bodyEl.innerHTML = '';
}


// Initialize email preview modal event listeners
function initEmailPreview() {
  const modal = document.getElementById('emailModal');

  // Close button
  document.getElementById('emailModalClose').addEventListener('click', closeEmailModal);

  // Click backdrop to close
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeEmailModal();
  });

  // Keyboard shortcuts when modal is open
  document.addEventListener('keydown', (e) => {
    if (!modal.classList.contains('visible')) return;
    if (e.key === 'Escape') {
      closeEmailModal();
    }
  });

  // Open in Gmail button
  document.getElementById('emailOpenBtn').addEventListener('click', () => {
    const threadId = modal.dataset.threadId;
    if (threadId) {
      window.open(`https://mail.google.com/mail/u/0/#inbox/${threadId}`, 'gmail');
    }
  });
}

// Show error state
function showGmailError(message) {
  const content = document.getElementById('gmailContent');
  content.innerHTML = `<div class="gmail-error">${escapeHtml(message)}</div>`;
}

// Show loading state
function showGmailLoading() {
  const content = document.getElementById('gmailContent');
  content.innerHTML = `<div class="gmail-loading">${t('loadingEmails')}</div>`;
}

// Show sign-in button
function showSignIn() {
  const content = document.getElementById('gmailContent');
  content.innerHTML = '';
  document.getElementById('gmailSignIn').style.display = 'block';
}

// Hide sign-in button
function hideSignIn() {
  document.getElementById('gmailSignIn').style.display = 'none';
}

// Logout function - clears cached auth token
async function logoutGmail() {
  if (typeof chrome === 'undefined' || !chrome.identity) {
    console.error('chrome.identity not available');
    return;
  }
  
  try {
    // Get current token
    const token = await new Promise((resolve) => {
      chrome.identity.getAuthToken({ interactive: false }, (token) => {
        resolve(token);
      });
    });
    
    if (token) {
      // Revoke the token with Google
      await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`);
      
      // Remove cached token from Chrome
      chrome.identity.removeCachedAuthToken({ token: token }, () => {
        console.log('Logged out of Gmail');
      });
    }
    
    // Clear UI and show signed-out state
    const content = document.getElementById('gmailContent');
    content.innerHTML = '';
    
    // Clear meetings
    const meetingsSection = document.getElementById('meetingsSection');
    if (meetingsSection) {
      meetingsSection.innerHTML = '';
    }
    
    // Clear signed-in flag and show signed-out state
    chrome.storage.local.remove('googleSignedIn');
    showSignedOutState();
  } catch (error) {
    console.error('Logout error:', error);
  }
}

// Main Gmail load function (with stale-while-revalidate caching)
// forceRefresh: true = bypass cache (for manual refresh button)
async function loadGmail(forceRefresh = false) {
  const refreshBtn = document.getElementById('gmailRefresh');
  
  // Show cached data immediately if available (and not force refresh)
  if (!forceRefresh && hasCachedData('gmail')) {
    renderEmails(getCachedData('gmail'));
    
    // If cache is fresh, don't refetch
    if (isCacheFresh('gmail')) {
      return;
    }
    
    // Cache is stale, fetch in background (no spinner for background refresh)
    (async () => {
      try {
        const token = await getAuthToken();
        if (token) {
          const emails = await fetchEmails(token);
          setCacheData('gmail', emails);
          renderEmails(emails);
        }
      } catch (err) {
        console.log('Background Gmail refresh failed:', err);
      }
    })();
    return;
  }
  
  refreshBtn.classList.add('spinning');
  
  try {
    const token = await getAuthToken();
    console.log('Got auth token:', token ? 'yes' : 'no');
    if (!hasCachedData('gmail')) {
      showGmailLoading();
    }
    
    const emails = await fetchEmails(token);
    setCacheData('gmail', emails);
    renderEmails(emails);
  } catch (error) {
    console.error('Gmail error:', error);
    console.error('Error message:', error.message);
    
    if (error.message === 'TOKEN_EXPIRED') {
      // Token expired - show signed-out state, don't auto-prompt
      console.log('Token expired, showing signed-out state');
      showSignedOutState();
      return;
    }
    
    // Check for auth-related errors - show signed-out state
    if (error.message?.includes('OAuth2 not granted') || 
        error.message?.includes('user gesture') ||
        error.message?.includes('not signed in') ||
        error.message?.includes('invalid_client') ||
        error.message?.includes('The user did not approve') ||
        error.message?.includes('canceled') ||
        error.message?.includes('interaction required')) {
      showSignedOutState();
    } else {
      // Show detailed error for debugging
      const errorMsg = error.message || String(error);
      showGmailError(`Error: ${errorMsg}`);
    }
  } finally {
    refreshBtn.classList.remove('spinning');
  }
}

// Show signed-out state: hide meetings/gmail, show sign-in icon button
function showSignedOutState() {
  const panel = document.getElementById('calendarPanel');
  panel.classList.add('not-signed-in');
  const signInBtn = document.getElementById('googleSignInHover');
  const signOutBtn = document.getElementById('googleSignOutBtn');
  if (signInBtn) {
    signInBtn.style.display = 'flex';
    signInBtn.disabled = false;
    signInBtn.style.opacity = '';
  }
  if (signOutBtn) signOutBtn.style.display = 'none';
  // Always show footer when signed out (sign-in button visible)
  const footer = document.querySelector('.settings-modal-footer');
  if (footer) footer.style.display = '';
  // Re-evaluate column alignment (Gmail now hidden via CSS)
  reapplyColumnAlignments();
}

// Show signed-in state: hide sign-in, show sign-out with user name
function showSignedInState() {
  const panel = document.getElementById('calendarPanel');
  panel.classList.remove('not-signed-in');
  const signInBtn = document.getElementById('googleSignInHover');
  const signOutBtn = document.getElementById('googleSignOutBtn');
  if (signInBtn) signInBtn.style.display = 'none';
  if (signOutBtn) {
    signOutBtn.style.display = 'flex';
    // Fetch user info to display name/email
    fetchGoogleUserName();
  }
  // Keep footer visible (sign-out button shown)
  const footer = document.querySelector('.settings-modal-footer');
  if (footer) footer.style.display = '';
  hideSignIn();
  // Re-evaluate column alignment (Gmail now visible via CSS)
  reapplyColumnAlignments();
}

async function fetchGoogleUserName() {
  try {
    const token = await getAuthToken();
    if (!token) return;
    const resp = await fetch('https://www.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!resp.ok) return;
    const profile = await resp.json();
    const nameEl = document.getElementById('signoutUserName');
    if (nameEl && profile.emailAddress) {
      nameEl.textContent = profile.emailAddress;
    }
  } catch (err) {
    console.warn('[Auth] Failed to fetch OAuth user email:', err);
  }
}

// Initialize Google auth UI (always runs, even if gmail widget is disabled)
function initGoogleAuth() {
  if (typeof chrome === 'undefined' || !chrome.identity) return;

  // Sign-in button in settings footer
  const signInBtn = document.getElementById('googleSignInHover');
  if (signInBtn) {
    signInBtn.addEventListener('click', async () => {
      await forceReauth();
    });
  }

  // Sign-out button in settings footer
  const signOutBtn = document.getElementById('googleSignOutBtn');
  if (signOutBtn) {
    signOutBtn.addEventListener('click', () => {
      logoutGmail();
    });
  }

  // Check auth state and update footer buttons
  chrome.storage.local.get('googleSignedIn', (data) => {
    if (data.googleSignedIn) {
      chrome.identity.getAuthToken({ interactive: false }, (token) => {
        if (token) {
          showSignedInState();
        } else {
          chrome.storage.local.remove('googleSignedIn');
          showSignedOutState();
        }
      });
    } else {
      showSignedOutState();
    }
  });
}

// Initialize Gmail widget (only when gmail widget is enabled)
function initGmail() {
  // Check if chrome.identity is available
  if (typeof chrome === 'undefined' || !chrome.identity) {
    console.error('chrome.identity API not available');
    return;
  }
  
  // Load gmail data if already signed in
  chrome.storage.local.get('googleSignedIn', (data) => {
    if (data.googleSignedIn) {
      chrome.identity.getAuthToken({ interactive: false }, (token) => {
        if (token) {
          console.log('Found existing token, loading data...');
          loadGmail();
          loadMeetings();
        }
      });
    }
  });
  
  // Refresh button (force refresh to bypass cache)
  document.getElementById('gmailRefresh').addEventListener('click', () => {
    loadGmail(true);
  });
  
  // Auto-refresh Gmail every 30 seconds (silent background refresh)
  setInterval(async () => {
    // Only refresh if panel is in signed-in state
    const panel = document.getElementById('calendarPanel');
    if (panel && panel.classList.contains('not-signed-in')) return;
    if (!hasCachedData('gmail')) return;
    try {
      const token = await getAuthToken();
      if (token) {
        const emails = await fetchEmails(token);
        setCacheData('gmail', emails);
        renderEmails(emails);
        console.log('Gmail auto-refreshed');
      }
    } catch (err) {
      console.log('Gmail auto-refresh failed:', err);
    }
  }, 30 * 1000);
  
  // Legacy sign-in button (kept as fallback)
  document.getElementById('gmailSignIn').addEventListener('click', async () => {
    await forceReauth();
  });
  
  // Instant Meeting button
  document.getElementById('gmailMeet').addEventListener('click', () => {
    window.open('https://meet.google.com/new?hs=180&authuser=0', '_blank');
  });

  // Keyboard shortcut: Alt+Shift+M to open instant meeting
  document.addEventListener('keydown', (e) => {
    if (e.altKey && e.shiftKey && (e.code === 'KeyM' || e.key === 'M' || e.key === 'm')) {
      e.preventDefault();
      window.open('https://meet.google.com/new?hs=180&authuser=0', '_blank');
    }
  });
  
  // Auto-refresh every 5 minutes (only if signed in)
  setInterval(() => {
    const panel = document.getElementById('calendarPanel');
    if (panel && panel.classList.contains('not-signed-in')) return;
    if (hasCachedData('gmail')) {
      loadGmail();
    }
  }, 5 * 60 * 1000);
}

// Force re-authentication with all scopes
async function forceReauth() {
  if (typeof chrome === 'undefined' || !chrome.identity) {
    return;
  }
  
  // Disable sign-in button while connecting
  const signinBtn = document.getElementById('googleSignInHover');
  if (signinBtn) {
    signinBtn.style.opacity = '0.3';
    signinBtn.disabled = true;
  }
  
  try {
    // First, get any existing token
    const oldToken = await new Promise((resolve) => {
      chrome.identity.getAuthToken({ interactive: false }, (token) => {
        resolve(token);
      });
    });
    
    if (oldToken) {
      console.log('Revoking old token...');
      // Revoke with Google
      await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${oldToken}`);
      // Remove from Chrome
      await new Promise((resolve) => {
        chrome.identity.removeCachedAuthToken({ token: oldToken }, resolve);
      });
      console.log('Old token revoked');
    }
    
    // Now get a fresh token with interactive prompt
    console.log('Requesting fresh token with all scopes...');
    const newToken = await new Promise((resolve) => {
      chrome.identity.getAuthToken({ interactive: true }, (token) => {
        if (chrome.runtime.lastError) {
          console.error('Auth error:', chrome.runtime.lastError);
          resolve(null);
        } else {
          resolve(token);
        }
      });
    });
    
    if (newToken) {
      console.log('New token obtained, loading data...');
      chrome.storage.local.set({ googleSignedIn: true });
      showSignedInState();
      loadGmail();
      loadMeetings();
    } else {
      showSignedOutState();
    }
  } catch (error) {
    console.error('Re-auth error:', error);
    showSignedOutState();
  }
}

