<script lang="ts">
  import './legal.css';
  import Fireflies from './Fireflies.svelte';
  import foxIcon from '../assets/icon/fox.png';

  export let title: string;
  export let pagetype: string = '';
  export let lastUpdated: string = 'April 8, 2026';
  export let pageId: 'about' | 'privacy' | 'terms'; // e.g. "privacy", "terms"

  const links = [
    { href: '/', label: 'Home' },
    { href: '/about', label: 'About Us' },
    { href: '/privacy', label: 'Privacy Policy' },
    { href: '/terms', label: 'Terms & Conditions' },
  ];

  const path = typeof window !== 'undefined' ? window.location.pathname : '/';
</script>

<Fireflies count={14} />
<nav class="top-nav">
  <div
    class="max-w-[860px] justify-between items-center flex w-full border-b border-white/[.08] pb-4 px-4"
  >
    <a class="nav-logo whitespace-nowrap flex items-center gap-1.5" href="/">
      <img src={foxIcon} alt="Fox" class="w-5 h-5 object-contain" />
      SneakyChat
    </a>
    <div class="nav-links">
      <a href="/about" class={pageId === 'about' ? 'active' : ''}>About</a>
      <a href="/privacy" class={pageId === 'privacy' ? 'active' : ''}>Privacy</a>
      <a href="/terms" class={pageId === 'terms' ? 'active' : ''}>Terms</a>
    </div>
  </div>
</nav>

<div class="legal-shell">
  <div class="legal-panel">
    <header class="legal-header">
      <p class="text-[.72rem] uppercase tracking-[0.18em] text-berry font-bold">
        {pagetype}
      </p>
      <h1 class="font-fredoka text-[1.7rem] sm:text-[2rem] text-cream">
        {title}
      </h1>
      <p class="legal-updated">
        Effective date: {lastUpdated} · Last updated: {lastUpdated}
      </p>

      <!-- {#if subtitle}
                <p
                    class="text-[.9rem] text-[rgba(255,248,240,.82)] mt-2 max-w-[60ch] leading-relaxed"
                >
                    {subtitle}
                </p>
            {/if} -->

      <nav class="mt-4 flex flex-wrap gap-2">
        {#each links as link}
          <a
            href={link.href}
            class="legal-nav-link {path === link.href
              ? 'legal-nav-link-active'
              : 'legal-nav-link-inactive'}"
          >
            {link.label}
          </a>
        {/each}
      </nav>
    </header>

    <article class="legal-content">
      <slot />
      <footer class="legal-footer">
        <div class="legal-footer-links">
          <a href="/about" class="legal-footer-link">About</a>
          <a href="/privacy" class="legal-footer-link">Privacy Policy</a>
          <a href="/terms" class="legal-footer-link">Terms &amp; Conditions</a>
          <a href="/" class="legal-footer-link">Back to Chat</a>
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
    </article>
  </div>
</div>
