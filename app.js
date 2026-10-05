/**
 * FocusDo — Modern Simple To-Do Application
 * Based on PRD v1.0 specifications
 */

(function () {
  'use strict';

  // Constants
  const STORAGE_KEY = 'focusdo_todos_v1';

  // State
  let todos = [];
  let currentFilter = 'all'; // 'all' | 'active' | 'completed'

  // DOM Elements
  const todoForm = document.getElementById('todo-form');
  const todoInput = document.getElementById('todo-input');
  const todoList = document.getElementById('todo-list');
  const emptyState = document.getElementById('empty-state');
  const currentDateEl = document.getElementById('current-date');
  const toastContainer = document.getElementById('toast-container');

  // Stats Elements
  const progressPercentEl = document.getElementById('progress-percent');
  const progressBarFillEl = document.getElementById('progress-bar-fill');
  const statRemainingEl = document.getElementById('stat-remaining');
  const statCompletedEl = document.getElementById('stat-completed');

  // Filter Buttons
  const filterTabs = document.querySelectorAll('.filter-tab');
  const countAllEl = document.getElementById('count-all');
  const countActiveEl = document.getElementById('count-active');
  const countCompletedEl = document.getElementById('count-completed');
  const clearCompletedBtn = document.getElementById('clear-completed-btn');

  /* ==========================================================================
     Initialization & Storage
     ========================================================================== */

  function init() {
    updateDateDisplay();
    loadTodos();
    bindEvents();
    render();
  }

  function updateDateDisplay() {
    const today = new Date();
    const options = { month: 'long', day: 'numeric', weekday: 'short' };
    currentDateEl.textContent = today.toLocaleDateString('ko-KR', options);
  }

  function loadTodos() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        todos = JSON.parse(stored);
      } else {
        // Sample default onboarding items for first-time visitors
        todos = [
          {
            id: generateId(),
            text: 'FocusDo 투두리스트 시작하기 ✨',
            completed: true,
            createdAt: Date.now() - 3600000,
          },
          {
            id: generateId(),
            text: '완료할 항목 체크박스 눌러보기',
            completed: false,
            createdAt: Date.now(),
          },
        ];
        saveTodos();
      }
    } catch (e) {
      console.error('LocalStorage load failed:', e);
      todos = [];
    }
  }

  function saveTodos() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
    } catch (e) {
      console.error('LocalStorage save failed:', e);
      showToast('⚠️ 저장 공간이 부족하거나 로컬 스토리지에 접근할 수 없습니다.');
    }
  }

  function generateId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }

  /* ==========================================================================
     Event Handlers
     ========================================================================== */

  function bindEvents() {
    // Form submission
    todoForm.addEventListener('submit', handleAddTodo);

    // Filter switching
    filterTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        filterTabs.forEach((t) => {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        currentFilter = tab.getAttribute('data-filter');
        render();
      });
    });

    // Clear completed items
    clearCompletedBtn.addEventListener('click', handleClearCompleted);

    // Global keyboard shortcut ('/' to focus input)
    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement !== todoInput) {
        e.preventDefault();
        todoInput.focus();
      } else if (e.key === 'Escape' && document.activeElement === todoInput) {
        todoInput.blur();
      }
    });
  }

  function handleAddTodo(e) {
    e.preventDefault();
    const text = todoInput.value.trim();

    if (!text) {
      showToast('할 일 내용을 입력해주세요.');
      todoInput.focus();
      return;
    }

    const newTodo = {
      id: generateId(),
      text: text,
      completed: false,
      createdAt: Date.now(),
    };

    todos.unshift(newTodo);
    saveTodos();
    render();

    todoInput.value = '';
    todoInput.focus();
    showToast('새로운 할 일이 추가되었습니다.');
  }

  function handleToggleTodo(id) {
    const todo = todos.find((t) => t.id === id);
    if (!todo) return;

    todo.completed = !todo.completed;
    saveTodos();
    render();

    if (todo.completed) {
      showToast('할 일을 달성했습니다! 🎉');
    }
  }

  function handleDeleteTodo(id, itemElement) {
    // Trigger exit animation
    if (itemElement) {
      itemElement.classList.add('removing');
      itemElement.addEventListener(
        'animationend',
        () => {
          todos = todos.filter((t) => t.id !== id);
          saveTodos();
          render();
        },
        { once: true }
      );
    } else {
      todos = todos.filter((t) => t.id !== id);
      saveTodos();
      render();
    }
    showToast('할 일이 삭제되었습니다.');
  }

  function handleClearCompleted() {
    const completedCount = todos.filter((t) => t.completed).length;
    if (completedCount === 0) {
      showToast('완료된 항목이 없습니다.');
      return;
    }

    todos = todos.filter((t) => !t.completed);
    saveTodos();
    render();
    showToast(`${completedCount}개의 완료 항목을 정리했습니다.`);
  }

  /* ==========================================================================
     Rendering
     ========================================================================== */

  function render() {
    updateStats();

    // Filter todos
    const filteredTodos = todos.filter((todo) => {
      if (currentFilter === 'active') return !todo.completed;
      if (currentFilter === 'completed') return todo.completed;
      return true;
    });

    // Clear current list
    todoList.innerHTML = '';

    if (filteredTodos.length === 0) {
      emptyState.classList.add('visible');
      const emptyTitle = emptyState.querySelector('.empty-title');
      const emptyDesc = emptyState.querySelector('.empty-desc');

      if (currentFilter === 'completed') {
        emptyTitle.textContent = '완료된 할 일이 없습니다';
        emptyDesc.textContent = '목록에서 완료한 작업에 체크해 보세요.';
      } else if (currentFilter === 'active') {
        emptyTitle.textContent = '진행 중인 할 일이 없습니다';
        emptyDesc.textContent = '모든 할 일을 마쳤거나 새 작업을 등록해 보세요!';
      } else {
        emptyTitle.textContent = '등록된 할 일이 없습니다';
        emptyDesc.textContent = '오늘 시작하고 싶은 계획을 상단에 입력해 보세요!';
      }
    } else {
      emptyState.classList.remove('visible');

      filteredTodos.forEach((todo) => {
        const itemEl = createTodoElement(todo);
        todoList.appendChild(itemEl);
      });
    }
  }

  function createTodoElement(todo) {
    const li = document.createElement('li');
    li.className = `todo-item ${todo.completed ? 'completed' : ''}`;
    li.setAttribute('data-id', todo.id);

    // Label & Custom Checkbox
    const label = document.createElement('label');
    label.className = 'custom-checkbox';
    label.setAttribute('aria-label', `${todo.text} 완료 토글`);

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = todo.completed;
    checkbox.addEventListener('change', () => handleToggleTodo(todo.id));

    const checkmark = document.createElement('div');
    checkmark.className = 'checkbox-mark';
    checkmark.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    `;

    label.appendChild(checkbox);
    label.appendChild(checkmark);

    // Text span
    const textSpan = document.createElement('span');
    textSpan.className = 'todo-text';
    textSpan.textContent = todo.text;

    // Delete Button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.setAttribute('title', '삭제');
    deleteBtn.setAttribute('aria-label', `${todo.text} 삭제`);
    deleteBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        <line x1="10" y1="11" x2="10" y2="17"></line>
        <line x1="14" y1="11" x2="14" y2="17"></line>
      </svg>
    `;

    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleDeleteTodo(todo.id, li);
    });

    li.appendChild(label);
    li.appendChild(textSpan);
    li.appendChild(deleteBtn);

    return li;
  }

  function updateStats() {
    const total = todos.length;
    const completed = todos.filter((t) => t.completed).length;
    const active = total - completed;
    const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

    // Update Progress bar & card
    progressPercentEl.textContent = `${percent}%`;
    progressBarFillEl.style.width = `${percent}%`;
    statRemainingEl.textContent = `남은 할 일: ${active}개`;
    statCompletedEl.textContent = `완료: ${completed} / ${total}개`;

    // Update Tab count badges
    countAllEl.textContent = total;
    countActiveEl.textContent = active;
    countCompletedEl.textContent = completed;
  }

  /* ==========================================================================
     Toast Notifications
     ========================================================================== */

  function showToast(message) {
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;

    toastContainer.appendChild(toast);

    setTimeout(() => {
      if (toast.parentElement) {
        toast.parentElement.removeChild(toast);
      }
    }, 2500);
  }

  // Start app on DOMContentLoaded
  document.addEventListener('DOMContentLoaded', init);
})();
