'use client';

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-dark-900 text-white">
      <div className="max-w-4xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-bold mb-2">Terms of Service</h1>
        <p className="text-zinc-400 mb-8">Last updated: January 2026</p>

        <div className="space-y-8 text-zinc-300">
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">1. Acceptance of Terms</h2>
            <p>
              By accessing or using BotMarket (&quot;the Platform&quot;), you agree to be bound by these Terms of Service. 
              If you do not agree to these terms, do not use the Platform.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">2. Eligibility</h2>
            <p className="mb-4">To use BotMarket, you must:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Be at least 18 years of age</li>
              <li>Have the legal capacity to enter into binding agreements</li>
              <li>Not be located in a jurisdiction where prediction market trading is prohibited</li>
              <li>Comply with all applicable local, state, and federal laws</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">3. Risk Disclosure</h2>
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-4">
              <p className="text-red-400 font-semibold">⚠️ IMPORTANT RISK WARNING</p>
            </div>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Trading involves substantial risk of loss.</strong> You can lose some or all of your invested capital.
              </li>
              <li>
                <strong>Past performance is not indicative of future results.</strong> Bot performance history does not guarantee future profits.
              </li>
              <li>
                <strong>Automated trading carries unique risks.</strong> Technical failures, network issues, or market conditions can result in unexpected losses.
              </li>
              <li>
                <strong>You are solely responsible for your trading decisions.</strong> BotMarket does not provide financial advice.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">4. Platform Services</h2>
            <p className="mb-4">BotMarket provides:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Tools to create and configure automated trading bots</li>
              <li>Integration with Polymarket prediction markets</li>
              <li>A marketplace to discover and fork trading strategies</li>
              <li>Wallet management and fund allocation services</li>
            </ul>
            <p className="mt-4 text-zinc-400">
              We do not guarantee the availability, accuracy, or reliability of our services. The Platform is provided &quot;as is&quot; without warranties of any kind.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">5. User Responsibilities</h2>
            <p className="mb-4">You agree to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Safeguard your wallet credentials and private keys</li>
              <li>Not share your account access with others</li>
              <li>Not use the Platform for any illegal or unauthorized purpose</li>
              <li>Not attempt to exploit, hack, or disrupt the Platform</li>
              <li>Report any security vulnerabilities responsibly</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">6. Fees</h2>
            <p>
              BotMarket may charge fees for certain services, including but not limited to performance fees on profitable trades. 
              All applicable fees will be clearly disclosed before you confirm any transaction.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">7. Intellectual Property</h2>
            <p>
              All content, features, and functionality of the Platform are owned by BotMarket and are protected by 
              copyright, trademark, and other intellectual property laws. You may not copy, modify, distribute, or 
              reverse engineer any part of the Platform without prior written consent.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">8. Limitation of Liability</h2>
            <p className="mb-4">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, BOTMARKET SHALL NOT BE LIABLE FOR:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Any trading losses, regardless of cause</li>
              <li>Loss of profits, data, or business opportunities</li>
              <li>Damages arising from unauthorized access to your account</li>
              <li>Service interruptions or technical failures</li>
              <li>Actions of third-party services (Polymarket, blockchain networks, etc.)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">9. Indemnification</h2>
            <p>
              You agree to indemnify and hold harmless BotMarket, its affiliates, and their respective officers, 
              directors, employees, and agents from any claims, damages, losses, or expenses arising from your 
              use of the Platform or violation of these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">10. Termination</h2>
            <p>
              We may terminate or suspend your access to the Platform at any time, without prior notice, for 
              any reason, including violation of these Terms. Upon termination, you remain responsible for 
              withdrawing any funds from your bots.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">11. Governing Law</h2>
            <p>
              These Terms shall be governed by and construed in accordance with applicable laws, without regard 
              to conflict of law principles. Any disputes shall be resolved through binding arbitration.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">12. Changes to Terms</h2>
            <p>
              We reserve the right to modify these Terms at any time. Changes will be effective immediately upon 
              posting. Your continued use of the Platform constitutes acceptance of the modified Terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">13. Contact</h2>
            <p>
              For questions about these Terms of Service, please contact us at{' '}
              <a href="mailto:legal@botmarket.io" className="text-accent hover:underline">
                legal@botmarket.io
              </a>
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-white/10">
          <p className="text-zinc-500 text-sm">
            By using BotMarket, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
          </p>
        </div>
      </div>
    </div>
  );
}
