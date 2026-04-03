import Link from 'next/link';
import { ArrowLeft, GitBranch, Target, Shield, CheckCircle } from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center gap-4">
          <Link href="/" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-500" />
          </Link>
          <h1 className="font-bold text-lg">About GitLens Intelligence</h1>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-12 space-y-12">
        <section className="space-y-6">
          <h2 className="text-3xl font-bold tracking-tight">The Core Problem</h2>
          <p className="text-lg text-slate-600 leading-relaxed">
            Most engineering teams measure code quality using static analysis (linting, testing) but completely ignore the <strong>human risk</strong> hidden inside their Git history. When developers leave a company, they take undocumented context with them. Over time, core modules degrade into &quot;Ghost Code&quot;—running in production, yet no one on the current team remembers how it works. This leads to massive &quot;Bus Factor&quot; vulnerabilities where entire system architectures depend on a single engineer.
          </p>
        </section>
        
        <section className="space-y-6">
          <h2 className="text-3xl font-bold tracking-tight">Our Solution</h2>
          <p className="text-lg text-slate-600 leading-relaxed">
            GitLens Intelligence natively connects to your raw Git metadata to mathematically quantify and visualize engineering risk. By simulating knowledge decay using the proven <strong>Ebbinghaus retention curve</strong>, and leveraging localized AI models via Groq, we don&apos;t just show you graphs—we generate exact 72-hour emergency transfer plans before critical employees walk out the door.
          </p>
        </section>

        <section className="space-y-8">
          <h2 className="text-3xl font-bold tracking-tight">The Engine</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-3"><Target className="w-5 h-5 text-blue-600" /> Bus Factor Analysis</h3>
              <p className="text-slate-500 text-sm">Mathematically flags specific files where &gt;80% of all historic commits belong to a single developer, highlighting critical single-points-of-failure.</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-3"><Shield className="w-5 h-5 text-red-500" /> Knowledge Radar</h3>
              <p className="text-slate-500 text-sm">Calculates exactly how many days have passed since an active developer touched a file, mapping memory retention to identify &quot;Ghost Code&quot;.</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-3"><GitBranch className="w-5 h-5 text-purple-500" /> Departure Simulator</h3>
              <p className="text-slate-500 text-sm">Allows you to actively &quot;remove&quot; a developer from the team virtually, automatically calculating the exact orphaned files and drafting an emergency handover plan.</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-3"><CheckCircle className="w-5 h-5 text-green-500" /> Automation Spotter</h3>
              <p className="text-slate-500 text-sm">Cross-references Code Churn metrics with single-ownership files to identify perfectly isolated, high-labor modules that are prime candidates for AI agent delegation.</p>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-3xl font-bold tracking-tight">How We&apos;re Different</h2>
          <p className="text-lg text-slate-600 leading-relaxed">
            Traditional platforms like GitHub Insights or SonarQube focus strictly on lines-of-code and burndown charts. <strong>GitLens Intelligence completely re-frames the codebase as a human network.</strong> By processing pure Git logs securely without uploading your sensitive proprietary source code to the cloud, we provide enterprise-grade socio-technical architecture insights instantaneously.
          </p>
        </section>
      </main>
    </div>
  );
}
