<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { chatStore, type ChatMessage } from '$stores/chatStore';
  import { socket } from '$lib/socket';

  export let visible = false;

  const dispatch = createEventDispatcher();

  type HistorySession = {
    chatId: string;
    startedAt: number;
    lastTextAt: number;
    messages: ChatMessage[];
  };

  let sessions: HistorySession[] = [];
  let activeChatId: string | null = null;
  let reportModal: { messageId: string; chatId: string } | null = null;
  let reportReason = '';
  let isSubmittingReport = false;

  $: if (visible) {
    sessions = chatStore.getArchivedChatHistory().filter((s) => {
      const latestText = [...s.messages]
        .reverse()
        .find((m) => m.type !== 'system' && (m.text?.trim() || m.sticker));
      return !!latestText;
    });

    if (!activeChatId || !sessions.find((s) => s.chatId === activeChatId)) {
      activeChatId = sessions[0]?.chatId ?? null;
    }
  }

  $: activeSession = sessions.find((s) => s.chatId === activeChatId) ?? null;

  function closeModal(): void {
    dispatch('close');
  }

  function openChat(chatId: string): void {
    activeChatId = chatId;
  }

  function deleteChat(chatId: string): void {
    chatStore.deleteArchivedChat(chatId);
    sessions = chatStore.getArchivedChatHistory();
    if (activeChatId === chatId) {
      activeChatId = sessions[0]?.chatId ?? null;
    }
  }

  function clearAllChats(): void {
    chatStore.clearArchivedChatHistory();
    sessions = [];
    activeChatId = null;
  }

  function formatDate(timestamp?: number): string {
    if (!timestamp) return 'Unknown time';
    return new Date(timestamp).toLocaleString();
  }

  function formatTime(timestamp?: number): string {
    if (!timestamp) return '⏳';
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function formatDuration(durationMs?: number): string {
    if (!durationMs || durationMs <= 0) return '0m';

    const totalMinutes = Math.floor(durationMs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }

    return `${minutes}m`;
  }

  function getSessionDuration(session?: HistorySession | null): string {
    if (!session) return '0m';

    const latestMessageTime = session.messages
      .map((message) => message.timestamp)
      .filter((timestamp): timestamp is number => typeof timestamp === 'number')
      .sort((a, b) => b - a)[0];

    const endTime = latestMessageTime ?? session.lastTextAt ?? session.startedAt;
    return formatDuration(Math.max(0, endTime - session.startedAt));
  }

  function previewText(messages: ChatMessage[]): string {
    const latestText = [...messages]
      .reverse()
      .find((m) => m.type !== 'system' && (m.text?.trim() || m.sticker));

    if (!latestText) return 'No messages';
    if (latestText.sticker) return `Sticker: ${latestText.sticker.name}`;
    return latestText.text;
  }

  function openReportModal(messageId: string, chatId: string): void {
    reportModal = { messageId, chatId };
    reportReason = '';
  }

  function closeReportModal(): void {
    reportModal = null;
    reportReason = '';
    isSubmittingReport = false;
  }

  async function submitReport(): Promise<void> {
    if (!reportModal || !reportReason.trim() || isSubmittingReport) return;

    isSubmittingReport = true;
    try {
      const session = sessions.find((s) => s.chatId === reportModal.chatId);
      const msg = session?.messages.find((m) => m.id === reportModal.messageId);
      const conversationEncryptedMeta = (session?.messages || [])
        .map((m) => m.meta)
        .filter((meta): meta is string => !!meta);

      if (!msg) return;

      socket.emit(
        'report:message',
        {
          chatId: reportModal.chatId,
          messageId: reportModal.messageId,
          messageText: msg.text || '',
          reason: reportReason,
          encryptedMeta: msg.meta,
          conversationEncryptedMeta,
          reportedUserId: 'unknown-user',
        },
        (response: any) => {
          if (response.success) {
            closeReportModal();
            alert('✅ Report submitted successfully');
          } else {
            if (response.error?.includes('already been reported')) {
              alert('❌ This chat has already been reported');
            } else {
              alert(`❌ Failed to submit report: ${response.error}`);
            }
          }
          isSubmittingReport = false;
        }
      );
    } catch (err) {
      console.error('Failed to submit report:', err);
      alert('❌ Failed to submit report');
      isSubmittingReport = false;
    }
  }
</script>

{#if visible}
  <div class="fixed inset-0 z-50 flex items-center justify-center px-2 py-2 sm:px-3 sm:py-5">
    <button
      class="absolute inset-0 bg-black/70 border-0"
      aria-label="Close chat history"
      on:click={closeModal}
    ></button>

    <div
      class="relative z-10 w-full max-w-[760px] h-[92dvh] sm:h-[min(80vh,680px)] rounded-2xl border border-white/[.09] bg-[rgba(13,23,13,.97)] shadow-[0_18px_60px_rgba(0,0,0,.45)] overflow-hidden flex flex-col sm:flex-row"
    >
      <div
        class="w-full sm:w-[42%] sm:min-w-[240px] border-b sm:border-b-0 sm:border-r border-white/[.08] flex flex-col min-h-0 max-h-[42%] sm:max-h-none"
      >
        <div
          class="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-white/[.08] flex items-center justify-between gap-2"
        >
          <div class="font-fredoka text-cream text-base sm:text-lg">Chat History</div>
          <div class="flex items-center gap-2">
            <button
              class="text-[.72rem] sm:text-[.75rem] px-2.5 py-1 rounded-lg border border-red-400/25 text-red-200 bg-red-500/10 hover:bg-red-500/20 transition-colors"
              on:click={clearAllChats}
              disabled={!sessions.length}
            >
              Delete all
            </button><button
              class="sm:hidden text-[.72rem] px-2.5 py-1 rounded-lg border border-white/[.1] text-cream bg-white/[.06] hover:bg-white/[.1] transition-colors"
              aria-label="Close chat history"
              on:click={closeModal}
            >
              ✕
            </button>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto p-2 min-h-0">
          {#if !sessions.length}
            <div class="text-sm text-muted px-3 py-4">No saved chats yet.</div>
          {:else}
            {#each sessions as s}
              <button
                class={`w-full text-left rounded-xl px-2.5 sm:px-3 py-2.5 mb-1.5 border transition-colors ${activeChatId === s.chatId ? 'bg-fox/20 border-fox/45' : 'bg-white/[.02] border-white/[.07] hover:bg-white/[.05]'}`}
                on:click={() => openChat(s.chatId)}
              >
                <div class="text-[.76rem] text-leaf-lt">
                  {formatDate(s.lastTextAt || s.startedAt)}
                </div>
                <div class="text-[.85rem] text-cream line-clamp-2 leading-snug mt-0.5">
                  {previewText(s.messages)}
                </div>
                <div class="text-[.72rem] text-muted mt-1">{s.messages.length} messages</div>
              </button>
            {/each}
          {/if}
        </div>
      </div>

      <div class="flex-1 flex flex-col min-h-0">
        <div
          class="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-white/[.08] flex items-center justify-between gap-2"
        >
          <div class="text-[.78rem] sm:text-[.82rem] text-leaf-lt flex flex-col gap-0.5">
            {#if activeSession}
              Started: {formatDate(activeSession.startedAt)}
              <span class="text-[.72rem] text-muted"
                >Duration: {getSessionDuration(activeSession)}</span
              >
            {:else}
              Select a chat
            {/if}
          </div>
          <div class="flex items-center gap-2 shrink-0">
            {#if activeSession}
              <button
                class="text-[.72rem] sm:text-[.75rem] px-2.5 py-1 rounded-lg border border-red-400/25 text-red-200 bg-red-500/10 hover:bg-red-500/20 transition-colors"
                on:click={() => deleteChat(activeSession.chatId)}
              >
                Delete
              </button>
            {/if}
            <button
              class="hidden sm:inline-flex text-[.72rem] sm:text-[.75rem] px-2.5 py-1 rounded-lg border border-white/[.1] text-cream bg-white/[.06] hover:bg-white/[.1] transition-colors"
              aria-label="Close chat history"
              on:click={closeModal}
            >
              ✕
            </button>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto px-3 sm:px-4 py-3 flex flex-col gap-2 min-h-0">
          {#if !activeSession}
            <div class="text-sm text-muted">No chat selected.</div>
          {:else}
            {#each activeSession.messages as msg (msg.id)}
              <div
                class={`
                  ${
                    msg.type === 'self'
                      ? 'self-end group rounded-[20px] p-2 px-3 relative max-w-[78%] text-[.88rem] leading-relaxed bg-gradient-to-br from-fox to-fox-dark text-white break-words'
                      : msg.type === 'partner'
                        ? 'self-start group rounded-[20px] relative max-w-[78%] px-3 py-2 text-[.88rem] leading-relaxed bg-[#2C352B] text-cream border border-white/[.06] break-words'
                        : 'self-center text-[.73rem] text-center whitespace-pre-line text-berry-lt font-semibold px-3 py-1 bg-[rgba(124,58,237,.1)] rounded-full'
                  }
                `}
              >
                {#if msg.sticker}
                  <div class="flex flex-col items-start gap-1.5">
                    <img
                      src={msg.sticker.url}
                      alt={msg.sticker.name}
                      class="w-[100px] h-[100px] object-contain"
                      on:error={(e) => {
                        const img = e.target as HTMLImageElement;
                        img.style.display = 'none';
                      }}
                    />
                  </div>
                {:else}
                  <span class="whitespace-pre-wrap">{msg.text}</span>
                {/if}

                {#if msg.timestamp || msg.reaction || msg.type === 'partner'}
                  <div
                    class={` flex items-center gap-2 text-[.72rem] whitespace-nowrap ${msg.type === 'self' ? 'flex-row-reverse' : 'justify-start'}`}
                  >
                    <span class="opacity-90 text-muted">{formatTime(msg.timestamp)}</span>
                    {#if msg.reaction}
                      <span
                        class={`inline-block text-white px-1 py-[1px] border rounded-full border-white/[.06] ${msg.type === 'self' ? 'bg-[#db530f]/10' : 'bg-[#2C352B]'}`}
                      >
                        {msg.reaction}
                      </span>
                    {/if}
                    {#if msg.type === 'partner'}
                      <button
                        class="text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-70 transition-opacity cursor-pointer bg-none border-none p-0"
                        on:click={() => openReportModal(msg.id, activeSession.chatId)}
                        title="Report this message"
                      >
                        🚩
                      </button>
                    {/if}
                  </div>
                {/if}
              </div>
            {/each}
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Report Modal -->
{#if reportModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
    <div class="bg-[rgba(21,40,21,0.95)] border border-white/[.14] rounded-2xl p-6 max-w-sm w-full">
      <h2 class="text-xl font-fredoka text-cream mb-4">Report Message 🚩</h2>

      <div class="mb-4">
        <label class="block text-sm text-cream font-semibold mb-2">Reason for reporting</label>
        <textarea
          bind:value={reportReason}
          placeholder="Why are you reporting this message?"
          class="w-full px-3 py-2 bg-[rgba(0,0,0,0.3)] border border-white/[.1] rounded-lg text-cream placeholder-gray-500 resize-none h-24 focus:outline-none focus:border-orange-500"
          disabled={isSubmittingReport}
        ></textarea>
      </div>

      <div class="flex gap-3">
        <button
          class="flex-1 py-2 px-3 bg-[rgba(255,255,255,.1)] hover:bg-[rgba(255,255,255,.15)] rounded-lg text-cream border-0 cursor-pointer font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          on:click={closeReportModal}
          disabled={isSubmittingReport}
        >
          Cancel
        </button>
        <button
          class="flex-1 py-2 px-3 bg-red-600 hover:bg-red-700 rounded-lg text-white border-0 cursor-pointer font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          on:click={submitReport}
          disabled={!reportReason.trim() || isSubmittingReport}
        >
          {isSubmittingReport ? '⏳ Submitting...' : 'Submit Report'}
        </button>
      </div>
    </div>
  </div>
{/if}
