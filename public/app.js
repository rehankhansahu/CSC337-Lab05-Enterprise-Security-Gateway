let accessToken = null;
let currentUser = null;

// ==========================================
// DOM
// ==========================================

const authSection =
  document.getElementById('authSection');

const dashboardSection =
  document.getElementById('dashboardSection');

const loginTab =
  document.getElementById('loginTab');

const registerTab =
  document.getElementById('registerTab');

const loginForm =
  document.getElementById('loginForm');

const registerForm =
  document.getElementById('registerForm');

const authMessage =
  document.getElementById('authMessage');

const dashboardMessage =
  document.getElementById('dashboardMessage');

const navUser =
  document.getElementById('navUser');

const navRole =
  document.getElementById('navRole');

const logoutBtn =
  document.getElementById('logoutBtn');

const refreshBtn =
  document.getElementById('refreshBtn');

const profileBtn =
  document.getElementById('profileBtn');

const approvePayrollBtn =
  document.getElementById('approvePayrollBtn');

const deleteUserArea =
  document.getElementById('deleteUserArea');

const deleteUserBtn =
  document.getElementById('deleteUserBtn');

const deleteUserId =
  document.getElementById('deleteUserId');

const employeeNotice =
  document.getElementById('employeeNotice');

// ==========================================
// HELPERS
// ==========================================

function showMessage(
  element,
  message,
  type = 'error'
) {
  element.textContent = message;
  element.className = `message ${type}`;
}

function hideMessage(element) {
  element.className = 'message hidden';
  element.textContent = '';
}

function setLoading(button, loading, text) {
  if (!button) return;

  if (loading) {
    button.dataset.originalText =
      button.textContent;

    button.textContent = text;
    button.disabled = true;
  } else {
    button.textContent =
      button.dataset.originalText ||
      button.textContent;

    button.disabled = false;
  }
}

