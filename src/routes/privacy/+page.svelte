<script lang="ts">
  import LegalPageLayout from "$components/LegalPageLayout.svelte";
</script>

<LegalPageLayout
  title="Privacy Policy"
  lastUpdated="January 1, 2025"
  pagetype="Legal"
>
  <section class="legal-highlight legal-highlight-leaf">
    <div class="legal-highlight-icon">🛡️</div>
    <p class="legal-highlight-text">
      <strong class="text-cream">The short version:</strong> SneakyChat is built
      around privacy. We do not store your messages, we do not create user accounts,
      and we do not sell or share your personal data. Your conversations exist only
      in the moment they happen.
    </p>
  </section>

  <section class="legal-section">
    <h2 class="legal-section-title">
      <span class="legal-sec-num">1</span>
      Who we are
    </h2>
    <p class="legal-p mb-2">
      SneakyChat ("we", "us", "our") operates the anonymous chat platform
      available at this website. We are the data controller for the limited
      information processed in connection with your use of SneakyChat.
    </p>
    <p class="legal-p">
      If you have questions about this policy, you can reach us via the contact
      information at the bottom of this page.
    </p>
  </section>

  <section class="legal-section">
    <h2 class="legal-section-title">
      <span class="legal-sec-num">2</span>
      What information we collect
    </h2>
    <p class="legal-p mb-3">
      SneakyChat is designed to minimise data collection. Here is a complete
      picture of what is and is not collected:
    </p>

    <div class="overflow-x-auto rounded-card border border-white/[.07]">
      <table class="w-full border-collapse text-left">
        <thead>
          <tr class="bg-[rgba(124,58,237,.06)]">
            <th
              class="border-b border-white/[.08] px-3 py-2 text-[0.78rem] uppercase tracking-[0.05em] text-[var(--berry-lt)]"
              >Data</th
            >
            <th
              class="border-b border-white/[.08] px-3 py-2 text-[0.78rem] uppercase tracking-[0.05em] text-[var(--berry-lt)]"
              >Collected?</th
            >
            <th
              class="border-b border-white/[.08] px-3 py-2 text-[0.78rem] uppercase tracking-[0.05em] text-[var(--berry-lt)]"
              >Where it lives</th
            >
          </tr>
        </thead>
        <tbody>
          <tr>
            <td
              class="border-b border-white/[.04] px-3 py-2 text-[0.84rem] font-semibold text-cream"
              >Chat messages</td
            >
            <td
              class="border-b border-white/[.04] px-3 py-2 text-[0.84rem] text-muted"
              >Not stored</td
            >
            <td
              class="border-b border-white/[.04] px-3 py-2 text-[0.84rem] text-muted"
            >
              Relayed in real-time between users only. Never written to disk.
            </td>
          </tr>
          <tr>
            <td
              class="border-b border-white/[.04] px-3 py-2 text-[0.84rem] font-semibold text-cream"
              >User identity</td
            >
            <td
              class="border-b border-white/[.04] px-3 py-2 text-[0.84rem] text-muted"
              >Not collected</td
            >
            <td
              class="border-b border-white/[.04] px-3 py-2 text-[0.84rem] text-muted"
            >
              No name, email, or account is created. You are a fox, nothing
              more.
            </td>
          </tr>
          <tr>
            <td
              class="border-b border-white/[.04] px-3 py-2 text-[0.84rem] font-semibold text-cream"
              >Berry count &amp; session state</td
            >
            <td
              class="border-b border-white/[.04] px-3 py-2 text-[0.84rem] text-muted"
              >Stored in a signed JWT only</td
            >
            <td
              class="border-b border-white/[.04] px-3 py-2 text-[0.84rem] text-muted"
            >
              Held in your browser's localStorage. The server signs the token
              but stores nothing.
            </td>
          </tr>
          <tr>
            <td
              class="border-b border-white/[.04] px-3 py-2 text-[0.84rem] font-semibold text-cream"
              >IP address</td
            >
            <td
              class="border-b border-white/[.04] px-3 py-2 text-[0.84rem] text-muted"
              >Transiently visible</td
            >
            <td
              class="border-b border-white/[.04] px-3 py-2 text-[0.84rem] text-muted"
            >
              Your IP is visible to our server during a connection (as with all
              websites) but is not logged or stored.
            </td>
          </tr>
          <tr>
            <td class="px-3 py-2 text-[0.84rem] font-semibold text-cream"
              >Cookies</td
            >
            <td class="px-3 py-2 text-[0.84rem] text-muted">Not used</td>
            <td class="px-3 py-2 text-[0.84rem] text-muted">
              SneakyChat does not set any cookies.
            </td>
          </tr>
          <tr>
            <td class="px-3 py-2 text-[0.84rem] font-semibold text-cream"
              >Analytics data</td
            >
            <td class="px-3 py-2 text-[0.84rem] text-muted">Collected</td>
            <td class="px-3 py-2 text-[0.84rem] text-muted">
              Managed by Google. See details in section 5.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <section class="legal-section">
    <h2 class="legal-section-title">
      <span class="legal-sec-num">3</span>
      How JWT tokens work
    </h2>
    <p class="legal-p mb-2">
      When you first visit SneakyChat, a JSON Web Token (JWT) is issued and
      stored in your browser's
      <code>localStorage</code>. This token contains:
    </p>
    <ul class="legal-list mb-2">
      <li class="legal-list-item">Your current berry count (an integer)</li>
      <li class="legal-list-item">A timestamp of your last match</li>
      <li class="legal-list-item">An ID for any active chat session</li>
      <li class="legal-list-item">The time the token was issued</li>
    </ul>
    <p class="legal-p">
      The token is cryptographically signed by the server to prevent tampering.
      It contains no personally identifiable information - no name, no email, no
      device fingerprint. If you clear your browser's localStorage, the token is
      gone and a fresh one is issued on your next visit.
    </p>
  </section>

  <section class="legal-section">
    <h2 class="legal-section-title">
      <span class="legal-sec-num">4</span>
      How we use information
    </h2>
    <p class="legal-p mb-2">
      The limited session data we process is used exclusively to:
    </p>
    <ul class="legal-list">
      <li class="legal-list-item">
        Manage your berry balance and enforce cooldown periods
      </li>
      <li class="legal-list-item">
        Facilitate real-time matchmaking between connected users
      </li>
      <li class="legal-list-item">
        Relay messages between matched users during an active chat
      </li>
      <li class="legal-list-item">
        Detect and prevent abuse (e.g. excessive skipping)
      </li>
      <li class="legal-list-item">
        Understand website performance and user behavior through Google
        Analytics
      </li>
    </ul>
    <p class="legal-p mt-2">
      We do not use any data for advertising, profiling, or sale to third
      parties.
    </p>
  </section>

  <section class="legal-section">
    <h2 class="legal-section-title">
      <span class="legal-sec-num">5</span>
      Data sharing and third parties
    </h2>
    <p class="legal-p mb-2">
      We do not sell, rent, or share your personal data with third parties.
      SneakyChat does not use advertising networks or tracking pixels.
    </p>
    <p class="legal-p mb-2">
      <strong>Google Analytics:</strong> We use Google Analytics to understand
      website performance, user behavior, and traffic patterns. Google Analytics
      collects data such as your browser type, device type, pages visited on
      this website, and time spent on the site without identifying you
      personally. This data is subject to
      <a
        href="https://policies.google.com/privacy"
        target="_blank"
        class="text-[var(--leaf-lt)] underline hover:text-fox"
        >Google's Privacy Policy</a
      >. You can opt out of Google Analytics tracking by installing the
      <a
        href="https://tools.google.com/dlpage/gaoptout"
        target="_blank"
        class="text-[var(--leaf-lt)] underline hover:text-fox"
        >Google Analytics Opt-out Browser Add-on</a
      >.
    </p>
    <p class="legal-p mb-2">
      Your messages are relayed in real time to the person you are matched with.
      They are not stored or accessible to us after the chat ends.
    </p>
    <p class="legal-p">
      We may disclose information if required to do so by law or in response to
      valid legal process, though given that we store virtually nothing, there
      is little to disclose.
    </p>
  </section>

  <section class="legal-section">
    <h2 class="legal-section-title">
      <span class="legal-sec-num">6</span>
      Data retention
    </h2>
    <p class="legal-p mb-2">
      Chat messages are never persisted - they exist only in server memory for
      the duration of the active connection and are gone the moment the chat
      ends or a user disconnects.
    </p>
    <p class="legal-p mb-2">
      Session state (berry count, chat ID) exists in your browser's localStorage
      until you clear it. The server holds socket state in memory only for the
      duration of your active connection.
    </p>
    <p class="legal-p">
      Server access logs (if any, depending on hosting provider) may retain IP
      addresses for up to 30 days as a standard operational measure. We do not
      control or extend this retention.
    </p>
  </section>

  <section class="legal-section">
    <h2 class="legal-section-title">
      <span class="legal-sec-num">7</span>
      Children's privacy
    </h2>
    <div class="legal-warn-box">
      <p class="legal-warn-text">
        SneakyChat is not intended for users under the age of 13. We do not
        knowingly collect any information from children. If you believe a child
        under 13 is using the platform, please contact us.
      </p>
    </div>
    <p class="legal-p">
      Users between 13 and 18 should use SneakyChat only with the knowledge of a
      parent or guardian, and should never share personal information in chats.
    </p>
  </section>

  <section class="legal-section">
    <h2 class="legal-section-title">
      <span class="legal-sec-num">8</span>
      Your rights
    </h2>
    <p class="legal-p mb-2">
      Because we do not collect personal data tied to any identity, many
      traditional data rights (access, correction, deletion requests) are not
      applicable in the usual sense. However:
    </p>
    <ul class="legal-list">
      <li class="legal-list-item">
        You can delete your session data at any time by clearing your browser's
        localStorage
      </li>
      <li class="legal-list-item">
        You can stop using SneakyChat at any time - no account to delete
      </li>
      <li class="legal-list-item">
        If you are in the EU/EEA, you have rights under the GDPR. Since we hold
        no personal data about you, these rights are largely satisfied by design
      </li>
    </ul>
  </section>

  <section class="legal-section">
    <h2 class="legal-section-title">
      <span class="legal-sec-num">9</span>
      Security
    </h2>
    <p class="legal-p mb-2">
      All connections to SneakyChat are made over HTTPS and encrypted WebSocket
      (WSS) connections. JWT tokens are cryptographically signed to prevent
      tampering. We do not store passwords or any sensitive personal data.
    </p>
    <p class="legal-p">
      No system is perfectly secure. We encourage you to treat any public chat
      service with appropriate caution and never share information you wouldn't
      want a stranger to know.
    </p>
  </section>

  <section class="legal-section">
    <h2 class="legal-section-title">
      <span class="legal-sec-num">10</span>
      Changes to this policy
    </h2>
    <p class="legal-p">
      We may update this Privacy Policy from time to time. If we make material
      changes, we will update the "Last updated" date at the top of this page.
      Continued use of SneakyChat after changes constitutes acceptance of the
      updated policy.
    </p>
  </section>

  <section class="legal-card">
    <h3 class="mb-2 font-fredoka text-base text-cream">📬 Contact us</h3>
    <p class="text-[0.85rem] leading-7 text-muted">
      Questions about this Privacy Policy? Reach out at
      <a
        href="mailto:t3lap0ka+privacy@gmail.com"
        class="text-[var(--leaf-lt)] hover:text-fox">t3lap0ka@gmail.com</a
      >. We aim to respond within 5 business days.
    </p>
  </section>
</LegalPageLayout>
