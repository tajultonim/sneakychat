<script lang="ts">
  import { berries } from '../../stores/gameStore.ts';
  import { activeGame, hasActiveGame, gameSize } from '../../stores/gameStore.ts';
  import { stickerStore } from '../../stores/stickerStore.ts';
  import Icon from '@iconify/svelte';
  import animatedFox from '../../assets/icon/animated-fox.webp';
  import {
    messages,
    timerDisplay,
    timerUrgent,
    showTimerModal,
    partnerWantsExtend,
    myExtendVote,
    timerRemaining,
    session,
  } from '../../stores/chatStore.ts';

  import { partnerStatus } from '../../stores/userStore.ts';
  import { socket } from '../../lib/socket.ts';
  import GameProposal from '../games/GameProposal.svelte';
  import GameBoard from '../games/GameBoard.svelte';
  import GameMenu from '../GameMenu.svelte';
  import StickerPicker from '../StickerPicker.svelte';
  import EmojiPicker from '../EmojiPicker.svelte';
  import { onMount, tick } from 'svelte';
  import { isEmoji } from '$lib/helper.ts';

  type OutgoingMessage = {
    text?: string;
    id: string;
    replyTo?: string | null;
    reaction?: string;
    stickerId?: string;
    type?: 'reaction' | 'sticker';
  };

  const {
    onSendMessage,
    onSkip,
    onExtend,
    onComplete,
    onExit,
  }: {
    onSendMessage?: (payload: OutgoingMessage) => void;
    onSkip?: () => void;
    onExtend?: () => void;
    onComplete?: () => void;
    onExit?: () => void;
  } = $props();

  let inputText = $state('');
  let messagesEl: HTMLDivElement;
  let inputEl: HTMLTextAreaElement;
  let wrapperEl: HTMLDivElement;
  let reactionPickerEl = $state<HTMLDivElement | null>(null);
  let sendButtonIconEl = $state<HTMLSpanElement | null>(null);
  let replyToId = $state<string | null>(null);
  let reactionPickerMessageId = $state<string | null>(null);
  let modalCountdown = $state(10);
  let modalCountdownInterval: ReturnType<typeof setInterval> | null = null;
  let modalAutoFinishTimeout: ReturnType<typeof setTimeout> | null = null;
  let modalTimerArmed = false;
  let gameMenuOpen = $state(false);
  let stickerPickerOpen = $state(false);
  let emojiPickerOpen = $state(false);
  let longPressMenu = $state<{
    messageId: string;
    text: string;
    x: number;
    y: number;
  } | null>(null);
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;
  let longPressStartX = 0;
  let longPressStartY = 0;
  let suppressNextBubbleTap = false;
  let reportModal = $state<{
    messageId: string;
    reportedUserId: string;
  } | null>(null);
  let reportReason = $state('');
  let isSubmittingReport = $state(false);

  function handleEmojiSelect(emoji: string) {
    inputText += emoji;
    resizeInput();
    inputEl?.focus();
  }

  // Titlebar notification
  let originalTitle = typeof document !== 'undefined' ? document.title : '';
  let previousMessageCount = 0;
  let titleFlashInterval: ReturnType<typeof setInterval> | null = null;
  let titleFlashing = false;

  let typingTimer: ReturnType<typeof setTimeout> | null = null;
  let isTyping = false;
  let disableEnterToSend = false;
  const TYPING_DELAY = 1000;
  const MAX_INPUT_LINES = 5;
  const LONG_PRESS_DELAY = 450;
  const LONG_PRESS_MOVE_TOLERANCE = 10;

  onMount(() => {
    gameSize.set('normal'); // Reset game size when component mounts
    // Touch-first devices generally rely on a virtual keyboard.
    disableEnterToSend =
      window.matchMedia('(pointer: coarse)').matches && (navigator.maxTouchPoints ?? 0) > 0;
    resizeInput();
    return () => {
      if (typingTimer) clearTimeout(typingTimer);
    };
  });

  function resizeInput(): void {
    if (!inputEl) return;
    inputEl.style.height = 'auto';
    const styles = window.getComputedStyle(inputEl);
    const lineHeight = Number.parseFloat(styles.lineHeight) || 20;
    const maxHeight = lineHeight * MAX_INPUT_LINES;
    inputEl.style.height = `${Math.min(inputEl.scrollHeight, maxHeight)}px`;
  }

  $effect(() => {
    $messages.length;
    if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
  });

  $effect(() => {
    if ($gameSize == 'normal') {
      if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  });

  if (typeof window !== 'undefined') {
    window.addEventListener('focus', () => {
      stopTitleFlash();
    });
  }

  function clearLongPressTimer(): void {
    if (!longPressTimer) return;
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }

  function closeLongPressMenu(): void {
    longPressMenu = null;
  }

  function startLongPress(
    event: TouchEvent,
    messageId: string,
    text: string,
    canOpenMenu: boolean
  ): void {
    if (!canOpenMenu || $showTimerModal || event.touches.length !== 1) return;

    const touch = event.touches[0];
    longPressStartX = touch.clientX;
    longPressStartY = touch.clientY;
    clearLongPressTimer();
    console.log(event);
    longPressTimer = setTimeout(() => {
      suppressNextBubbleTap = true;
      openMessageActionMenu(messageId, text, touch.clientX, touch.clientY - 16);
    }, LONG_PRESS_DELAY);
  }

  function openMessageActionMenu(messageId: string, text: string, x: number, y: number): void {
    reactionPickerMessageId = null;
    const menuWidth = 172;
    const menuHeight = 112;
    const menuX = Math.max(12, Math.min(x, wrapperEl.clientWidth - menuWidth - 12));
    const menuY = Math.max(12, Math.min(y, wrapperEl.clientHeight - menuHeight - 12));
    longPressMenu = { messageId, text, x: menuX, y: menuY };
  }

  function handleLongPressMove(event: TouchEvent): void {
    if (!longPressTimer || event.touches.length !== 1) return;

    const touch = event.touches[0];
    const deltaX = Math.abs(touch.clientX - longPressStartX);
    const deltaY = Math.abs(touch.clientY - longPressStartY);
    if (deltaX > LONG_PRESS_MOVE_TOLERANCE || deltaY > LONG_PRESS_MOVE_TOLERANCE) {
      clearLongPressTimer();
    }
  }

  function endLongPress(): void {
    clearLongPressTimer();
  }

  function handleMessageContextMenu(
    event: MouseEvent,
    messageId: string,
    text: string,
    canOpenMenu: boolean
  ): void {
    if (!canOpenMenu || $showTimerModal) return;

    event.preventDefault();
    event.stopPropagation();
    suppressNextBubbleTap = true;
    console.log(event);
    openMessageActionMenu(messageId, text, event.clientX, event.clientY);
  }

  function handleMessageBubbleClick(): void {
    if (suppressNextBubbleTap) {
      suppressNextBubbleTap = false;
      return;
    }
    inputEl.focus();
  }

  async function copyTextToClipboard(text: string): Promise<void> {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const fallback = document.createElement('textarea');
        fallback.value = text;
        fallback.setAttribute('readonly', '');
        fallback.style.position = 'fixed';
        fallback.style.opacity = '0';
        document.body.appendChild(fallback);
        fallback.select();
        document.execCommand('copy');
        document.body.removeChild(fallback);
      }
    } finally {
      closeLongPressMenu();
    }
  }

  function replyFromLongPress(messageId: string): void {
    replyToId = messageId;
    closeLongPressMenu();
    inputEl.focus();
  }

  function openReportModal(messageId: string, reportedUserId: string): void {
    reportModal = { messageId, reportedUserId };
    reportReason = '';
    closeLongPressMenu();
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
      const msg = $messages.find((m) => m.id === reportModal.messageId);
      if (!msg) return;

      const conversationEncryptedMeta = $messages
        .map((m) => m.meta)
        .filter((meta): meta is string => !!meta);

      // Get the chat ID from the active chat
      const activeChatId = $session.chatId;

      socket.emit(
        'report:message',
        {
          chatId: activeChatId || 'unknown',
          messageId: reportModal.messageId,
          reason: reportReason,
          encryptedMeta: msg.meta,
          conversationEncryptedMeta,
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

  function flyPlane() {
    if (sendButtonIconEl?.classList.contains('animate-fly')) return; // prevent spamming
    void sendButtonIconEl?.offsetWidth; // restart animation trick
    sendButtonIconEl?.classList.add('animate-fly');
    setTimeout(() => {
      sendButtonIconEl?.classList.remove('animate-fly');
    }, 300);
  }

  window.addEventListener('click', (e: MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;

    if (longPressMenu && !target?.closest('[data-longpress-menu="true"]')) {
      closeLongPressMenu();
    }

    // Close emoji reaction picker
    if (reactionPickerMessageId) {
      if (
        reactionPickerEl &&
        !reactionPickerEl.contains(target) &&
        !target?.closest('.emoji-button')
      ) {
        reactionPickerMessageId = null;
      }
    }

    // Close sticker picker when clicking outside
    if (
      stickerPickerOpen &&
      !target?.closest('[aria-label="sticker picker"]') &&
      target?.textContent !== '🎨'
    ) {
      if (!target?.closest('button[aria-label="Open sticker picker"]')) {
        stickerPickerOpen = false;
      }
    }

    // Close emoji picker when clicking outside
    if (
      emojiPickerOpen &&
      !target?.closest('[aria-label="emoji picker"]') &&
      target?.textContent !== '😊'
    ) {
      if (!target?.closest('button[aria-label="Open emoji picker"]')) {
        emojiPickerOpen = false;
      }
    }
  });

  function generateId(length: number): string {
    if (length <= 0) return '';
    const bytes = Math.ceil(length / 2);
    const array = new Uint8Array(bytes);
    crypto.getRandomValues(array);
    const hex = Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
    return hex.slice(0, length);
  }

  async function sendMsg(): Promise<void> {
    const text = inputText.trim();
    if (!text || $showTimerModal) return;

    onSendMessage?.({
      text: text,
      id: generateId(5),
      replyTo: replyToId,
    });
    inputText = '';
    await tick();
    resizeInput();
    replyToId = null;
    inputEl.focus();
    flyPlane();
  }

  function sendReaction(messageId: string, reaction: string): void {
    onSendMessage?.({
      type: 'reaction',
      id: generateId(5),
      replyTo: messageId,
      reaction,
    });
    reactionPickerMessageId = null;
  }

  function sendSticker(stickerId: string): void {
    const sticker = stickerStore.getStickerById(stickerId);
    if (!sticker) return;

    stickerStore.addRecentSticker(stickerId);

    onSendMessage?.({
      type: 'sticker',
      id: generateId(5),
      text: sticker.fallbackText,
      stickerId,
    });
    stickerPickerOpen = false;
    inputEl.focus();
    flyPlane();
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey && !disableEnterToSend) {
      e.preventDefault();
      sendMsg();
    }
  }

  function handleExtend(): void {
    if ($myExtendVote) return;
    clearModalTimer();
    onExtend?.();
  }

  function clearModalTimer(): void {
    if (modalCountdownInterval) {
      clearInterval(modalCountdownInterval);
      modalCountdownInterval = null;
    }
    if (modalAutoFinishTimeout) {
      clearTimeout(modalAutoFinishTimeout);
      modalAutoFinishTimeout = null;
    }
    modalTimerArmed = false;
  }

  function startModalTimer(): void {
    clearModalTimer();
    modalCountdown = 10;
    modalTimerArmed = true;

    modalCountdownInterval = setInterval(() => {
      modalCountdown = Math.max(0, modalCountdown - 1);
    }, 1000);

    modalAutoFinishTimeout = setTimeout(() => {
      handleComplete();
    }, 10000);
  }

  function handleComplete(): void {
    clearModalTimer();
    onComplete?.();
  }

  function stopTitleFlash(): void {
    if (titleFlashInterval) {
      clearInterval(titleFlashInterval);
      titleFlashInterval = null;
    }
    if (typeof document !== 'undefined') {
      document.title = originalTitle;
    }
    titleFlashing = false;
  }

  function startTitleFlash(): void {
    if (titleFlashing) return;
    titleFlashing = true;
    let isFlashing = false;

    titleFlashInterval = setInterval(() => {
      if (typeof document !== 'undefined') {
        isFlashing = !isFlashing;
        document.title = isFlashing ? '📬 New message!' : originalTitle;
      }
    }, 500);

    // Stop flashing after 5 seconds or when window focuses
    const stopFlashTimeout = setTimeout(() => {
      stopTitleFlash();
    }, 600000);

    const handleFocus = () => {
      clearTimeout(stopFlashTimeout);
      stopTitleFlash();
      window.removeEventListener('focus', handleFocus);
    };

    window.addEventListener('focus', handleFocus);
  }

  $effect(() => {
    if ($showTimerModal && !modalTimerArmed && !$myExtendVote) {
      startModalTimer();
    } else if ((!$showTimerModal || $myExtendVote) && modalTimerArmed) {
      clearModalTimer();
    }
  });

  // Detect new messages from partner
  $effect(() => {
    const currentMessageCount = $messages.length;
    if (currentMessageCount > previousMessageCount && currentMessageCount > 0) {
      const lastMessage = $messages[currentMessageCount - 1];
      // Flash only if new message is from the partner (not system, not self)
      if (lastMessage.type === 'partner' && typeof window !== 'undefined') {
        if (!document.hasFocus()) {
          startTitleFlash();
        }
      }
    }
    previousMessageCount = currentMessageCount;
  });

  function proposeGame(gameType: string) {
    socket.emit('proposeGame', { gameType });
    gameMenuOpen = false;
  }

  $effect(() => {
    if ($hasActiveGame && gameMenuOpen) {
      gameMenuOpen = false;
    }
  });

  $effect(() => {
    return () => {
      clearLongPressTimer();
      clearModalTimer();
      stopTitleFlash();
    };
  });
</script>

<!-- Outer wrapper fills the card height -->
<div bind:this={wrapperEl} class="flex flex-col h-[100dvh] sm:h-[calc(100dvh-1.5rem)] relative">
  <!-- ── Chat header ── -->
  <div
    class="flex items-center gap-2.5 px-3 py-2 bg-[rgba(255,107,53,.07)] border-b border-white/[.06] shrink-0"
  >
    <button
      class="text-leaf-lt font-fredoka text-xl leading-none px-1 bg-transparent border-0 cursor-pointer"
      onclick={() => onExit?.()}>&lt;</button
    >

    <span class="text-[1.3rem]">🦊</span>

    <div class="flex-1 flex flex-col">
      <span class="font-fredoka text-[.9rem] text-fox">Sneaky Fox</span>
      <span
        class={`text-[.82rem]  ${$partnerStatus === 'online' ? 'text-muted' : $partnerStatus === 'typing' ? 'text-blue-400' : 'text-red-500'} `}
      >
        <span
          class={`inline-block w-[7px] h-[7px] rounded-full ${$partnerStatus === 'online' ? 'bg-green shadow-[0_0_6px_#00e5a0]' : $partnerStatus === 'typing' ? 'bg-blue-400 shadow-[0_0_6px_#3b82f6]' : 'bg-red-500 shadow-[0_0_6px_#ef4444]'}  mr-1`}
        ></span>
        {$partnerStatus === 'online'
          ? 'Online'
          : $partnerStatus === 'typing'
            ? 'Typing...'
            : 'Offline'}
      </span>
    </div>

    <!-- Berry badge -->
    <div
      class="flex items-center gap-1 bg-[rgba(124,58,237,.12)] border border-[rgba(167,139,250,.2)] rounded-full px-2.5 py-[3px]"
    >
      <span class="text-[.8rem]">🍇</span>
      <span class="font-fredoka text-[.9rem] text-berry-lt leading-none">{$berries}</span>
    </div>

    <!-- Timer -->
    <div class="flex flex-col items-center mx-1.5">
      <div
        class="font-fredoka text-base text-cream leading-none {$timerUrgent
          ? 'text-fox animate-blink'
          : ''}"
      >
        {$timerDisplay}
      </div>
      <div class="text-[.55rem] text-muted font-bold uppercase tracking-[.04em]">left</div>
    </div>

    <button
      class="bg-transparent border-0 cursor-pointer text-[rgba(255,100,70,.55)] text-[.72rem] font-nunito font-bold uppercase tracking-[.04em] px-1.5 py-1 rounded hover:text-fox hover:bg-[rgba(255,107,53,.1)] transition-colors whitespace-nowrap"
      onclick={() => onSkip?.()}>Skip ✕</button
    >
  </div>

  <!-- ── Messages ── -->
  <div
    class="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-[5px]"
    role="log"
    aria-label="Chat messages"
    bind:this={messagesEl}
  >
    {#each $messages as msg, i (msg.id)}
      {#if msg.type === 'system'}
        <div
          class="self-center text-[.73rem] text-center whitespace-pre-line text-berry-lt font-semibold px-3 py-1 bg-[rgba(124,58,237,.1)] rounded-full animate-popin"
        >
          {msg.text}
        </div>
      {:else}
        <div
          id={`msg-${msg.id}`}
          data-message-id={msg.id}
          data-can-menu={!msg.sticker && msg.type !== 'reaction'}
          data-message-text={msg.text}
          role="button"
          onclick={handleMessageBubbleClick}
          oncontextmenu={(e) => {
            handleMessageContextMenu(e, msg.id, msg.text, !msg.sticker && msg.type !== 'reaction');
          }}
          ontouchstart={(e) =>
            startLongPress(e, msg.id, msg.text, !msg.sticker && msg.type !== 'reaction')}
          ontouchmove={handleLongPressMove}
          ontouchend={endLongPress}
          ontouchcancel={endLongPress}
          tabindex="0"
          onkeydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              inputEl.focus();
            }
          }}
          class={msg.type === 'self'
            ? `self-end group ${
                $messages[i - 1]?.type === 'self' && $messages[i + 1]?.type === 'self'
                  ? 'rounded-r-[4px]'
                  : $messages[i - 1]?.type === 'self'
                    ? 'rounded-tr-[4px]'
                    : $messages[i + 1]?.type === 'self'
                      ? 'rounded-br-[4px]'
                      : 'rounded-[20px]'
              } ${$messages[i - 1]?.type !== 'self' ? 'mt-2' : ''} ${msg.timestamp ? 'hover:mb-4' : ''} ${msg.reaction ? 'mb-4' : '-mb-1'}  rounded-[20px] p-2 px-3 relative max-w-[78%] text-[.88rem] leading-relaxed ${isEmoji(msg.text) || msg.sticker ? '' : 'bg-gradient-to-br from-fox to-fox-dark text-white'} break-words animate-popin`
            : `self-start group ${
                $messages[i - 1]?.type === 'partner' && $messages[i + 1]?.type === 'partner'
                  ? 'rounded-l-[4px]'
                  : $messages[i - 1]?.type === 'partner'
                    ? 'rounded-tl-[4px]'
                    : $messages[i + 1]?.type === 'partner'
                      ? 'rounded-bl-[4px]'
                      : 'rounded-[20px]'
              } ${$messages[i - 1]?.type !== 'partner' ? 'mt-2' : ''} ${msg.timestamp ? 'hover:mb-4' : 'mb-5'}  ${msg.reaction ? 'mb-4' : '-mb-1'}  rounded-[20px]  relative hover:mb-3 max-w-[78%] px-3 py-2 text-[.88rem] leading-relaxed ${isEmoji(msg.text) || msg.sticker ? '' : 'bg-[#2C352B] text-cream border border-white/[.06]'} break-words animate-popin`}
        >
          {#if msg.replyTo && msg.type !== 'reaction'}
            <div
              role="button"
              onclick={() => {
                const el = document.getElementById('msg-' + msg.replyTo);
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
              tabindex="0"
              onkeydown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  const el = document.getElementById('msg-' + msg.replyTo);
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }
              }}
              class={`${msg.type == 'self' ? 'self-end' : 'self-start'} min-w-[60px] border-l-[3px] pr-2 pl-2 flex flex-col w-full relative p-1`}
            >
              <div class=" font-bold text-gray-200 mb-1 text-xs whitespace-nowrap">
                {$messages.find((m) => m.id === msg.replyTo)?.type == 'self' ? 'You' : 'Fox'}
              </div>
              <div
                class={`${msg.type == 'self' ? 'text-gray-200/[0.95]' : 'text-gray-200/[0.8]'} relative whitespace-nowrap text-sm w-full overflow-hidden`}
              >
                {$messages.find((m) => m.id === msg.replyTo)?.text}
              </div>
            </div>
          {/if}
          {#if msg.sticker}
            <img
              src={msg.sticker.url}
              alt={msg.sticker.name}
              class="w-[100px] h-[100px] object-contain animate-popin"
              onerror={(e) => {
                const img = e.target as HTMLImageElement;
                img.style.display = 'none';
              }}
            />
          {:else}
            <span class={`${isEmoji(msg.text) ? 'text-7xl' : 'whitespace-pre-wrap'}`}
              >{msg.text}</span
            >
          {/if}
          <span
            class={`absolute -my-1 w-full pt-3 flex items-center gap-2 ${msg.type == 'self' ? 'right-0 flex-row-reverse' : 'left-0'} text-xs whitespace-nowrap text-muted`}
          >
            <span
              class={`group-hover:inline-block ${msg.timestamp ? 'hidden' : 'inline-block animate-pulse'} opacity-70`}
              >{msg.timestamp
                ? new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '⏳'}</span
            >
            <span
              class={` ${msg.reaction ? '' : 'hidden'} inline-block px-1 py-[1px] border rounded-full border-white/[.06] ${msg.type == 'self' ? 'bg-[#db530f]/10' : 'bg-[#2C352B] text-cream'} `}
              >{msg.reaction}</span
            >
          </span>

          <!-- <span
            class={`absolute -bottom-0 ${msg.type == "self" ? "-left-5 -rotate-45" : "-right-5 rotate-45"}`}
          >
            {msg.reaction ? msg.reaction : ""}
          </span> -->

          <span
            class={` group-hover:pb-[18px] group-hover:-mb-[18px] ${msg.type == 'self' ? '-left-2 pr-5 -translate-x-5' : '-right-2 translate-x-12 pl-12 flex-row-reverse'} text-white flex group-hover:opacity-100 hover:opacity-100 opacity-0 gap-1 absolute bottom-0 [&>*]:fill-[var(--leaf)] [&>*]:border [&>*]:rounded-full [&>*]:w-[1.5rem] [&>*]:h-[1.5rem] [&>*]:cursor-pointer [&>button>*]:w-full [&>button>*]:h-full [&>button]:flex [&>button]:items-center [&>button]:justify-center [&>button]:p-1`}
          >
            <button
              class=" hover:opacity-80 opacity-40 hover:bg-purple-600/20 rounded-full hover:border-purple-500 [&>*]:hover:text-purple-500 transition-colors"
              aria-label="Reply"
              onclick={() => {
                replyToId = msg.id;
                inputEl.focus();
              }}
            >
              <Icon icon="mdi:reply" />
            </button>
            {#if msg.type !== 'self'}
              <button
                class=" emoji-button hover:opacity-80 opacity-40 hover:bg-purple-600/20 rounded-full hover:border-purple-500 [&>*]:hover:text-purple-500 transition-colors relative"
                onclick={() => {
                  reactionPickerMessageId = reactionPickerMessageId === msg.id ? null : msg.id;
                }}
              >
                <Icon icon="mdi:emoji" />
              </button>
            {/if}
          </span>
          {#if reactionPickerMessageId === msg.id}
            <div
              class={`absolute bottom-full mb-1 z-50 ${msg.type === 'self' ? 'right-0' : 'left-0'}`}
              bind:this={reactionPickerEl}
            >
              <div
                aria-label="picker"
                class="flex gap-1.5 bg-[rgba(21,40,21,0.95)] border border-white/[.1] rounded-full px-2 py-1.5 animate-popin max-w-[min(92vw,360px)] overflow-x-auto"
              >
                {#each ['❤️', '😂', '😮', '😢', '🔥', '👍', '🦊'] as reaction}
                  <button
                    class={`${msg.reaction === reaction ? 'bg-white/10 px-1 rounded-md' : ''} hover:scale-125 text-2xl transition-transform cursor-pointer bg-transparent border-0 p-0 shrink-0`}
                    onclick={() => {
                      sendReaction(msg.id, msg.reaction == reaction ? '' : reaction);
                    }}
                  >
                    {reaction}
                  </button>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      {/if}
    {/each}
  </div>

  {#if longPressMenu}
    <button
      class="fixed inset-0 z-40 bg-transparent border-0 cursor-default"
      aria-label="Close message actions"
      onclick={closeLongPressMenu}
    ></button>
    <div
      data-longpress-menu="true"
      class="fixed z-50 min-w-[160px] overflow-hidden rounded-xl border border-white/[.14] bg-[rgba(14,28,14,.96)] shadow-[0_14px_34px_rgba(0,0,0,.45)]"
      style={`left:${longPressMenu.x}px; top:${longPressMenu.y}px;`}
    >
      <button
        class="w-full text-left px-3.5 py-2.5 text-[.86rem] text-cream font-nunito hover:bg-white/[.08] transition-colors border-0 bg-transparent cursor-pointer"
        onclick={() => copyTextToClipboard(longPressMenu.text)}
      >
        Copy
      </button>
      <button
        class="w-full text-left px-3.5 py-2.5 text-[.86rem] text-cream font-nunito hover:bg-white/[.08] transition-colors border-0 bg-transparent cursor-pointer"
        onclick={() => replyFromLongPress(longPressMenu.messageId)}
      >
        Reply
      </button>
      {#if longPressMenu && $messages.find((m) => m.id === longPressMenu.messageId)?.type === 'partner'}
        <button
          class="w-full text-left px-3.5 py-2.5 text-[.86rem] text-red-400 font-nunito hover:bg-white/[.08] transition-colors border-0 bg-transparent cursor-pointer"
          onclick={() => {
            const msg = $messages.find((m) => m.id === longPressMenu.messageId);
            if (msg && msg.meta) {
              const metaStr = msg.meta;
              try {
                // Try to extract user ID from meta if needed, otherwise use a default
                openReportModal(longPressMenu.messageId, 'unknown-user');
              } catch {
                openReportModal(longPressMenu.messageId, 'unknown-user');
              }
            }
          }}
        >
          Report
        </button>
      {/if}
    </div>
  {/if}

  <!-- ── Game display ── -->
  {#if $activeGame && ($gameSize == 'normal' || $gameSize == 'maximized')}
    <div
      class={`flex-1 overflow-y-auto px-3 py-3 bg-black/20 border-t border-white/[.06] ${($gameSize as any) == 'maximized' ? 'absolute bottom-16 w-full max-h-[100dvh] mt-28 overflow-scroll' : ''} ${!$activeGame ? 'hidden' : ''}`}
    >
      <GameBoard />
    </div>
  {/if}

  <!-- ── Input row ── -->
  <div class=" border-t border-white/[.05] bg-black/[.12]">
    {#if replyToId}
      <div class=" relative pt-2 pl-4 pr-10">
        <div class="  text-gray-200 mb-1 text-xs">
          Replying to {$messages.find((m) => m.id === replyToId)?.type == 'self' ? 'You' : 'Fox'}
        </div>
        <div class="text-gray-400 relative whitespace-nowrap text-sm w-full overflow-hidden">
          {$messages.find((m) => m.id === replyToId)?.text || ''}
        </div>
        <button
          class="absolute top-1 font-bold right-2 text-gray-400 hover:text-white"
          onclick={() => {
            replyToId = null;
          }}
        >
          ✕
        </button>
      </div>
    {/if}
    <div class="flex relative items-end gap-2 px-2.5 py-2 shrink-0">
      <button
        class="game-menu-trigger w-[37px] h-[37px] mb-[1px] shrink-0 rounded-full border-0 cursor-pointer text-[1rem] flex items-center justify-center transition-all bg-[rgba(124,58,237,.2)] text-berry-lt hover:bg-[rgba(124,58,237,.35)] hover:scale-110 disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:scale-100"
        disabled={$showTimerModal || $hasActiveGame}
        onclick={() => {
          gameMenuOpen = !gameMenuOpen;
          stickerPickerOpen = false;
          emojiPickerOpen = false;
        }}
        aria-label="Open game menu"
      >
        🎮
      </button>

      <button
        class="w-[37px] h-[37px] mb-[1px] shrink-0 rounded-full border-0 cursor-pointer text-[1rem] flex items-center justify-center transition-all bg-[rgba(124,58,237,.2)] text-berry-lt hover:bg-[rgba(124,58,237,.35)] hover:scale-110 disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:scale-100"
        disabled={$showTimerModal || $berries < 2}
        onclick={() => {
          stickerPickerOpen = !stickerPickerOpen;
          gameMenuOpen = false;
          emojiPickerOpen = false;
        }}
        aria-label="Open sticker picker"
      >
        🎨
      </button>

      <button
        class="w-[37px] h-[37px] mb-[1px] shrink-0 rounded-full border-0 cursor-pointer text-[1rem] flex items-center justify-center transition-all bg-[rgba(124,58,237,.2)] text-berry-lt hover:bg-[rgba(124,58,237,.35)] hover:scale-110 disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:scale-100"
        disabled={$showTimerModal}
        onclick={() => {
          emojiPickerOpen = !emojiPickerOpen;
          gameMenuOpen = false;
          stickerPickerOpen = false;
        }}
        aria-label="Open emoji picker"
      >
        😊
      </button>

      <textarea
        class="flex-1 min-h-[37px] max-h-[140px] bg-white/[.07] border border-white/[.09] rounded-2xl px-4 py-[8px] text-cream font-nunito text-[.88rem] leading-5 outline-none placeholder-white/20 focus:border-[rgba(255,107,53,.45)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed resize-none overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        placeholder="Say something sneaky..."
        maxlength="500"
        autocomplete="off"
        rows="1"
        bind:value={inputText}
        disabled={$showTimerModal}
        onkeydown={handleKeydown}
        bind:this={inputEl}
        oninput={() => {
          resizeInput();
          if (isTyping) {
            clearTimeout(typingTimer);
          } else {
            socket.emit('typing', { isTyping: true });
            isTyping = true;
          }
          typingTimer = setTimeout(() => {
            socket.emit('typing', { isTyping: false });
            console.log('emitting typing false');
            isTyping = false;
          }, TYPING_DELAY);
        }}
      ></textarea>
      <button
        class="w-[37px] h-[37px] mb-[1px] text-white disabled:pointer-events-none overflow-hidden select-none pl-1 pb-1 shrink-0 bg-fox rounded-full border-0 cursor-pointer text-[.95rem] flex items-center justify-center transition-all hover:bg-fox-dark hover:scale-110 disabled:opacity-40 disabled:cursor-not-allowed"
        disabled={$showTimerModal || !inputText.trim()}
        onclick={sendMsg}
      >
        <span bind:this={sendButtonIconEl} class=" w-full h-full -rotate-45">
          <Icon icon="wordpress:send" class=" w-full h-full" />
        </span>
      </button>
    </div>
  </div>

  <!-- ── Game menu ── -->
  <GameMenu
    isOpen={gameMenuOpen}
    onSelect={(gameType) => proposeGame(gameType)}
    onClose={() => {
      gameMenuOpen = false;
    }}
    triggerSelector={`.game-menu-trigger`}
  />

  <!-- ── Sticker Picker ── -->
  {#if stickerPickerOpen}
    <div class="absolute bottom-[58px] left-3 z-40">
      <StickerPicker
        disabled={$showTimerModal || $berries < 2}
        onSelect={(stickerId) => sendSticker(stickerId)}
      />
    </div>
  {/if}

  <!-- ── Emoji Picker ── -->
  <EmojiPicker
    isOpen={emojiPickerOpen}
    onEmojiSelect={handleEmojiSelect}
    onClose={() => {
      emojiPickerOpen = false;
    }}
  />

  <!-- ── Game Proposal Modal ── -->
  <GameProposal />

  <!-- ── Minimized Game Display ── -->
  {#if $activeGame && $gameSize === 'minimized'}
    <GameBoard />
  {/if}

  <!-- ── Timer-end modal ── -->
  {#if $showTimerModal && !$timerRemaining}
    <div
      class="absolute inset-0 bg-[rgba(10,18,10,.88)] backdrop-blur-md z-50 flex flex-col items-center justify-center gap-4 px-7 py-7 text-center animate-modalin"
    >
      <div class="w-16 h-16">
        <img src={animatedFox} alt="Fox" class="w-full h-full object-contain animate-bobble" />
      </div>

      <div class="font-fredoka text-[1.5rem] text-cream">Time's up!</div>

      <div
        class="inline-flex items-center gap-1.5 bg-[rgba(124,58,237,.15)] border border-[rgba(167,139,250,.25)] rounded-full px-3.5 py-[5px] font-fredoka text-base text-berry-lt -mt-1"
      >
        +5 🍇 berries earned!
      </div>

      <div class="text-[.85rem] whitespace-pre-line text-leaf-lt leading-relaxed max-w-[260px]">
        {$partnerStatus === 'offline'
          ? 'Other fox is not online :('
          : 'Do you want to keep chatting with this fox? Both of you need to agree.'}
      </div>

      {#if !$myExtendVote}
        <div
          class="inline-flex items-center gap-1.5 bg-[rgba(255,255,255,.05)] border border-white/[.12] rounded-full px-3.5 py-[5px] text-[.75rem] text-muted font-bold"
        >
          Auto-finishing in <span class="font-fredoka text-cream">{modalCountdown}s</span>
        </div>
      {/if}

      {#if $partnerWantsExtend && $partnerStatus !== 'offline'}
        <div
          class="flex items-center justify-center gap-1.5 w-full max-w-[300px] bg-[rgba(22,163,74,.12)] border border-[rgba(22,163,74,.25)] rounded-xl px-3.5 py-[7px] text-[.78rem] text-leaf-lt font-bold animate-popin"
        >
          ✅ Other fox wants to extend!
        </div>
      {/if}

      {#if $myExtendVote && $partnerStatus !== 'offline'}
        <div class="text-[.75rem] text-muted font-semibold">⏳ Waiting for the other fox...</div>
      {/if}

      <div class="flex gap-2.5 w-full max-w-[300px]">
        {#if $partnerStatus !== 'offline'}
          <button
            class="flex-1 py-[11px] px-2 rounded-xl font-fredoka text-[.95rem] text-white border-0 cursor-pointer flex items-center justify-center gap-1.5
                 bg-gradient-to-br from-berry to-[#5B21B6] shadow-[0_3px_14px_rgba(124,58,237,.35)]
                 transition-all hover:-translate-y-0.5 hover:brightness-110 active:scale-[.97]
                 disabled:opacity-35 disabled:cursor-not-allowed"
            disabled={$myExtendVote}
            onclick={handleExtend}
          >
            🍇 Extend +5
          </button>
        {/if}
        <button
          class="flex-1 py-[11px] px-2 rounded-xl font-fredoka text-[.95rem] text-white border-0 cursor-pointer flex items-center justify-center gap-1.5
                 bg-gradient-to-br from-[#16A34A] to-[#15803D] shadow-[0_3px_14px_rgba(22,163,74,.3)]
                 transition-all hover:-translate-y-0.5 hover:brightness-110 active:scale-[.97]
                 disabled:opacity-35 disabled:cursor-not-allowed"
          onclick={handleComplete}
        >
          ✓ Finish +5
        </button>
      </div>
    </div>
  {/if}

  <!-- Report Modal -->
  {#if reportModal}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div class="bg-[rgba(21,40,21,0.95)] border border-white/[.14] rounded-2xl p-6 max-w-sm mx-4">
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
            onclick={closeReportModal}
            disabled={isSubmittingReport}
          >
            Cancel
          </button>
          <button
            class="flex-1 py-2 px-3 bg-red-600 hover:bg-red-700 rounded-lg text-white border-0 cursor-pointer font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onclick={submitReport}
            disabled={!reportReason.trim() || isSubmittingReport}
          >
            {isSubmittingReport ? '⏳ Submitting...' : 'Submit Report'}
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>
