import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-slate-900 border-t border-slate-700">
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 mb-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <img src="/logo.png" alt="" className="h-8 w-auto" />
              <span className="font-display text-lg font-bold text-white tracking-wide">Side Scout</span>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              Free NBA stats tracker with real-time data, trend analysis, and live game monitoring.
            </p>
          </div>

          {/* Navigation */}
          <div>
            <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">Explore</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/" className="text-sm text-slate-400 hover:text-white transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-sm text-slate-400 hover:text-white transition-colors">
                  About
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-sm text-slate-400 hover:text-white transition-colors">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">Legal</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/privacy" className="text-sm text-slate-400 hover:text-white transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-sm text-slate-400 hover:text-white transition-colors">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>

          {/* Data */}
          <div>
            <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">Data</h4>
            <ul className="space-y-2">
              <li>
                <a
                  href="https://policies.google.com/technologies/partner-sites"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-slate-400 hover:text-white transition-colors"
                >
                  How Google uses data
                </a>
              </li>
              <li>
                <a
                  href="https://www.google.com/settings/ads"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-slate-400 hover:text-white transition-colors"
                >
                  Ad personalisation
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Divider + bottom */}
        <div className="border-t border-slate-700 pt-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              &copy; {new Date().getFullYear()} Side Scout. All rights reserved.
            </p>
            <p className="text-xs text-slate-500 text-center sm:text-right leading-relaxed">
              Not affiliated with the NBA. Stats are for informational &amp; entertainment purposes only.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
