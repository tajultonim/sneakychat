<script lang="ts">
  import { onMount } from 'svelte';
  import { connectSocket, socket } from '$lib/socket';

  interface BlockedUser {
    userId: string;
    reason: string;
    blockedUntil: number;
    timeRemaining: number;
    isPermanent: boolean;
  }

  interface AdminUser {
    userId: string;
    role: 'superadmin' | 'moderator';
    createdAt: number;
    createdBy: string | null;
    isActive: boolean;
  }

  // Auth state
  let isAuthenticated = false;
  let adminUsername = '';
  let adminPassword = '';
  let adminToken = '';
  let currentAdminUserId = '';
  let isSuperAdmin = false;
  let loginError = '';
  let isLoggingIn = false;

  // Admin data
  let blockedUsers: BlockedUser[] = [];
  let admins: AdminUser[] = [];
  let isLoading = true;
  let error = '';
  let success = '';
  let activeTab: 'blocked' | 'admins' = 'blocked';

  // Form state for blocking users
  let blockUserId = '';
  let blockReason = '';
  let blockDurationHours = 0;
  let isSubmitting = false;

  // Form state for managing admins
  let newAdminUserId = '';
  let newAdminRole: 'superadmin' | 'moderator' = 'moderator';
  let isSubmittingAdmin = false;

  onMount(() => {
    const stored = localStorage.getItem('adminToken');
    if (stored) {
      verifyToken(stored);
    } else {
      isLoading = false;
    }

    // Listen for real-time updates from other admins
    const sock = socket;

    sock.on('admin:blockedUsersUpdated', (data: any) => {
      if (data.data) {
        blockedUsers = data.data;
        sortBlockedUsers();
        success = '🔄 Blocked users list updated';
        setTimeout(() => {
          success = '';
        }, 3000);
      }
    });

    sock.on('admin:adminsUpdated', (data: any) => {
      if (data.data) {
        admins = data.data;
        sortAdmins();
        success = '🔄 Admins list updated';
        setTimeout(() => {
          success = '';
        }, 3000);
      }
    });
  });

  async function verifyToken(token: string) {
    try {
      const res = await fetch(`${import.meta.env.VITE_SERVER_URL}/api/admin/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      if (res.ok) {
        const data = await res.json();
        adminToken = token;
        currentAdminUserId = data.adminUserId;
        isAuthenticated = true;
        localStorage.setItem('adminToken', token);
        loadAdminData();
      } else {
        localStorage.removeItem('adminToken');
        isLoading = false;
      }
    } catch (err) {
      isLoading = false;
    }
  }

  async function handleLogin() {
    if (!adminUsername || !adminPassword) {
      loginError = '❌ Username and password required';
      return;
    }

    isLoggingIn = true;
    loginError = '';

    try {
      const res = await fetch(`${import.meta.env.VITE_SERVER_URL}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: adminUsername, password: adminPassword }),
      });

      if (res.ok) {
        const data = await res.json();
        adminToken = data.token;
        currentAdminUserId = data.adminUserId;
        isAuthenticated = true;
        localStorage.setItem('adminToken', data.token);
        adminUsername = '';
        adminPassword = '';
        loadAdminData();
      } else {
        const data = await res.json();
        loginError = `❌ ${data.error || 'Login failed'}`;
      }
    } catch (err) {
      loginError = '❌ Connection error';
    } finally {
      isLoggingIn = false;
    }
  }

  function handleLogout() {
    adminToken = '';
    currentAdminUserId = '';
    isAuthenticated = false;
    isSuperAdmin = false;
    blockedUsers = [];
    admins = [];
    localStorage.removeItem('adminToken');
  }

  function loadAdminData() {
    isLoading = true;
    const sock = connectSocket();

    sock.emit('admin:getBlockedUsers', (response: any) => {
      if (response.error) {
        error = '❌ Failed to load blocked users';
      } else if (response.data) {
        blockedUsers = response.data;
        sortBlockedUsers();
      }

      sock.emit('admin:getAllAdmins', (adminsResponse: any) => {
        if (!adminsResponse.error) {
          isSuperAdmin = true;
          admins = adminsResponse.data;
          sortAdmins();
        }
        isLoading = false;
      });
    });
  }

  function sortBlockedUsers() {
    blockedUsers = blockedUsers.sort((a, b) => b.blockedUntil - a.blockedUntil);
  }

  function sortAdmins() {
    admins = admins.sort((a, b) => {
      if (a.role === 'superadmin' && b.role !== 'superadmin') return -1;
      if (a.role !== 'superadmin' && b.role === 'superadmin') return 1;
      return a.userId.localeCompare(b.userId);
    });
  }

  function handleBlockUser() {
    if (!blockUserId.trim()) {
      error = '❌ Please enter a user ID';
      return;
    }

    isSubmitting = true;
    error = '';
    success = '';

    const sock = socket;
    sock.emit(
      'admin:blockUser',
      {
        userId: blockUserId,
        reason: blockReason || 'Blocked by admin',
        durationHours: blockDurationHours,
      },
      (response: any) => {
        isSubmitting = false;

        if (response.success) {
          success = `✅ ${response.message}`;
          blockUserId = '';
          blockReason = '';
          blockDurationHours = 0;

          sock.emit('admin:getBlockedUsers', (response: any) => {
            if (response.data) {
              blockedUsers = response.data;
              sortBlockedUsers();
            }
          });
        } else {
          error = `❌ ${response.error || 'Failed to block user'}`;
        }
      }
    );
  }

  function handleUnblockUser(userId: string) {
    if (!confirm(`Are you sure you want to unblock ${userId}?`)) return;

    const sock = socket;
    sock.emit('admin:unblockUser', { userId }, (response: any) => {
      if (response.success) {
        success = `✅ ${response.message}`;
        error = '';

        sock.emit('admin:getBlockedUsers', (response: any) => {
          if (response.data) {
            blockedUsers = response.data;
            sortBlockedUsers();
          }
        });
      } else {
        error = `❌ ${response.error || 'Failed to unblock user'}`;
      }
    });
  }

  function handleAddAdmin() {
    if (!newAdminUserId.trim()) {
      error = '❌ Please enter a user ID';
      return;
    }

    isSubmittingAdmin = true;
    error = '';
    success = '';

    const sock = socket;
    sock.emit(
      'admin:addAdmin',
      {
        userId: newAdminUserId,
        role: newAdminRole,
      },
      (response: any) => {
        isSubmittingAdmin = false;

        if (response.success) {
          success = `✅ ${response.message}`;
          newAdminUserId = '';
          newAdminRole = 'moderator';

          sock.emit('admin:getAllAdmins', (response: any) => {
            if (response.data) {
              admins = response.data;
              sortAdmins();
            }
          });
        } else {
          error = `❌ ${response.error || 'Failed to add admin'}`;
        }
      }
    );
  }

  function handleRemoveAdmin(userId: string) {
    if (!confirm(`Are you sure you want to remove ${userId} as an admin?`)) return;

    const sock = socket;
    sock.emit('admin:removeAdmin', { userId }, (response: any) => {
      if (response.success) {
        success = `✅ ${response.message}`;
        error = '';

        sock.emit('admin:getAllAdmins', (response: any) => {
          if (response.data) {
            admins = response.data;
            sortAdmins();
          }
        });
      } else {
        error = `❌ ${response.error || 'Failed to remove admin'}`;
      }
    });
  }

  function handleUpdateAdminRole(userId: string, newRole: 'superadmin' | 'moderator') {
    if (!confirm(`Change ${userId} to ${newRole}?`)) return;

    const sock = socket;
    sock.emit('admin:updateAdminRole', { userId, role: newRole }, (response: any) => {
      if (response.success) {
        success = `✅ ${response.message}`;
        error = '';

        sock.emit('admin:getAllAdmins', (response: any) => {
          if (response.data) {
            admins = response.data;
            sortAdmins();
          }
        });
      } else {
        error = `❌ ${response.error || 'Failed to update role'}`;
      }
    });
  }

  function formatTimeRemaining(ms: number): string {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m`;
    return 'Expired';
  }

  function formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleString();
  }
</script>

<div class="admin-panel relative">
  <h1>👮 Admin Panel</h1>

  {#if !isAuthenticated}
    <div class="login-container">
      <div class="login-form">
        <h2>🔐 Admin Login</h2>

        {#if loginError}
          <div class="error-message">{loginError}</div>
        {/if}

        <form on:submit|preventDefault={handleLogin}>
          <div class="form-group">
            <label for="username">Username</label>
            <input
              id="username"
              type="text"
              bind:value={adminUsername}
              placeholder="Enter admin username"
              disabled={isLoggingIn}
              autocomplete="username"
            />
          </div>

          <div class="form-group">
            <label for="password">Password</label>
            <input
              id="password"
              type="password"
              bind:value={adminPassword}
              placeholder="Enter admin password"
              disabled={isLoggingIn}
              autocomplete="current-password"
            />
          </div>

          <button type="submit" disabled={isLoggingIn}>
            {isLoggingIn ? '⏳ Logging in...' : '🔐 Login'}
          </button>
        </form>
      </div>
    </div>
  {:else if isLoading}
    <div class="loading">Loading admin panel...</div>
  {:else}
    <div class="admin-header">
      <div class="user-info">
        Logged in as: <strong>{currentAdminUserId}</strong>
        {#if isSuperAdmin}
          <span class="badge superadmin-badge">👑 Superadmin</span>
        {:else}
          <span class="badge moderator-badge">🛡️ Moderator</span>
        {/if}
      </div>
      <button class="logout-btn" on:click={handleLogout}>🚪 Logout</button>
    </div>

    <div class="tabs">
      <button
        class="tab-btn"
        class:active={activeTab === 'blocked'}
        on:click={() => (activeTab = 'blocked')}
      >
        🚫 Blocked Users ({blockedUsers.length})
      </button>
      {#if isSuperAdmin}
        <button
          class="tab-btn"
          class:active={activeTab === 'admins'}
          on:click={() => (activeTab = 'admins')}
        >
          👥 Manage Admins ({admins.length})
        </button>
      {/if}
    </div>

    {#if error}
      <div class="error-message">{error}</div>
    {/if}

    {#if success}
      <div class="success-message">{success}</div>
    {/if}

    {#if activeTab === 'blocked'}
      <div class="section">
        <h2>🚫 Block a User</h2>

        <form on:submit|preventDefault={handleBlockUser}>
          <div class="form-group">
            <label for="userId">User ID</label>
            <input
              id="userId"
              type="text"
              bind:value={blockUserId}
              placeholder="Enter user ID to block"
              disabled={isSubmitting}
            />
          </div>

          <div class="form-group">
            <label for="reason">Reason (optional)</label>
            <textarea
              id="reason"
              bind:value={blockReason}
              placeholder="Why are you blocking this user?"
              disabled={isSubmitting}
              rows="3"
            ></textarea>
          </div>

          <div class="form-group">
            <label for="duration">Duration (hours, 0 = permanent)</label>
            <input
              id="duration"
              type="number"
              bind:value={blockDurationHours}
              min="0"
              step="1"
              disabled={isSubmitting}
            />
          </div>

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? '⏳ Processing...' : '🚫 Block User'}
          </button>
        </form>
      </div>

      <div class="section">
        <h2>📋 Blocked Users ({blockedUsers.length})</h2>

        {#if blockedUsers.length === 0}
          <p class="no-data">No blocked users</p>
        {:else}
          <div class="blocked-users-list">
            {#each blockedUsers as user (user.userId)}
              <div class="user-card">
                <div class="user-info">
                  <div class="user-id">{user.userId}</div>
                  <div class="user-reason">{user.reason}</div>
                  <div class="user-details">
                    {#if user.isPermanent}
                      <span class="badge permanent">🔒 Permanent</span>
                    {:else}
                      <span class="badge temporary"
                        >⏱️ {formatTimeRemaining(user.timeRemaining)}</span
                      >
                    {/if}
                    <span class="timestamp">Blocked: {formatDate(user.blockedUntil)}</span>
                  </div>
                </div>
                <button class="unblock-btn" on:click={() => handleUnblockUser(user.userId)}>
                  ↩️ Unblock
                </button>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}

    {#if activeTab === 'admins' && isSuperAdmin}
      <div class="section">
        <h2>➕ Add Admin</h2>

        <form on:submit|preventDefault={handleAddAdmin}>
          <div class="form-group">
            <label for="adminUserId">User ID</label>
            <input
              id="adminUserId"
              type="text"
              bind:value={newAdminUserId}
              placeholder="Enter user ID to make admin"
              disabled={isSubmittingAdmin}
            />
          </div>

          <div class="form-group">
            <label for="adminRole">Role</label>
            <select id="adminRole" bind:value={newAdminRole} disabled={isSubmittingAdmin}>
              <option value="moderator">Moderator</option>
              <option value="superadmin">Superadmin</option>
            </select>
          </div>

          <button type="submit" disabled={isSubmittingAdmin}>
            {isSubmittingAdmin ? '⏳ Processing...' : '➕ Add Admin'}
          </button>
        </form>
      </div>

      <div class="section">
        <h2>👥 Current Admins ({admins.length})</h2>

        {#if admins.length === 0}
          <p class="no-data">No admins yet</p>
        {:else}
          <div class="admins-list">
            {#each admins as admin (admin.userId)}
              <div class="admin-card">
                <div class="admin-info">
                  <div class="admin-id">{admin.userId}</div>
                  <div class="admin-role">
                    {#if admin.role === 'superadmin'}
                      <span class="badge role-superadmin">👑 Superadmin</span>
                    {:else}
                      <span class="badge role-moderator">🛡️ Moderator</span>
                    {/if}
                  </div>
                  <div class="admin-details">
                    <span class="timestamp">Added: {formatDate(admin.createdAt)}</span>
                    {#if admin.createdBy}
                      <span class="timestamp">By: {admin.createdBy}</span>
                    {/if}
                  </div>
                </div>
                <div class="admin-actions">
                  {#if admin.role === 'moderator'}
                    <button
                      class="promote-btn"
                      on:click={() => handleUpdateAdminRole(admin.userId, 'superadmin')}
                    >
                      ⬆️ Promote
                    </button>
                  {:else}
                    <button
                      class="demote-btn"
                      on:click={() => handleUpdateAdminRole(admin.userId, 'moderator')}
                    >
                      ⬇️ Demote
                    </button>
                  {/if}
                  <button class="remove-btn" on:click={() => handleRemoveAdmin(admin.userId)}>
                    ❌ Remove
                  </button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  {/if}
</div>

<style>
  .admin-panel {
    max-width: 900px;
    margin: 0 auto;
    padding: 20px;
    font-family: 'Courier New', monospace;
    min-height: 100vh;
  }

  h1 {
    color: #ffd700;
    margin-bottom: 30px;
    text-align: center;
  }

  h2 {
    color: #ffa500;
    margin-top: 0;
    margin-bottom: 15px;
    border-bottom: 2px solid #ffa500;
    padding-bottom: 10px;
  }

  .login-container {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 60vh;
  }

  .login-form {
    background: rgba(0, 0, 0, 0.3);
    border: 2px solid #ffa500;
    border-radius: 12px;
    padding: 40px;
    width: 100%;
    max-width: 400px;
  }

  .login-form h2 {
    text-align: center;
    color: #ffd700;
    border: none;
    margin-bottom: 30px;
  }

  .admin-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: rgba(255, 165, 0, 0.1);
    border: 1px solid #ffa500;
    border-radius: 8px;
    padding: 15px 20px;
    margin-bottom: 20px;
  }

  .user-info {
    color: #ffa500;
    font-weight: bold;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .logout-btn {
    padding: 8px 15px;
    background: #ff6b6b;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: bold;
  }

  .logout-btn:hover {
    background: #ff5252;
  }

  .tabs {
    display: flex;
    gap: 10px;
    margin-bottom: 20px;
    border-bottom: 2px solid #ffa500;
  }

  .tab-btn {
    padding: 12px 20px;
    background: rgba(255, 165, 0, 0.1);
    color: #ffa500;
    border: none;
    cursor: pointer;
    font-weight: bold;
    transition: all 0.3s ease;
    border-bottom: 3px solid transparent;
  }

  .tab-btn:hover {
    background: rgba(255, 165, 0, 0.2);
  }

  .tab-btn.active {
    background: rgba(255, 165, 0, 0.2);
    border-bottom-color: #ffd700;
  }

  .section {
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid #ffa500;
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 20px;
  }

  .error-message {
    background: rgba(255, 0, 0, 0.1);
    border: 1px solid #ff0000;
    color: #ff6b6b;
    padding: 12px;
    border-radius: 4px;
    margin-bottom: 15px;
  }

  .success-message {
    background: rgba(0, 255, 0, 0.1);
    border: 1px solid #00ff00;
    color: #51cf66;
    padding: 12px;
    border-radius: 4px;
    margin-bottom: 15px;
  }

  .loading {
    text-align: center;
    color: #ffa500;
    padding: 40px;
    font-size: 18px;
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 15px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
  }

  label {
    color: #ffa500;
    margin-bottom: 5px;
    font-weight: bold;
  }

  input,
  textarea,
  select {
    padding: 10px;
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid #ffa500;
    color: #fff;
    border-radius: 4px;
    font-family: inherit;
    font-size: 14px;
  }

  input:disabled,
  textarea:disabled,
  select:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  input:focus,
  textarea:focus,
  select:focus {
    outline: none;
    border-color: #ffd700;
    box-shadow: 0 0 8px rgba(255, 215, 0, 0.3);
  }

  button {
    padding: 12px 20px;
    background: #ff6b6b;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: bold;
    font-size: 16px;
    transition: all 0.3s ease;
  }

  button:hover:not(:disabled) {
    background: #ff5252;
    transform: scale(1.02);
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .blocked-users-list,
  .admins-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .user-card,
  .admin-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid #ff0000;
    border-radius: 6px;
    padding: 15px;
    gap: 15px;
  }

  .admin-card {
    border-color: #ffa500;
  }

  .user-info,
  .admin-info {
    flex: 1;
  }

  .user-id,
  .admin-id {
    font-weight: bold;
    color: #ffa500;
    margin-bottom: 5px;
    word-break: break-all;
  }

  .user-reason {
    color: #ccc;
    font-size: 14px;
    margin-bottom: 8px;
  }

  .user-details,
  .admin-details {
    display: flex;
    gap: 10px;
    align-items: center;
    font-size: 12px;
    flex-wrap: wrap;
  }

  .admin-role {
    margin-bottom: 8px;
  }

  .badge {
    padding: 3px 8px;
    border-radius: 3px;
    font-size: 12px;
    font-weight: bold;
  }

  .badge.permanent {
    background: rgba(255, 0, 0, 0.3);
    color: #ff6b6b;
  }

  .badge.temporary {
    background: rgba(255, 165, 0, 0.3);
    color: #ffa500;
  }

  .badge.role-superadmin {
    background: rgba(255, 215, 0, 0.3);
    color: #ffd700;
  }

  .badge.role-moderator {
    background: rgba(100, 149, 237, 0.3);
    color: #87ceeb;
  }

  .badge.superadmin-badge,
  .badge.moderator-badge {
    margin-left: 10px;
    padding: 5px 10px;
  }

  .timestamp {
    color: #888;
  }

  .unblock-btn {
    background: #51cf66;
    padding: 8px 12px;
    font-size: 14px;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .unblock-btn:hover {
    background: #40c057;
  }

  .admin-actions {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
  }

  .promote-btn,
  .demote-btn,
  .remove-btn {
    padding: 8px 12px;
    font-size: 14px;
    white-space: nowrap;
  }

  .promote-btn {
    background: #6db3f2;
  }

  .promote-btn:hover {
    background: #5a9fd4;
  }

  .demote-btn {
    background: #f59f00;
  }

  .demote-btn:hover {
    background: #d48806;
  }

  .remove-btn {
    background: #ff6b6b;
  }

  .remove-btn:hover {
    background: #ff5252;
  }

  .no-data {
    color: #aaa;
    text-align: center;
    padding: 20px;
  }
</style>
