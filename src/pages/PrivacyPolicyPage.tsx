import { useNavigate } from 'react-router-dom';
import { Shield, Lock, Key, ArrowLeft, Eye, Trash2, Database, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PrivacyPolicyPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background cyber-grid">
      {/* Header */}
      <div className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="text-muted-foreground hover:text-foreground gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            <span className="font-semibold text-foreground">Privacy Policy</span>
          </div>
          <span className="text-xs text-muted-foreground ml-auto">Last updated: June 2026</span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 pb-16">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto mb-4 neon-glow">
            <Lock className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2 text-balance">ShadowCrypt Privacy Policy</h1>
          <p className="text-muted-foreground text-sm max-w-xl mx-auto text-pretty">
            ShadowCrypt is built on a zero-knowledge architecture. This policy explains exactly what
            data exists, how it is protected, and what you — and only you — control.
          </p>
        </div>

        <div className="space-y-8">
          {/* Key principles */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { icon: Lock,   title: 'Zero Knowledge',  desc: 'All messages are encrypted on your device before transmission. We never see plaintext.' },
              { icon: Eye,    title: 'No Surveillance', desc: 'We do not track behaviour, sell data, or run analytics on your conversations.' },
              { icon: Trash2, title: 'You Own Your Data', desc: 'Delete your account at any time and all your data is wiped from our servers instantly.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-card border border-border rounded-xl p-4 h-full flex flex-col">
                <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center mb-3 shrink-0">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground text-sm mb-1">{title}</h3>
                <p className="text-muted-foreground text-xs text-pretty flex-1">{desc}</p>
              </div>
            ))}
          </div>

          <Section title="1. Information We Collect" icon={Key}>
            <p>ShadowCrypt collects the absolute minimum required to operate the service:</p>
            <ul>
              <li>
                <strong>Username</strong> — your chosen handle, stored in our database to enable
                contact discovery. It is public-facing within the platform.
              </li>
              <li>
                <strong>Derived auth identity</strong> — a technical identifier derived from your
                username is used solely by our authentication provider (Supabase Auth) to verify
                your identity. It is never used for communication or marketing.
              </li>
              <li>
                <strong>Public encryption key</strong> — your ECDH P-256 public key is stored
                server-side so contacts can initiate encrypted sessions with you. This key is
                mathematically incapable of decrypting any message.
              </li>
              <li>
                <strong>Account creation timestamp</strong> — stored for security auditing only.
              </li>
              <li>
                <strong>Optional bio</strong> — a short profile bio you may choose to add. This is
                stored in your public profile and visible to your contacts.
              </li>
            </ul>
            <p className="mt-3">
              <strong>We do NOT collect:</strong> IP addresses, device fingerprints, message
              content, browsing behaviour, location data, or any other personal information beyond
              the above.
            </p>
          </Section>

          <Section title="2. How Your Messages Are Protected" icon={Lock}>
            <p>
              Every message is end-to-end encrypted using the Signal Protocol Double Ratchet
              algorithm <em>before</em> it leaves your device:
            </p>
            <ul>
              <li>
                <strong>ECDH P-256</strong> is used for key agreement between you and each contact.
              </li>
              <li>
                <strong>HKDF-SHA256</strong> derives a unique encryption key for every single
                message from the ratchet chain state.
              </li>
              <li>
                <strong>AES-256-GCM</strong> encrypts message content with authenticated
                encryption. Neither our servers nor any third party can decrypt it.
              </li>
              <li>
                <strong>Forward secrecy &amp; break-in recovery</strong> — past messages remain
                secure even if your current session keys are compromised, and future messages
                recover security after a breach automatically.
              </li>
            </ul>
            <p className="mt-3">
              Our relay infrastructure acts as a blind delivery service. Encrypted packets are
              forwarded to the intended recipient and <strong>never stored in plaintext</strong>.
              Relay entries are purged immediately after delivery.
            </p>
          </Section>

          <Section title="3. Message & Contact Storage" icon={Database}>
            <p>
              To provide message history persistence and multi-session continuity, ShadowCrypt
              stores your encrypted message records and contact list in our secure database:
            </p>
            <ul>
              <li>
                <strong>Messages</strong> — your copy of each conversation is stored in our
                database under your account. The stored payload is the <em>decrypted</em> text,
                protected at rest by Supabase's row-level security so only your authenticated
                session can access your rows.
              </li>
              <li>
                <strong>Contacts</strong> — your contact list (usernames and public keys) is stored
                server-side, scoped to your account via row-level security.
              </li>
              <li>
                <strong>Cryptographic session state</strong> (ratchet keys, identity key pair) is
                stored exclusively on your device in an encrypted IndexedDB vault. This is never
                transmitted to our servers.
              </li>
              <li>
                <strong>Vault PIN</strong> — your 6-digit PIN is used to derive a PBKDF2 key
                (310,000 iterations, SHA-256) that locks the local vault. The PIN itself is never
                stored anywhere.
              </li>
            </ul>
            <p className="mt-3">
              Deleting your account permanently removes all your messages and contacts from our
              database with no possibility of recovery.
            </p>
          </Section>

          <Section title="3a. Automatic 30-Day Message Deletion" icon={Trash2}>
            <p>
              To protect your privacy and prevent the database from accumulating unbounded personal
              data, <strong>all messages stored on our servers are automatically and permanently
              deleted 30 days after they were sent</strong>. This applies to every user account
              without exception.
            </p>
            <p className="mt-3">Why we do this:</p>
            <ul>
              <li>
                <strong>Privacy by design</strong> — the less historical data we hold, the less
                there is to expose in the unlikely event of a security incident. Limiting retention
                to 30 days minimises the blast radius of any breach.
              </li>
              <li>
                <strong>Data minimisation</strong> — we only keep data for as long as it is
                reasonably needed for the service to function. After 30 days, old messages provide
                no additional service value and retaining them would be contrary to our
                zero-knowledge ethos.
              </li>
              <li>
                <strong>Regulatory alignment</strong> — automatic, time-bound deletion aligns with
                the data minimisation and storage limitation principles found in privacy
                regulations such as GDPR.
              </li>
              <li>
                <strong>Preventing database accumulation</strong> — without automatic deletion,
                message storage would grow indefinitely. Purging old records keeps the service
                lean, fast, and sustainable for all users.
              </li>
            </ul>
            <p className="mt-3">
              The deletion runs automatically every day at 02:00 UTC at the database level. There
              is no manual intervention and no way to recover deleted messages. If you need to
              preserve a conversation, please save it locally before the 30-day window expires.
            </p>
            <p className="mt-3">
              Note: your device's local message cache (stored in the encrypted IndexedDB vault)
              follows the same 30-day rule and is also purged automatically on each app load.
            </p>
          </Section>

          <Section title="4. Data Sharing &amp; Third Parties" icon={Eye}>
            <p>
              We do not sell, rent, share, or monetise your data in any form. The sole exception is:
            </p>
            <ul>
              <li>
                <strong>Legal obligations</strong> — if compelled by a valid court order, we may be
                required to disclose account metadata (username, public key, creation date). We
                cannot provide message content because our architecture does not give us the ability
                to read it.
              </li>
            </ul>
          </Section>

          <Section title="5. Account Deletion" icon={Trash2}>
            <p>
              You may delete your account at any time from the Settings panel inside the app.
              Deletion is immediate and irreversible:
            </p>
            <ul>
              <li>Your profile, public key, and authentication record are permanently erased from our servers.</li>
              <li>All your messages and contacts stored in our database are permanently deleted.</li>
              <li>Your locally stored cryptographic session vault is cleared from your device.</li>
              <li>There is no grace period and no recovery option. This action cannot be undone.</li>
            </ul>
          </Section>

          <Section title="6. Children's Privacy" icon={UserX}>
            <p>
              ShadowCrypt is not intended for users under the age of 13. We do not knowingly
              collect or store data from children. If you have reason to believe a minor has
              registered an account, please report it through the appropriate legal or platform
              reporting channels.
            </p>
          </Section>

          <Section title="7. Changes to This Policy" icon={Shield}>
            <p>
              We may update this Privacy Policy as the platform evolves. When material changes are
              made, a notice will be displayed prominently within the application prior to the
              changes taking effect. Continued use of ShadowCrypt following such notice constitutes
              your acceptance of the revised policy.
            </p>
          </Section>

          <Section title="8. Contact Us" icon={Shield}>
            <p>
              If you have any questions, concerns, or requests regarding this Privacy Policy or your
              data, you can reach the ShadowCrypt team at:
            </p>
            <p className="mt-3">
              <strong>Email:</strong>{' '}
              <a
                href="mailto:admin.forestritium@gmail.com"
                className="text-primary hover:underline"
              >
                admin.forestritium@gmail.com
              </a>
            </p>
            <p className="mt-2 text-xs">
              We aim to respond within 72 hours on business days.
            </p>
          </Section>
        </div>

        <div className="mt-10 text-center">
          <Button
            onClick={() => navigate(-1)}
            className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Return to ShadowCrypt
          </Button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 md:p-6">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
          <Icon className="w-3.5 h-3.5 text-primary" />
        </div>
        <h2 className="font-semibold text-foreground text-base text-balance">{title}</h2>
      </div>
      <div className="text-sm text-muted-foreground space-y-2 leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_strong]:text-foreground [&_em]:text-foreground/80 [&_code]:font-mono [&_code]:text-primary/80 [&_code]:text-xs">
        {children}
      </div>
    </div>
  );
}
