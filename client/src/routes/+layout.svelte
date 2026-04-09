<script lang="ts">
  import { page } from "$app/stores";
  import { onMount } from "svelte";
  import type { PageData } from "$lib/pageMetadata";
  import "../app.css";

  let metadata: PageData | null = null;

  $: if ($page.data) {
    metadata = $page.data as PageData;
  }

  onMount(() => {
    // Register service worker for PWA support
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/service-worker.js").catch((err) => {
        console.error("Service Worker registration failed:", err);
      });
    }

    // Update meta tags dynamically for client-side navigation
    if (!metadata) return;

    document.title = metadata.title;

    updateMetaTag("description", metadata.description);
    updateMetaTag("keywords", metadata.keywords || "");
    updateMetaTag("og:title", metadata.ogTitle, "property");
    updateMetaTag("og:description", metadata.ogDescription, "property");
    updateMetaTag("og:url", metadata.ogUrl, "property");
    updateMetaTag("twitter:title", metadata.twitterTitle);
    updateMetaTag("twitter:description", metadata.twitterDescription);

    // Update canonical URL
    let canonical = document.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    );
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = metadata.canonicalUrl;
  });

  function updateMetaTag(
    name: string,
    content: string,
    attribute: "name" | "property" = "name",
  ): void {
    if (!content) return;

    let tag = document.querySelector<HTMLMetaElement>(
      `meta[${attribute}="${name}"]`,
    );
    if (!tag) {
      tag = document.createElement("meta");
      tag.setAttribute(attribute, name);
      document.head.appendChild(tag);
    }
    tag.content = content;
  }
</script>

<svelte:head>
  {#if metadata}
    <title>{metadata.title}</title>
    <meta name="description" content={metadata.description} />
    {#if metadata.keywords}
      <meta name="keywords" content={metadata.keywords} />
    {/if}
    <meta property="og:type" content="website" />
    <meta property="og:title" content={metadata.ogTitle} />
    <meta property="og:description" content={metadata.ogDescription} />
    <meta property="og:url" content={metadata.ogUrl} />
    <meta property="og:site_name" content="SneakyChat" />
    <meta property="og:image" content="https://sneakychat.app/og-image.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content={metadata.twitterTitle} />
    <meta name="twitter:description" content={metadata.twitterDescription} />
    <meta
      name="twitter:image"
      content="https://sneakychat.app/twitter-image.png"
    />
    <link rel="canonical" href={metadata.canonicalUrl} />
  {/if}
</svelte:head>

<slot />
