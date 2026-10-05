/**
 * FocusDo — Modern Simple To-Do Application
 * Integrated with Supabase (Auth + Cloud Database) & LocalStorage Fallback
 */

(function () {
  'use strict';

  // Supabase Configuration
  const SUPABASE_URL = 'https://gltgygtwubasijzvzifl.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_BRQAAGI1z8aRAlyePZIdJA_wq6800Vj';
  const LOCAL_STORAGE_KEY = 'focusdo_todos_guest_v1';

  let supabase = null;
  let currentUser = null;
  let todos = [];
  let currentFilter = 'all'; // 'all' | 'active' | 'completed'
  let currentAuthTab = 'login'; // 'login' | 'signup'

  // DOM Elements - Main
  const todoForm = document.getElementById('todo-form');
  const todoInput = document.getElementById('todo-input');
  const todoList = document.getElementById('todo-list');
  const emptyState = document.getElementById('empty-state');
  const currentDateEl = document.getElementById('current-date');
  const toastContainer = document.getElementById('toast-container');
  const storageStatusText = document.getElementById('storage-status-text');

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

  // Auth Header Elements
  const openAuthBtn = document.getElementById('open-auth-btn');
  const userProfileBadge = document.getElementById('user-profile-badge');
  const userAvatar = document.getElementById('user-avatar');
  const userEmailEl = document.getElementById('user-email');
  const logoutBtn = document.getElementById('logout-btn');
  const guestBanner = document.getElementById('guest-banner');
  const bannerLoginBtn = document.getElementById('banner-login-btn');

  // Auth Modal Elements
  const authModal = document.getElementById('auth-modal');
  const closeAuthModal = document.getElementById('close-auth-modal');
  const tabLogin = document.getElementById('tab-login');
  const tabSignup = document.getElementById('tab-signup');
  const authForm = document.getElementById('auth-form');
  const authEmailInput = document.getElementById('auth-email');
  const authPasswordInput = document.getElementById('auth-password');
  const authSubmitBtn = document.getElementById('auth-submit-btn');
  const authSubmitText = document.getElementById('auth-submit-text');
  const authSpinner = document.getElementById('auth-spinner');
  const authMessage = document.getElementById('auth-message');

  /* ==========================================================================
     Initialization & Supabase Setup
     ========================================================================== */

  async function init() {
    updateDateDisplay();
    initSupabase();
    bindEvents();

    if (supabase) {
      await checkAuthSession();
    } else {
      loadLocalTodos();
      render();
    }
  }

  function updateDateDisplay() {
    const today = new Date();
    const options = { month: 'long', day: 'numeric', weekday: 'short' };
    currentDateEl.textContent = today.toLocaleDateString('ko-KR', options);
  }

  function initSupabase() {
    try {
      if (window.supabase && typeof window.supabase.createClient === 'function') {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

        // Listen for authentication changes
        supabase.auth.onAuthStateChange(async (event, session) => {
          if (session && session.user) {
            currentUser = session.user;
            updateAuthUI(true);
            await loadCloudTodos();
          } else {
            currentUser = null;
            updateAuthUI(false);
            loadLocalTodos();
          }
          render();
        });
      } else {
        console.warn('Supabase SDK not loaded, using LocalStorage fallback.');
      }
    } catch (e) {
      console.error('Failed to initialize Supabase client:', e);
    }
  }

  async function checkAuthSession() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;

      if (session && session.user) {
        currentUser = session.user;
        updateAuthUI(true);
        await loadCloudTodos();
      } else {
        currentUser = null;
        updateAuthUI(false);
        loadLocalTodos();
      }
    } catch (err) {
      console.warn('Auth session check failed, using local storage:', err);
      currentUser = null;
      updateAuthUI(false);
      loadLocalTodos();
    }
    render();
  }

  function updateAuthUI(isLoggedIn) {
    if (isLoggedIn && currentUser) {
      openAuthBtn.style.display = 'none';
      userProfileBadge.style.display = 'inline-flex';
      guestBanner.style.display = 'none';
      userEmailEl.textContent = currentUser.email;
      userAvatar.textContent = (currentUser.email || 'U')[0].toUpperCase();
      storageStatusText.textContent = '☁️ Supabase 클라우드 연동됨';
    } else {
      openAuthBtn.style.display = 'inline-flex';
      userProfileBadge.style.display = 'none';
      guestBanner.style.display = 'flex';
      storageStatusText.textContent = '💾 로컬 게스트 모드';
    }
  }

  /* ==========================================================================
     Todo Data Operations (Supabase DB + Local Storage Fallback)
     ========================================================================== */

  async function loadCloudTodos() {
    try {
      const { data, error } = await supabase
        .from('todos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        // Table not found in Supabase (PGRST205)
        if (error.code === 'PGRST205' || error.message.includes('Could not find the table')) {
          showToast('⚠️ Supabase SQL 에디터에서 todos 테이블 생성이 필요합니다.');
        } else {
          showToast(`클라우드 조회 오류: ${error.message}`);
        }
        loadLocalTodos();
        return;
      }

      todos = (data || []).map((row) => ({
        id: row.id,
        text: row.text,
        completed: row.completed,
        createdAt: new Date(row.created_at).getTime(),
      }));
    } catch (err) {
      console.error('Error fetching todos from Supabase:', err);
      loadLocalTodos();
    }
  }

  function loadLocalTodos() {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        todos = JSON.parse(stored);
      } else {
        todos = [
          {
            id: generateId(),
            text: 'FocusDo 투두리스트 시작하기 ✨',
            completed: true,
            createdAt: Date.now() - 3600000,
          },
          {
            id: generateId(),
            text: '우측 상단 [로그인]으로 Supabase 클라우드 동기화하기 ☁️',
            completed: false,
            createdAt: Date.now(),
          },
        ];
        saveLocalTodos();
      }
    } catch (e) {
      console.error('LocalStorage load failed:', e);
      todos = [];
    }
  }

  function saveLocalTodos() {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(todos));
    } catch (e) {
      console.error('LocalStorage save failed:', e);
    }
  }

  function generateId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }

  /* ==========================================================================
     Event Bindings
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
      if (e.key === '/' && document.activeElement !== todoInput && !authModal.classList.contains('open')) {
        e.preventDefault();
        todoInput.focus();
      } else if (e.key === 'Escape') {
        if (authModal.classList.contains('open')) {
          closeModal();
        } else if (document.activeElement === todoInput) {
          todoInput.blur();
        }
      }
    });

    // Auth modal controls
    openAuthBtn.addEventListener('click', openModal);
    bannerLoginBtn.addEventListener('click', openModal);
    closeAuthModal.addEventListener('click', closeModal);
    authModal.addEventListener('click', (e) => {
      if (e.target === authModal) closeModal();
    });

    tabLogin.addEventListener('click', () => switchAuthTab('login'));
    tabSignup.addEventListener('click', () => switchAuthTab('signup'));
    authForm.addEventListener('submit', handleAuthSubmit);
    logoutBtn.addEventListener('click', handleLogout);
  }

  /* ==========================================================================
     CRUD Action Handlers
     ========================================================================== */

  async function handleAddTodo(e) {
    e.preventDefault();
    const text = todoInput.value.trim();

    if (!text) {
      showToast('할 일 내용을 입력해주세요.');
      todoInput.focus();
      return;
    }

    if (currentUser && supabase) {
      // Add to Supabase Database
      try {
        const { data, error } = await supabase
          .from('todos')
          .insert([
            {
              text: text,
              completed: false,
              user_id: currentUser.id,
            },
          ])
          .select();

        if (error) {
          if (error.code === 'PGRST205' || error.message.includes('Could not find the table')) {
            showToast('⚠️ Supabase SQL 에디터에서 todos 테이블을 생성해주세요!');
          } else {
            showToast(`등록 실패: ${error.message}`);
          }
          return;
        }

        if (data && data.length > 0) {
          todos.unshift({
            id: data[0].id,
            text: data[0].text,
            completed: data[0].completed,
            createdAt: new Date(data[0].created_at).getTime(),
          });
        }
      } catch (err) {
        console.error('Supabase insert error:', err);
        showToast('저장 중 네트워크 오류가 발생했습니다.');
        return;
      }
    } else {
      // Local Storage
      const newTodo = {
        id: generateId(),
        text: text,
        completed: false,
        createdAt: Date.now(),
      };
      todos.unshift(newTodo);
      saveLocalTodos();
    }

    render();
    todoInput.value = '';
    todoInput.focus();
    showToast('새로운 할 일이 추가되었습니다.');
  }

  async function handleToggleTodo(id) {
    const todo = todos.find((t) => t.id === id);
    if (!todo) return;

    const previousState = todo.completed;
    todo.completed = !todo.completed;
    render();

    if (currentUser && supabase) {
      try {
        const { error } = await supabase
          .from('todos')
          .update({ completed: todo.completed })
          .eq('id', id);

        if (error) {
          todo.completed = previousState;
          render();
          showToast(`상태 변경 실패: ${error.message}`);
          return;
        }
      } catch (err) {
        todo.completed = previousState;
        render();
        showToast('네트워크 오류가 발생했습니다.');
        return;
      }
    } else {
      saveLocalTodos();
    }

    if (todo.completed) {
      showToast('할 일을 달성했습니다! 🎉');
    }
  }

  async function handleDeleteTodo(id, itemElement) {
    const deleteAction = async () => {
      if (currentUser && supabase) {
        try {
          const { error } = await supabase.from('todos').delete().eq('id', id);
          if (error) {
            showToast(`삭제 실패: ${error.message}`);
            return;
          }
        } catch (err) {
          console.error('Delete error:', err);
          showToast('삭제 중 오류가 발생했습니다.');
          return;
        }
      }

      todos = todos.filter((t) => t.id !== id);
      if (!currentUser) saveLocalTodos();
      render();
      showToast('할 일이 삭제되었습니다.');
    };

    if (itemElement) {
      itemElement.classList.add('removing');
      itemElement.addEventListener(
        'animationend',
        () => {
          deleteAction();
        },
        { once: true }
      );
    } else {
      deleteAction();
    }
  }

  async function handleClearCompleted() {
    const completedItems = todos.filter((t) => t.completed);
    if (completedItems.length === 0) {
      showToast('완료된 항목이 없습니다.');
      return;
    }

    if (currentUser && supabase) {
      try {
        const { error } = await supabase
          .from('todos')
          .delete()
          .eq('completed', true)
          .eq('user_id', currentUser.id);

        if (error) {
          showToast(`완료 항목 정리 실패: ${error.message}`);
          return;
        }
      } catch (err) {
        showToast('정리 중 오류가 발생했습니다.');
        return;
      }
    }

    todos = todos.filter((t) => !t.completed);
    if (!currentUser) saveLocalTodos();
    render();
    showToast(`${completedItems.length}개의 완료 항목을 정리했습니다.`);
  }

  /* ==========================================================================
     Authentication Handlers
     ========================================================================== */

  function openModal() {
    authModal.classList.add('open');
    authModal.setAttribute('aria-hidden', 'false');
    authEmailInput.focus();
    clearAuthMessage();
  }

  function closeModal() {
    authModal.classList.remove('open');
    authModal.setAttribute('aria-hidden', 'true');
    clearAuthMessage();
  }

  function switchAuthTab(tab) {
    currentAuthTab = tab;
    clearAuthMessage();
    if (tab === 'login') {
      tabLogin.classList.add('active');
      tabSignup.classList.remove('active');
      authSubmitText.textContent = '로그인';
    } else {
      tabSignup.classList.add('active');
      tabLogin.classList.remove('active');
      authSubmitText.textContent = '회원가입';
    }
  }

  function setAuthLoading(loading) {
    authSubmitBtn.disabled = loading;
    authSpinner.style.display = loading ? 'block' : 'none';
    authSubmitText.style.display = loading ? 'none' : 'inline';
  }

  function setAuthMessage(type, msg) {
    authMessage.className = `auth-message ${type}`;
    authMessage.textContent = msg;
    authMessage.style.display = 'block';
  }

  function clearAuthMessage() {
    authMessage.style.display = 'none';
    authMessage.textContent = '';
  }

  async function handleAuthSubmit(e) {
    e.preventDefault();
    if (!supabase) {
      setAuthMessage('error', 'Supabase 클라이언트를 불러오지 못했습니다.');
      return;
    }

    const email = authEmailInput.value.trim();
    const password = authPasswordInput.value;

    if (!email || !password) {
      setAuthMessage('error', '이메일과 비밀번호를 모두 입력해 주세요.');
      return;
    }

    setAuthLoading(true);
    clearAuthMessage();

    try {
      if (currentAuthTab === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            setAuthMessage('error', '이메일 또는 비밀번호가 일치하지 않습니다.');
          } else {
            setAuthMessage('error', error.message);
          }
          setAuthLoading(false);
          return;
        }

        showToast('성공적으로 로그인되었습니다! 🎉');
        closeModal();
      } else {
        // Sign Up
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) {
          setAuthMessage('error', error.message);
          setAuthLoading(false);
          return;
        }

        // If email confirmation is enabled in Supabase
        if (data.user && data.user.identities && data.user.identities.length === 0) {
          setAuthMessage('error', '이미 가입된 이메일 계정입니다.');
        } else if (data.session) {
          showToast('회원가입 및 로그인이 완료되었습니다! 🎉');
          closeModal();
        } else {
          setAuthMessage(
            'success',
            '회원가입 신청이 완료되었습니다! 가입하신 이메일의 확인 링크를 클릭해 주세요.'
          );
        }
      }
    } catch (err) {
      console.error('Auth error:', err);
      setAuthMessage('error', '인증 중 문제가 발생했습니다.');
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleLogout() {
    if (!supabase) return;
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      showToast('로그아웃되었습니다.');
    } catch (err) {
      console.error('Logout error:', err);
      showToast('로그아웃 중 오류가 발생했습니다.');
    }
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
    }, 2800);
  }

  // Start app on DOMContentLoaded
  document.addEventListener('DOMContentLoaded', init);
})();
