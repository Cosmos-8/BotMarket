'use client';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-dark-900 text-white">
      <div className="max-w-4xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-zinc-400 mb-8">Last updated: January 2026</p>

        <div className="space-y-8 text-zinc-300">
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">1. Introduction</h2>
            <p>
              BotMarket (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to protecting your privacy. 
              This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you 
              use our platform.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">2. Information We Collect</h2>
            
            <h3 className="text-xl font-medium text-white mt-6 mb-3">2.1 Wallet Information</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>Public wallet addresses you connect to the Platform</li>
              <li>Transaction history associated with your wallet</li>
              <li>Signatures used to verify wallet ownership</li>
            </ul>

            <h3 className="text-xl font-medium text-white mt-6 mb-3">2.2 Bot & Trading Data</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>Bot configurations and trading strategies you create</li>
              <li>Trading signals, orders, and transaction history</li>
              <li>Performance metrics and analytics</li>
            </ul>

            <h3 className="text-xl font-medium text-white mt-6 mb-3">2.3 Technical Information</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>IP address and approximate location</li>
              <li>Browser type and version</li>
              <li>Device information</li>
              <li>Usage patterns and interaction data</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">3. How We Use Your Information</h2>
            <p className="mb-4">We use collected information to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Provide and maintain the Platform</li>
              <li>Process your trading signals and execute orders</li>
              <li>Calculate and display bot performance metrics</li>
              <li>Detect and prevent fraud or abuse</li>
              <li>Improve our services and user experience</li>
              <li>Communicate important updates or changes</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">4. Information Sharing</h2>
            <p className="mb-4">We may share your information with:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Third-party services:</strong> Polymarket, blockchain networks, and other integrated services 
                necessary for Platform operation
              </li>
              <li>
                <strong>Public blockchain:</strong> Transaction data is recorded on public blockchains and is 
                inherently visible to anyone
              </li>
              <li>
                <strong>Legal authorities:</strong> When required by law or to protect our legal rights
              </li>
            </ul>
            <p className="mt-4 text-zinc-400">
              We do NOT sell your personal information to third parties for marketing purposes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">5. Data Security</h2>
            <p className="mb-4">We implement security measures including:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Encryption of sensitive data (private keys, API secrets)</li>
              <li>Secure HTTPS connections</li>
              <li>Rate limiting and abuse prevention</li>
              <li>Regular security audits</li>
            </ul>
            <p className="mt-4 text-zinc-400">
              However, no system is 100% secure. You are responsible for maintaining the security of your 
              wallet credentials and private keys.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">6. Data Retention</h2>
            <p>
              We retain your data for as long as necessary to provide our services and comply with legal obligations. 
              Bot configurations and trading history are retained indefinitely unless you request deletion. 
              Blockchain transactions are permanent and cannot be deleted.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">7. Your Rights</h2>
            <p className="mb-4">Depending on your jurisdiction, you may have the right to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data (subject to legal retention requirements)</li>
              <li>Object to certain processing of your data</li>
              <li>Export your data in a portable format</li>
            </ul>
            <p className="mt-4">
              To exercise these rights, contact us at{' '}
              <a href="mailto:privacy@botmarket.io" className="text-accent hover:underline">
                privacy@botmarket.io
              </a>
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">8. Cookies & Tracking</h2>
            <p>
              We use essential cookies to maintain your session and preferences. We may use analytics tools 
              to understand how users interact with the Platform. You can control cookie settings through 
              your browser preferences.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">9. Children&apos;s Privacy</h2>
            <p>
              BotMarket is not intended for users under 18 years of age. We do not knowingly collect 
              information from children. If you believe a child has provided us with personal information, 
              please contact us immediately.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">10. International Users</h2>
            <p>
              If you access the Platform from outside the jurisdiction where our servers are located, 
              your information may be transferred across borders. By using the Platform, you consent to 
              such transfers.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">11. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. Changes will be posted on this page 
              with an updated revision date. Continued use of the Platform after changes constitutes 
              acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">12. Contact Us</h2>
            <p>
              For questions or concerns about this Privacy Policy, please contact:{' '}
              <a href="mailto:privacy@botmarket.io" className="text-accent hover:underline">
                privacy@botmarket.io
              </a>
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-white/10">
          <p className="text-zinc-500 text-sm">
            By using BotMarket, you acknowledge that you have read and understood this Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}
