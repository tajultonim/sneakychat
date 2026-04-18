<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { connectSocket, socket } from '$lib/socket';
  import { updateBerryUI, berries } from '$stores/gameStore';
  import { toastStore } from '$stores/toastStore';
  import { startCooldown } from '$stores/cooldownStore';
  import {
    chatStore,
    messages,
    queuedMessages,
    session,
    type ChatMessage,
    type QueuedMessage,
  } from '$stores/chatStore';
  import { roomId } from '$stores/roomStore';
  import { gameProposal, activeGame } from '$stores/gameStore';
  import { get } from 'svelte/store';

  import Fireflies from '$components/Fireflies.svelte';
  import Header from '$components/Header.svelte';
  import StatsStrip from '$components/StatsStrip.svelte';
  import CooldownBadge from '$components/CooldownBadge.svelte';
  import IdleScreen from '$components/IdleScreen.svelte';
  import SearchingScreen from '$components/SearchingScreen.svelte';
  import ChatScreen from '$components/chats/ChatScreen.svelte';
  import SkipConfirmModal from '$components/SkipConfirmModal.svelte';
  import ToastManager from '$components/ToastManager.svelte';
  import ExitConfirmModal from '$components/ExitConfirmModal.svelte';
  import ChatHistoryModal from '$components/ChatHistoryModal.svelte';
  import { partnerStatus } from '$stores/userStore';
  import { stickerStore } from '$stores/stickerStore';
  import { browser } from '$app/environment';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { myuserId } from '$stores/userStore';

  type Screen = 'idle' | 'searching' | 'chat';

  let screen: Screen = 'idle';
  let isConnected = false;
  let onlineCount = 1;
  let searchTitle = 'Sneaking through the forest...';
  let searchSub = 'Looking for another fox to chat with';
  let showSkipConfirm = false;
  let showExitConfirm = false;
  let showHistoryModal = false;
  let disposeHomeRuntime: (() => void) | null = null;
  let isBlocked = false;
  let blockReason = '';
  let blockedUntil: number | null = null;
  let blockIsPermanent = false;
  let blockReportId = '';
  let showAppealModal = false;
  let appealId = '';
  let appealReason = '';
  let appealMessage = '';
  let appealReportId = '';
  let appealStatus = '';
  let appealSubmitting = false;
  let appealSuccess = '';
  let appealError = '';

  $: {
    if (browser) {
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', screen == 'chat' ? '#272718' : '#0F1A0F');
    }
  }

  onMount(() => {
    const param = page.url.searchParams.get('screen');

    if (param == 'chat') {
      handleFindFox();
      const url = new URL(page.url);
      url.searchParams.delete('screen');
      goto(url, { replaceState: true });
      screen = 'searching';
    }

    fetchBlockStatus();
  });

  function formatBlockedUntil(): string {
    if (!blockedUntil) {
      if (blockIsPermanent) {
        return 'Forever';
      }
      return 'Unknown';
    }
    return new Date(blockedUntil).toLocaleString();
  }

  async function fetchBlockStatus(): Promise<void> {
    if (!browser) return;
    const token = localStorage.getItem('sneaky_token');
    if (!token) return;

    try {
      const res = await fetch(`${import.meta.env.VITE_SERVER_URL}/api/block-status`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (data?.blocked) {
        isBlocked = true;
        blockReason = data.reason || 'Blocked';
        blockedUntil = data.blockedUntil || null;
        blockIsPermanent = !!data.isPermanent;
        blockReportId = data.reportId || '';
        if (blockReportId && !showAppealModal) {
          fetchExistingAppeal(blockReportId);
        }
      } else {
        isBlocked = false;
        blockReportId = '';
      }
    } catch {
      // Ignore block status fetch errors
    }
  }

  async function submitAppeal(): Promise<void> {
    if (!appealReason.trim() || appealSubmitting) return;
    appealSubmitting = true;
    appealError = '';
    appealSuccess = '';

    try {
      const token = localStorage.getItem('sneaky_token');
      const res = await fetch(`${import.meta.env.VITE_SERVER_URL}/api/appeal`, {
        method: appealId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({
          appealId: appealId || undefined,
          reason: appealReason,
          message: appealMessage,
          reportId: appealReportId || null,
        }),
      });

      const data = await res.json();
      if (data?.success) {
        appealSuccess = appealId
          ? 'Appeal updated. We will review it soon.'
          : 'Appeal submitted. We will review it soon.';
        appealReason = '';
        appealMessage = '';
        showAppealModal = false;
        appealId = '';
        appealStatus = '';
      } else {
        appealError = data?.error || 'Failed to submit appeal.';
      }
    } catch {
      appealError = 'Failed to submit appeal.';
    } finally {
      appealSubmitting = false;
    }
  }

  async function fetchExistingAppeal(reportId: string): Promise<void> {
    if (!browser || !reportId) return;
    try {
      const token = localStorage.getItem('sneaky_token');
      const res = await fetch(
        `${import.meta.env.VITE_SERVER_URL}/api/appeal?reportId=${encodeURIComponent(reportId)}`,
        {
          headers: {
            Authorization: token ? `Bearer ${token}` : '',
          },
        }
      );
      const data = await res.json();
      if (data?.success && data.appeal) {
        appealId = data.appeal.appeal_id || '';
        appealReason = data.appeal.reason || '';
        appealMessage = data.appeal.message || '';
        appealStatus = data.appeal.status || '';
      } else {
        appealId = '';
        appealStatus = '';
      }
    } catch {
      appealId = '';
      appealStatus = '';
    }
  }

  function openAppealModal(): void {
    appealReportId = blockReportId;
    appealError = '';
    appealSuccess = '';
    appealId = '';
    appealReason = '';
    appealMessage = '';
    appealStatus = '';
    showAppealModal = true;
    if (blockReportId) {
      fetchExistingAppeal(blockReportId);
    }
  }

  function initHomeRuntime(): () => void {
    const sock = connectSocket();

    sock.on('connect', () => {
      isConnected = true;
      fetchBlockStatus();
      if (screen == 'searching') {
        toastStore.add('🔄 Reconnected! Resuming search...');
        handleFindFox();
      }
      // if (get(roomId)) {
      //   chatStore.loadSession(get(roomId) || '');
      //   sock.emit(
      //     'rejoinRoom',
      //     { roomId: get(roomId), ouid: get(session).userId },
      //     (response: any) => {
      //       if (response.status == 'success') {
      //         toastStore.add('🔄 Rejoined existing chat!');
      //         screen = 'chat';
      //         if (response.timeEndAt <= Date.now()) {
      //           toastStore.add('⏰ Chat already ended. Starting fresh.');
      //           localStorage.removeItem('roomId');
      //           handleFindFox();
      //           return;
      //         }
      //         chatStore.resetTimer(response.timeEndAt - Date.now());
      //         console.log('Rejoin response:', response);
      //         chatStore.updateSession({
      //           chatId: get(roomId) || '',
      //           userId: response.userId,
      //           partnerId: response.partnerId,
      //         });

      //         const queued = get(queuedMessages)
      //           .filter((m: QueuedMessage) => m.chatId !== get(roomId))
      //           .forEach((m) => {
      //             console.log('Removing queued message for old room: ' + m.text);
      //             chatStore.removeQueuedMessage(m.id);
      //           });

      //         const searchQueued = get(messages).filter(
      //           (m: ChatMessage) => m.type === 'self' && !m.timestamp
      //         );

      //         searchQueued.forEach((m) => {
      //           chatStore.addQueuedMessage(
      //             m.text,
      //             get(roomId) || '',
      //             m.id,
      //             'self',
      //             m.replyTo || ''
      //           );
      //         });
      //       } else {
      //         toastStore.add(response.msg || 'Failed to rejoin chat. Starting fresh.');
      //         localStorage.removeItem('roomId');
      //         handleFindFox();
      //       }
      //     }
      //   );
      // }
    });

    sock.on('rejoinRoom', (d: unknown) => {
      const { status, timeEndAt, msg } = d as { status: string; timeEndAt: number; msg: string };
      if (status === 'success') {
        toastStore.add('🔄 Rejoined existing chat!');
        screen = 'chat';
        if (timeEndAt <= Date.now()) {
          toastStore.add('⏰ Chat already ended. Starting fresh.');
          localStorage.removeItem('roomId');
          handleFindFox();
          return;
        }
        chatStore.resetTimer(timeEndAt - Date.now());
        console.log('Rejoin response:', d);
        chatStore.updateSession({
          chatId: get(roomId) || '',
        });

        const queued = get(queuedMessages)
          .filter((m: QueuedMessage) => m.chatId !== get(roomId))
          .forEach((m) => {
            console.log('Removing queued message for old room: ' + m.text);
            chatStore.removeQueuedMessage(m.id);
          });

        const searchQueued = get(messages).filter(
          (m: ChatMessage) => m.type === 'self' && !m.timestamp
        );

        searchQueued.forEach((m) => {
          chatStore.addQueuedMessage(m.text, get(roomId) || '', m.id, 'self', m.replyTo || '');
        });
      } else {
        toastStore.add(msg || 'Failed to rejoin chat. Starting fresh.');
        localStorage.removeItem('roomId');
        handleFindFox();
      }
    });

    sock.on('disconnect', () => {
      isConnected = false;
      toastStore.add('🌫️ Connection lost. Reconnecting...');
    });

    sock.on('connect_error', (err: any) => {
      if (err?.message?.toLowerCase()?.includes('blocked')) {
        isBlocked = true;
        fetchBlockStatus();
      }
    });

    sock.on('banned', (d: unknown) => {
      const { message } = d as { message?: string };
      isBlocked = true;
      blockReason = message || 'Blocked';
      fetchBlockStatus();
    });

    sock.on('onlineCount', (d: unknown) => {
      onlineCount = (d as { count: number }).count;
    });

    sock.on('init', (d: unknown) => {
      const { token, berries: b, userId } = d as { token: string; berries: number; userId: string };
      localStorage.setItem('sneaky_token', token);
      updateBerryUI(b);
      myuserId.set(userId);
    });

    sock.on('berriesUpdate', (d: unknown) => {
      const { token, berries: b, msg } = d as { token: string; berries: number; msg?: string };
      localStorage.setItem('sneaky_token', token);
      updateBerryUI(b);
    });

    sock.on('searching', (d: unknown) => {
      const { msg } = d as { msg: string };
      searchTitle = 'Sneaking through the forest...';
      searchSub = 'Looking for another fox to chat with';
      screen = 'searching';
    });

    sock.on('autoRequeue', (d: unknown) => {
      const { msg } = d as { msg: string };
      searchTitle = 'Finding another fox...';
      searchSub = msg || '💨 Fox left — searching for a new one!';
      screen = 'searching';
    });

    sock.on('matched', (d: unknown) => {
      const {
        token,
        berries: b,
        durationMs,
        chatId,
      } = d as {
        token: string;
        berries: number;
        durationMs: number;
        msg: string;
        partnerId: string;
        chatId: string;
        userId: string;
      };
      localStorage.setItem('sneaky_token', token);
      updateBerryUI(b);
      screen = 'chat';
      chatStore.start(durationMs);
      activeGame.set(null);
      gameProposal.set(null);
      roomId.set((d as { chatId: string }).chatId);
      chatStore.updateSession({
        chatId,
        startedAt: Date.now(),
        messages: [],
      });
    });

    sock.on('message', (d: unknown, callback: any) => {
      const messageEvent = d as {
        from: string;
        text: string;
        id: string;
        replyTo?: string;
        reaction?: string;
        type?: string;
        timestamp?: number;
        stickerId?: string;
        meta?: string;
      };
      const { from, text, id, replyTo, type, reaction, timestamp, stickerId, meta } = messageEvent;

      if (callback) callback('ok');

      if (type === 'system') {
        chatStore.addMessage(text, id, 'system', undefined, timestamp);
        return;
      }

      if (type === 'reaction') {
        if (!replyTo) return;
        chatStore.updateMessage(replyTo, {
          reaction: reaction || '',
        });
        return;
      }

      if (type === 'sticker' && stickerId) {
        const sticker = stickerStore.getStickerById(stickerId);
        if (sticker) {
          if (get(messages).find((m) => m.id === id)) {
            // Message already exists, just update timestamp and sticker
            if (timestamp) {
              chatStore.updateMessage(id, { timestamp, meta });
            }
          } else {
            // New sticker message
            chatStore.addMessage(
              '',
              id,
              from === 'self' ? 'self' : 'partner',
              replyTo,
              timestamp,
              undefined,
              meta
            );
            // Now add the sticker
            console.log(d);
            chatStore.updateMessage(id, {
              sticker: {
                id: sticker.id,
                name: sticker.name,
                url: sticker.url,
                type: sticker.type,
                fallbackText: sticker.fallbackText,
              },
              text,
            });
          }
        }
        return;
      }

      if (get(messages).find((m) => m.id === id)) {
        if (timestamp) {
          chatStore.updateMessage(id, {
            timestamp,
            meta,
          });
        } else {
          chatStore.addQueuedMessage(text, get(roomId) || '', id, 'self', replyTo);
        }
      } else {
        chatStore.addMessage(
          text,
          id,
          from === 'self' ? 'self' : 'partner',
          replyTo,
          timestamp,
          reaction,
          meta
        );
      }
    });

    sock.on('timerEnd', (d: unknown) => {
      const { token, berries: b } = d as { token: string; berries: number };
      localStorage.setItem('sneaky_token', token);
      updateBerryUI(b);
      chatStore.showModal();
    });

    sock.on('extendRequest', () => {
      chatStore.partnerWantsExtend();
      toastStore.add('🍇 Partner wants to extend!');
    });

    sock.on('chatExtended', (d: unknown) => {
      const {
        token,
        berries: b,
        durationMs,
        msg,
      } = d as {
        token: string;
        berries: number;
        durationMs: number;
        msg: string;
      };
      localStorage.setItem('sneaky_token', token);
      updateBerryUI(b);
      chatStore.extend(durationMs, msg);
      toastStore.add(msg);
    });

    sock.on('partner-status', (d: unknown) => {
      const { status, event } = d as { status: string; event?: 'rejoined' };
      partnerStatus.set(status);
      // console.log("Partner status:", status);
      // console.log("Queued messages:", get(queuedMessages));
      if (status === 'online' && event === 'rejoined') {
        const queued = get(queuedMessages).filter((m: QueuedMessage) => m.chatId === get(roomId));
        queued.forEach((m) => {
          console.log('Re-sending queued message: ' + m.text);
          sock.emit(
            'message',
            {
              text: m.text,
              id: m.id,
              replyTo: m.replyTo,
            },
            (res: any) => {
              if (res?.status !== 'success') {
                toastStore.add('⚠️ Failed to send queued message. Please try again.');
              } else {
                chatStore.updateMessage(m.id, {
                  timestamp: res.timestamp,
                });
              }
            }
          );
          chatStore.removeQueuedMessage(m.id);
        });
      }
      if (status === 'offline') {
        toastStore.add('💨 Partner left the chat. Waiting to reconnect...', 3500);
      }
    });

    socket.on('aliveCheck', (callback: any) => {
      console.log('Received alive check from server');
      callback('ok');
    });

    sock.on('chatEnded', (d: unknown) => {
      const { token, berries: b, msg } = d as { token: string; berries: number; msg: string };
      localStorage.setItem('sneaky_token', token);
      localStorage.removeItem('roomId');
      roomId.set('');
      updateBerryUI(b);
      showSkipConfirm = false;
      screen = 'idle';
      startCooldown(get(berries));
      toastStore.add(msg, 4500);
    });

    sock.on('idle', (d: unknown) => {
      screen = 'idle';
      toastStore.add((d as { msg: string }).msg);
      roomId.set('');
      localStorage.removeItem('roomId');
    });
    sock.on('error', (d: unknown) => toastStore.add('⚠️ ' + (d as { msg: string }).msg));
    sock.on('noberries', (d: unknown) => {
      screen = 'idle';
      toastStore.add('🪹 ' + (d as { msg: string }).msg);
      startCooldown(get(berries));
    });
    sock.on('info', (d: unknown) => {
      const { msg } = d as { msg: string };
      if (screen === 'chat') chatStore.addMessage(msg);
      else toastStore.add(msg);
    });

    // ── Game event listeners ──
    sock.on('gameProposal', (d: unknown) => {
      const proposal = d as {
        gameId: string;
        chatId: string;
        proposedBy: string;
        gameType: string;
      };
      gameProposal.set(proposal);
      // toastStore.add(`🎮 ${proposal.gameType}: Partner wants to play!`);
    });

    sock.on('gameStarted', (d: unknown) => {
      const { gameId, chatId, gameType, initialState, players } = d as {
        gameId: string;
        chatId: string;
        gameType: string;
        initialState: unknown;
        players: string[];
      };

      activeGame.set({
        gameId,
        chatId,
        gameType,
        players,
        state: initialState,
        isFinished: false,
        winner: null,
        currentPlayer: players[0],
      });
      gameProposal.set(null);
      // toastStore.add('🎮 Game started!');
    });

    sock.on('gameRejoin', (d: unknown) => {
      const { gameId, chatId, gameType, state, isFinished, winner, message } = d as {
        gameId: string;
        chatId: string;
        gameType: string;
        state: unknown;
        isFinished: boolean;
        winner: string | null;
        message: string;
      };

      activeGame.set({
        gameId,
        chatId,
        gameType,
        players: [],
        state,
        isFinished,
        winner,
        currentPlayer: null,
      });
      // toastStore.add(message);
    });

    sock.on('gameStateUpdate', (d: unknown) => {
      const { gameId, gameType, state, currentPlayer } = d as {
        gameId: string;
        gameType: string;
        state: unknown;
        currentPlayer: string | null;
      };
      const current = get(activeGame);
      if (current && current.gameId === gameId) {
        activeGame.set({
          ...current,
          state,
          currentPlayer,
        });
      }
    });

    sock.on('gameEnded', (d: unknown) => {
      try {
        const { gameId, state, winner, reward, message } = d as {
          gameId: string;
          state?: unknown;
          winner: string | null;
          reward: number;
          message: string;
        };
        const current = get(activeGame);
        if (current && current.gameId === gameId) {
          activeGame.set({
            ...current,
            state: state ?? current.state,
            isFinished: true,
            winner,
            currentPlayer: null,
          });
          // // toastStore.add(message);
          // if (winner) {
          //   toastStore.add(`✨ +${reward} berries!`);
          // }

          // Game remains open, waiting for user to restart or close
        }
      } catch (e) {
        console.log(e);
        let msg = (d as { msg: string }).msg;
        toastStore.add(msg);
        activeGame.set(null);
      }
    });

    return () => {
      socket.disconnect();
    };
  }

  onMount(() => {
    if (!disposeHomeRuntime) {
      disposeHomeRuntime = initHomeRuntime();
    }
  });

  onDestroy(() => {
    if (disposeHomeRuntime) {
      disposeHomeRuntime();
      disposeHomeRuntime = null;
    }
  });

  function handleFindFox(): void {
    if (!isConnected) {
      toastStore.add('⚠️ Not connected to server. Please wait...');
      return;
    }
    socket.emit('findFox');
  }
  function handleCancelSearch(): void {
    socket.emit('skip');
  }
  function handleSendMessage(e: {
    text?: string;
    id: string;
    replyTo?: string | null;
    reaction?: string;
    type?: 'reaction' | 'sticker';
    stickerId?: string;
  }): void {
    let timestamp: number | null = null;
    console.log(e);
    socket?.emitwithtimeout(
      'message',
      {
        text: e.text,
        id: e.id,
        replyTo: e.replyTo,
        reaction: e.reaction,
        type: e.type || 'text',
        stickerId: e.stickerId,
      },
      (error: any, response: any) => {
        console.log(response, error);
        if (error || response?.status !== 'success') {
          toastStore.add('⚠️ Failed to send message. Please try again.');
          chatStore.addQueuedMessage(
            e.text || '',
            get(roomId) || '',
            e.id,
            e.type === 'sticker' ? 'sticker' : 'self',
            e.replyTo || ''
          );
          return;
        } else {
          chatStore.updateMessage(e.id, {
            timestamp: response.timestamp,
            meta: response.meta,
          });
        }
        response.timestamp && (timestamp = response.timestamp);
      }
    );

    // Handle text messages
    if (!e.type && e.text) {
      chatStore.addMessage(e.text, e.id, 'self', e.replyTo ?? undefined, timestamp ?? undefined);
    }

    // Handle sticker messages
    if (e.type === 'sticker' && e.stickerId) {
      const sticker = stickerStore.getStickerById(e.stickerId);
      if (sticker) {
        chatStore.addMessage('', e.id, 'self', e.replyTo ?? undefined, timestamp ?? undefined);
        chatStore.updateMessage(e.id, {
          sticker: {
            id: sticker.id,
            name: sticker.name,
            url: sticker.url,
            type: sticker.type,
            fallbackText: sticker.fallbackText,
          },
          text: e.text || sticker.fallbackText || ':sticker:',
        });
      }
    }
  }
  function handleSkipRequest(): void {
    showSkipConfirm = true;
  }
  function handleSkipConfirm(): void {
    showSkipConfirm = false;
    socket.emit('skip');
  }
  function handleSkipCancel(): void {
    showSkipConfirm = false;
  }
  function handleExtend(): void {
    socket.emit('extendChat');
    chatStore.markExtendVote();
  }
  function handleChatComplete(): void {
    socket.emit('chatComplete');
  }

  function handleExitConfirm(): void {
    showExitConfirm = false;
    socket.emit('exitChat');
  }
  function handleExitCancel(): void {
    showExitConfirm = false;
  }
  function handleExitRequest(): void {
    showExitConfirm = true;
  }

  function handleViewHistory(): void {
    showHistoryModal = true;
  }

  function handleCloseHistory(): void {
    showHistoryModal = false;
  }
</script>

<Fireflies count={14} />

<div
  class={`relative z-10 w-full max-w-[440px] sm:mt-3 mx-auto ${screen === 'chat' ? 'px-0' : 'px-4'}`}
>
  <Header {isConnected} hidden={screen === 'chat'} />
  <StatsStrip {onlineCount} hidden={screen === 'chat'} />
  <CooldownBadge />

  {#if isBlocked}
    <div class="mb-4 rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-cream">
      <div class="text-sm font-bold uppercase tracking-[.06em] text-red-200">Blocked</div>
      <div class="text-sm text-red-100 mt-1">{blockReason}</div>
      <div class="text-xs text-red-200 mt-2">
        {#if blockIsPermanent}
          Block duration: Permanent
        {:else}
          Unblocked at: {formatBlockedUntil()}
        {/if}
      </div>
      {#if blockReportId}
        <div class="text-xs text-red-200 mt-2">Related report: {blockReportId}</div>
      {/if}
      {#if appealId}
        <div class="text-xs text-red-200 mt-2">Appeal status: {appealStatus || 'pending'}</div>
      {/if}
      <button
        class="mt-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[.06em] text-cream hover:bg-white/20"
        on:click={openAppealModal}
      >
        Appeal
      </button>
      {#if appealSuccess}
        <div class="text-xs text-green-200 mt-2">{appealSuccess}</div>
      {/if}
      {#if appealError}
        <div class="text-xs text-red-200 mt-2">{appealError}</div>
      {/if}
    </div>
  {/if}

  <div
    class={`bg-[rgba(255,248,240,0.035)] sm:border border-white/[.07] ${screen == 'chat' ? 'sm:rounded-[18px]' : 'rounded-[18px]'} overflow-hidden  backdrop-blur-md shadow-[0_4px_24px_rgba(0,0,0,.22)]`}
  >
    {#if screen === 'idle'}
      <IdleScreen on:findFox={handleFindFox} on:viewHistory={handleViewHistory} />
    {:else if screen === 'searching'}
      <SearchingScreen title={searchTitle} sub={searchSub} on:cancel={handleCancelSearch} />
    {:else if screen === 'chat'}
      <ChatScreen
        onSendMessage={handleSendMessage}
        onSkip={handleSkipRequest}
        onExtend={handleExtend}
        onComplete={handleChatComplete}
        onExit={handleExitRequest}
      />
    {/if}
  </div>

  {#if screen !== 'chat'}
    <footer class="legal-footer pb-4">
      <div class="legal-footer-links">
        <a href="/about" class="legal-footer-link">About</a>
        <a href="/privacy" class="legal-footer-link">Privacy Policy</a>
        <a href="/terms" class="legal-footer-link">Terms &amp; Conditions</a>
      </div>
      <p class="legal-footer-copy">
        &copy; {new Date().getFullYear()} SneakyChat. All rights reserved.
      </p>
      <p class="legal-footer-copy">
        Made with 🍇 by <a
          href="http://instagram.com/telap0ka"
          target="_blank"
          class=" text-leaf-lt underline"
          rel="noopener noreferrer">telap0ka</a
        >
      </p>
    </footer>
  {/if}
</div>

<SkipConfirmModal
  visible={showSkipConfirm}
  on:confirm={handleSkipConfirm}
  on:cancel={handleSkipCancel}
/>

<ExitConfirmModal
  visible={showExitConfirm}
  on:confirm={handleExitConfirm}
  on:cancel={handleExitCancel}
/>

<ChatHistoryModal visible={showHistoryModal} on:close={handleCloseHistory} />

{#if showAppealModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
    <div
      class="w-full max-w-md rounded-2xl border border-white/20 bg-[rgba(14,28,14,.96)] p-6 shadow-[0_18px_40px_rgba(0,0,0,.45)]"
    >
      <div class="text-lg font-fredoka text-cream mb-4">Appeal Block</div>
      {#if appealStatus}
        <div
          class="mb-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs uppercase tracking-[.06em] text-cream"
        >
          Status: {appealStatus}
        </div>
      {/if}
      <label class="block text-xs font-bold uppercase tracking-[.06em] text-cream">Reason</label>
      <input
        class="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-cream outline-none"
        placeholder="Why should your block be lifted?"
        bind:value={appealReason}
        disabled={appealSubmitting}
      />

      <label class="block text-xs font-bold uppercase tracking-[.06em] text-cream mt-4">
        Details
      </label>
      <textarea
        class="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-cream outline-none h-24 resize-none"
        placeholder="Add any context"
        bind:value={appealMessage}
        disabled={appealSubmitting}
      ></textarea>

      <div class="mt-5 flex gap-2">
        <button
          class="flex-1 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm font-bold text-cream"
          on:click={() => (showAppealModal = false)}
          disabled={appealSubmitting}
        >
          Cancel
        </button>
        <button
          class="flex-1 rounded-xl bg-red-500 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
          on:click={submitAppeal}
          disabled={!appealReason.trim() ||
            appealSubmitting ||
            (appealStatus && appealStatus !== 'pending')}
        >
          {appealSubmitting ? 'Submitting...' : appealId ? 'Update Appeal' : 'Submit Appeal'}
        </button>
      </div>
    </div>
  </div>
{/if}

<ToastManager />
