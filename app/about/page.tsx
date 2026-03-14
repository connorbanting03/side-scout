import type { Metadata } from 'next';
import Link from 'next/link';
import { BarChart3, TrendingUp, Radio, Target, Zap, Users } from 'lucide-react';
import Footer from '../components/Footer';

export const metadata: Metadata = {
  title: 'About — Side Scout',
  description: 'Learn about Side Scout, the free NBA stats tracker and live game monitor built for basketball fans and sports analysts.',
};

const features = [
  {
    icon: BarChart3,
    title: 'Player & Team Stats',
    description: 'Detailed game logs, shooting splits, and performance averages for every active NBA player and all 30 teams.',
  },
  {
    icon: TrendingUp,
    title: 'Trend Analysis',
    description: 'See how players are performing over their last 5, 10, 15, or 20 games compared to their season averages.',
  },
  {
    icon: Radio,
    title: 'Live Game Tracking',
    description: 'Real-time box scores and live stat updates for games in progress, so you never miss a beat.',
  },
  {
    icon: Target,
    title: 'Value Picks',
    description: 'Algorithmically generated picks highlighting players trending up with consistent recent performance.',
  },
  {
    icon: Zap,
    title: 'Fast & Free',
    description: 'No sign-up required. Instant access to stats with a clean, fast interface on any device.',
  },
  {
    icon: Users,
    title: 'Multi-Tab Comparison',
    description: 'Open multiple players and teams simultaneously and switch between them instantly.',
  },
];

export default function About() {
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
        {/* Hero section */}
        <div className="text-center mb-10">
          <h1 className="font-display text-3xl md:text-5xl font-bold text-gray-900 mb-4">
            About Side Scout
          </h1>
          <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
            The free NBA stats tracker built for serious basketball fans. Real-time data, 
            trend analysis, and smart picks — all in one fast, clean interface.
          </p>
        </div>

        {/* What is Side Scout */}
        <article className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 md:p-10 mb-8">
          <h2 className="font-display text-2xl font-bold text-gray-900 mb-4">What is Side Scout?</h2>
          <div className="space-y-4 text-gray-700 leading-relaxed">
            <p>
              Side Scout is a free, no-sign-up-required NBA statistics platform that gives you instant access to 
              player and team performance data. Whether you&apos;re a fantasy basketball manager, a stats enthusiast, 
              or just a fan who wants to know how your favourite player has been performing lately, Side Scout has 
              you covered.
            </p>
            <p>
              We pull data from publicly available NBA sources and present it in an easy-to-digest format. Search 
              for any active player or team, view recent game logs, analyse shooting trends, and check live box 
              scores — all from a single search bar.
            </p>
            <p>
              Our <strong>Value Picks</strong> feature uses a statistical algorithm to surface players who are 
              trending above their season averages with consistent recent performance. It&apos;s a great starting 
              point for research, whether you&apos;re setting a fantasy lineup or just curious about who&apos;s hot 
              right now.
            </p>
          </div>
        </article>

        {/* Features grid */}
        <h2 className="font-display text-2xl font-bold text-gray-900 mb-6 text-center">Features</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-8">
          {features.map((feature) => (
            <div key={feature.title} className="bg-white rounded-xl shadow-md border border-slate-200 p-5 hover:shadow-lg transition-shadow">
              <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center mb-3">
                <feature.icon className="w-5 h-5 text-indigo-600" />
              </div>
              <h3 className="font-bold text-gray-900 mb-1">{feature.title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>

        {/* How it works */}
        <article className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 md:p-10 mb-8">
          <h2 className="font-display text-2xl font-bold text-gray-900 mb-4">How It Works</h2>
          <div className="space-y-4 text-gray-700 leading-relaxed">
            <ol className="list-decimal pl-6 space-y-3">
              <li>
                <strong>Search</strong> — Type any NBA player or team name into the search bar at the top of the page.
              </li>
              <li>
                <strong>Explore</strong> — View detailed game logs, averages, shooting splits, and performance charts. 
                Adjust the game window (last 5, 10, 15, 20, or full season) to see exactly the timeframe you care about.
              </li>
              <li>
                <strong>Compare</strong> — Open multiple players or teams in tabs and switch between them instantly. 
                Use the sidebar to manage your open tabs.
              </li>
              <li>
                <strong>Track live games</strong> — When games are in progress, live box scores appear automatically 
                for players and teams you&apos;re viewing.
              </li>
            </ol>
          </div>
        </article>

        {/* Disclaimer */}
        <article className="bg-amber-50 rounded-2xl border border-amber-200 p-6 md:p-10 mb-8">
          <h2 className="font-display text-xl font-bold text-amber-900 mb-3">Disclaimer</h2>
          <p className="text-amber-800 leading-relaxed text-sm">
            Side Scout is an independent project and is not affiliated with, endorsed by, or connected to the 
            National Basketball Association (NBA) or any of its teams. All statistics are sourced from publicly 
            available data and are provided for informational and entertainment purposes only. Side Scout does not 
            provide betting or financial advice. Any decisions you make based on information from this site are 
            made at your own risk.
          </p>
        </article>

        <div className="text-center mt-8">
          <Link href="/" className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-3 rounded-xl shadow-lg transition-colors">
            ← Start Exploring Stats
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
