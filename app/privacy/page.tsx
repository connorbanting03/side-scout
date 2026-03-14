import type { Metadata } from 'next';
import Link from 'next/link';
import Footer from '../components/Footer';

export const metadata: Metadata = {
  title: 'Privacy Policy — Side Scout',
  description: 'Privacy policy for Side Scout, an NBA stats tracking and live game monitoring application.',
};

export default function PrivacyPolicy() {
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
          <h1 className="font-display text-3xl md:text-4xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
          <p className="text-sm text-gray-500 mb-8">Last updated: March 13, 2026</p>

          <div className="prose prose-slate max-w-none space-y-6 text-gray-700 leading-relaxed">
            <section>
              <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">1. Introduction</h2>
              <p>
                Side Scout (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) operates the website at{' '}
                <strong>sidescout.app</strong> (the &quot;Service&quot;). This Privacy Policy explains how we collect,
                use, and protect information when you use our Service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">2. Information We Collect</h2>
              <p>We collect limited information to operate and improve the Service:</p>
              <ul className="list-disc pl-6 space-y-2 mt-3">
                <li>
                  <strong>Usage Data:</strong> We automatically collect information such as your browser type,
                  pages visited, time spent on pages, and referring URLs through analytics services.
                </li>
                <li>
                  <strong>Device Information:</strong> We may collect information about the device you use to
                  access our Service, including device type, operating system, and screen resolution.
                </li>
                <li>
                  <strong>Cookies &amp; Similar Technologies:</strong> We and our third-party partners use cookies,
                  web beacons, and similar technologies to collect information and deliver personalised advertising.
                  See Section 5 for details.
                </li>
              </ul>
              <p className="mt-3">
                We do <strong>not</strong> require you to create an account, and we do not collect personal
                information such as your name, email address, or payment details.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">3. How We Use Your Information</h2>
              <p>We use the information we collect to:</p>
              <ul className="list-disc pl-6 space-y-2 mt-3">
                <li>Provide, maintain, and improve the Service</li>
                <li>Understand how users interact with the Service</li>
                <li>Detect, prevent, and address technical issues</li>
                <li>Display relevant advertisements</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">4. Third-Party Services</h2>
              <p>We use the following third-party services:</p>
              <ul className="list-disc pl-6 space-y-2 mt-3">
                <li>
                  <strong>Google Analytics:</strong> We use Google Analytics to understand how visitors use our site.
                  Google Analytics collects information such as how often users visit the site, what pages they visit,
                  and what other sites they visited prior to coming to our site.
                </li>
                <li>
                  <strong>Google AdSense:</strong> We use Google AdSense to display advertisements. Google and its
                  partners may use cookies to serve ads based on your prior visits to this website or other websites.
                  You may opt out of personalised advertising by visiting{' '}
                  <a href="https://www.google.com/settings/ads" className="text-indigo-600 underline hover:text-indigo-800" target="_blank" rel="noopener noreferrer">
                    Google Ads Settings
                  </a>.
                </li>
              </ul>
              <p className="mt-3">
                For more information about how Google uses data when you use our site, visit{' '}
                <a href="https://policies.google.com/technologies/partner-sites" className="text-indigo-600 underline hover:text-indigo-800" target="_blank" rel="noopener noreferrer">
                  How Google uses data when you use our partners&apos; sites or apps
                </a>.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">5. Cookies</h2>
              <p>
                Cookies are small text files placed on your device by websites you visit. We use cookies for
                analytics and advertising purposes. Third-party vendors, including Google, use cookies to serve
                ads based on your prior visits to this website or other websites.
              </p>
              <p className="mt-3">
                You can control cookie preferences through your browser settings. Most browsers allow you to
                block or delete cookies. However, doing so may affect the functionality of the Service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">6. Data Retention</h2>
              <p>
                We retain usage data collected through analytics for as long as necessary to fulfil the purposes
                outlined in this policy. Aggregated or anonymised data may be retained indefinitely for analytical purposes.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">7. Children&apos;s Privacy</h2>
              <p>
                Our Service is not directed to children under the age of 13. We do not knowingly collect personal
                information from children under 13. If you are a parent or guardian and believe your child has
                provided us with personal information, please contact us so we can take appropriate action.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">8. Your Rights</h2>
              <p>Depending on your jurisdiction, you may have the right to:</p>
              <ul className="list-disc pl-6 space-y-2 mt-3">
                <li>Access the personal data we hold about you</li>
                <li>Request correction or deletion of your data</li>
                <li>Opt out of personalised advertising</li>
                <li>Withdraw consent where processing is based on consent</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">9. Changes to This Policy</h2>
              <p>
                We may update this Privacy Policy from time to time. Any changes will be posted on this page
                with an updated revision date. We encourage you to review this policy periodically.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">10. Contact Us</h2>
              <p>
                If you have any questions about this Privacy Policy, please contact us at{' '}
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
