// ============ Notes/Todo Widget ============

function initNotesTodo() {
  const widget = document.getElementById('notesTodoWidget');
  if (!widget) return;

  const tabs = widget.querySelectorAll('.nt-tab');
  const notesPanel = document.getElementById('ntNotesPanel');
  const todoPanel = document.getElementById('ntTodoPanel');
  const boardPanel = document.getElementById('ntBoardPanel');
  const notesArea = document.getElementById('ntNotesArea');
  const searchInput = document.getElementById('ntSearch');
  const todoList = document.getElementById('ntTodoList');
  const todoInput = document.getElementById('ntTodoInput');
  const todoDate = document.getElementById('ntTodoDate');
  const todoAddBtn = document.getElementById('ntTodoAddBtn');
  const boardInput = document.getElementById('ntBoardInput');
  const boardDate = document.getElementById('ntBoardDate');
  const boardAddBtn = document.getElementById('ntBoardAddBtn');

  let todos = [];
  let notesScrollTop = 0;
  let activeTab = 'notes';
  let searchQuery = '';

  const searchCount = document.getElementById('ntSearchCount');
  const notesHighlights = document.getElementById('ntNotesHighlights');
  let noteMatches = [];
  let currentMatchIndex = -1;

  // ---- Storage ----
  function loadNotes() {
    chrome.storage.local.get(['ntNotes', 'ntNotesScroll'], (data) => {
      if (data.ntNotes !== undefined) {
        notesArea.value = data.ntNotes;
      }
      if (data.ntNotesScroll !== undefined) {
        notesScrollTop = data.ntNotesScroll;
      }
      // Defer scroll restore — element may not be visible yet
      requestAnimationFrame(() => {
        notesArea.scrollTop = notesScrollTop;
      });
    });
  }

  function saveNotes() {
    chrome.storage.local.set({ ntNotes: notesArea.value });
  }

  function saveNotesScroll() {
    chrome.storage.local.set({ ntNotesScroll: notesArea.scrollTop });
  }

  function loadTodos() {
    chrome.storage.local.get('ntTodos', (data) => {
      if (data.ntTodos) {
        todos = data.ntTodos;
        renderTodos();
        renderBoard();
      }
    });
  }

  function saveTodos() {
    chrome.storage.local.set({ ntTodos: todos });
  }

  // ---- Tab switching ----
  function switchTab(tab) {
    activeTab = tab;
    chrome.storage.local.set({ ntActiveTab: tab });
    tabs.forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tab);
    });
    notesPanel.classList.toggle('active', tab === 'notes');
    todoPanel.classList.toggle('active', tab === 'todo');
    if (boardPanel) boardPanel.classList.toggle('active', tab === 'board');
    if (tab === 'notes') {
      requestAnimationFrame(() => {
        notesArea.scrollTop = notesScrollTop;
      });
    }
    if (tab === 'board') {
      renderBoard();
    }
  }

  tabs.forEach(t => {
    t.addEventListener('click', () => {
      switchTab(t.dataset.tab);
      doSearch();
    });
  });

  // ---- Notes ----
  let notesSaveTimeout = null;
  notesArea.addEventListener('input', () => {
    clearTimeout(notesSaveTimeout);
    notesSaveTimeout = setTimeout(saveNotes, 300);
    // Update highlight overlay if searching
    if (searchQuery && activeTab === 'notes') {
      findAllNoteMatches();
      currentMatchIndex = Math.min(currentMatchIndex, noteMatches.length - 1);
      if (currentMatchIndex < 0 && noteMatches.length > 0) currentMatchIndex = 0;
      updateNotesHighlightOverlay();
      updateSearchCount();
    }
  });

  notesArea.addEventListener('scroll', () => {
    notesScrollTop = notesArea.scrollTop;
    saveNotesScroll();
  });

  // ---- Todos ----
  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function formatDueDate(dateStr) {
    if (!dateStr) return '';
    const due = new Date(dateStr + 'T23:59:59');
    const now = new Date();
    const diffDays = Math.ceil((due - now) / (1000 * 60 * 60 * 24));

    const d = new Date(dateStr + 'T00:00:00');
    const month = d.toLocaleString('default', { month: 'short' });
    const day = d.getDate();
    const year = d.getFullYear();
    const currentYear = now.getFullYear();
    const label = year !== currentYear ? `${month} ${day}, ${year}` : `${month} ${day}`;

    if (diffDays < 0) return { label, cls: 'overdue', diffDays };
    if (diffDays <= 2) return { label, cls: 'soon', diffDays };
    return { label, cls: '', diffDays };
  }

  function addTodo(fromBoard) {
    const input = fromBoard ? boardInput : todoInput;
    const dateInput = fromBoard ? boardDate : todoDate;
    const text = input.value.trim();
    if (!text) return;
    todos.push({
      id: generateId(),
      text,
      due: dateInput.value || '',
      done: false,
      status: 'backlog',
      created: Date.now()
    });
    input.value = '';
    saveTodos();
    renderTodos();
    renderBoard();
    input.focus();
  }

  function toggleTodo(id) {
    const todo = todos.find(t => t.id === id);
    if (todo) {
      todo.done = !todo.done;
      todo.status = todo.done ? 'done' : 'todo';
      saveTodos();
      renderTodos();
      renderBoard();
    }
  }

  function deleteTodo(id) {
    todos = todos.filter(t => t.id !== id);
    saveTodos();
    renderTodos();
    renderBoard();
  }

  function renderTodos() {
    // Status priority: inprogress (highest) > todo > backlog (lowest)
    const STATUS_PRIORITY = { inprogress: 0, todo: 1, backlog: 2, done: 3 };

    // Sort: undone first, then by due date asc (no-date last),
    // then by status priority (in progress first), then by creation time
    const sorted = [...todos].sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      if (!a.done) {
        // Both undone: sort by due date first
        if (a.due && b.due) {
          const dateCmp = a.due.localeCompare(b.due);
          if (dateCmp !== 0) return dateCmp;
        } else if (a.due) return -1;
        else if (b.due) return 1;
        // Same date (or both no date): sort by status priority
        const pa = STATUS_PRIORITY[a.status || 'todo'] ?? 2;
        const pb = STATUS_PRIORITY[b.status || 'todo'] ?? 2;
        if (pa !== pb) return pa - pb;
      }
      return b.created - a.created;
    });

    // Hide done tasks from list view (they're visible on the board)
    const hideDone = sorted.filter(item => !item.done);
    const filtered = searchQuery
      ? hideDone.filter(t => t.text.toLowerCase().includes(searchQuery))
      : hideDone;

    if (filtered.length === 0) {
      todoList.innerHTML = searchQuery
        ? `<div style="opacity:0.3;font-size:0.72rem;padding:12px;text-align:center;">${t('noMatchingTasks')}</div>`
        : `<div style="opacity:0.3;font-size:0.72rem;padding:12px;text-align:center;">${t('noTasksYet')}</div>`;
      updateTodoBadge();
      return;
    }

    const STATUS_LABELS = { backlog: 'BL', todo: 'TD', inprogress: 'IP', done: 'DN' };
    const STATUS_FULL_LABELS = { backlog: t('backlog'), todo: t('toDo'), inprogress: t('inProgress'), done: t('done') };

    todoList.innerHTML = filtered.map(todo => {
      const due = formatDueDate(todo.due);
      const text = searchQuery ? highlightSearch(escapeHtml(todo.text), searchQuery) : escapeHtml(todo.text);
      const st = todo.status || 'todo';
      return `
        <div class="nt-todo-item ${todo.done ? 'done' : ''}" data-id="${todo.id}" data-status="${st}">
          <button class="nt-todo-check" data-action="toggle" data-id="${todo.id}" title="${t('markDone')}">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
          </button>
          <span class="nt-todo-text" data-action="edit-text" data-id="${todo.id}">${text}</span>
          <span class="nt-todo-due ${due ? due.cls : ''}" data-action="edit-date" data-id="${todo.id}" title="${t('clickChangeDate')}">${due ? due.label : `<span class="nt-todo-due-placeholder">${t('addDate')}</span>`}</span>
          <div class="nt-todo-status-dropdown" data-action="set-status" data-id="${todo.id}" data-status="${st}">
            <button class="nt-todo-status-btn" type="button">${STATUS_LABELS[st]}</button>
            <div class="nt-todo-status-menu">
              ${Object.entries(STATUS_FULL_LABELS).map(([val, label]) => `
                <div class="nt-todo-status-option ${val === st ? 'active' : ''}" data-value="${val}">${label}</div>
              `).join('')}
            </div>
          </div>
          <button class="nt-todo-delete" data-action="delete" data-id="${todo.id}" title="${t('deleteLabel')}">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
        </div>
      `;
    }).join('');

    // Event delegation for toggle/delete/edit/status
    todoList.querySelectorAll('[data-action="toggle"]').forEach(btn => {
      btn.addEventListener('click', () => toggleTodo(btn.dataset.id));
    });
    todoList.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', () => deleteTodo(btn.dataset.id));
    });
    todoList.querySelectorAll('[data-action="edit-text"]').forEach(span => {
      span.addEventListener('click', () => startEditText(span.dataset.id, span));
    });
    todoList.querySelectorAll('[data-action="edit-date"]').forEach(span => {
      span.addEventListener('click', (e) => {
        e.stopPropagation();
        startEditDate(span.dataset.id, span);
      });
    });
    // Custom status dropdown handlers
    todoList.querySelectorAll('[data-action="set-status"]').forEach(dropdown => {
      const btn = dropdown.querySelector('.nt-todo-status-btn');
      const menu = dropdown.querySelector('.nt-todo-status-menu');
      
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        // Close any other open dropdowns
        document.querySelectorAll('.nt-todo-status-menu.open').forEach(m => {
          if (m !== menu) m.classList.remove('open');
        });
        menu.classList.toggle('open');
      });
      
      menu.querySelectorAll('.nt-todo-status-option').forEach(opt => {
        opt.addEventListener('click', (e) => {
          e.stopPropagation();
          const newStatus = opt.dataset.value;
          const todo = todos.find(t => t.id === dropdown.dataset.id);
          if (!todo) return;
          todo.status = newStatus;
          todo.done = newStatus === 'done';
          saveTodos();
          renderTodos();
          renderBoard();
        });
      });
    });

    updateTodoBadge();
  }

  // Update the badge on the Todo tab showing count of overdue / due-today tasks
  function updateTodoBadge() {
    const todoTab = widget.querySelector('.nt-tab[data-tab="todo"]');
    if (!todoTab) return;

    const today = new Date().toISOString().split('T')[0];
    const dueCount = todos.filter(t => {
      if (t.done) return false;
      if (!t.due) return false;
      if ((t.status || 'todo') === 'backlog') return false;
      return t.due <= today;
    }).length;

    // Remove existing badge
    const existing = todoTab.querySelector('.nt-tab-badge');
    if (existing) existing.remove();

    if (dueCount > 0) {
      const badge = document.createElement('span');
      badge.className = 'nt-tab-badge';
      badge.textContent = dueCount;
      todoTab.appendChild(badge);
    }
  }

  function startEditText(id, span) {
    const todo = todos.find(t => t.id === id);
    if (!todo) return;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'nt-todo-edit-input';
    input.value = todo.text;
    span.replaceWith(input);
    input.focus();
    input.select();

    const finish = () => {
      const newText = input.value.trim();
      if (newText && newText !== todo.text) {
        todo.text = newText;
        saveTodos();
      }
      renderTodos();
      renderBoard();
    };

    input.addEventListener('blur', finish);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
      if (e.key === 'Escape') { input.value = todo.text; input.blur(); }
    });
  }

  function startEditDate(id, span) {
    const todo = todos.find(t => t.id === id);
    if (!todo) return;
    const input = document.createElement('input');
    input.type = 'date';
    input.className = 'nt-todo-edit-date';
    input.value = todo.due || '';
    span.replaceWith(input);
    input.focus();
    // Open the date picker
    if (input.showPicker) {
      try { input.showPicker(); } catch(e) {}
    }

    const finish = () => {
      todo.due = input.value || '';
      saveTodos();
      renderTodos();
      renderBoard();
    };

    input.addEventListener('change', finish);
    input.addEventListener('blur', finish);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { input.value = todo.due; input.blur(); }
    });
  }

  todoAddBtn.addEventListener('click', () => addTodo(false));
  todoInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addTodo(false);
  });
  todoDate.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addTodo(false);
  });

  // Close status dropdowns on click outside
  document.addEventListener('click', () => {
    document.querySelectorAll('.nt-todo-status-menu.open').forEach(m => m.classList.remove('open'));
  });

  // ---- Board ----
  if (boardAddBtn) {
    boardAddBtn.addEventListener('click', () => addTodo(true));
  }
  if (boardInput) {
    boardInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addTodo(true);
    });
  }
  if (boardDate) {
    boardDate.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addTodo(true);
    });
  }

  const STATUS_COLORS = {
    backlog: 'rgba(148,163,184,0.6)',
    todo: 'rgba(96,165,250,0.6)',
    inprogress: 'rgba(251,191,36,0.6)',
    done: 'rgba(74,222,128,0.6)'
  };

  function renderBoard() {
    if (!boardPanel) return;
    const columns = boardPanel.querySelectorAll('.nt-board-col');
    columns.forEach(col => {
      const colName = col.dataset.col;
      const cardsContainer = col.querySelector('.nt-board-col-cards');
      if (!cardsContainer) return;

      const colTodos = todos
        .filter(t => (t.status || 'todo') === colName)
        .filter(t => !searchQuery || t.text.toLowerCase().includes(searchQuery))
        .sort((a, b) => {
          // Items with due dates first (closest date on top), no-date items last
          if (a.due && b.due) return a.due.localeCompare(b.due);
          if (a.due) return -1;
          if (b.due) return 1;
          return 0;
        });

      // Update column header count
      const titleEl = col.querySelector('.nt-board-col-title');
      if (titleEl) {
        let countSpan = titleEl.querySelector('.nt-board-col-count');
        if (!countSpan) {
          countSpan = document.createElement('span');
          countSpan.className = 'nt-board-col-count';
          titleEl.appendChild(countSpan);
        }
        countSpan.textContent = colTodos.length;
      }

      if (colTodos.length === 0) {
        cardsContainer.innerHTML = '<div style="opacity:0.2;font-size:0.55rem;text-align:center;padding:8px;">—</div>';
      } else {
        cardsContainer.innerHTML = colTodos.map(todo => {
          const due = formatDueDate(todo.due);
          const text = searchQuery ? highlightSearch(escapeHtml(todo.text), searchQuery) : escapeHtml(todo.text);
          let daysLeftHtml = '';
          if (due && due.diffDays !== undefined) {
            const d = due.diffDays;
            const daysLabel = d < 0 ? `${Math.abs(d)}d ago` : d === 0 ? 'today' : `${d}d`;
            daysLeftHtml = `<span class="nt-board-card-days ${due.cls}">${daysLabel}</span>`;
          }
          return `
            <div class="nt-board-card" draggable="true" data-id="${todo.id}" data-status="${todo.status || 'todo'}">
              <div class="nt-board-card-text">${text}</div>
              <div class="nt-board-card-bottom">
                <div class="nt-board-card-due ${due ? due.cls : ''}" data-action="edit-board-date" data-id="${todo.id}">${due ? due.label : `<span class="nt-board-card-due-placeholder">${t('addDate')}</span>`}</div>
                ${daysLeftHtml}
              </div>
              <button class="nt-board-card-delete" data-id="${todo.id}" title="${t('deleteLabel')}">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
              </button>
            </div>
          `;
        }).join('');
      }

      // Drag-and-drop listeners on cards
      cardsContainer.querySelectorAll('.nt-board-card').forEach(card => {
        card.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('text/plain', card.dataset.id);
          card.classList.add('dragging');
          setTimeout(() => { card.style.display = 'none'; }, 0);
        });
        card.addEventListener('dragend', () => {
          card.classList.remove('dragging');
          card.style.display = '';
        });
      });

      // Drop zone listeners
      cardsContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        col.classList.add('drag-over');
      });
      cardsContainer.addEventListener('dragenter', (e) => {
        e.preventDefault();
        col.classList.add('drag-over');
      });
      cardsContainer.addEventListener('dragleave', (e) => {
        if (!col.contains(e.relatedTarget)) {
          col.classList.remove('drag-over');
        }
      });
      cardsContainer.addEventListener('drop', (e) => {
        e.preventDefault();
        col.classList.remove('drag-over');
        const cardId = e.dataTransfer.getData('text/plain');
        const todo = todos.find(t => t.id === cardId);
        if (todo && todo.status !== colName) {
          todo.status = colName;
          todo.done = colName === 'done';
          saveTodos();
          renderTodos();
          renderBoard();
        }
      });

      // Delete from board
      cardsContainer.querySelectorAll('.nt-board-card-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          deleteTodo(btn.dataset.id);
        });
      });

      // Edit date from board (click on card due date)
      cardsContainer.querySelectorAll('[data-action="edit-board-date"]').forEach(dueEl => {
        dueEl.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = dueEl.dataset.id;
          const todo = todos.find(t => t.id === id);
          if (!todo) return;
          const input = document.createElement('input');
          input.type = 'date';
          input.className = 'nt-todo-edit-date';
          input.value = todo.due || '';
          input.style.fontSize = '0.54rem';
          dueEl.replaceWith(input);
          input.focus();
          if (input.showPicker) {
            try { input.showPicker(); } catch(ex) {}
          }
          const finish = () => {
            todo.due = input.value || '';
            saveTodos();
            renderTodos();
            renderBoard();
          };
          input.addEventListener('change', finish);
          input.addEventListener('blur', finish);
        });
      });

      // Edit text from board (click on card text)
      cardsContainer.querySelectorAll('.nt-board-card-text').forEach(textEl => {
        textEl.addEventListener('dblclick', () => {
          const card = textEl.closest('.nt-board-card');
          const id = card.dataset.id;
          const todo = todos.find(t => t.id === id);
          if (!todo) return;
          const textarea = document.createElement('textarea');
          textarea.className = 'nt-board-card-edit-textarea';
          textarea.value = todo.text;
          textEl.replaceWith(textarea);
          textarea.focus();
          textarea.select();
          // Auto-resize to fit content
          textarea.style.height = 'auto';
          textarea.style.height = textarea.scrollHeight + 'px';

          const finish = () => {
            const newText = textarea.value.trim();
            if (newText && newText !== todo.text) {
              todo.text = newText;
              saveTodos();
            }
            renderTodos();
            renderBoard();
          };
          textarea.addEventListener('input', () => {
            textarea.style.height = 'auto';
            textarea.style.height = textarea.scrollHeight + 'px';
          });
          textarea.addEventListener('blur', finish);
          textarea.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); textarea.blur(); }
            if (ev.key === 'Escape') { textarea.value = todo.text; textarea.blur(); }
          });
        });
      });
    });
  }

  // Set default board date to tomorrow
  if (boardDate) {
    const boardTomorrow = new Date();
    boardTomorrow.setDate(boardTomorrow.getDate() + 1);
    boardDate.value = boardTomorrow.toISOString().split('T')[0];
  }

  // ---- Search ----
  function highlightSearch(html, query) {
    if (!query) return html;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return html.replace(regex, '<span class="nt-search-highlight">$1</span>');
  }

  function escapeHtml(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function findAllNoteMatches() {
    noteMatches = [];
    if (!searchQuery || activeTab !== 'notes') return;
    const text = notesArea.value.toLowerCase();
    const q = searchQuery;
    let pos = 0;
    while (pos < text.length) {
      const idx = text.indexOf(q, pos);
      if (idx === -1) break;
      noteMatches.push({ start: idx, end: idx + q.length });
      pos = idx + 1;
    }
  }

  function updateNotesHighlightOverlay() {
    if (!notesHighlights) return;
    if (!searchQuery || activeTab !== 'notes' || noteMatches.length === 0) {
      notesHighlights.innerHTML = '';
      return;
    }
    const raw = notesArea.value;
    let html = '';
    let last = 0;
    noteMatches.forEach((m, i) => {
      html += escapeHtml(raw.substring(last, m.start));
      const cls = i === currentMatchIndex ? 'current' : '';
      html += `<mark class="${cls}">${escapeHtml(raw.substring(m.start, m.end))}</mark>`;
      last = m.end;
    });
    html += escapeHtml(raw.substring(last));
    notesHighlights.innerHTML = html;
  }

  function syncHighlightScroll() {
    if (notesHighlights) {
      notesHighlights.scrollTop = notesArea.scrollTop;
    }
  }

  notesArea.addEventListener('scroll', syncHighlightScroll);

  function scrollToNoteMatch(idx) {
    if (idx < 0 || idx >= noteMatches.length) return;
    const m = noteMatches[idx];
    notesArea.setSelectionRange(m.start, m.end);
    const linesBefore = notesArea.value.substring(0, m.start).split('\n').length - 1;
    const lineHeight = parseFloat(getComputedStyle(notesArea).lineHeight) || 18;
    const scrollTarget = linesBefore * lineHeight - notesArea.clientHeight / 3;
    notesArea.scrollTop = Math.max(0, scrollTarget);
    syncHighlightScroll();
  }

  function getTodoMatchCount() {
    if (!searchQuery || (activeTab !== 'todo' && activeTab !== 'board')) return 0;
    let count = 0;
    todos.forEach(t => {
      const text = t.text.toLowerCase();
      let pos = 0;
      while (pos < text.length) {
        const idx = text.indexOf(searchQuery, pos);
        if (idx === -1) break;
        count++;
        pos = idx + 1;
      }
    });
    return count;
  }

  function updateSearchCount() {
    if (!searchCount) return;
    if (!searchQuery) {
      searchCount.textContent = '';
      return;
    }
    if (activeTab === 'notes') {
      if (noteMatches.length === 0) {
        searchCount.textContent = '0';
      } else {
        searchCount.textContent = `${currentMatchIndex + 1}/${noteMatches.length}`;
      }
    } else if (activeTab === 'todo' || activeTab === 'board') {
      const count = getTodoMatchCount();
      searchCount.textContent = count > 0 ? `${count}` : '0';
    }
  }

  function doSearch() {
    searchQuery = searchInput.value.trim().toLowerCase();
    if (activeTab === 'notes') {
      findAllNoteMatches();
      currentMatchIndex = noteMatches.length > 0 ? 0 : -1;
      updateNotesHighlightOverlay();
      if (currentMatchIndex >= 0) scrollToNoteMatch(currentMatchIndex);
    } else {
      noteMatches = [];
      currentMatchIndex = -1;
      updateNotesHighlightOverlay();
    }
    renderTodos();
    renderBoard();
    updateSearchCount();
  }

  searchInput.addEventListener('input', doSearch);

  // Enter in search: go to next match
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && searchQuery) {
      e.preventDefault();
      if (activeTab === 'notes' && noteMatches.length > 0) {
        currentMatchIndex = (currentMatchIndex + 1) % noteMatches.length;
        updateNotesHighlightOverlay();
        scrollToNoteMatch(currentMatchIndex);
        updateSearchCount();
      }
    }
  });

  // ---- Keyboard shortcuts (Alt+Shift+key, works even when focused on inputs) ----
  document.addEventListener('keydown', (e) => {
    // Escape: Clear search / blur (no modifier needed)
    if (e.key === 'Escape' && document.activeElement === searchInput) {
      searchInput.value = '';
      searchQuery = '';
      noteMatches = [];
      currentMatchIndex = -1;
      updateNotesHighlightOverlay();
      updateSearchCount();
      renderTodos();
      renderBoard();
      searchInput.blur();
      return;
    }

    if (!e.altKey || !e.shiftKey) return;

    // Alt+Shift+1: Notes tab
    if (e.code === 'Digit1') {
      e.preventDefault();
      switchTab('notes');
      notesArea.focus();
    }
    // Alt+Shift+2: Todo tab
    if (e.code === 'Digit2') {
      e.preventDefault();
      switchTab('todo');
      todoInput.focus();
    }
    // Alt+Shift+3: Board tab
    if (e.code === 'Digit3') {
      e.preventDefault();
      switchTab('board');
    }
    // Alt+Shift+F: Focus search
    if (e.code === 'KeyF') {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
    // Alt+Shift+N: New todo
    if (e.code === 'KeyN') {
      e.preventDefault();
      switchTab('todo');
      todoInput.focus();
    }
    // Alt+Shift+Z: Trigger Zen Pulse (manual, always works)
    if (e.code === 'KeyZ') {
      e.preventDefault();
      startZenPulsePattern();
    }
  });

  // ---- Init ----
  loadNotes();
  loadTodos();

  // Restore last active tab
  chrome.storage.local.get('ntActiveTab', (data) => {
    if (data.ntActiveTab) {
      switchTab(data.ntActiveTab);
    }
  });

  // Set default date to tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  todoDate.value = tomorrow.toISOString().split('T')[0];
}

