<script lang="ts">
  import LegalPageLayout from '$components/LegalPageLayout.svelte';
  import animatedFox from '../../assets/icon/animated-fox.webp';
</script>

<LegalPageLayout title="About" pageId="about" lastUpdated="April 10, 2026" pagetype="Doc">
  <section class="legal-card mb-8 p-6 text-center sm:p-8">
    <div class="mb-4 flex justify-center">
      <img
        src={animatedFox}
        alt="Fox"
        class="w-24 h-24 drop-shadow-[0_4px_16px_rgba(255,107,53,.3)] animate-bobble"
      />
    </div>
    <h1 class="font-fredoka text-[1.8rem] sm:text-[2.5rem] text-fox drop-shadow-[0_4px_16px_rgba(255,107,53,.3)] mb-8">SneakyChat</h1>
    <p class="mx-auto max-w-[58ch] text-[0.95rem] leading-7 text-[var(--leaf-lt)]">
      A place where Sneaky Foxes roam the forest, meet strangers, and share moments - anonymously,
      honestly, freely.
    </p>
  </section>

  <section class="legal-section">
    <p class="legal-eyebrow">What we are</p>
    <h2 class="legal-title">Random. Anonymous. Real.</h2>
    <p class="legal-p mb-2">
      SneakyChat is an anonymous random chat platform that pairs two strangers for a short,
      time-limited conversation. No accounts, no usernames, no history - just two foxes sharing a
      moment in the forest.
    </p>
    <p class="legal-p">
      We built SneakyChat because we believe the best conversations sometimes happen between
      strangers. When there's nothing to prove and no one to impress, people talk differently - more
      honestly, more curiously, more freely.
    </p>
  </section>

  <section class="legal-feature-grid">
    <article class="legal-feature-card">
      <span class="mb-2 block text-3xl">🎭</span>
      <h3 class="mb-1 font-fredoka text-base text-cream">Fully anonymous</h3>
      <p class="text-[0.82rem] leading-6 text-muted">
        No sign-up, no profile, no identity. Your fox is whoever you choose to be in that moment.
      </p>
    </article>
    <article class="legal-feature-card">
      <span class="mb-2 block text-3xl">⏰</span>
      <h3 class="mb-1 font-fredoka text-base text-cream">Time-limited chats</h3>
      <p class="text-[0.82rem] leading-6 text-muted">
        Chats are 2 minutes by default. If both foxes want more, you extend together - or part ways.
      </p>
    </article>
    <article class="legal-feature-card">
      <span class="mb-2 block text-3xl">🍇</span>
      <h3 class="mb-1 font-fredoka text-base text-cream">Berry economy</h3>
      <p class="text-[0.82rem] leading-6 text-muted">
        Berries keep things fair. Finishing chats earns berries; skipping costs them. Good foxes
        thrive.
      </p>
    </article>
    <article class="legal-feature-card">
      <span class="mb-2 block text-3xl">🌿</span>
      <h3 class="mb-1 font-fredoka text-base text-cream">Zero data stored</h3>
      <p class="text-[0.82rem] leading-6 text-muted">
        We don't store messages or user data server-side. Your conversations live and die in the
        moment.
      </p>
    </article>
  </section>

  <section class="legal-highlight legal-highlight-berry">
    <div class="text-3xl">🍇</div>
    <div>
      <h3 class="mb-1 font-fredoka text-[1.05rem] text-[var(--berry-lt)]">The Berry System</h3>
      <p class="text-[0.85rem] leading-7 text-muted">
        We like to call it the Chapri Protection. Berries are your fox's energy. You start with 55
        and earn more by having good chats - finishing a full conversation rewards you with berries,
        and mutually extending a chat gives both foxes a bonus. Skipping mid-chat costs 1 berry. Low
        on berries? Your fox needs to rest before finding new foxes. The system is designed to
        reward genuine connection over rapid skipping.
      </p>
    </div>
  </section>

  <section class="legal-section">
    <p class="legal-eyebrow">Our values</p>
    <h2 class="legal-title">What we stand for</h2>
    <ul class="space-y-2">
      <li class="legal-value-item">
        <span class="text-xl">🛡️</span>
        <div>
          <p class="text-[0.88rem] font-bold text-cream">Privacy first</p>
          <p class="text-[0.82rem] leading-6 text-muted">
            No accounts, no tracking, no message logs. Your identity and conversations remain yours.
          </p>
        </div>
      </li>
      <li class="legal-value-item">
        <span class="text-xl">🤝</span>
        <div>
          <p class="text-[0.88rem] font-bold text-cream">Respectful community</p>
          <p class="text-[0.82rem] leading-6 text-muted">
            We expect every fox to treat others with basic dignity. Harassment is not tolerated.
          </p>
        </div>
      </li>
      <li class="legal-value-item">
        <span class="text-xl">⚖️</span>
        <div>
          <p class="text-[0.88rem] font-bold text-cream">Fair by design</p>
          <p class="text-[0.82rem] leading-6 text-muted">
            The berry system discourages abuse and rewards users who engage meaningfully.
          </p>
        </div>
      </li>
      <li class="legal-value-item">
        <span class="text-xl">🪶</span>
        <div>
          <p class="text-[0.88rem] font-bold text-cream">Lightweight &amp; accessible</p>
          <p class="text-[0.82rem] leading-6 text-muted">
            Built to load fast on any device, anywhere. No bloated frameworks, no heavy installs.
          </p>
        </div>
      </li>
    </ul>
  </section>

  <section class="mb-4">
    <p class="legal-eyebrow">Our story</p>
    <h2 class="legal-title">Why a sneaky fox?</h2>
    <p class="legal-p mb-2">
      The fox is a universal symbol of wit, curiosity, and a bit of mischief - the perfect spirit
      animal for an anonymous stranger-chat app. Foxes are clever, adaptable, and surprisingly
      social. They find each other in unexpected places.
    </p>
    <p class="legal-p mb-2">
      We wanted a mascot that felt warm but a little mysterious. A fox that sneaks through the
      digital forest, taps a stranger on the shoulder, and says: "Hey - want to talk?"
    </p>
    <p class="legal-p">
      That's SneakyChat. No agenda, no performance. Just two foxes, a limited clock, and whatever
      happens next.
    </p>
  </section>
</LegalPageLayout>
