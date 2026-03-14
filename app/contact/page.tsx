import type { Metadata } from 'next';
import Link from 'next/link';
import { Mail, MessageSquare, AlertTriangle } from 'lucide-react';
import Footer from '../components/Footer';

export const metadata: Metadata = {
  title: 'Contact — Side Scout',
  description: 'Get in touch with the Side Scout team for questions, feedback, or support.',
};

export default function Contact() {
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
        <div className="text-center mb-10">
          <h1 className="font-display text-3xl md:text-4xl font-bold text-gray-900 mb-3">Contact Us</h1>
          <p className="text-lg text-gray-600 max-w-xl mx-auto">
            Have a question, feedback, or found a bug? We&apos;d love to hear from you.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-10">
          <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6 text-center">
            <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center mx-auto mb-4">
              <Mail className="w-6 h-6 text-indigo-600" />
            </div>
            <h3 className="font-bold text-gray-900 mb-2">Email</h3>
            <p className="text-sm text-gray-600 mb-3">For general enquiries and support</p>
            <a href="mailto:contact@sidescout.app" className="text-indigo-600 hover:text-indigo-800 font-semibold text-sm underline">
              contact@sidescout.app
            </a>
          </div>

          <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6 text-center">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="w-6 h-6 text-emerald-600" />
            </div>
            <h3 className="font-bold text-gray-900 mb-2">Feedback</h3>
            <p className="text-sm text-gray-600 mb-3">Suggestions for features or improvements</p>
            <a href="mailto:contact@sidescout.app?subject=Feature%20Suggestion" className="text-emerald-600 hover:text-emerald-800 font-semibold text-sm underline">
              Send feedback
            </a>
          </div>

          <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6 text-center">
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
            <h3 className="font-bold text-gray-900 mb-2">Report an Issue</h3>
            <p className="text-sm text-gray-600 mb-3">Found incorrect data or a bug?</p>
            <a href="mailto:contact@sidescout.app?subject=Bug%20Report" className="text-amber-600 hover:text-amber-800 font-semibold text-sm underline">
              Report a bug
            </a>
          </div>
        </div>

        <article className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 md:p-10">
          <h2 className="font-display text-2xl font-bold text-gray-900 mb-4">Frequently Asked Questions</h2>
          <div className="space-y-6 text-gray-700">
            <div>
              <h3 className="font-bold text-gray-900 mb-1">Where does the data come from?</h3>
              <p className="text-sm leading-relaxed">
                All NBA statistics are sourced from publicly available data via the NBA&apos;s public-facing endpoints. 
                Data is refreshed regularly throughout the day and during live games.
              </p>
            </div>
            <div>
              <h3 className="font-bold text-gray-900 mb-1">Is Side Scout free?</h3>
              <p className="text-sm leading-relaxed">
                Yes, Side Scout is completely free to use. No sign-up or account is required. The site is supported 
                by advertisements.
              </p>
            </div>
            <div>
              <h3 className="font-bold text-gray-900 mb-1">How often are stats updated?</h3>
              <p className="text-sm leading-relaxed">
                Player and team game logs are refreshed multiple times per day. During live games, box scores update 
                automatically every 30 seconds.
              </p>
            </div>
            <div>
              <h3 className="font-bold text-gray-900 mb-1">Can I use this on my phone?</h3>
              <p className="text-sm leading-relaxed">
                Absolutely. Side Scout is fully responsive and designed to work great on phones, tablets, and desktops.
              </p>
            </div>
            <div>
              <h3 className="font-bold text-gray-900 mb-1">What are Value Picks?</h3>
              <p className="text-sm leading-relaxed">
                Value Picks are algorithmically generated highlights of players who are trending above their season 
                averages with low variance (high consistency). They&apos;re for informational purposes only and should 
                not be taken as betting advice.
              </p>
            </div>
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
