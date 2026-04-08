export type PageMetadata = {
  title: string;
  description: string;
  ogTitle: string;
  ogDescription: string;
  ogUrl: string;
  canonicalUrl: string;
  twitterTitle: string;
  twitterDescription: string;
  keywords?: string;
};

export const pageMetadata: Record<string, PageMetadata> = {
  home: {
    title: "SneakyChat 🦊 - Chat with Strangers Anonymously",
    description:
      "SneakyChat - Anonymous random chat with strangers. No accounts, no history, just genuine conversations. Join the forest of foxes today!",
    ogTitle: "SneakyChat 🦊 - Anonymous Chat with Strangers",
    ogDescription:
      "Meet and chat anonymously with strangers in real-time. No accounts needed, just genuine conversations limited to 2 minutes.",
    ogUrl: "https://sneakychat.app/",
    canonicalUrl: "https://sneakychat.app/",
    twitterTitle: "SneakyChat 🦊 - Chat Anonymously",
    twitterDescription:
      "Anonymous random chat with strangers. No accounts, no history, just genuine conversations.",
    keywords:
      "anonymous chat, random chat, stranger chat, anonymous messaging, chat with strangers",
  },
  about: {
    title: "About SneakyChat - Anonymous Chat Platform",
    description:
      "Learn about SneakyChat, an anonymous random chat platform where strangers meet for genuine conversations without accounts or history.",
    ogTitle: "About SneakyChat - Anonymous Chat",
    ogDescription:
      "Discover how SneakyChat enables anonymous, genuine conversations between strangers in a safe, private environment.",
    ogUrl: "https://sneakychat.app/about",
    canonicalUrl: "https://sneakychat.app/about",
    twitterTitle: "About SneakyChat",
    twitterDescription:
      "Learn about SneakyChat's mission to enable genuine anonymous conversations.",
    keywords: "about sneakychat, anonymous chat platform, random chat app",
  },
  privacy: {
    title: "Privacy Policy - SneakyChat",
    description:
      "Read SneakyChat's privacy policy. We explain how we protect your anonymity and handle data on our platform.",
    ogTitle: "Privacy Policy - SneakyChat",
    ogDescription:
      "Understand how SneakyChat protects your privacy and keeps your conversations anonymous.",
    ogUrl: "https://sneakychat.app/privacy",
    canonicalUrl: "https://sneakychat.app/privacy",
    twitterTitle: "Privacy Policy - SneakyChat",
    twitterDescription:
      "Learn how SneakyChat protects your privacy and data.",
    keywords: "privacy policy, data privacy, anonymous chat security",
  },
  terms: {
    title: "Terms & Conditions - SneakyChat",
    description:
      "Review SneakyChat's terms and conditions. Understand the rules and guidelines for using our anonymous chat platform.",
    ogTitle: "Terms & Conditions - SneakyChat",
    ogDescription:
      "Read SneakyChat's terms of service and community guidelines.",
    ogUrl: "https://sneakychat.app/terms",
    canonicalUrl: "https://sneakychat.app/terms",
    twitterTitle: "Terms & Conditions - SneakyChat",
    twitterDescription:
      "Review SneakyChat's terms and conditions for using our platform.",
    keywords: "terms of service, terms and conditions, community guidelines",
  },
};

export function updateMetadata(metadata: PageMetadata): void {
  if (typeof document === "undefined") return;

  // Update title
  document.title = metadata.title;

  // Update meta tags
  updateMetaTag("description", metadata.description);
  updateMetaTag("keywords", metadata.keywords || "");
  updateMetaTag("og:title", metadata.ogTitle, "property");
  updateMetaTag("og:description", metadata.ogDescription, "property");
  updateMetaTag("og:url", metadata.ogUrl, "property");
  updateMetaTag("twitter:title", metadata.twitterTitle);
  updateMetaTag("twitter:description", metadata.twitterDescription);

  // Update canonical URL
  updateCanonicalURL(metadata.canonicalUrl);
}

function updateMetaTag(
  name: string,
  content: string,
  attribute: "name" | "property" = "name"
): void {
  if (!content) return;

  let tag = document.querySelector<HTMLMetaElement>(`meta[${attribute}="${name}"]`);

  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attribute, name);
    document.head.appendChild(tag);
  }

  tag.content = content;
}

function updateCanonicalURL(url: string): void {
  let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');

  if (!canonical) {
    canonical = document.createElement("link");
    canonical.rel = "canonical";
    document.head.appendChild(canonical);
  }

  canonical.href = url;
}
