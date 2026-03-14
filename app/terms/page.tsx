import type { Metadata } from 'next';
import Link from 'next/link';
import Footer from '../components/Footer';

export const metadata: Metadata = {
  title: 'Terms of Service — Side Scout',
  description: 'Terms of service for Side Scout, an NBA stats tracking and live game monitoring application.',
};

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <header className="bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-600 border-b border-indigo-700 shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
            <img src="/logo.png" alt="" className="h-10 w-auto drop-shadow-lg" />
            <span className="font-display text-xl font-bold text-white drop-shadow-lg tracking-wide">Side Scout</span>
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 md:py-12">
        <article className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 md:p-10">
          <h1 className="font-display text-3xl md:text-4xl font-bold text-gray-900 mb-2">Terms of Service</h1>
          <p className="text-sm text-gray-500 mb-8">Last updated: March 13, 2026</p>

          <div className="prose prose-slate max-w-none space-y-6 text-gray-700 leading-relaxed">
            <section>
              <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">1. Acceptance of Terms</h2>
              <p>
                By accessing or using Side Scout at <strong>sidescout.app</strong> (the &quot;Service&quot;), you agree to
                be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">2. Description of Service</h2>
              <p>
                Side Scout is a free NBA statistics tracking and live game monitoring tool. The Service provides
                player and team performance data, historical game logs, trend analysis, and value pick recommendations
                for informational and entertainment purposes.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">3. Disclaimer</h2>
              <p>
                The information provided on Side Scout is for <strong>informational and entertainment purposes only</strong>.
                We do not guarantee the accuracy, completeness, or timeliness of any statistics or data displayed.
              </p>
              <p className="mt-3">
                Side Scout does not provide gambling, betting, or financial advice. Any decisions you make based on
                information from this Service are made at your own risk. We are not responsible for any losses incurred
                from the use of our data or recommendations.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">4. Data Sources</h2>
              <p>
                NBA statistics and game data displayed on Side Scout are sourced from publicly available data via the
                NBA&apos;s public-facing APIs. Side Scout is not affiliated with, endorsed by, or connected to the
                National Basketball Association (NBA) or any of its teams.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">5. Intellectual Property</h2>
              <p>
                The Side Scout name, logo, and original design elements are the property of Side Scout. NBA team names,
                logos, and player likenesses are the property of their respective owners and are used for identification
                purposes only.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">6. User Conduct</h2>
              <p>You agree not to:</p>
              <ul className="list-disc pl-6 space-y-2 mt-3">
                <li>Use the Service for any unlawful purpose</li>
                <li>Attempt to gain unauthorised access to any portion of the Service</li>
                <li>Use automated systems (bots, scrapers) to access the Service in a manner that exceeds reasonable use</li>
                <li>Interfere with or disrupt the Service or servers connected to the Service</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">7. Availability</h2>
              <p>
                We strive to keep Side Scout available at all times but do not guarantee uninterrupted access. The
                Service may be temporarily unavailable due to maintenance, updates, or circumstances beyond our control.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">8. Limitation of Liability</h2>
              <p>
                To the fullest extent permitted by law, Side Scout and its operators shall not be liable for any
                indirect, incidental, special, consequential, or punitive damages arising from your use of the Service.
                The Service is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">9. Advertising</h2>
              <p>
                The Service displays advertisements provided by third-party ad networks, including Google AdSense.
                These ads help support the free operation of Side Scout. Ad content is managed by the respective
                ad networks and is subject to their own policies.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">10. Changes to Terms</h2>
              <p>
                We reserve the right to modify these Terms of Service at any time. Changes will be posted on this
                page with an updated revision date. Continued use of the Service after changes constitutes acceptance
                of the revised terms.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">11. Contact Us</h2>
              <p>
                If you have questions about these Terms, please contact us at{' '}
                <a href="mailto:contact@sidescout.app" className="text-indigo-600 underline hover:text-indigo-800">
                  contact@sidescout.app
                </a>.
              </p>
            </section>
          </div>
        </article>

        <div className="text-center mt-8">
          <Link href="/" className="text-indigo-600 hover:text-indigo-800 font-semibold text-sm">
            ← Back to Side Scout
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
