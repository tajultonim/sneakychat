<script lang="ts">
  import { browser } from '$app/environment';
  import { afterNavigate, replaceState } from '$app/navigation';
  import { onDestroy, onMount } from 'svelte';
  import { connectSocket, socket } from '$lib/socket';
  import { renderMarkdown } from '$lib/markdown';

  type TabKey = 'blocked' | 'admins' | 'reports' | 'appeals';
  type ReportStatusTab = 'all' | 'pending' | 'actioned' | 'dismissed';
  type AppealStatusTab = 'all' | 'pending' | 'approved' | 'rejected';

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
  let isRoleKnown = false;
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
  let activeTab: TabKey = 'reports';
  let reportStatusTab: ReportStatusTab = 'pending';
  let appealStatusTab: AppealStatusTab = 'pending';
  let selectedReportId = '';
  let selectedAppealId = '';
  let requestedTab: TabKey | null = null;
  let noticeMarkdown = '';
  let noticeCreatedAt: number | null = null;
  let noticeCreatedBy = '';
  let isSubmittingNotice = false;
  let noticePreviewHtml = '';
  let noticeExpireMode: 'none' | 'hours' | 'date' = 'none';
  let noticeExpireHours = 24;
  let noticeExpireDate = '';

  // Form state for blocking users
  let blockUserId = '';
  let blockReason = '';
  let blockDurationHours = 0;
  let isSubmitting = false;

  // Form state for managing admins
  let newAdminUserId = '';
  let newAdminRole: 'superadmin' | 'moderator' = 'moderator';
  let isSubmittingAdmin = false;

  const superTabs: TabKey[] = ['admins', 'reports', 'appeals'];

  function isTabKey(value: string): value is TabKey {
    return ['blocked', 'admins', 'reports', 'appeals'].includes(value);
  }

  function resolveTab(tab: TabKey): TabKey {
    if (superTabs.includes(tab)) {
      return isSuperAdmin ? tab : 'blocked';
    }
    return tab;
  }

  function syncTabToUrl(tab: TabKey): void {
    if (!browser) return;
    const params = new URLSearchParams(window.location.search);
    params.set('tab', tab);
    const next = `${window.location.pathname}?${params.toString()}`;
    replaceState(next, {});
  }

  function applyTab(tab: TabKey): void {
    activeTab = resolveTab(tab);
    syncTabToUrl(activeTab);
  }

  function resolveRequestedTab(): void {
    if (requestedTab) {
      applyTab(requestedTab);
      requestedTab = null;
    } else if (!isSuperAdmin && activeTab !== 'blocked') {
      applyTab('blocked');
    } else {
      syncTabToUrl(activeTab);
    }
  }

  function initTabFromUrl(): void {
    if (!browser) return;
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab') || '';
    if (!tab || !isTabKey(tab)) {
      syncTabToUrl(activeTab);
      return;
    }

    if (!isRoleKnown && superTabs.includes(tab)) {
      requestedTab = tab;
      return;
    }

    applyTab(tab);
  }

  onMount(() => {
    let initialized = false;
    afterNavigate(() => {
      if (initialized) return;
      initialized = true;
      initTabFromUrl();
    });

    const stored = browser ? localStorage.getItem('adminToken') : null;
    if (stored) {
      verifyToken(stored);
    } else {
      isLoading = false;
    }

    const handleBlockedUpdated = (data: any) => {
      if (data.data) {
        blockedUsers = data.data;
        sortBlockedUsers();
        success = 'Blocked users list updated.';
        setTimeout(() => {
          success = '';
        }, 2400);
      }
    };

    const handleAdminsUpdated = (data: any) => {
      if (data.data) {
        admins = data.data;
        sortAdmins();
        success = 'Admins list updated.';
        setTimeout(() => {
          success = '';
        }, 2400);
      }
    };

    const handleReportsUpdated = (data: any) => {
      if (Array.isArray(data.data)) {
        reports = data.data;
        sortReports();
        success = 'Reports list updated.';
        setTimeout(() => {
          success = '';
        }, 2400);
      }
    };

    const handleAppealsUpdated = (data: any) => {
      if (Array.isArray(data.data)) {
        appeals = data.data;
        success = 'Appeals list updated.';
        setTimeout(() => {
          success = '';
        }, 2400);
      }
    };

    socket.on('admin:blockedUsersUpdated', handleBlockedUpdated);
    socket.on('admin:adminsUpdated', handleAdminsUpdated);
    socket.on('admin:reportsUpdated', handleReportsUpdated);
    socket.on('admin:appealsUpdated', handleAppealsUpdated);

    onDestroy(() => {
      socket.off('admin:blockedUsersUpdated', handleBlockedUpdated);
      socket.off('admin:adminsUpdated', handleAdminsUpdated);
      socket.off('admin:reportsUpdated', handleReportsUpdated);
      socket.off('admin:appealsUpdated', handleAppealsUpdated);
    });
  });

  async function verifyToken(token: string): Promise<void> {
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
    } catch {
      isLoading = false;
    }
  }

  async function handleLogin(): Promise<void> {
    if (!adminUsername || !adminPassword) {
      loginError = 'Username and password required.';
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
        loginError = data.error || 'Login failed.';
      }
    } catch {
      loginError = 'Connection error.';
    } finally {
      isLoggingIn = false;
    }
  }

  function handleLogout(): void {
    adminToken = '';
    currentAdminUserId = '';
    isAuthenticated = false;
    isSuperAdmin = false;
    isRoleKnown = false;
    blockedUsers = [];
    admins = [];
    reports = [];
    appeals = [];
    localStorage.removeItem('adminToken');
    activeTab = 'reports';
    syncTabToUrl('reports');
  }

  function emit(event: string, payload?: unknown): Promise<any> {
    return new Promise((resolve, reject) => {
      const handler = (first: any, second?: any) => {
        if (first && typeof first === 'object' && 'error' in first && !second) {
          reject(first);
          return;
        }
        if (second !== undefined) {
          if (first) {
            reject(first);
            return;
          }
          resolve(second);
          return;
        }
        resolve(first);
      };

      if (payload === undefined) {
        socket.emitwithtimeout(event, handler);
      } else {
        socket.emitwithtimeout(event, payload, handler);
      }
    });
  }

  async function loadAdminData(): Promise<void> {
    isLoading = true;
    error = '';
    connectSocket();

    try {
      const blockedResponse = await emit('admin:getBlockedUsers');
      if (blockedResponse?.error) {
        error = 'Failed to load blocked users.';
      } else if (blockedResponse?.data) {
        blockedUsers = blockedResponse.data;
        sortBlockedUsers();
      }

      const adminsResponse = await emit('admin:getAllAdmins');
      if (!adminsResponse?.error) {
        isSuperAdmin = true;
        admins = adminsResponse.data;
        sortAdmins();
      } else {
        isSuperAdmin = false;
      }

      isRoleKnown = true;
      resolveRequestedTab();

      const reportsResponse = await emit('admin:getReports');
      if (!reportsResponse?.error) {
        reports = Array.isArray(reportsResponse?.data) ? reportsResponse.data : [];
        sortReports();
      }

      const appealsResponse = await emit('admin:getAppeals');
      if (!appealsResponse?.error) {
        appeals = Array.isArray(appealsResponse?.data) ? appealsResponse.data : [];
      }

      const noticeResponse = await emit('admin:getNotice');
      if (!noticeResponse?.error) {
        const notice = noticeResponse?.data;
        if (notice?.content) {
          noticeMarkdown = notice.content;
          noticeCreatedAt = notice.created_at || null;
          noticeCreatedBy = notice.created_by || '';
          if (typeof notice.expires_at === 'number' && notice.expires_at > 0) {
            noticeExpireMode = 'date';
            noticeExpireDate = new Date(notice.expires_at).toISOString().slice(0, 16);
          } else {
            noticeExpireMode = 'none';
            noticeExpireDate = '';
          }
        } else {
          noticeMarkdown = '';
          noticeCreatedAt = null;
          noticeCreatedBy = '';
        }
      }
    } catch (err) {
      console.log(err);
      error = 'Admin panel timed out. Check the server connection.';
      isSuperAdmin = false;
      isRoleKnown = true;
      resolveRequestedTab();
    } finally {
      isLoading = false;
    }
  }

  function sortBlockedUsers(): void {
    blockedUsers = blockedUsers.sort((a, b) => b.blockedUntil - a.blockedUntil);
  }

  function sortAdmins(): void {
    admins = admins.sort((a, b) => {
      if (a.role === 'superadmin' && b.role !== 'superadmin') return -1;
      if (a.role !== 'superadmin' && b.role === 'superadmin') return 1;
      return a.userId.localeCompare(b.userId);
    });
  }

  function sortReports(): void {
    reports = reports.sort((a, b) => {
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (a.status !== 'pending' && b.status === 'pending') return 1;
      return b.created_at - a.created_at;
    });
  }

  $: filteredReports =
    reportStatusTab === 'all'
      ? reports
      : reports.filter((report) => report.status === reportStatusTab);

  $: reportCounts = {
    all: reports.length,
    pending: reports.filter((report) => report.status === 'pending').length,
    actioned: reports.filter((report) => report.status === 'actioned').length,
    dismissed: reports.filter((report) => report.status === 'dismissed').length,
  };

  $: filteredAppeals =
    appealStatusTab === 'all'
      ? appeals
      : appeals.filter((appeal) => appeal.status === appealStatusTab);

  $: appealCounts = {
    all: appeals.length,
    pending: appeals.filter((appeal) => appeal.status === 'pending').length,
    approved: appeals.filter((appeal) => appeal.status === 'approved').length,
    rejected: appeals.filter((appeal) => appeal.status === 'rejected').length,
  };

  $: if (
    filteredReports.length &&
    !filteredReports.find((r) => getReportId(r) === selectedReportId)
  ) {
    selectedReportId = getReportId(filteredReports[0]);
  }

  $: if (
    filteredAppeals.length &&
    !filteredAppeals.find((a) => getAppealId(a) === selectedAppealId)
  ) {
    selectedAppealId = getAppealId(filteredAppeals[0]);
  }

  $: selectedReport = reports.find((report) => getReportId(report) === selectedReportId) || null;
  $: selectedAppeal = appeals.find((appeal) => getAppealId(appeal) === selectedAppealId) || null;
  $: noticePreviewHtml = renderMarkdown(noticeMarkdown);

  function handleUpdateReportStatus(reportId: string, newStatus: string): void {
    socket.emit('admin:updateReportStatus', { reportId, status: newStatus }, (response: any) => {
      if (response.success) {
        success = response.message || 'Report updated.';
        reports = reports.map((report) =>
          getReportId(report) === reportId
            ? {
                ...report,
                status: newStatus,
                reviewed_at: Date.now(),
                reviewed_by: currentAdminUserId,
              }
            : report
        );
        sortReports();
      } else {
        error = response.error || 'Failed to update report.';
      }
    });
  }

  function handleUpdateAppealStatus(appealId: string, newStatus: string): void {
    socket.emit('admin:updateAppealStatus', { appealId, status: newStatus }, (response: any) => {
      if (response.success) {
        success = response.message || 'Appeal updated.';
        appeals = appeals.map((appeal) =>
          getAppealId(appeal) === appealId
            ? {
                ...appeal,
                status: newStatus,
                reviewed_at: Date.now(),
                reviewed_by: currentAdminUserId,
              }
            : appeal
        );
      } else {
        error = response.error || 'Failed to update appeal.';
      }
    });
  }

  function handleSendNotice(): void {
    if (!noticeMarkdown.trim()) {
      error = 'Notice content is required.';
      return;
    }

    let expiresAt: number | null = null;
    if (noticeExpireMode === 'hours') {
      const hours = Number(noticeExpireHours);
      if (!Number.isFinite(hours) || hours <= 0) {
        error = 'Expiration hours must be greater than 0.';
        return;
      }
      expiresAt = Date.now() + hours * 60 * 60 * 1000;
    } else if (noticeExpireMode === 'date') {
      if (!noticeExpireDate) {
        error = 'Expiration date is required.';
        return;
      }
      const parsed = Date.parse(noticeExpireDate);
      if (Number.isNaN(parsed)) {
        error = 'Expiration date is invalid.';
        return;
      }
      expiresAt = parsed;
    }

    isSubmittingNotice = true;
    error = '';
    success = '';

    socket.emit('admin:setNotice', { content: noticeMarkdown, expiresAt }, (response: any) => {
      isSubmittingNotice = false;
      if (response.success) {
        success = 'Notice sent.';
        noticeCreatedAt = response.data?.created_at || Date.now();
        noticeCreatedBy = response.data?.created_by || currentAdminUserId;
      } else {
        error = response.error || 'Failed to send notice.';
      }
    });
  }

  function handleClearNotice(): void {
    if (!confirm('Clear the active notice?')) return;

    isSubmittingNotice = true;
    error = '';
    success = '';

    socket.emit('admin:clearNotice', {}, (response: any) => {
      isSubmittingNotice = false;
      if (response.success) {
        success = 'Notice cleared.';
        noticeMarkdown = '';
        noticeCreatedAt = null;
        noticeCreatedBy = '';
      } else {
        error = response.error || 'Failed to clear notice.';
      }
    });
  }

  function handleDeleteReport(reportId: string): void {
    const confirmed = confirm(`Delete report ${reportId}? This cannot be undone.`);
    if (!confirmed) return;

    socket.emit('admin:deleteReport', { reportId }, (response: any) => {
      if (response.success) {
        success = response.message || 'Report deleted.';
        error = '';
        reports = reports.filter((report) => getReportId(report) !== reportId);
        if (selectedReportId === reportId) {
          selectedReportId = '';
        }
      } else {
        error = response.error || 'Failed to delete report.';
      }
    });
  }

  function handleDeleteAppeal(appealId: string): void {
    const confirmed = confirm(`Delete appeal ${appealId}? This cannot be undone.`);
    if (!confirmed) return;

    socket.emit('admin:deleteAppeal', { appealId }, (response: any) => {
      if (response.success) {
        success = response.message || 'Appeal deleted.';
        error = '';
        appeals = appeals.filter((appeal) => getAppealId(appeal) !== appealId);
        if (selectedAppealId === appealId) {
          selectedAppealId = '';
        }
      } else {
        error = response.error || 'Failed to delete appeal.';
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

  function handleBlockFromReport(report: any): void {
    const userId = report?.reported_user_id;
    if (!userId) {
      error = 'Missing reported user ID.';
      return;
    }

    const confirmBlock = confirm(`Block ${userId} based on this report?`);
    if (!confirmBlock) return;

    const durationInput = prompt('Block duration in hours (0 = permanent):', '0');
    if (durationInput === null) return;
    const durationHours = Number(durationInput);
    if (!Number.isFinite(durationHours) || durationHours < 0) {
      error = 'Invalid duration.';
      return;
    }

    const ip = getReportSenderIp(report);
    const reason = `Reported: ${report.reason || 'Policy violation'} (report ${getReportId(report)})`;

    socket.emit(
      'admin:blockUser',
      {
        userId,
        reason,
        durationHours,
        ip,
        reportId: getReportId(report),
      },
      (response: any) => {
        if (response.success) {
          success = response.message || 'User blocked.';
          error = '';
        } else {
          error = response.error || 'Failed to block user.';
        }
      }
    );
  }

  function handleBlockUser(): void {
    if (!blockUserId.trim()) {
      error = 'Please enter a user ID.';
      return;
    }

    isSubmitting = true;
    error = '';
    success = '';

    socket.emit(
      'admin:blockUser',
      {
        userId: blockUserId,
        reason: blockReason || 'Blocked by admin',
        durationHours: blockDurationHours,
      },
      (response: any) => {
        isSubmitting = false;

        if (response.success) {
          success = response.message || 'User blocked.';
          blockUserId = '';
          blockReason = '';
          blockDurationHours = 0;
        } else {
          error = response.error || 'Failed to block user.';
        }
      }
    );
  }

  function handleUnblockUser(userId: string): void {
    if (!confirm(`Are you sure you want to unblock ${userId}?`)) return;

    socket.emit('admin:unblockUser', { userId }, (response: any) => {
      if (response.success) {
        success = response.message || 'User unblocked.';
        error = '';
      } else {
        error = response.error || 'Failed to unblock user.';
      }
    });
  }

  function handleAddAdmin(): void {
    if (!newAdminUserId.trim()) {
      error = 'Please enter a user ID.';
      return;
    }

    isSubmittingAdmin = true;
    error = '';
    success = '';

    socket.emit(
      'admin:addAdmin',
      {
        userId: newAdminUserId,
        role: newAdminRole,
      },
      (response: any) => {
        isSubmittingAdmin = false;

        if (response.success) {
          success = response.message || 'Admin added.';
          newAdminUserId = '';
          newAdminRole = 'moderator';
        } else {
          error = response.error || 'Failed to add admin.';
        }
      }
    );
  }

  function handleRemoveAdmin(userId: string): void {
    if (!confirm(`Are you sure you want to remove ${userId} as an admin?`)) return;

    socket.emit('admin:removeAdmin', { userId }, (response: any) => {
      if (response.success) {
        success = response.message || 'Admin removed.';
        error = '';
      } else {
        error = response.error || 'Failed to remove admin.';
      }
    });
  }

  function handleUpdateAdminRole(userId: string, newRole: 'superadmin' | 'moderator'): void {
    if (!confirm(`Change ${userId} to ${newRole}?`)) return;

    socket.emit('admin:updateAdminRole', { userId, role: newRole }, (response: any) => {
      if (response.success) {
        success = response.message || 'Admin updated.';
        error = '';
      } else {
        error = response.error || 'Failed to update role.';
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

  function formatDate(timestamp: any): string {
    if (typeof timestamp === 'string') {
      const parsed = parseInt(timestamp);
      if (isNaN(parsed)) return timestamp;
      timestamp = parsed;
    }
    const d = new Date(parseInt(timestamp));
    return d.toLocaleString();
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

  function parseMessageMeta(meta: string | null): Record<string, unknown> | null {
    if (!meta) return null;
    try {
      const parsed = JSON.parse(meta);
      if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
      return null;
    } catch {
      return null;
    }
  }

  function getReportId(report: any): string {
    return report?.report_id || report?.id || '';
  }

  function getAppealId(appeal: any): string {
    return appeal?.appeal_id || appeal?.id || '';
  }

  function statusBadgeClass(status: string): string {
    switch (status) {
      case 'pending':
        return 'bg-amber-400/20 text-amber-200 border-amber-300/40';
      case 'actioned':
        return 'bg-green/20 text-green border-green/50';
      case 'dismissed':
        return 'bg-white/10 text-muted border-white/15';
      case 'approved':
        return 'bg-green/20 text-green border-green/50';
      case 'rejected':
        return 'bg-fox/20 text-fox border-fox/50';
      default:
        return 'bg-white/10 text-cream border-white/20';
    }
  }
</script>

<div class="relative min-h-screen overflow-hidden bg-forest text-cream font-nunito">
  <div
    class="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_600px_at_12%_-10%,rgba(124,58,237,0.18),transparent_65%),radial-gradient(900px_520px_at_100%_0%,rgba(255,107,53,0.2),transparent_60%),linear-gradient(160deg,rgba(15,26,15,0.95),rgba(10,14,10,0.98))]"
  ></div>
  <div
    class="pointer-events-none absolute -top-24 -left-20 h-72 w-72 rounded-full bg-berry/25 blur-3xl"
  ></div>
  <div
    class="pointer-events-none absolute -bottom-20 -right-16 h-80 w-80 rounded-full bg-fox/25 blur-3xl"
  ></div>

  <div class="relative mx-auto flex min-h-screen max-w-6xl flex-col px-4 pb-16 pt-10">
    <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div class="space-y-2">
        <div class="text-xs uppercase tracking-[0.4em] text-green/80">Control Room</div>
        <h1 class="text-3xl font-fredoka tracking-wide text-cream md:text-4xl">Admin Grid</h1>
        <p class="max-w-xl text-sm text-muted">
          Real-time moderation, layered intel, and fast-response tools. Stay crisp.
        </p>
      </div>
      {#if isAuthenticated}
        <div class="flex flex-wrap items-center gap-3">
          <span
            class="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-cream"
            >{currentAdminUserId}</span
          >
          <span
            class={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.18em] ${
              isSuperAdmin
                ? 'border-amber-300/50 bg-amber-400/20 text-amber-200'
                : 'border-green/40 bg-green/20 text-green'
            }`}>{isSuperAdmin ? 'Superadmin' : 'Moderator'}</span
          >
          <button
            class="rounded-full border border-fox/40 bg-fox/20 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-fox hover:bg-fox/30"
            on:click={handleLogout}
          >
            Logout
          </button>
        </div>
      {/if}
    </div>

    {#if !isAuthenticated}
      <div class="mt-10 grid place-items-center">
        <div
          class="w-full max-w-md rounded-3xl border border-white/10 bg-black/40 p-8 shadow-[0_24px_60px_rgba(0,0,0,0.45)]"
        >
          <div class="text-xl font-fredoka text-cream">Admin Login</div>
          <p class="mt-2 text-sm text-muted">Secure access for moderation staff.</p>

          {#if loginError}
            <div class="mt-4 rounded-2xl border border-fox/40 bg-fox/15 px-4 py-3 text-sm text-fox">
              {loginError}
            </div>
          {/if}

          <form class="mt-6 space-y-4" on:submit|preventDefault={handleLogin}>
            <div class="space-y-2">
              <label
                for="admin-username"
                class="text-xs font-bold uppercase tracking-[0.2em] text-muted">Username</label
              >
              <input
                id="admin-username"
                class="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-cream outline-none focus:border-fox/50"
                bind:value={adminUsername}
                placeholder="Enter admin username"
                disabled={isLoggingIn}
                autocomplete="username"
              />
            </div>
            <div class="space-y-2">
              <label
                for="admin-password"
                class="text-xs font-bold uppercase tracking-[0.2em] text-muted">Password</label
              >
              <input
                id="admin-password"
                class="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-cream outline-none focus:border-fox/50"
                type="password"
                bind:value={adminPassword}
                placeholder="Enter admin password"
                disabled={isLoggingIn}
                autocomplete="current-password"
              />
            </div>
            <button
              class="w-full rounded-2xl bg-fox px-4 py-3 text-sm font-bold uppercase tracking-[0.2em] text-black shadow-lg shadow-fox/30"
              type="submit"
              disabled={isLoggingIn}
            >
              {isLoggingIn ? 'Logging in...' : 'Login'}
            </button>
          </form>
        </div>
      </div>
    {:else if isLoading}
      <div class="mt-16 text-center text-sm text-muted">Loading admin panel...</div>
    {:else}
      <div class="mt-8 grid gap-4 md:grid-cols-[1.2fr_1fr]">
        <div class="rounded-3xl border border-white/10 bg-black/40 p-6">
          <div class="text-xs uppercase tracking-[0.32em] text-green/80">Snapshot</div>
          <div class="mt-3 text-2xl font-fredoka text-cream">Live moderation feed</div>
          <p class="mt-2 text-sm text-muted">Rapid signal triage, auditing, and action control.</p>
        </div>
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="rounded-3xl border border-white/10 bg-black/50 p-4">
            <div class="text-xs uppercase tracking-[0.2em] text-muted">Blocked</div>
            <div class="mt-2 text-3xl font-fredoka text-cream">{blockedUsers.length}</div>
          </div>
          <div class="rounded-3xl border border-white/10 bg-black/50 p-4">
            <div class="text-xs uppercase tracking-[0.2em] text-muted">Reports</div>
            <div class="mt-2 text-3xl font-fredoka text-cream">{reports.length}</div>
          </div>
          <div class="rounded-3xl border border-white/10 bg-black/50 p-4">
            <div class="text-xs uppercase tracking-[0.2em] text-muted">Appeals</div>
            <div class="mt-2 text-3xl font-fredoka text-cream">{appeals.length}</div>
          </div>
          <div class="rounded-3xl border border-white/10 bg-black/50 p-4">
            <div class="text-xs uppercase tracking-[0.2em] text-muted">Admins</div>
            <div class="mt-2 text-3xl font-fredoka text-cream">{admins.length}</div>
          </div>
        </div>
      </div>

      {#if isSuperAdmin}
        <details class="mt-6 rounded-3xl border border-white/10 bg-black/40 p-6">
          <summary
            class="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3"
          >
            <div>
              <div class="text-xs uppercase tracking-[0.32em] text-muted">Broadcast</div>
              <div class="text-xl font-fredoka text-cream">Markdown notice</div>
            </div>
            {#if noticeCreatedAt}
              <div class="text-xs text-muted">
                Last sent {formatDate(noticeCreatedAt)}
                {#if noticeCreatedBy}
                  · {noticeCreatedBy}
                {/if}
              </div>
            {/if}
          </summary>
          <div class="mt-5 grid gap-4 lg:grid-cols-2">
            <div class="space-y-3">
              <textarea
                class="min-h-[180px] w-full rounded-2xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-cream outline-none focus:border-fox/50"
                bind:value={noticeMarkdown}
                placeholder="Write a markdown notice for all users..."
                disabled={isSubmittingNotice}
              ></textarea>
              <div class="rounded-2xl border border-white/10 bg-black/50 p-3 text-sm">
                <div class="text-xs uppercase tracking-[0.2em] text-muted">Expires</div>
                <div class="mt-3 flex flex-wrap items-center gap-3">
                  <label class="flex items-center gap-2 text-xs text-muted">
                    <input
                      type="radio"
                      name="notice-expire"
                      value="none"
                      bind:group={noticeExpireMode}
                      disabled={isSubmittingNotice}
                    />
                    No expiry
                  </label>
                  <label class="flex items-center gap-2 text-xs text-muted">
                    <input
                      type="radio"
                      name="notice-expire"
                      value="hours"
                      bind:group={noticeExpireMode}
                      disabled={isSubmittingNotice}
                    />
                    In hours
                  </label>
                  <label class="flex items-center gap-2 text-xs text-muted">
                    <input
                      type="radio"
                      name="notice-expire"
                      value="date"
                      bind:group={noticeExpireMode}
                      disabled={isSubmittingNotice}
                    />
                    On date/time
                  </label>
                </div>
                {#if noticeExpireMode === 'hours'}
                  <div class="mt-3">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      class="w-full rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-sm text-cream outline-none focus:border-fox/50"
                      bind:value={noticeExpireHours}
                      disabled={isSubmittingNotice}
                      placeholder="Hours until expiry"
                    />
                  </div>
                {/if}
                {#if noticeExpireMode === 'date'}
                  <div class="mt-3">
                    <input
                      type="datetime-local"
                      class="w-full rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-sm text-cream outline-none focus:border-fox/50"
                      bind:value={noticeExpireDate}
                      disabled={isSubmittingNotice}
                    />
                  </div>
                {/if}
              </div>
              <div class="flex flex-wrap justify-end gap-3">
                <button
                  class="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-muted"
                  on:click={handleClearNotice}
                  disabled={isSubmittingNotice}
                >
                  Clear
                </button>
                <button
                  class="rounded-full border border-fox/40 bg-fox/20 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-fox"
                  on:click={handleSendNotice}
                  disabled={isSubmittingNotice}
                >
                  {isSubmittingNotice ? 'Sending...' : 'Send notice'}
                </button>
              </div>
            </div>
            <div class="rounded-2xl border border-white/10 bg-black/50 p-4 text-sm text-cream">
              <div class="text-xs uppercase tracking-[0.2em] text-muted">Preview</div>
              <div class="mt-3 leading-relaxed">{@html noticePreviewHtml}</div>
            </div>
          </div>
        </details>
      {/if}

      <div class="mt-8 flex flex-wrap gap-3">
        <button
          class={`rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] transition ${
            activeTab === 'reports'
              ? 'border-fox/60 bg-fox/25 text-fox'
              : 'border-white/10 bg-black/40 text-muted hover:border-white/30'
          }`}
          on:click={() => applyTab('reports')}
          disabled={!isSuperAdmin && isRoleKnown}
        >
          Reports
        </button>
        <button
          class={`rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] transition ${
            activeTab === 'appeals'
              ? 'border-green/60 bg-green/20 text-green'
              : 'border-white/10 bg-black/40 text-muted hover:border-white/30'
          }`}
          on:click={() => applyTab('appeals')}
          disabled={!isSuperAdmin && isRoleKnown}
        >
          Appeals
        </button>
        <button
          class={`rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] transition ${
            activeTab === 'blocked'
              ? 'border-amber-300/60 bg-amber-400/20 text-amber-200'
              : 'border-white/10 bg-black/40 text-muted hover:border-white/30'
          }`}
          on:click={() => applyTab('blocked')}
        >
          Blocked
        </button>
        {#if isSuperAdmin}
          <button
            class={`rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] transition ${
              activeTab === 'admins'
                ? 'border-berry/60 bg-berry/20 text-berry-lt'
                : 'border-white/10 bg-black/40 text-muted hover:border-white/30'
            }`}
            on:click={() => applyTab('admins')}
          >
            Manage Admins
          </button>
        {/if}
      </div>

      {#if error}
        <div class="mt-6 rounded-2xl border border-fox/40 bg-fox/15 px-4 py-3 text-sm text-fox">
          {error}
        </div>
      {/if}
      {#if success}
        <div
          class="mt-6 rounded-2xl border border-green/40 bg-green/15 px-4 py-3 text-sm text-green"
        >
          {success}
        </div>
      {/if}

      {#if activeTab === 'reports' && isSuperAdmin}
        <section class="mt-8 space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div class="text-xs uppercase tracking-[0.32em] text-muted">Reports</div>
              <div class="text-xl font-fredoka text-cream">User reports</div>
            </div>
            <div class="flex flex-wrap gap-2">
              {#each ['pending', 'actioned', 'dismissed', 'all'] as tab}
                <button
                  class={`rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] ${
                    reportStatusTab === tab
                      ? 'border-green/50 bg-green/20 text-green'
                      : 'border-white/10 bg-black/40 text-muted hover:border-white/30'
                  }`}
                  on:click={() => (reportStatusTab = tab as ReportStatusTab)}
                >
                  {tab} ({reportCounts[tab as keyof typeof reportCounts] || 0})
                </button>
              {/each}
            </div>
          </div>

          <div class="grid gap-6 lg:grid-cols-[minmax(0,320px)_1fr]">
            <div class="rounded-3xl border border-white/10 bg-black/40 p-4">
              {#if filteredReports.length === 0}
                <div
                  class="rounded-2xl border border-dashed border-white/20 p-6 text-center text-sm text-muted"
                >
                  No reports in this filter.
                </div>
              {:else}
                <div class="space-y-3">
                  {#each filteredReports as report (getReportId(report))}
                    <button
                      class={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                        selectedReportId === getReportId(report)
                          ? 'border-fox/60 bg-fox/15'
                          : 'border-white/10 bg-black/40 hover:border-white/30'
                      }`}
                      on:click={() => (selectedReportId = getReportId(report))}
                    >
                      <div class="flex items-center justify-between">
                        <span
                          class={`rounded-full border px-2 py-1 text-[0.6rem] font-bold uppercase tracking-[0.2em] ${statusBadgeClass(
                            report.status
                          )}`}>{report.status}</span
                        >
                        <span class="text-xs text-muted">{formatDate(report.created_at)}</span>
                      </div>
                      <div class="mt-2 text-sm font-semibold text-cream">
                        {report.reported_user_id || 'Unknown user'}
                      </div>
                      <div class="mt-1 text-xs text-muted">Report #{getReportId(report)}</div>
                    </button>
                  {/each}
                </div>
              {/if}
            </div>

            <div class="rounded-3xl border border-white/10 bg-black/40 p-6">
              {#if !selectedReport}
                <div
                  class="rounded-2xl border border-dashed border-white/20 p-6 text-center text-sm text-muted"
                >
                  Select a report to inspect details.
                </div>
              {:else}
                <div class="space-y-6">
                  <div class="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div class="text-xs uppercase tracking-[0.2em] text-muted">Report</div>
                      <div class="text-xl font-fredoka text-cream">
                        #{getReportId(selectedReport)}
                      </div>
                    </div>
                    <span
                      class={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] ${statusBadgeClass(
                        selectedReport.status
                      )}`}>{selectedReport.status}</span
                    >
                  </div>

                  <div class="grid gap-4 md:grid-cols-2">
                    <div class="rounded-2xl border border-white/10 bg-black/50 p-4 text-sm">
                      <div class="text-xs uppercase tracking-[0.2em] text-muted">Reporter</div>
                      <div class="mt-2 text-cream">{selectedReport.reporter_id}</div>
                    </div>
                    <div class="rounded-2xl border border-white/10 bg-black/50 p-4 text-sm">
                      <div class="text-xs uppercase tracking-[0.2em] text-muted">Reported user</div>
                      <div class="mt-2 text-cream">{selectedReport.reported_user_id}</div>
                    </div>
                    <div class="rounded-2xl border border-white/10 bg-black/50 p-4 text-sm">
                      <div class="text-xs uppercase tracking-[0.2em] text-muted">Chat ID</div>
                      <div class="mt-2 break-all text-cream">{selectedReport.chat_id}</div>
                    </div>
                    <div class="rounded-2xl border border-white/10 bg-black/50 p-4 text-sm">
                      <div class="text-xs uppercase tracking-[0.2em] text-muted">Reported at</div>
                      <div class="mt-2 text-cream">{formatDate(selectedReport.created_at)}</div>
                    </div>
                  </div>

                  <div class="grid gap-4 md:grid-cols-2">
                    <div class="rounded-2xl border border-amber-300/30 bg-amber-400/10 p-4 text-sm">
                      <div class="text-xs uppercase tracking-[0.2em] text-amber-200">Reason</div>
                      <div class="mt-2 text-cream">{selectedReport.reason}</div>
                    </div>
                    <div class="rounded-2xl border border-fox/30 bg-fox/10 p-4 text-sm">
                      <div class="text-xs uppercase tracking-[0.2em] text-fox">
                        Reported message
                      </div>
                      <div class="mt-2 text-cream">{selectedReport.message_text}</div>
                    </div>
                  </div>

                  <div class="rounded-3xl border border-white/10 bg-black/60 p-4">
                    <div class="text-xs uppercase tracking-[0.2em] text-muted">Conversation</div>
                    {#if parseConversation(selectedReport).length === 0}
                      <div class="mt-4 text-sm text-muted">No conversation stored.</div>
                    {:else}
                      <div class="mt-4 flex max-h-72 flex-col gap-4 overflow-y-auto pr-2">
                        {#each parseConversation(selectedReport) as entry (entry.index)}
                          {@const isReported = entry.senderId === selectedReport.reported_user_id}
                          {@const isFlagged =
                            !!selectedReport.message_text &&
                            !!entry.text &&
                            entry.text === selectedReport.message_text}
                          <div
                            class={`flex flex-col gap-1 ${isReported ? 'items-start' : 'items-end'}`}
                          >
                            <div
                              class="flex flex-wrap items-center gap-2 text-[0.65rem] uppercase tracking-[0.2em] text-muted"
                            >
                              <span>{entry.sentAt ? formatDate(entry.sentAt) : 'unknown time'}</span
                              >
                            </div>
                            <div
                              class={`max-w-[85%] rounded-2xl border px-3 py-2 text-sm ${
                                isReported
                                  ? 'border-fox/40 bg-fox/20 text-cream'
                                  : 'border-white/10 bg-black/50 text-cream'
                              } ${isFlagged ? 'ring-1 ring-red-500 ml-1' : ''}`}
                            >
                              <div class="text-[0.6rem] uppercase tracking-[0.2em] text-muted">
                                {entry.type || 'message'} {entry.me}
                              </div>
                              {#if entry.replyTo}
                                <div
                                  class="mt-1 rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-[0.65rem] text-muted"
                                >
                                  Reply to: {entry.replyTo}
                                </div>
                              {/if}
                              {#if entry.reaction}
                                <div
                                  class="mt-1 rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-[0.65rem] text-muted"
                                >
                                  Reaction: {entry.reaction}
                                </div>
                              {/if}
                              <div class="mt-1">
                                {entry.text || entry.stickerId || entry.reaction || ''}
                              </div>
                            </div>
                          </div>
                        {/each}
                      </div>
                    {/if}
                  </div>

                  {#if selectedReport.message_meta}
                    {@const meta = parseMessageMeta(selectedReport.message_meta)}
                    <div class="rounded-2xl border border-white/10 bg-black/50 p-4 text-sm">
                      <div class="text-xs font-bold uppercase tracking-[0.2em] text-muted">
                        Message metadata
                      </div>
                      {#if meta}
                        <div class="mt-4 grid gap-3 md:grid-cols-2">
                          <div class="rounded-xl border border-white/10 bg-black/60 p-3">
                            <div class="text-[0.6rem] uppercase tracking-[0.2em] text-muted">
                              Chat ID
                            </div>
                            <div class="mt-2 break-all text-cream">{meta.chatId || 'Unknown'}</div>
                          </div>
                          <div class="rounded-xl border border-white/10 bg-black/60 p-3">
                            <div class="text-[0.6rem] uppercase tracking-[0.2em] text-muted">
                              Message ID
                            </div>
                            <div class="mt-2 break-all text-cream">
                              {meta.messageId || 'Unknown'}
                            </div>
                          </div>
                          <div class="rounded-xl border border-white/10 bg-black/60 p-3">
                            <div class="text-[0.6rem] uppercase tracking-[0.2em] text-muted">
                              Sender ID
                            </div>
                            <div class="mt-2 break-all text-cream">
                              {meta.senderId || 'Unknown'}
                            </div>
                          </div>
                          <div class="rounded-xl border border-white/10 bg-black/60 p-3">
                            <div class="text-[0.6rem] uppercase tracking-[0.2em] text-muted">
                              Sender IP
                            </div>
                            <div class="mt-2 break-all text-cream">
                              {meta.senderIp || 'Unknown'}
                            </div>
                          </div>
                          <div
                            class="rounded-xl border border-white/10 bg-black/60 p-3 md:col-span-2"
                          >
                            <div class="text-[0.6rem] uppercase tracking-[0.2em] text-muted">
                              User Agent
                            </div>
                            <div class="mt-2 break-all text-cream">
                              {meta.userAgent || 'Unknown'}
                            </div>
                          </div>
                          <div class="rounded-xl border border-white/10 bg-black/60 p-3">
                            <div class="text-[0.6rem] uppercase tracking-[0.2em] text-muted">
                              Sent At
                            </div>
                            <div class="mt-2 text-cream">
                              {meta.sentAt ? formatDate(meta.sentAt) : 'Unknown'}
                            </div>
                          </div>
                          <div class="rounded-xl border border-white/10 bg-black/60 p-3">
                            <div class="text-[0.6rem] uppercase tracking-[0.2em] text-muted">
                              Type
                            </div>
                            <div class="mt-2 text-cream">{meta.type || 'Unknown'}</div>
                          </div>
                          <div class="rounded-xl border border-white/10 bg-black/60 p-3">
                            <div class="text-[0.6rem] uppercase tracking-[0.2em] text-muted">
                              Reply To
                            </div>
                            <div class="mt-2 break-all text-cream">
                              {meta.replyTo || 'None'}
                            </div>
                          </div>
                          <div
                            class="rounded-xl border border-white/10 bg-black/60 p-3 md:col-span-2"
                          >
                            <div class="text-[0.6rem] uppercase tracking-[0.2em] text-muted">
                              Text
                            </div>
                            <div class="mt-2 text-cream">{meta.text || ''}</div>
                          </div>
                        </div>
                      {:else}
                        <div
                          class="mt-3 rounded-xl border border-white/10 bg-black/60 p-3 text-xs text-muted"
                        >
                          {selectedReport.message_meta}
                        </div>
                      {/if}
                    </div>
                  {/if}

                  <div class="flex flex-wrap justify-end gap-3">
                    {#if selectedReport.status === 'pending' || selectedReport.status === 'dismissed'}
                      <button
                        class="rounded-full border border-fox/40 bg-fox/20 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-fox"
                        on:click={() => handleBlockFromReport(selectedReport)}
                      >
                        Block user
                      </button>
                    {/if}
                    {#if selectedReport.status === 'pending'}
                      <button
                        class="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-muted"
                        on:click={() =>
                          handleUpdateReportStatus(getReportId(selectedReport), 'dismissed')}
                      >
                        Dismiss
                      </button>
                    {/if}
                    <button
                      class="rounded-full border border-red-400/50 bg-red-500/20 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-red-200"
                      on:click={() => handleDeleteReport(getReportId(selectedReport))}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              {/if}
            </div>
          </div>
        </section>
      {/if}

      {#if activeTab === 'appeals' && isSuperAdmin}
        <section class="mt-8 space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div class="text-xs uppercase tracking-[0.32em] text-muted">Appeals</div>
              <div class="text-xl font-fredoka text-cream">Appeal queue</div>
            </div>
            <div class="flex flex-wrap gap-2">
              {#each ['pending', 'approved', 'rejected', 'all'] as tab}
                <button
                  class={`rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] ${
                    appealStatusTab === tab
                      ? 'border-amber-300/50 bg-amber-400/20 text-amber-200'
                      : 'border-white/10 bg-black/40 text-muted hover:border-white/30'
                  }`}
                  on:click={() => (appealStatusTab = tab as AppealStatusTab)}
                >
                  {tab} ({appealCounts[tab as keyof typeof appealCounts] || 0})
                </button>
              {/each}
            </div>
          </div>

          <div class="grid gap-6 lg:grid-cols-[minmax(0,320px)_1fr]">
            <div class="rounded-3xl border border-white/10 bg-black/40 p-4">
              {#if filteredAppeals.length === 0}
                <div
                  class="rounded-2xl border border-dashed border-white/20 p-6 text-center text-sm text-muted"
                >
                  No appeals in this filter.
                </div>
              {:else}
                <div class="space-y-3">
                  {#each filteredAppeals as appeal (getAppealId(appeal))}
                    <button
                      class={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                        selectedAppealId === getAppealId(appeal)
                          ? 'border-green/60 bg-green/15'
                          : 'border-white/10 bg-black/40 hover:border-white/30'
                      }`}
                      on:click={() => (selectedAppealId = getAppealId(appeal))}
                    >
                      <div class="flex items-center justify-between">
                        <span
                          class={`rounded-full border px-2 py-1 text-[0.6rem] font-bold uppercase tracking-[0.2em] ${statusBadgeClass(
                            appeal.status
                          )}`}>{appeal.status}</span
                        >
                        <span class="text-xs text-muted">{formatDate(appeal.created_at)}</span>
                      </div>
                      <div class="mt-2 text-sm font-semibold text-cream">
                        {appeal.user_id || 'Unknown user'}
                      </div>
                      <div class="mt-1 text-xs text-muted">Appeal #{getAppealId(appeal)}</div>
                    </button>
                  {/each}
                </div>
              {/if}
            </div>

            <div class="rounded-3xl border border-white/10 bg-black/40 p-6">
              {#if !selectedAppeal}
                <div
                  class="rounded-2xl border border-dashed border-white/20 p-6 text-center text-sm text-muted"
                >
                  Select an appeal to inspect details.
                </div>
              {:else}
                <div class="space-y-6">
                  <div class="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div class="text-xs uppercase tracking-[0.2em] text-muted">Appeal</div>
                      <div class="text-xl font-fredoka text-cream">
                        #{getAppealId(selectedAppeal)}
                      </div>
                    </div>
                    <span
                      class={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] ${statusBadgeClass(
                        selectedAppeal.status
                      )}`}>{selectedAppeal.status}</span
                    >
                  </div>

                  <div class="grid gap-4 md:grid-cols-2">
                    <div class="rounded-2xl border border-white/10 bg-black/50 p-4 text-sm">
                      <div class="text-xs uppercase tracking-[0.2em] text-muted">User</div>
                      <div class="mt-2 text-cream">{selectedAppeal.user_id}</div>
                    </div>
                    <div class="rounded-2xl border border-white/10 bg-black/50 p-4 text-sm">
                      <div class="text-xs uppercase tracking-[0.2em] text-muted">Created</div>
                      <div class="mt-2 text-cream">{formatDate(selectedAppeal.created_at)}</div>
                    </div>
                    {#if selectedAppeal.report_id}
                      <div class="rounded-2xl border border-white/10 bg-black/50 p-4 text-sm">
                        <div class="text-xs uppercase tracking-[0.2em] text-muted">Report</div>
                        <div class="mt-2 break-all text-cream">{selectedAppeal.report_id}</div>
                      </div>
                    {/if}
                  </div>

                  <div class="rounded-2xl border border-amber-300/30 bg-amber-400/10 p-4 text-sm">
                    <div class="text-xs uppercase tracking-[0.2em] text-amber-200">Reason</div>
                    <div class="mt-2 text-cream">{selectedAppeal.reason}</div>
                  </div>
                  {#if selectedAppeal.message}
                    <div class="rounded-2xl border border-white/10 bg-black/50 p-4 text-sm">
                      <div class="text-xs uppercase tracking-[0.2em] text-muted">Message</div>
                      <div class="mt-2 text-cream">{selectedAppeal.message}</div>
                    </div>
                  {/if}

                  <div class="flex flex-wrap justify-end gap-3">
                    {#if selectedAppeal.status !== 'approved'}
                      <button
                        class="rounded-full border border-green/50 bg-green/20 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-green"
                        on:click={() =>
                          handleUpdateAppealStatus(getAppealId(selectedAppeal), 'approved')}
                      >
                        Approve
                      </button>
                    {/if}
                    {#if selectedAppeal.status === 'pending'}
                      <button
                        class="rounded-full border border-fox/40 bg-fox/20 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-fox"
                        on:click={() =>
                          handleUpdateAppealStatus(getAppealId(selectedAppeal), 'rejected')}
                      >
                        Reject
                      </button>
                    {/if}
                    <button
                      class="rounded-full border border-red-400/50 bg-red-500/20 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-red-200"
                      on:click={() => handleDeleteAppeal(getAppealId(selectedAppeal))}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              {/if}
            </div>
          </div>
        </section>
      {/if}

      {#if activeTab === 'blocked'}
        <section class="mt-8 grid gap-6 lg:grid-cols-[minmax(0,320px)_1fr]">
          <div class="rounded-3xl border border-white/10 bg-black/40 p-6">
            <div class="text-xs uppercase tracking-[0.32em] text-muted">Block user</div>
            <div class="mt-2 text-xl font-fredoka text-cream">Manual block</div>
            <form class="mt-6 space-y-4" on:submit|preventDefault={handleBlockUser}>
              <div class="space-y-2">
                <label
                  for="block-user-id"
                  class="text-xs font-bold uppercase tracking-[0.2em] text-muted">User ID</label
                >
                <input
                  id="block-user-id"
                  class="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-cream outline-none focus:border-amber-300/50"
                  bind:value={blockUserId}
                  placeholder="Enter user ID"
                  disabled={isSubmitting}
                />
              </div>
              <div class="space-y-2">
                <label
                  for="block-reason"
                  class="text-xs font-bold uppercase tracking-[0.2em] text-muted">Reason</label
                >
                <textarea
                  id="block-reason"
                  class="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-cream outline-none focus:border-amber-300/50"
                  bind:value={blockReason}
                  rows="3"
                  placeholder="Why are they being blocked?"
                  disabled={isSubmitting}
                ></textarea>
              </div>
              <div class="space-y-2">
                <label
                  for="block-duration"
                  class="text-xs font-bold uppercase tracking-[0.2em] text-muted">Duration</label
                >
                <input
                  id="block-duration"
                  class="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-cream outline-none focus:border-amber-300/50"
                  type="number"
                  min="0"
                  step="1"
                  bind:value={blockDurationHours}
                  disabled={isSubmitting}
                />
                <div class="text-xs text-muted">0 means permanent block.</div>
              </div>
              <button
                class="w-full rounded-2xl bg-amber-400 px-4 py-3 text-sm font-bold uppercase tracking-[0.2em] text-black"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Blocking...' : 'Block user'}
              </button>
            </form>
          </div>

          <div class="rounded-3xl border border-white/10 bg-black/40 p-6">
            <div class="text-xs uppercase tracking-[0.32em] text-muted">Blocked users</div>
            <div class="mt-2 text-xl font-fredoka text-cream">Current list</div>

            {#if blockedUsers.length === 0}
              <div
                class="mt-6 rounded-2xl border border-dashed border-white/20 p-6 text-center text-sm text-muted"
              >
                No blocked users.
              </div>
            {:else}
              <div class="mt-6 space-y-4">
                {#each blockedUsers as user (user.userId)}
                  <div class="rounded-2xl border border-white/10 bg-black/50 p-4">
                    <div class="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div class="text-sm font-semibold text-cream">{user.userId}</div>
                        <div class="mt-1 text-sm text-muted">{user.reason}</div>
                        <div class="mt-3 flex flex-wrap gap-2 text-xs">
                          {#if user.isPermanent}
                            <span
                              class="rounded-full border border-fox/40 bg-fox/20 px-2 py-1 text-fox"
                              >Permanent</span
                            >
                          {:else}
                            <span
                              class="rounded-full border border-amber-300/40 bg-amber-400/20 px-2 py-1 text-amber-200"
                              >{formatTimeRemaining(user.timeRemaining)}</span
                            >
                          {/if}
                          <span
                            class="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-muted"
                            >Blocked: {formatDate(user.blockedUntil)}</span
                          >
                        </div>
                      </div>
                      <button
                        class="rounded-full border border-green/40 bg-green/20 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-green"
                        on:click={() => handleUnblockUser(user.userId)}
                      >
                        Unblock
                      </button>
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </section>
      {/if}

      {#if activeTab === 'admins' && isSuperAdmin}
        <section class="mt-8 grid gap-6 lg:grid-cols-[minmax(0,320px)_1fr]">
          <div class="rounded-3xl border border-white/10 bg-black/40 p-6">
            <div class="text-xs uppercase tracking-[0.32em] text-muted">Add admin</div>
            <div class="mt-2 text-xl font-fredoka text-cream">Invite control</div>
            <form class="mt-6 space-y-4" on:submit|preventDefault={handleAddAdmin}>
              <div class="space-y-2">
                <label
                  for="new-admin-user-id"
                  class="text-xs font-bold uppercase tracking-[0.2em] text-muted">User ID</label
                >
                <input
                  id="new-admin-user-id"
                  class="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-cream outline-none focus:border-berry/50"
                  bind:value={newAdminUserId}
                  placeholder="User ID"
                  disabled={isSubmittingAdmin}
                />
              </div>
              <div class="space-y-2">
                <label
                  for="new-admin-role"
                  class="text-xs font-bold uppercase tracking-[0.2em] text-muted">Role</label
                >
                <select
                  id="new-admin-role"
                  class="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-cream outline-none focus:border-berry/50"
                  bind:value={newAdminRole}
                  disabled={isSubmittingAdmin}
                >
                  <option value="moderator">Moderator</option>
                  <option value="superadmin">Superadmin</option>
                </select>
              </div>
              <button
                class="w-full rounded-2xl bg-berry px-4 py-3 text-sm font-bold uppercase tracking-[0.2em] text-cream"
                type="submit"
                disabled={isSubmittingAdmin}
              >
                {isSubmittingAdmin ? 'Adding...' : 'Add admin'}
              </button>
            </form>
          </div>

          <div class="rounded-3xl border border-white/10 bg-black/40 p-6">
            <div class="text-xs uppercase tracking-[0.32em] text-muted">Admins</div>
            <div class="mt-2 text-xl font-fredoka text-cream">Roster</div>

            {#if admins.length === 0}
              <div
                class="mt-6 rounded-2xl border border-dashed border-white/20 p-6 text-center text-sm text-muted"
              >
                No admins yet.
              </div>
            {:else}
              <div class="mt-6 space-y-4">
                {#each admins as admin (admin.userId)}
                  <div class="rounded-2xl border border-white/10 bg-black/50 p-4">
                    <div class="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div class="text-sm font-semibold text-cream">{admin.userId}</div>
                        <div class="mt-2 flex flex-wrap gap-2 text-xs">
                          <span
                            class={`rounded-full border px-2 py-1 ${
                              admin.role === 'superadmin'
                                ? 'border-amber-300/40 bg-amber-400/20 text-amber-200'
                                : 'border-green/40 bg-green/20 text-green'
                            }`}>{admin.role}</span
                          >
                          <span
                            class="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-muted"
                            >Added: {formatDate(admin.createdAt)}</span
                          >
                          {#if admin.createdBy}
                            <span
                              class="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-muted"
                              >By: {admin.createdBy}</span
                            >
                          {/if}
                        </div>
                      </div>
                      <div class="flex flex-wrap gap-2">
                        {#if admin.role === 'moderator'}
                          <button
                            class="rounded-full border border-amber-300/40 bg-amber-400/20 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-amber-200"
                            on:click={() => handleUpdateAdminRole(admin.userId, 'superadmin')}
                          >
                            Promote
                          </button>
                        {:else}
                          <button
                            class="rounded-full border border-green/40 bg-green/20 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-green"
                            on:click={() => handleUpdateAdminRole(admin.userId, 'moderator')}
                          >
                            Demote
                          </button>
                        {/if}
                        <button
                          class="rounded-full border border-fox/40 bg-fox/20 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-fox"
                          on:click={() => handleRemoveAdmin(admin.userId)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </section>
      {/if}
    {/if}
  </div>
</div>