async function request(
  url,
  options = {},
  retry = true
) {
  const headers = {
    ...(options.headers || {})
  };

  if (accessToken) {
    headers.Authorization =
      `Bearer ${accessToken}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include'
  });

  /*
    If access token expired but refresh cookie is
    still valid, rotate tokens and retry once.
  */

  if (
    response.status === 401 &&
    retry &&
    url !== '/api/v1/auth/login' &&
    url !== '/api/v1/auth/register' &&
    url !== '/api/v1/auth/refresh'
  ) {
    const refreshed =
      await refreshSession(false);

    if (refreshed) {
      return request(
        url,
        options,
        false
      );
    }
  }

  return response;
}

async function readJSON(response) {
  try {
    return await response.json();
  } catch {
    return {
      success: false,
      message: 'Invalid server response'
    };
  }
}

// ==========================================
// AUTH TABS
// ==========================================

function showLogin() {
  loginTab.classList.add('active');
  registerTab.classList.remove('active');

  loginForm.classList.remove('hidden');
  registerForm.classList.add('hidden');

  hideMessage(authMessage);
}

function showRegister() {
  registerTab.classList.add('active');
  loginTab.classList.remove('active');

  registerForm.classList.remove('hidden');
  loginForm.classList.add('hidden');

  hideMessage(authMessage);
}

loginTab.addEventListener(
  'click',
  showLogin
);

registerTab.addEventListener(
  'click',
  showRegister
);

// ==========================================
// REGISTER
// ==========================================

registerForm.addEventListener(
  'submit',
  async (event) => {
    event.preventDefault();

    hideMessage(authMessage);

    const button =
      document.getElementById('registerBtn');

    const name =
      document
        .getElementById('registerName')
        .value
        .trim();

    const email =
      document
        .getElementById('registerEmail')
        .value
        .trim();

    const password =
      document
        .getElementById('registerPassword')
        .value;

    try {
      setLoading(
        button,
        true,
        'Creating account...'
      );

      const response = await fetch(
        '/api/v1/auth/register',
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json'
          },

          credentials: 'include',

          body: JSON.stringify({
            name,
            email,
            password
          })
        }
      );

      const data = await readJSON(response);

      if (!response.ok) {
        throw new Error(
          data.message ||
          'Registration failed'
        );
      }

      accessToken = data.accessToken;
      currentUser = data.user;

      registerForm.reset();

      await loadProfile();

      showMessage(
        dashboardMessage,
        'Account created successfully.',
        'success'
      );
    } catch (error) {
      showMessage(
        authMessage,
        error.message
      );
    } finally {
      setLoading(button, false);
    }
  }
);

// ==========================================
// LOGIN
// ==========================================

loginForm.addEventListener(
  'submit',
  async (event) => {
    event.preventDefault();

    hideMessage(authMessage);

    const button =
      document.getElementById('loginBtn');

    const email =
      document
        .getElementById('loginEmail')
        .value
        .trim();

    const password =
      document
        .getElementById('loginPassword')
        .value;

    try {
      setLoading(
        button,
        true,
        'Signing in...'
      );

      const response = await fetch(
        '/api/v1/auth/login',
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json'
          },

          credentials: 'include',

          body: JSON.stringify({
            email,
            password
          })
        }
      );

      const data = await readJSON(response);

      if (!response.ok) {
        throw new Error(
          data.message || 'Login failed'
        );
      }

      accessToken = data.accessToken;
      currentUser = data.user;

      loginForm.reset();

      await loadProfile();
    } catch (error) {
      showMessage(
        authMessage,
        error.message
      );
    } finally {
      setLoading(button, false);
    }
  }
);

// ==========================================
// REFRESH TOKEN ROTATION
// ==========================================

async function refreshSession(
  showFeedback = true
) {
  try {
    const response = await fetch(
      '/api/v1/auth/refresh',
      {
        method: 'POST',
        credentials: 'include'
      }
    );

    const data = await readJSON(response);

    if (!response.ok) {
      accessToken = null;

      return false;
    }

    accessToken = data.accessToken;

    if (showFeedback) {
      showMessage(
        dashboardMessage,
        'Session refreshed. Refresh token rotated successfully.',
        'success'
      );
    }

    return true;
  } catch {
    return false;
  }
}

refreshBtn.addEventListener(
  'click',
  async () => {
    hideMessage(dashboardMessage);

    setLoading(
      refreshBtn,
      true,
      'Refreshing...'
    );

    const success =
      await refreshSession(true);

    setLoading(
      refreshBtn,
      false
    );

    if (!success) {
      showAuth();

      showMessage(
        authMessage,
        'Your session has expired. Please sign in again.'
      );
    }
  }
);

// ==========================================
// PROTECTED PROFILE
// ==========================================

async function loadProfile() {
  try {
    const response = await request(
      '/api/v1/employee/profile'
    );

    const data = await readJSON(response);

    if (!response.ok) {
      throw new Error(
        data.message ||
        'Unable to load profile'
      );
    }

    currentUser = data.user;

    renderDashboard(currentUser);

    return true;
  } catch {
    showAuth();

    return false;
  }
}

profileBtn.addEventListener(
  'click',
  async () => {
    hideMessage(dashboardMessage);

    setLoading(
      profileBtn,
      true,
      'Loading...'
    );

    const success =
      await loadProfile();

    setLoading(
      profileBtn,
      false
    );

    if (success) {
      showMessage(
        dashboardMessage,
        'Protected profile loaded successfully.',
        'success'
      );
    }
  }
);

// ==========================================
// PAYROLL - MANAGER / SUPERADMIN
// ==========================================

approvePayrollBtn.addEventListener(
  'click',
  async () => {
    hideMessage(dashboardMessage);

    try {
      setLoading(
        approvePayrollBtn,
        true,
        'Approving...'
      );

      const response = await request(
        '/api/v1/payroll/approve',
        {
          method: 'POST'
        }
      );

      const data = await readJSON(response);

      if (!response.ok) {
        throw new Error(
          data.message ||
          'Payroll approval failed'
        );
      }

      showMessage(
        dashboardMessage,
        data.message,
        'success'
      );
    } catch (error) {
      showMessage(
        dashboardMessage,
        error.message
      );
    } finally {
      setLoading(
        approvePayrollBtn,
        false
      );
    }
  }
);

// ==========================================
// DELETE USER - SUPERADMIN
// ==========================================

deleteUserBtn.addEventListener(
  'click',
  async () => {
    hideMessage(dashboardMessage);

    const id =
      deleteUserId.value.trim();

    if (!id) {
      showMessage(
        dashboardMessage,
        'Enter the user ID to delete.'
      );

      return;
    }

    const confirmed = window.confirm(
      'Delete this user? This action cannot be undone.'
    );

    if (!confirmed) {
      return;
    }

    try {
      setLoading(
        deleteUserBtn,
        true,
        'Deleting...'
      );

      const response = await request(
        `/api/v1/users/${encodeURIComponent(id)}`,
        {
          method: 'DELETE'
        }
      );

      const data = await readJSON(response);

      if (!response.ok) {
        throw new Error(
          data.message ||
          'Unable to delete user'
        );
      }

      deleteUserId.value = '';

      showMessage(
        dashboardMessage,
        data.message,
        'success'
      );
    } catch (error) {
      showMessage(
        dashboardMessage,
        error.message
      );
    } finally {
      setLoading(
        deleteUserBtn,
        false
      );
    }
  }
);

// ==========================================
// LOGOUT
// ==========================================

logoutBtn.addEventListener(
  'click',
  async () => {
    try {
      await fetch(
        '/api/v1/auth/logout',
        {
          method: 'POST',
          credentials: 'include'
        }
      );
    } finally {
      accessToken = null;
      currentUser = null;

      showAuth();

      showMessage(
        authMessage,
        'Logged out successfully.',
        'success'
      );
    }
  }
);

// ==========================================
// UI RENDERING
// ==========================================

function renderDashboard(user) {
  authSection.classList.add('hidden');
  dashboardSection.classList.remove('hidden');

  navUser.classList.remove('hidden');

  document.getElementById(
    'welcomeText'
  ).textContent =
    `Welcome, ${user.name}`;

  document.getElementById(
    'profileName'
  ).textContent =
    user.name || '-';

  document.getElementById(
    'profileEmail'
  ).textContent =
    user.email || '-';

  document.getElementById(
    'profileRole'
  ).textContent =
    user.role || '-';

  document.getElementById(
    'profileProvider'
  ).textContent =
    user.provider || 'local';

  document.getElementById(
    'avatar'
  ).textContent =
    (user.name || 'U')
      .charAt(0)
      .toUpperCase();

  navRole.textContent = user.role;

  document.getElementById(
    'dashboardRole'
  ).textContent =
    user.role;

  approvePayrollBtn.classList.add(
    'hidden'
  );

  deleteUserArea.classList.add(
    'hidden'
  );

  employeeNotice.classList.add(
    'hidden'
  );

  if (
    user.role === 'Manager' ||
    user.role === 'SuperAdmin'
  ) {
    approvePayrollBtn.classList.remove(
      'hidden'
    );
  }

  if (user.role === 'SuperAdmin') {
    deleteUserArea.classList.remove(
      'hidden'
    );
  }

  if (user.role === 'Employee') {
    employeeNotice.classList.remove(
      'hidden'
    );
  }

  hideMessage(authMessage);
}

function showAuth() {
  dashboardSection.classList.add(
    'hidden'
  );

  authSection.classList.remove(
    'hidden'
  );

  navUser.classList.add('hidden');

  showLogin();
}

// ==========================================
// RESTORE SESSION / OAUTH CALLBACK
// ==========================================

async function initialize() {
  /*
    OAuth callback returns:
    /?oauth=success

    Refresh token exists only as httpOnly cookie.
    We exchange it for a short-lived access token.
  */

  const params =
    new URLSearchParams(
      window.location.search
    );

  const oauthSuccess =
    params.get('oauth') === 'success';

  const restored =
    await refreshSession(false);

  if (restored) {
    const loaded =
      await loadProfile();

    if (loaded && oauthSuccess) {
      showMessage(
        dashboardMessage,
        'GitHub authentication successful.',
        'success'
      );
    }
  } else {
    showAuth();
  }

  // Remove OAuth marker from browser URL
  if (window.location.search) {
    window.history.replaceState(
      {},
      document.title,
      window.location.pathname
    );
  }
}

initialize();