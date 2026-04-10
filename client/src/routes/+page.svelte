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
  import { get } from 'svelte/store';

  import Fireflies from '$components/Fireflies.svelte';
  import Header from '$components/Header.svelte';
  import StatsStrip from '$components/StatsStrip.svelte';
  import CooldownBadge from '$components/CooldownBadge.svelte';
  import IdleScreen from '$components/IdleScreen.svelte';
  import SearchingScreen from '$components/SearchingScreen.svelte';
  import ChatScreen from '$components/ChatScreen.svelte';
  import SkipConfirmModal from '$components/SkipConfirmModal.svelte';
  import ToastManager from '$components/ToastManager.svelte';
  import ExitConfirmModal from '$components/ExitConfirmModal.svelte';
  import { partnerStatus } from '$stores/partnerStore';
  import { browser } from '$app/environment';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';

  type Screen = 'idle' | 'searching' | 'chat';

  let screen: Screen = 'idle';
  let isConnected = false;
  let onlineCount = 1;
  let searchTitle = 'Sneaking through the forest...';
  let searchSub = 'Looking for another fox to chat with';
  let showSkipConfirm = false;
  let showExitConfirm = false;
  let disposeHomeRuntime: (() => void) | null = null;

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
  });

  function initHomeRuntime(): () => void {
    const sock = connectSocket();

    sock.on('connect', () => {
      isConnected = true;
      if (screen == 'searching') {
        toastStore.add('🔄 Reconnected! Resuming search...');
        handleFindFox();
      }
      if (get(roomId)) {
        chatStore.loadSession(get(roomId) || '');
        sock.emit(
          'rejoinRoom',
          { roomId: get(roomId), ouid: get(session).userId },
          (response: any) => {
            if (response.status == 'success') {
              toastStore.add('🔄 Rejoined existing chat!');
              screen = 'chat';
              if (response.timeEndAt <= Date.now()) {
                toastStore.add('⏰ Chat already ended. Starting fresh.');
                localStorage.removeItem('roomId');
                handleFindFox();
                return;
              }
              chatStore.resetTimer(response.timeEndAt - Date.now());
              console.log('Rejoin response:', response);
              chatStore.updateSession({
                chatId: get(roomId) || '',
                userId: response.userId,
                partnerId: response.partnerId,
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
                chatStore.addQueuedMessage(
                  m.text,
                  get(roomId) || '',
                  m.id,
                  'self',
                  m.replyTo || ''
                );
              });
            } else {
              toastStore.add(response.msg || 'Failed to rejoin chat. Starting fresh.');
              localStorage.removeItem('roomId');
              handleFindFox();
            }
          }
        );
      }
    });
    sock.on('disconnect', () => {
      isConnected = false;
      toastStore.add('🌫️ Connection lost. Reconnecting...');
    });

    sock.on('onlineCount', (d: unknown) => {
      onlineCount = (d as { count: number }).count;
    });

    sock.on('init', (d: unknown) => {
      const { token, berries: b } = d as { token: string; berries: number };
      localStorage.setItem('sneaky_token', token);
      updateBerryUI(b);
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
        msg,
        partnerId,
        chatId,
        userId,
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
      roomId.set((d as { chatId: string }).chatId);
      chatStore.updateSession({
        chatId,
        userId,
        partnerId,
        startedAt: Date.now(),
      });
    });

    sock.on('message', (d: unknown, callback: any) => {
      const { from, text, id, replyTo, type, reaction, timestamp } = d as {
        from: string;
        text: string;
        id: string;
        replyTo?: string;
        reaction?: string;
        type?: string;
        timestamp?: number;
      };

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

      if (get(messages).find((m) => m.id === id)) {
        if (timestamp) {
          chatStore.updateMessage(id, {
            timestamp,
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
          reaction
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
    type?: 'reaction';
  }): void {
    let timestamp: number | null = null;
    socket?.emitwithtimeout(
      'message',
      {
        text: e.text,
        id: e.id,
        replyTo: e.replyTo,
        reaction: e.reaction,
        type: e.type,
      },
      (error: any, response: any) => {
        console.log(response, error);
        if (error || response?.status !== 'success') {
          toastStore.add('⚠️ Failed to send message. Please try again.');
          chatStore.addQueuedMessage(
            e.text || '',
            get(roomId) || '',
            e.id,
            'self',
            e.replyTo || ''
          );
          return;
        } else {
          chatStore.updateMessage(e.id, {
            timestamp: response.timestamp,
          });
        }
        response.timestamp && (timestamp = response.timestamp);
      }
    );

    if (!e.type && e.text) {
      chatStore.addMessage(e.text, e.id, 'self', e.replyTo ?? undefined, timestamp ?? undefined);
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
</script>

<Fireflies count={14} />

<div
  class={`relative z-10 w-full max-w-[440px] sm:mt-3 mx-auto ${screen === 'chat' ? 'px-0' : 'px-4'}`}
>
  <Header {isConnected} hidden={screen === 'chat'} />
  <StatsStrip {onlineCount} hidden={screen === 'chat'} />
  <CooldownBadge />

  <div
    class={`bg-[rgba(255,248,240,0.035)] sm:border border-white/[.07] ${screen == 'chat' ? 'sm:rounded-[18px]' : 'rounded-[18px]'} overflow-hidden  backdrop-blur-md shadow-[0_4px_24px_rgba(0,0,0,.22)]`}
  >
    {#if screen === 'idle'}
      <IdleScreen on:findFox={handleFindFox} />
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
    <footer class="legal-footer">
      <div class="legal-footer-links">
        <a href="/about" class="legal-footer-link">About</a>
        <a href="/privacy" class="legal-footer-link">Privacy Policy</a>
        <a href="/terms" class="legal-footer-link">Terms &amp; Conditions</a>
      </div>
      <p class="legal-footer-copy">&copy; 2025 SneakyChat. All rights reserved.</p>
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

<ToastManager />
