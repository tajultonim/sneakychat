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
  let reports: any[] = [];
  let appeals: any[] = [];
  let isLoading = true;
  let error = '';
  let success = '';
  let activeTab: 'blocked' | 'admins' | 'reports' | 'appeals' = 'blocked';
  let reportStatusTab: 'all' | 'pending' | 'reviewed' | 'actioned' | 'dismissed' = 'pending';

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

    sock.on('admin:reportsUpdated', (data: any) => {
      if (data.data) {
        reports = data.data;
        sortReports();
        success = '🔄 Reports list updated';
        setTimeout(() => {
          success = '';
        }, 3000);
      }
    });

    sock.on('admin:appealsUpdated', (data: any) => {
      if (data.data) {
        appeals = data.data;
        success = '🔄 Appeals list updated';
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
    reports = [];
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

        sock.emit('admin:getReports', (reportsResponse: any) => {
          if (!reportsResponse.error) {
            reports = reportsResponse.data;
            sortReports();
          }

          sock.emit('admin:getAppeals', (appealsResponse: any) => {
            if (!appealsResponse.error) {
              appeals = appealsResponse.data;
            }
            isLoading = false;
          });
        });
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

  function sortReports() {
    reports = reports.sort((a, b) => {
      // Pending reports first
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (a.status !== 'pending' && b.status === 'pending') return 1;
      // Then by date (newest first)
      return b.reported_at - a.reported_at;
    });
  }

  $: filteredReports =
    reportStatusTab === 'all'
      ? reports
      : reports.filter((report) => report.status === reportStatusTab);

  $: reportCounts = {
    all: reports.length,
    pending: reports.filter((report) => report.status === 'pending').length,
    reviewed: reports.filter((report) => report.status === 'reviewed').length,
    actioned: reports.filter((report) => report.status === 'actioned').length,
    dismissed: reports.filter((report) => report.status === 'dismissed').length,
  };

  function handleUpdateReportStatus(reportId: string, newStatus: string) {
    const sock = socket;
    sock.emit('admin:updateReportStatus', { reportId, status: newStatus }, (response: any) => {
      if (response.success) {
        success = `✅ ${response.message}`;
      } else {
        error = `❌ ${response.error || 'Failed to update report'}`;
      }
    });
  }

  function handleUpdateAppealStatus(appealId: string, newStatus: string) {
    const sock = socket;
    sock.emit('admin:updateAppealStatus', { appealId, status: newStatus }, (response: any) => {
      if (response.success) {
        success = `✅ ${response.message}`;
      } else {
        error = `❌ ${response.error || 'Failed to update appeal'}`;
      }
    });
  }

  function getReportSenderIp(report: any): string | null {
    if (!report?.message_meta) return null;
    try {
      const parsed = JSON.parse(report.message_meta);
      return typeof parsed?.senderIp === 'string' ? parsed.senderIp : null;
    } catch {
      return null;
    }
  }

  function handleBlockFromReport(report: any) {
    const userId = report?.reported_user_id;
    if (!userId) {
      error = '❌ Missing reported user ID';
      return;
    }

    const confirmBlock = confirm(`Block ${userId} based on this report?`);
    if (!confirmBlock) return;

    const durationInput = prompt('Block duration in hours (0 = permanent):', '0');
    if (durationInput === null) return;
    const durationHours = Number(durationInput);
    if (!Number.isFinite(durationHours) || durationHours < 0) {
      error = '❌ Invalid duration';
      return;
    }

    const sock = socket;
    const ip = getReportSenderIp(report);
    const reason = `Reported: ${report.reason || 'Policy violation'} (report ${report.report_id})`;

    sock.emit(
      'admin:blockUser',
      {
        userId,
        reason,
        durationHours,
        ip,
        reportId: report.report_id,
      },
      (response: any) => {
        if (response.success) {
          success = `✅ ${response.message}`;
          error = '';
        } else {
          error = `❌ ${response.error || 'Failed to block user'}`;
        }
      }
    );
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
  function parseConversation(report: any): Array<any> {
    if (!report?.conversation_context) return [];
    try {
      const parsed = JSON.parse(report.conversation_context);
      if (Array.isArray(parsed?.messages)) return parsed.messages;
      return [];
    } catch {
      return [];
    }
  }
</script>

<div class="admin-panel relative">
  <h1>👮 Admin Panel</h1>
  <p class="admin-subtitle">Sensitive controls, clean signal. Keep it sharp.</p>

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

    <div class="admin-hero">
      <div>
        <div class="hero-title">Control Room</div>
        <div class="hero-subtitle">Live moderation, instant actions, zero noise.</div>
      </div>
      <div class="hero-actions">
        <button class="ghost-btn" on:click={() => (activeTab = 'blocked')}>Blocked</button>
        {#if isSuperAdmin}
          <button class="ghost-btn" on:click={() => (activeTab = 'admins')}>Admins</button>
          <button class="ghost-btn" on:click={() => (activeTab = 'reports')}>Reports</button>
          <button class="ghost-btn" on:click={() => (activeTab = 'appeals')}>Appeals</button>
        {/if}
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-icon">🚫</div>
        <div>
          <div class="stat-label">Blocked Users</div>
          <div class="stat-value">{blockedUsers.length}</div>
        </div>
      </div>
      {#if isSuperAdmin}
        <div class="stat-card">
          <div class="stat-icon">👥</div>
          <div>
            <div class="stat-label">Admins</div>
            <div class="stat-value">{admins.length}</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">📋</div>
          <div>
            <div class="stat-label">Reports</div>
            <div class="stat-value">{reports.length}</div>
          </div>
        </div>
      {/if}
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
        <button
          class="tab-btn"
          class:active={activeTab === 'reports'}
          on:click={() => (activeTab = 'reports')}
        >
          📋 Reports ({reports.length})
        </button>
        <button
          class="tab-btn"
          class:active={activeTab === 'appeals'}
          on:click={() => (activeTab = 'appeals')}
        >
          📝 Appeals ({appeals.length})
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
      <div class="section-grid">
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
      </div>
    {/if}

    {#if activeTab === 'admins' && isSuperAdmin}
      <div class="section-grid">
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
      </div>
    {/if}

    {#if activeTab === 'reports' && isSuperAdmin}
      <div class="section">
        <h2>📋 User Reports ({reports.length})</h2>

        <div class="report-tabs">
          <button
            class="report-tab-btn"
            class:active={reportStatusTab === 'pending'}
            on:click={() => (reportStatusTab = 'pending')}
          >
            Pending ({reportCounts.pending})
          </button>
          <button
            class="report-tab-btn"
            class:active={reportStatusTab === 'reviewed'}
            on:click={() => (reportStatusTab = 'reviewed')}
          >
            Reviewed ({reportCounts.reviewed})
          </button>
          <button
            class="report-tab-btn"
            class:active={reportStatusTab === 'actioned'}
            on:click={() => (reportStatusTab = 'actioned')}
          >
            Actioned ({reportCounts.actioned})
          </button>
          <button
            class="report-tab-btn"
            class:active={reportStatusTab === 'dismissed'}
            on:click={() => (reportStatusTab = 'dismissed')}
          >
            Dismissed ({reportCounts.dismissed})
          </button>
          <button
            class="report-tab-btn"
            class:active={reportStatusTab === 'all'}
            on:click={() => (reportStatusTab = 'all')}
          >
            All ({reportCounts.all})
          </button>
        </div>

        {#if filteredReports.length === 0}
          <p class="no-data">No reports in this status</p>
        {:else}
          <div class="reports-list">
            {#each filteredReports as report (report.id)}
              <details class="report-item">
                <summary class="report-summary">
                  <div class="report-summary-left">
                    <span class={`status-badge status-${report.status}`}
                      >{report.status.toUpperCase()}</span
                    >
                    <div class="report-title">Report #{report.id}</div>
                  </div>
                  <div class="report-summary-right">
                    <div class="report-time">{formatDate(report.reported_at)}</div>
                    <div class="report-target">{report.reported_user_id}</div>
                  </div>
                </summary>

                <div class="report-detail">
                  <div class="report-content">
                    <div class="report-section">
                      <span class="report-label">Reporter:</span>
                      <span class="report-value">{report.reporter_id}</span>
                    </div>
                    <div class="report-section">
                      <span class="report-label">Reported User:</span>
                      <span class="report-value">{report.reported_user_id}</span>
                    </div>
                    <div class="report-section">
                      <span class="report-label">Chat ID:</span>
                      <span class="report-value report-code">{report.chat_id}</span>
                    </div>
                    <div class="report-section">
                      <span class="report-label">Reason:</span>
                      <div class="report-reason">{report.reason}</div>
                    </div>
                    <div class="report-section">
                      <span class="report-label">Message:</span>
                      <div class="report-message">{report.message_text}</div>
                    </div>
                  </div>

                  <div class="conversation-block">
                    <div class="conversation-title">Conversation</div>
                    {#if parseConversation(report).length === 0}
                      <div class="conversation-empty">No conversation stored</div>
                    {:else}
                      <div class="conversation-list">
                        {#each parseConversation(report) as entry (entry.index)}
                          <div
                            class={`conversation-row ${entry.senderId === report.reported_user_id ? 'conversation-row-reported' : 'conversation-row-other'}`}
                          >
                            <div class="conversation-meta">
                              <span class="conversation-sender">
                                {entry.senderId || 'unknown'}
                              </span>
                              <span class="conversation-sender">
                                {entry.text || 'unknown'}
                              </span>
                              <span class="conversation-time">
                                {entry.sentAt ? formatDate(entry.sentAt) : 'unknown time'}
                              </span>
                            </div>
                            <div
                              class={`conversation-bubble ${entry.senderId === report.reported_user_id ? 'conversation-bubble-reported' : 'conversation-bubble-other'}`}
                            >
                              <span class="conversation-type">{entry.type || 'unknown'}</span>
                              <span class="conversation-text">
                                {entry.text || entry.stickerId || entry.reaction || ''}
                              </span>
                            </div>
                          </div>
                        {/each}
                      </div>
                    {/if}
                  </div>

                  {#if report.message_meta}
                    <details class="report-details">
                      <summary class="report-label">Message Metadata</summary>
                      <pre class="report-meta-content">{report.message_meta}</pre>
                    </details>
                  {/if}

                  {#if report.status === 'pending'}
                    <div class="report-actions">
                      <button
                        class="action-btn btn-reviewed"
                        on:click={() => handleUpdateReportStatus(report.report_id, 'reviewed')}
                      >
                        ✓ Mark Reviewed
                      </button>
                      <button
                        class="action-btn btn-block"
                        on:click={() => handleBlockFromReport(report)}
                      >
                        🚫 Block User
                      </button>
                      <button
                        class="action-btn btn-actioned"
                        on:click={() => handleUpdateReportStatus(report.report_id, 'actioned')}
                      >
                        ⚡ Action Taken
                      </button>
                      <button
                        class="action-btn btn-dismissed"
                        on:click={() => handleUpdateReportStatus(report.report_id, 'dismissed')}
                      >
                        ✕ Dismiss
                      </button>
                    </div>
                  {/if}
                </div>
              </details>
            {/each}
          </div>
        {/if}
      </div>
    {/if}

    {#if activeTab === 'appeals' && isSuperAdmin}
      <div class="section">
        <h2>📝 Appeals ({appeals.length})</h2>

        {#if appeals.length === 0}
          <p class="no-data">No appeals yet</p>
        {:else}
          <div class="reports-list">
            {#each appeals as appeal (appeal.id)}
              <div class="report-item">
                <div class="report-summary">
                  <div class="report-summary-left">
                    <span class={`status-badge status-${appeal.status}`}
                      >{appeal.status.toUpperCase()}</span
                    >
                    <div class="report-title">Appeal #{appeal.id}</div>
                  </div>
                  <div class="report-summary-right">
                    <div class="report-time">{formatDate(appeal.created_at)}</div>
                    <div class="report-target">{appeal.user_id}</div>
                  </div>
                </div>

                <div class="report-detail">
                  <div class="report-content">
                    <div class="report-section">
                      <span class="report-label">User:</span>
                      <span class="report-value">{appeal.user_id}</span>
                    </div>
                    {#if appeal.report_id}
                      <div class="report-section">
                        <span class="report-label">Report:</span>
                        <span class="report-value report-code">{appeal.report_id}</span>
                      </div>
                    {/if}
                    <div class="report-section">
                      <span class="report-label">Reason:</span>
                      <div class="report-reason">{appeal.reason}</div>
                    </div>
                    {#if appeal.message}
                      <div class="report-section">
                        <span class="report-label">Message:</span>
                        <div class="report-message">{appeal.message}</div>
                      </div>
                    {/if}
                  </div>

                  {#if appeal.status === 'pending'}
                    <div class="report-actions">
                      <button
                        class="action-btn btn-actioned"
                        on:click={() => handleUpdateAppealStatus(appeal.appeal_id, 'approved')}
                      >
                        ✓ Approve
                      </button>
                      <button
                        class="action-btn btn-dismissed"
                        on:click={() => handleUpdateAppealStatus(appeal.appeal_id, 'rejected')}
                      >
                        ✕ Reject
                      </button>
                    </div>
                  {/if}
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
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,700;9..144,900&family=Space+Grotesk:wght@400;500;600;700&display=swap');

  :global(:root) {
    --ink-900: #0b1110;
    --ink-800: #0f1715;
    --ink-700: #15211f;
    --mint-200: #c7f7e7;
    --mint-300: #8fe8cd;
    --mint-400: #62d4b2;
    --sun-300: #ffd18b;
    --sun-400: #ffb457;
    --ember-400: #ff6a3d;
    --ember-500: #ff4d2e;
    --lav-400: #b8a4ff;
    --slate-300: #9fb3ad;
    --slate-200: #b9c7c2;
  }

  :global(body) {
    background: radial-gradient(1200px 800px at 10% -10%, rgba(98, 212, 178, 0.18), transparent 60%),
      radial-gradient(900px 700px at 100% 0%, rgba(255, 180, 87, 0.14), transparent 55%),
      linear-gradient(155deg, #0a1110 0%, #0f1917 45%, #0d1412 100%);
    color: var(--mint-200);
    font-family: 'Space Grotesk', system-ui, sans-serif;
  }

  :global(body)::before {
    content: '';
    position: fixed;
    inset: 0;
    pointer-events: none;
    background: linear-gradient(120deg, rgba(255, 255, 255, 0.03), transparent 40%),
      repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.02) 0 1px, transparent 1px 6px);
    opacity: 0.6;
    z-index: 0;
  }

  .admin-panel {
    max-width: 1200px;
    margin: 0 auto;
    padding: 28px 20px 60px;
    font-family: 'Space Grotesk', system-ui, sans-serif;
    min-height: 100vh;
    position: relative;
    z-index: 1;
  }

  .admin-panel::before {
    content: '';
    position: absolute;
    inset: 60px 40px auto auto;
    width: 220px;
    height: 220px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255, 180, 87, 0.25), transparent 70%);
    filter: blur(2px);
    opacity: 0.7;
    pointer-events: none;
  }

  .admin-subtitle {
    text-align: center;
    color: var(--slate-300);
    margin: -16px auto 32px;
    max-width: 520px;
    font-size: 1rem;
  }

  h1 {
    font-family: 'Fraunces', serif;
    color: var(--sun-400);
    margin-bottom: 34px;
    text-align: center;
    font-size: clamp(2.2rem, 3vw, 3rem);
    font-weight: 900;
    letter-spacing: 0.5px;
    text-shadow: 0 8px 24px rgba(255, 106, 61, 0.3);
  }

  h2 {
    font-family: 'Fraunces', serif;
    color: var(--mint-200);
    margin-top: 0;
    margin-bottom: 22px;
    font-size: 1.5em;
    border-bottom: 2px solid rgba(255, 255, 255, 0.08);
  }

  .login-container {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 70vh;
  }

  .login-form {
    background: rgba(15, 23, 21, 0.72);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(98, 212, 178, 0.2);
    border-radius: 22px;
    padding: 52px 42px;
    width: 100%;
    max-width: 420px;
    box-shadow: 0 18px 40px rgba(0, 0, 0, 0.35);
  }

  .login-form h2 {
    text-align: center;
    color: var(--ember-400);
    border: none;
    font-family: 'Fraunces', serif;
    margin-bottom: 30px;
    font-size: 1.8em;
  }

  .admin-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: rgba(15, 23, 21, 0.65);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(98, 212, 178, 0.18);
    border-radius: 20px;
    padding: 18px 24px;
    margin-bottom: 28px;
  }

  .user-info {
    color: var(--mint-200);
    font-weight: 500;
    font-size: 1em;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .logout-btn {
    padding: 10px 22px;
    background: rgba(255, 106, 61, 0.16);
    border: 1px solid rgba(255, 106, 61, 0.35);
    color: var(--sun-300);
    border-radius: 999px;
    cursor: pointer;
    font-weight: 600;
    transition: all 0.3s ease;
  }

  .logout-btn:hover {
    background: rgba(255, 106, 61, 0.3);
    border-color: rgba(255, 106, 61, 0.6);
    transform: translateY(-1px);
  }

  .tabs {
    display: flex;
    gap: 12px;
    margin-bottom: 25px;
    border-bottom: 2px solid rgba(98, 212, 178, 0.12);
    overflow-x: auto;
    padding-bottom: 10px;
  }

  .report-tabs {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 18px;
  }

  .report-tab-btn {
    padding: 8px 16px;
    background: rgba(15, 23, 21, 0.7);
    border: 1px solid rgba(98, 212, 178, 0.16);
    color: var(--slate-300);
    cursor: pointer;
    font-weight: 600;
    font-size: 0.85em;
    transition: all 0.3s ease;
    border-radius: 999px;
    white-space: nowrap;
  }

  .report-tab-btn:hover {
    background: rgba(98, 212, 178, 0.12);
    border-color: rgba(98, 212, 178, 0.35);
    color: var(--mint-200);
    transform: translateY(-1px);
  }

  .report-tab-btn.active {
    background: linear-gradient(120deg, rgba(255, 106, 61, 0.35), rgba(255, 180, 87, 0.22));
    border-color: rgba(255, 180, 87, 0.5);
    color: #1a0f0b;
  }

  .admin-hero {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 24px;
    padding: 20px 24px;
    margin-bottom: 22px;
    border-radius: 20px;
    background: linear-gradient(120deg, rgba(15, 23, 21, 0.85), rgba(26, 40, 36, 0.7));
    border: 1px solid rgba(98, 212, 178, 0.2);
    box-shadow: 0 18px 40px rgba(0, 0, 0, 0.25);
  }

  .hero-title {
    font-family: 'Fraunces', serif;
    font-size: 1.6rem;
    font-weight: 800;
    color: var(--mint-200);
    margin-bottom: 6px;
  }

  .hero-subtitle {
    color: var(--slate-300);
    font-size: 0.95rem;
  }

  .hero-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  .ghost-btn {
    padding: 10px 18px;
    background: rgba(98, 212, 178, 0.1);
    border: 1px solid rgba(98, 212, 178, 0.35);
    color: var(--mint-200);
    border-radius: 999px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .ghost-btn:hover {
    background: rgba(98, 212, 178, 0.2);
    border-color: rgba(98, 212, 178, 0.5);
    transform: translateY(-1px);
  }

  .stat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
    gap: 16px;
    margin-bottom: 24px;
  }

  .stat-card {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 16px 18px;
    border-radius: 18px;
    background: rgba(12, 18, 17, 0.8);
    border: 1px solid rgba(98, 212, 178, 0.18);
  }

  .stat-icon {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    display: grid;
    place-items: center;
    background: rgba(255, 180, 87, 0.2);
    color: #2a1609;
    font-size: 1.1rem;
  }

  .stat-label {
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--slate-300);
  }

  .stat-value {
    font-size: 1.6rem;
    font-weight: 700;
    color: var(--mint-200);
  }

  .section-grid {
    display: grid;
    grid-template-columns: minmax(260px, 1fr) 1.2fr;
    gap: 20px;
    align-items: start;
  }

  .tab-btn {
    padding: 12px 24px;
    background: rgba(15, 23, 21, 0.7);
    border: 1px solid rgba(98, 212, 178, 0.16);
    color: var(--slate-300);
    cursor: pointer;
    font-weight: 600;
    font-size: 0.95em;
    transition: all 0.3s ease;
    border-radius: 999px;
    white-space: nowrap;
  }

  .tab-btn:hover {
    background: rgba(98, 212, 178, 0.12);
    border-color: rgba(98, 212, 178, 0.35);
    color: var(--mint-200);
    transform: translateY(-1px);
  }

  .tab-btn.active {
    background: linear-gradient(120deg, rgba(255, 106, 61, 0.35), rgba(255, 180, 87, 0.22));
    border-color: rgba(255, 180, 87, 0.5);
    color: #1a0f0b;
  }

  .section {
    background: rgba(15, 23, 21, 0.72);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(98, 212, 178, 0.16);
    border-radius: 22px;
    padding: 26px;
    margin-bottom: 26px;
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.28);
  }

  .error-message {
    background: rgba(255, 106, 61, 0.14);
    border: 1px solid rgba(255, 106, 61, 0.35);
    color: var(--sun-300);
    padding: 15px 18px;
    border-radius: 12px;
    margin-bottom: 18px;
    font-weight: 500;
  }

  .success-message {
    background: rgba(98, 212, 178, 0.14);
    border: 1px solid rgba(98, 212, 178, 0.3);
    color: var(--mint-200);
    padding: 15px 18px;
    border-radius: 12px;
    margin-bottom: 18px;
    font-weight: 500;
  }

  .loading {
    text-align: center;
    color: var(--slate-300);
    padding: 40px;
    font-size: 1.1em;
    font-weight: 500;
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  label {
    color: var(--mint-200);
    font-size: 0.85em;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  input,
  textarea,
  select {
    padding: 12px 16px;
    background: rgba(9, 14, 13, 0.75);
    border: 1px solid rgba(98, 212, 178, 0.18);
    color: var(--mint-200);
    border-radius: 12px;
    font-family: inherit;
    font-size: 0.95em;
    transition: all 0.3s ease;
  }

  input:focus,
  textarea:focus,
  select:focus {
    outline: none;
    border-color: rgba(255, 180, 87, 0.6);
    box-shadow: 0 0 22px rgba(255, 180, 87, 0.18);
  }

  input:disabled,
  textarea:disabled,
  select:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  button {
    padding: 12px 24px;
    background: linear-gradient(120deg, rgba(255, 106, 61, 0.35), rgba(255, 180, 87, 0.25));
    border: 1px solid rgba(255, 180, 87, 0.4);
    color: #20110a;
    border-radius: 12px;
    cursor: pointer;
    font-weight: 600;
    font-size: 1em;
    transition: all 0.3s ease;
  }

  button:hover:not(:disabled) {
    background: linear-gradient(120deg, rgba(255, 106, 61, 0.5), rgba(255, 180, 87, 0.4));
    border-color: rgba(255, 180, 87, 0.7);
    color: #1a0f0b;
    transform: translateY(-1px);
    box-shadow: 0 10px 22px rgba(0, 0, 0, 0.25);
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .blocked-users-list,
  .admins-list,
  .reports-list {
    display: flex;
    flex-direction: column;
    gap: 15px;
  }

  .user-card,
  .admin-card,
  .report-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: rgba(12, 18, 17, 0.8);
    border: 1px solid rgba(98, 212, 178, 0.14);
    border-radius: 16px;
    padding: 18px 20px;
    gap: 15px;
    transition: all 0.3s ease;
  }

  .user-card:hover,
  .admin-card:hover,
  .report-card:hover {
    border-color: rgba(255, 180, 87, 0.4);
    background: rgba(255, 180, 87, 0.07);
    transform: translateY(-1px);
  }

  .user-id,
  .admin-id,
  .report-id {
    font-weight: 600;
    color: var(--sun-400);
    margin-bottom: 6px;
    word-break: break-all;
    font-size: 1em;
  }

  .user-reason {
    color: var(--slate-200);
    font-size: 0.9em;
    margin-bottom: 10px;
  }

  .user-details,
  .admin-details {
    display: flex;
    gap: 12px;
    align-items: center;
    font-size: 0.85em;
    flex-wrap: wrap;
  }

  .badge {
    padding: 5px 12px;
    border-radius: 20px;
    font-size: 0.8em;
    font-weight: 600;
    display: inline-block;
  }

  .badge.permanent {
    background: rgba(255, 106, 61, 0.2);
    color: var(--sun-300);
    border: 1px solid rgba(255, 106, 61, 0.4);
  }

  .badge.temporary {
    background: rgba(255, 180, 87, 0.2);
    color: #2d1b0e;
    border: 1px solid rgba(255, 180, 87, 0.4);
  }

  .badge.role-superadmin {
    background: rgba(184, 164, 255, 0.2);
    color: var(--lav-400);
    border: 1px solid rgba(184, 164, 255, 0.4);
  }

  .badge.role-moderator {
    background: rgba(98, 212, 178, 0.18);
    color: var(--mint-200);
    border: 1px solid rgba(98, 212, 178, 0.4);
  }

  .timestamp {
    color: var(--slate-300);
    font-size: 0.85em;
  }

  .unblock-btn {
    background: rgba(98, 212, 178, 0.2);
    border: 1px solid rgba(98, 212, 178, 0.4);
    color: var(--mint-200);
    padding: 10px 16px;
    font-size: 0.9em;
    white-space: nowrap;
    flex-shrink: 0;
    border-radius: 999px;
    cursor: pointer;
    font-weight: 600;
    transition: all 0.3s ease;
  }

  .unblock-btn:hover {
    background: rgba(98, 212, 178, 0.35);
    border-color: rgba(98, 212, 178, 0.6);
    color: #0c1412;
  }

  .admin-actions {
    display: flex;
    gap: 10px;
    flex-shrink: 0;
  }

  .promote-btn,
  .demote-btn,
  .remove-btn {
    padding: 10px 16px;
    font-size: 0.9em;
    white-space: nowrap;
    border-radius: 999px;
    border: 1px solid rgba(98, 212, 178, 0.2);
    cursor: pointer;
    font-weight: 600;
    transition: all 0.3s ease;
  }

  .promote-btn {
    background: rgba(184, 164, 255, 0.2);
    border-color: rgba(184, 164, 255, 0.4);
    color: var(--lav-400);
  }

  .promote-btn:hover {
    background: rgba(184, 164, 255, 0.35);
    border-color: rgba(184, 164, 255, 0.6);
    color: #1a1026;
  }

  .demote-btn {
    background: rgba(98, 212, 178, 0.2);
    border-color: rgba(98, 212, 178, 0.4);
    color: var(--mint-200);
  }

  .demote-btn:hover {
    background: rgba(98, 212, 178, 0.35);
    border-color: rgba(98, 212, 178, 0.6);
    color: #0c1412;
  }

  .remove-btn {
    background: rgba(255, 106, 61, 0.22);
    border-color: rgba(255, 106, 61, 0.45);
    color: var(--sun-300);
  }

  .remove-btn:hover {
    background: rgba(255, 106, 61, 0.35);
    border-color: rgba(255, 106, 61, 0.6);
    color: #1a0f0b;
  }

  .no-data {
    color: var(--slate-300);
    text-align: center;
    padding: 40px 20px;
    font-size: 1.05em;
  }

  .report-card {
    flex-direction: column;
    align-items: stretch;
  }

  .report-header {
    .report-item {
      border: 1px solid rgba(98, 212, 178, 0.16);
      border-radius: 16px;
      background: rgba(12, 18, 17, 0.75);
      overflow: hidden;
    }

    .report-summary {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 16px 18px;
      cursor: pointer;
      list-style: none;
    }

    .report-summary::-webkit-details-marker {
      display: none;
    }

    .report-summary-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .report-summary-right {
      text-align: right;
      color: var(--slate-300);
      font-size: 0.85em;
    }

    .report-title {
      font-weight: 600;
      color: var(--mint-200);
    }

    .report-target {
      color: var(--sun-300);
      font-weight: 600;
    }

    .report-detail {
      padding: 18px;
      border-top: 1px solid rgba(98, 212, 178, 0.12);
    }
    .conversation-block {
      margin-top: 18px;
      padding: 14px 16px;
      border-radius: 14px;
      background: rgba(0, 0, 0, 0.35);
      border: 1px solid rgba(98, 212, 178, 0.18);
    }

    .conversation-title {
      font-weight: 600;
      color: var(--mint-200);
      margin-bottom: 10px;
    }

    .conversation-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-height: 280px;
      overflow-y: auto;
    }

    .conversation-row {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .conversation-row-reported {
      align-items: flex-end;
    }

    .conversation-row-other {
      align-items: flex-start;
    }

    .conversation-meta {
      display: flex;
      justify-content: space-between;
      font-size: 0.75em;
      color: var(--slate-300);
      margin-bottom: 6px;
      gap: 12px;
    }

    .conversation-sender {
      color: var(--sun-300);
      font-weight: 600;
      word-break: break-all;
    }

    .conversation-bubble {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      border-radius: 14px;
      font-size: 0.9em;
      word-break: break-word;
      max-width: 85%;
      border: 1px solid rgba(98, 212, 178, 0.15);
    }

    .conversation-bubble-reported {
      background: rgba(255, 106, 61, 0.18);
      color: #2a1609;
      border-color: rgba(255, 106, 61, 0.35);
    }

    .conversation-bubble-other {
      background: rgba(15, 23, 21, 0.8);
      color: var(--mint-200);
    }

    .conversation-type {
      font-size: 0.75em;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--slate-300);
    }

    .conversation-text {
      color: var(--mint-200);
    }

    .conversation-empty {
      color: var(--slate-300);
      font-size: 0.9em;
    }
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 15px;
    gap: 12px;
    padding-bottom: 12px;
    border-bottom: 1px solid rgba(98, 212, 178, 0.16);
  }

  .status-badge {
    padding: 6px 14px;
    border-radius: 20px;
    font-size: 0.75em;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .status-pending {
    background: rgba(255, 193, 7, 0.15);
    color: #ffd18b;
    border: 1px solid rgba(255, 193, 7, 0.25);
  }

  .status-reviewed {
    background: rgba(184, 164, 255, 0.2);
    color: var(--lav-400);
    border: 1px solid rgba(184, 164, 255, 0.4);
  }

  .status-actioned {
    background: rgba(98, 212, 178, 0.2);
    color: var(--mint-200);
    border: 1px solid rgba(98, 212, 178, 0.4);
  }

  .status-dismissed {
    background: rgba(159, 179, 173, 0.16);
    color: var(--slate-200);
    border: 1px solid rgba(159, 179, 173, 0.35);
  }

  .status-approved {
    background: rgba(98, 212, 178, 0.2);
    color: var(--mint-200);
    border: 1px solid rgba(98, 212, 178, 0.4);
  }

  .status-rejected {
    background: rgba(255, 106, 61, 0.2);
    color: var(--sun-300);
    border: 1px solid rgba(255, 106, 61, 0.4);
  }

  .report-section {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 12px;
    font-size: 0.9em;
  }

  .report-label {
    font-weight: 600;
    color: var(--mint-200);
    min-width: 130px;
    flex-shrink: 0;
    text-transform: uppercase;
    font-size: 0.8em;
    letter-spacing: 0.3px;
  }

  .report-value {
    color: var(--slate-200);
    word-break: break-all;
  }

  .report-code {
    font-family: 'Courier New', monospace;
    font-size: 0.8em;
    background: rgba(0, 0, 0, 0.45);
    padding: 4px 8px;
    border-radius: 4px;
    border: 1px solid rgba(98, 212, 178, 0.2);
  }

  .report-reason,
  .report-message {
    background: rgba(255, 180, 87, 0.12);
    border-left: 4px solid rgba(255, 180, 87, 0.5);
    padding: 12px;
    border-radius: 6px;
    color: #1a120d;
    word-break: break-word;
    white-space: pre-wrap;
    margin-bottom: 10px;
    font-size: 0.9em;
  }

  .report-details {
    cursor: pointer;
    margin-top: 10px;
    border: 1px solid rgba(98, 212, 178, 0.18);
    border-radius: 10px;
    padding: 10px;
    background: rgba(0, 0, 0, 0.35);
  }

  .report-details summary {
    color: var(--mint-200);
    cursor: pointer;
    font-weight: 600;
    user-select: none;
    outline: none;
  }

  .report-meta-content {
    background: rgba(0, 0, 0, 0.4);
    padding: 12px;
    border-radius: 10px;
    overflow-x: auto;
    font-size: 0.8em;
    color: var(--slate-200);
    margin-top: 10px;
    border: 1px solid rgba(98, 212, 178, 0.2);
  }

  .report-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    padding-top: 12px;
    border-top: 1px solid rgba(98, 212, 178, 0.16);
  }

  .action-btn {
    padding: 10px 16px;
    font-size: 0.9em;
    white-space: nowrap;
    border-radius: 999px;
    border: 1px solid rgba(98, 212, 178, 0.2);
    cursor: pointer;
    font-weight: 600;
    transition: all 0.3s ease;
    background: rgba(15, 23, 21, 0.7);
    color: var(--mint-200);
  }

  .action-btn:hover {
    background: rgba(98, 212, 178, 0.2);
    border-color: rgba(98, 212, 178, 0.45);
  }

  .btn-reviewed {
    background: rgba(184, 164, 255, 0.22);
    border-color: rgba(184, 164, 255, 0.45);
    color: var(--lav-400);
  }

  .btn-reviewed:hover {
    background: rgba(184, 164, 255, 0.35);
    border-color: rgba(184, 164, 255, 0.6);
  }

  .btn-actioned {
    background: rgba(98, 212, 178, 0.22);
    border-color: rgba(98, 212, 178, 0.45);
    color: var(--mint-200);
  }

  .btn-actioned:hover {
    background: rgba(98, 212, 178, 0.35);
    border-color: rgba(98, 212, 178, 0.6);
  }

  .btn-block {
    background: rgba(255, 106, 61, 0.22);
    border-color: rgba(255, 106, 61, 0.5);
    color: var(--sun-300);
  }

  .btn-block:hover {
    background: rgba(255, 106, 61, 0.35);
    border-color: rgba(255, 106, 61, 0.7);
  }

  .btn-dismissed {
    background: rgba(159, 179, 173, 0.2);
    border-color: rgba(159, 179, 173, 0.4);
    color: var(--slate-200);
  }

  .btn-dismissed:hover {
    background: rgba(159, 179, 173, 0.35);
    border-color: rgba(159, 179, 173, 0.55);
  }

  @media (max-width: 720px) {
    .admin-hero {
      flex-direction: column;
      align-items: flex-start;
    }

    .section-grid {
      grid-template-columns: 1fr;
    }

    .admin-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
    }

    .user-card,
    .admin-card {
      flex-direction: column;
      align-items: flex-start;
    }

    .admin-actions {
      width: 100%;
      flex-wrap: wrap;
    }
  }
</style>
