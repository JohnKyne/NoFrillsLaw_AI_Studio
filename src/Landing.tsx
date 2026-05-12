import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowRight, 
  CheckCircle2, 
  Shield, 
  Clock, 
  Globe, 
  Menu, 
  X,
  ExternalLink,
  AlertCircle,
  Plus
} from 'lucide-react';
import { Link } from 'react-router-dom';

const PRICING_TIERS = [
  {
    category: "Loss Leaders",
    items: [
      { name: "Statutory Declarations", price: "39", unit: "fixed fee" },
      { name: "Basic Wills", price: "99", unit: "fixed fee" },
      { name: "Document Certification", price: "20", unit: "fixed fee" }
    ]
  },
  {
    category: "Standard Core",
    items: [
      { name: "Letters Before Action", price: "145", unit: "fixed fee" },
      { name: "Foreign Birth Registration", price: "595", unit: "fixed fee" },
      { name: "Naturalisation Assistance", price: "995", unit: "fixed fee" }
    ]
  },
  {
    category: "High-Margin Tail",
    items: [
      { name: "Probate (Uncontested)", price: "1,795", unit: "fixed fee" },
      { name: "Deed Poll Name Change", price: "150", unit: "fixed fee" }
    ]
  },
  {
    category: "Recurring Annuity",
    items: [
      { name: "Annual Corporate Governance", price: "495", unit: "per year" },
      { name: "Registered Office & Agent", price: "295", unit: "per year" }
    ]
  }
];

const SURCHARGES = [
  { name: "Same-Day Witnessing", price: "+20" },
  { name: "Out-of-Hours Session", price: "+40" },
  { name: "Hard Copy Postage", price: "+15" },
  { name: "Express DFA Apostille", price: "+60" }
];

const PENALTIES = [
  { name: "Booking < 24h Notice", price: "+50", reason: "Same-day priority handling fee" },
  { name: "Mid-Process Doc Changes", price: "+30", reason: "Additional manual review required" },
  { name: "Custom Template Mods", price: "+40", reason: "Manual template adjustment required" }
];

const REJECTED_MATTERS = [
  "Contested matters of any kind",
  "Personal injury claims",
  "Family law (separation, divorce, custody)",
  "Criminal matters",
  "Court representation",
  "Anything requiring judgment on contested facts"
];

const FAQS = [
  {
    q: "How can you be so much cheaper than a traditional solicitor?",
    a: "By refusing complex, contested work. We only take on matters that have a deterministic outcome (like a statutory declaration or an uncontested will). We automate the drafting and data collection, so our solicitors only spend time reviewing and signing, not doing admin."
  },
  {
    q: "Are you a real law firm?",
    a: "Yes. Veritas Legal (Ireland) Limited is a regulated solicitor's practice, registered with and regulated by the Law Society of Ireland. All documents are signed by a solicitor on the Roll of Solicitors."
  },
  {
    q: "Do I have to come into an office?",
    a: "No. The vast majority of our services are completed entirely online. If a physical wet-ink signature is legally required (for example, some property or probate documents), we offer video witnessing or fast tracked in-person slots in Dublin."
  },
  {
    q: "What if my case ends up being complicated?",
    a: "If your matter becomes contested or requires complex legal judgment outside our standard templates, we will refund you and refer you to a traditional law firm. We do not do bespoke litigation."
  }
];

export default function Landing() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [latency, setLatency] = useState('Calculating...');

  useEffect(() => {
    // Simulate fetching real-time latency
    setTimeout(() => setLatency('3h 45m'), 1500);
  }, []);

  return (
    <div className="min-h-screen font-sans bg-bg-base text-ink-body">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-border-neutral bg-bg-base/80 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-6 lg:px-12">
          <div className="flex h-20 items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-ink-bold grid place-items-center">
                <span className="text-bg-base font-mono text-2xl font-bold leading-none">V</span>
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-lg font-bold tracking-tight uppercase">Veritas Ireland</span>
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-40">Regulated Solicitors</span>
              </div>
            </div>
            
            <div className="hidden md:flex items-center gap-10">
              <a href="#interactive-tools" className="text-sm font-medium hover:text-accent-forest transition-colors">Viability Tools</a>
              <a href="#pricing" className="text-sm font-medium hover:text-accent-forest transition-colors">Pricing</a>
              <a href="#compliance" className="text-sm font-medium hover:text-accent-forest transition-colors">Compliance</a>
              <Link to="/app" className="bg-accent-forest text-bg-base text-xs font-bold uppercase tracking-widest px-8 py-3.5 hover:bg-accent-hover transition-colors rounded-sm">
                Book Self-Service
              </Link>
            </div>

            <button 
              className="md:hidden p-2"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {isMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed inset-x-0 top-20 z-40 border-b border-border-neutral bg-bg-base px-6 py-10 md:hidden"
          >
            <div className="flex flex-col gap-8">
              <a href="#interactive-tools" className="text-2xl font-medium tracking-tight" onClick={() => setIsMenuOpen(false)}>Viability Tools</a>
              <a href="#pricing" className="text-2xl font-medium tracking-tight" onClick={() => setIsMenuOpen(false)}>Pricing</a>
              <a href="#compliance" className="text-2xl font-medium tracking-tight" onClick={() => setIsMenuOpen(false)}>Compliance</a>
              <Link to="/app" className="w-full bg-accent-forest text-center text-bg-base text-xs font-bold uppercase tracking-widest py-5 rounded-sm">
                Book Self-Service
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main>
        {/* Dynamic Hero Section */}
        <section className="relative overflow-hidden pt-24 pb-32 md:pt-40 md:pb-52 border-b border-border-neutral">
          <div className="mx-auto max-w-7xl px-6 lg:px-12 grid grid-cols-1 lg:grid-cols-12 gap-16">
            <div className="lg:col-span-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <div className="inline-flex items-center gap-2 mb-8 border-l-2 border-accent-forest pl-4">
                  <span className="text-xs font-bold uppercase tracking-[0.2em] text-accent-forest">Solicitor-witnessed. Same-day. From €39.</span>
                </div>
                
                <h1 className="text-5xl md:text-6xl font-medium leading-[1.1] tracking-tight mb-10 text-balance text-ink-bold">
                  Structural cost reduction for Irish legal work.
                </h1>
                
                <p className="text-xl opacity-70 leading-relaxed mb-12 max-w-2xl text-balance">
                  Veritas provides deterministic legal outcomes at structurally lower costs through AI automation and rigorous scoping constraints.
                </p>

                <div className="flex flex-wrap gap-6 items-center">
                  <Link to="/app" className="bg-ink-bold text-bg-base px-10 py-5 text-sm font-bold uppercase tracking-[0.15em] flex items-center gap-3 hover:opacity-90 transition-all rounded-sm group">
                    Start matter
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" strokeWidth={1.5} />
                  </Link>
                  <div className="flex items-center gap-4 py-4 border-l border-border-neutral pl-8">
                    <div className="text-[11px] font-bold uppercase tracking-widest leading-tight">
                       <span className="block text-accent-forest mb-1">Regulated Professional</span>
                       <span className="opacity-60 text-ink-body">Patrick Kelly, Solicitor & CTA</span>
                       <span className="block opacity-40 mt-1">Law Society of Ireland</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

            <div className="lg:col-span-6 hidden lg:block">
              {/* Walkthrough Video / Demo Placeholder */}
              <div className="w-full aspect-video bg-bg-accent border border-border-neutral rounded-sm shadow-sm relative group overflow-hidden flex flex-col justify-center items-center">
                <div className="absolute inset-0 bg-ink-bold/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 cursor-pointer backdrop-blur-[2px]">
                   <span className="bg-bg-base text-ink-bold px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-sm">Play Walkthrough</span>
                </div>
                
                <div className="h-12 w-12 rounded-full border-2 border-border-neutral grid place-items-center mb-4 text-ink-body/40 group-hover:scale-110 group-hover:border-ink-bold group-hover:text-ink-bold transition-all duration-500 ease-out">
                   <div className="w-0 h-0 border-t-[6px] border-t-transparent border-l-[10px] border-l-current border-b-[6px] border-b-transparent ml-1" />
                </div>
                
                <div className="text-center font-mono opacity-50 px-8">
                  <span className="block text-sm font-bold mb-2 text-ink-body">Self-Service Demonstration</span>
                  <span className="block text-[10px]">0:30 Autonomous Intake Walkthrough</span>
                </div>
                
                {/* Decorative UI elements mimicking the app interface in the background */}
                <div className="absolute left-6 right-6 top-6 bottom-6 border border-border-neutral/30 rounded-sm pointer-events-none opacity-20 bg-bg-base -z-10 shadow-sm flex flex-col overflow-hidden">
                   <div className="h-6 border-b border-border-neutral/30 w-full flex items-center px-4 gap-2 bg-bg-accent/50">
                      <div className="w-2 h-2 rounded-full bg-border-neutral" />
                      <div className="w-2 h-2 rounded-full bg-border-neutral" />
                      <div className="w-2 h-2 rounded-full bg-border-neutral" />
                   </div>
                   <div className="p-4 space-y-3">
                      <div className="w-1/3 h-2 bg-border-neutral/50 rounded-sm" />
                      <div className="w-full h-8 border border-border-neutral/50 rounded-sm" />
                      <div className="w-full h-8 border border-border-neutral/50 rounded-sm" />
                   </div>
                </div>
              </div>
              
              <div className="mt-8 flex justify-between items-start gap-4">
                 <div className="flex-1 p-5 border border-border-neutral bg-bg-accent rounded-sm shadow-sm">
                    <div className="flex items-center justify-between mb-4 pb-4 border-b border-border-neutral/50">
                      <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">System Status</span>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-accent-forest animate-pulse" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-accent-forest">Live Availability</span>
                      </div>
                    </div>
                    <span className="block font-mono text-xl">{latency} processing gap</span>
                 </div>
              </div>
            </div>
          </div>
        </section>

        {/* Interactive Tools Section */}
        <section id="interactive-tools" className="py-32 border-b border-border-neutral bg-bg-base">
          <div className="mx-auto max-w-7xl px-6 lg:px-12">
            <h2 className="text-3xl md:text-4xl font-medium mb-4 tracking-tight text-center">Interactive Viability Tools</h2>
            <p className="text-center opacity-70 mb-16 max-w-2xl mx-auto">
              We decline over 40% of instructions because they do not fit our deterministic model. Use our automated tools below to verify if your matter is eligible for structurally lower costs.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Link to="/services/statutory-declarations" className="p-8 border border-border-neutral bg-bg-accent hover:border-ink-bold transition-all rounded-sm group flex flex-col items-start text-left">
                <span className="inline-block px-3 py-1 bg-border-neutral text-[10px] font-bold uppercase tracking-widest mb-6 rounded-sm">Eligibility Wizard</span>
                <h3 className="text-xl font-medium tracking-tight mb-3">Statutory Declarations</h3>
                <p className="opacity-70 text-sm leading-relaxed mb-8 flex-1">
                  Determine if your declaration can be processed same-day. Filters for complex uncontested facts vs standard templates.
                </p>
                <span className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-accent-forest group-hover:underline">
                  Start Assessment <ArrowRight size={16} />
                </span>
              </Link>
              
              <Link to="/services/wills" className="p-8 border border-border-neutral bg-bg-accent hover:border-ink-bold transition-all rounded-sm group flex flex-col items-start text-left">
                <span className="inline-block px-3 py-1 bg-border-neutral text-[10px] font-bold uppercase tracking-widest mb-6 rounded-sm">Complexity Matrix</span>
                <h3 className="text-xl font-medium tracking-tight mb-3">Will Necessity Assessment</h3>
                <p className="opacity-70 text-sm leading-relaxed mb-8 flex-1">
                  Check if your estate falls inside our simple distribution model or requires a bespoke tax structurer.
                </p>
                <span className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-accent-forest group-hover:underline">
                  Evaluate Estate <ArrowRight size={16} />
                </span>
              </Link>

              <Link to="/services/letters-before-action" className="p-8 border border-border-neutral bg-bg-accent hover:border-ink-bold transition-all rounded-sm group flex flex-col items-start text-left">
                <span className="inline-block px-3 py-1 bg-border-neutral text-[10px] font-bold uppercase tracking-widest mb-6 rounded-sm">Viability Filter</span>
                <h3 className="text-xl font-medium tracking-tight mb-3">LBA Decision Tool</h3>
                <p className="opacity-70 text-sm leading-relaxed mb-8 flex-1">
                  A Letter Before Action is useless if the matter is already disputed. Verify if your debt meets the criteria for immediate issue.
                </p>
                <span className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-accent-forest group-hover:underline">
                  Test Evidence <ArrowRight size={16} />
                </span>
              </Link>

              <Link to="/services/debt-collection" className="p-8 border border-border-neutral bg-bg-accent hover:border-ink-bold transition-all rounded-sm group flex flex-col items-start text-left">
                <span className="inline-block px-3 py-1 bg-border-neutral text-[10px] font-bold uppercase tracking-widest mb-6 rounded-sm">ROI Calculator</span>
                <h3 className="text-xl font-medium tracking-tight mb-3">SME Statutory Penalty Calculator</h3>
                <p className="opacity-70 text-sm leading-relaxed mb-8 flex-1">
                  Calculate exactly how much EU late payment legislation entitles you to claim on top of your primary invoice.
                </p>
                <span className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-accent-forest group-hover:underline">
                  Calculate ROI <ArrowRight size={16} />
                </span>
              </Link>
            </div>
          </div>
        </section>

        {/* B2B Scale / In-House Counsel Relief */}
        <section className="py-32 border-b border-border-neutral bg-bg-accent">
          <div className="mx-auto max-w-7xl px-6 lg:px-12 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <span className="inline-block px-3 py-1 bg-border-neutral text-[10px] font-bold uppercase tracking-widest mb-6 rounded-sm text-ink-bold">In-House Counsel Relief</span>
              <h2 className="text-4xl md:text-5xl font-medium tracking-tight mb-8">Outsource your operational legal tail.</h2>
              <p className="text-lg opacity-70 leading-relaxed mb-6">
                Your internal legal team should be focused on complex commercial negotiations and strategic M&A, not drafting basic NDAs or chasing €4,000 debts.
              </p>
              <p className="text-lg opacity-70 leading-relaxed mb-10">
                Veritas acts as an overflow valve for corporate counsel. We handle the high-volume, low-complexity legal work at a fixed, deeply discounted enterprise rate.
              </p>
              
              <ul className="space-y-4 mb-10 bg-bg-base p-6 border border-border-neutral rounded-sm">
                <li className="flex items-center gap-3">
                  <CheckCircle2 size={18} className="text-accent-forest shrink-0" />
                  <span className="text-sm font-medium">Bulk Statutory Declarations / Oaths</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 size={18} className="text-accent-forest shrink-0" />
                  <span className="text-sm font-medium">Programmatic SME Debt Recovery (LBA)</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 size={18} className="text-accent-forest shrink-0" />
                  <span className="text-sm font-medium">Standardised Employment Severance Agreements</span>
                </li>
              </ul>
              
              <div className="flex flex-wrap gap-6 items-center">
                <a href="https://cal.com/veritas-ireland" target="_blank" rel="noreferrer" className="bg-ink-bold text-bg-base px-10 py-5 text-sm font-bold uppercase tracking-[0.15em] flex items-center gap-3 hover:opacity-90 transition-all rounded-sm group">
                  Book Enterprise Discussion
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" strokeWidth={1.5} />
                </a>
              </div>
            </div>
            <div className="hidden lg:grid grid-cols-2 gap-4">
               {/* Decorative structural elements */}
               <div className="aspect-[4/3] border border-border-neutral bg-bg-base rounded-sm flex flex-col justify-end p-6">
                 <div className="w-full h-1/2 bg-bg-accent/50 border border-border-neutral/50 mb-2" />
                 <div className="w-3/4 h-1/4 bg-bg-accent/50 border border-border-neutral/50" />
                 <span className="block mt-4 text-[10px] font-bold uppercase tracking-widest opacity-40">Internal Capacity</span>
               </div>
               <div className="aspect-[4/3] border border-accent-forest bg-accent-forest/5 rounded-sm flex flex-col justify-end p-6 mt-12">
                 <div className="w-full h-full bg-accent-forest/10 border border-accent-forest/20 flex flex-col gap-2 p-2">
                   <div className="h-4 w-full bg-accent-forest/20" />
                   <div className="h-4 w-full bg-accent-forest/20" />
                   <div className="h-4 w-3/4 bg-accent-forest/20" />
                 </div>
                 <span className="block mt-4 text-[10px] font-bold uppercase tracking-widest text-accent-forest">Veritas External Protocol</span>
               </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="py-32 border-b border-border-neutral bg-bg-accent/50">
          <div className="mx-auto max-w-7xl px-6 lg:px-12">
            <h2 className="text-3xl md:text-4xl font-medium mb-16 tracking-tight text-center">How our autonomous pipeline works</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
              <div className="relative">
                <div className="text-[100px] font-mono font-bold leading-none text-border-neutral absolute -top-8 -left-4 -z-10 opacity-30">1</div>
                <h3 className="text-xl font-semibold mb-4">Complete Self-Service Intake</h3>
                <p className="opacity-70 leading-relaxed text-sm">
                  Choose your legal product and complete the automated logic flow. Our system validates your inputs instantly against legal requirements to ensure there are no missing conditions.
                </p>
              </div>
              <div className="relative">
                <div className="text-[100px] font-mono font-bold leading-none text-border-neutral absolute -top-8 -left-4 -z-10 opacity-30">2</div>
                <h3 className="text-xl font-semibold mb-4">AI Drafting & Verification</h3>
                <p className="opacity-70 leading-relaxed text-sm">
                  The system generates the exact documents required, strictly adhering to Law Society templates. Your identity and documents are verified automatically before human review.
                </p>
              </div>
              <div className="relative">
                <div className="text-[100px] font-mono font-bold leading-none text-border-neutral absolute -top-8 -left-4 -z-10 opacity-30">3</div>
                <h3 className="text-xl font-semibold mb-4">Solicitor Review & Signing</h3>
                <p className="opacity-70 leading-relaxed text-sm">
                  A registered solicitor checks the prepared file. Because the admin is automated, they solely focus on legal compliance, resulting in deterministic outcomes within hours, not weeks.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Architecture */}
        <section id="pricing" className="py-32 border-b border-border-neutral">
          <div className="mx-auto max-w-7xl px-6 lg:px-12">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 mb-24">
              <div className="lg:col-span-4">
                <h2 className="text-4xl md:text-5xl font-medium mb-6 tracking-tight">Institutional Pricing.<br />Total Clarity.</h2>
                <p className="opacity-60 max-w-sm">No "contact for quote." No negotiation. Just institutional transparency.</p>
              </div>
              
              <div className="lg:col-span-8">
                <div className="border border-border-neutral overflow-hidden rounded-sm shadow-sm">
                  <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border-neutral bg-ink-bold text-bg-base/50 text-[9px] font-bold uppercase tracking-[0.2em] p-3 text-center">
                    <span>Service Category</span>
                    <span>Fee Structure</span>
                    <span>Unit Basis</span>
                  </div>
                  <div className="divide-y divide-border-neutral">
                    {PRICING_TIERS.map((tier) => (
                      <div key={tier.category} className="p-8 md:p-12 last:pb-8 bg-bg-base">
                        <span className="block text-xs font-bold uppercase tracking-[0.2em] text-accent-forest mb-8">{tier.category}</span>
                        <div className="space-y-6">
                          {tier.items.map((item) => (
                            <div key={item.name} className="flex justify-between items-baseline border-b border-border-neutral/30 pb-4 last:border-0 group cursor-default">
                              <span className="text-xl font-medium tracking-tight group-hover:text-accent-forest transition-colors">{item.name}</span>
                              <div className="flex items-baseline gap-2">
                                <span className="text-[10px] uppercase font-bold opacity-30">{item.unit}</span>
                                <span className="font-mono text-2xl font-medium text-ink-bold">€{item.price}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Surcharges & Penalties */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-24">
              <div>
                <h3 className="text-xs font-bold mb-8 uppercase tracking-[0.15em] opacity-40">Universal Surcharges</h3>
                <div className="space-y-4 border-t border-border-neutral pt-8">
                  {SURCHARGES.map((s) => (
                    <div key={s.name} className="flex justify-between items-center group">
                      <span className="text-sm font-medium">{s.name}</span>
                      <span className="font-mono text-sm font-bold text-accent-forest px-3 py-1 bg-accent-forest/5">{s.price}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-xs font-bold mb-8 uppercase tracking-[0.15em] opacity-40">Complexity Penalties</h3>
                <div className="space-y-4 border-t border-border-neutral pt-8">
                  {PENALTIES.map((p) => (
                    <div key={p.name} className="flex justify-between items-start group">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{p.name}</span>
                        <span className="text-[10px] opacity-50 font-normal mt-1">{p.reason}</span>
                      </div>
                      <span className="font-mono text-sm font-bold text-ink-bold px-3 py-1 bg-ink-bold/5">{p.price}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-8 p-4 bg-bg-accent border border-border-neutral italic text-xs leading-relaxed opacity-60">
                  Notice: Penalties are applied to maintain operational discipline and protect lower base rates for standard users.
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Refusals Section */}
        <section className="py-32 bg-ink-bold text-bg-base border-b-8 border-accent-forest">
          <div className="mx-auto max-w-7xl px-6 lg:px-12 grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
            <div className="lg:col-span-5">
              <span className="inline-block px-4 py-1 border border-bg-base/20 text-[10px] font-bold uppercase tracking-widest mb-10 rounded-sm">Strategic Scope</span>
              <h2 className="text-4xl md:text-5xl font-medium tracking-tight mb-8 leading-tight">Explicit Refusals. <br /><span className="opacity-50">Total Competence.</span></h2>
              <p className="text-lg opacity-70 leading-relaxed mb-10">
                We are a productised service. We do not negotiate on scope. By refusing work that requires human judgment on contested facts, we ensure deterministic outcomes for everything else.
              </p>
              <div className="flex items-center gap-4">
                <AlertCircle size={20} className="text-bg-base/30" />
                <span className="text-sm border-b border-bg-base/20 pb-1 cursor-help opacity-70">Why we refuse certain cases</span>
              </div>
            </div>
            
            <div className="lg:col-span-7">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {REJECTED_MATTERS.map((item, idx) => (
                  <div key={idx} className="p-8 border border-bg-base/10 hover:border-bg-base/30 transition-colors flex items-center justify-between group rounded-sm bg-bg-base/5">
                    <span className="text-base font-medium opacity-80 group-hover:opacity-100">{item}</span>
                    <X size={16} className="opacity-20 group-hover:opacity-100 text-red-500 transition-all shrink-0 ml-4" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* About & Cofounder Section */}
        <section className="py-32 border-b border-border-neutral bg-bg-base">
          <div className="mx-auto max-w-7xl px-6 lg:px-12 grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-medium tracking-tight mb-8">Built by legal professionals, automated for scale.</h2>
              <p className="text-lg opacity-70 leading-relaxed mb-6">
                Most law firms are built around the billable hour, fundamentally misaligned with client interests. Veritas Ireland was founded to decouple the delivery of standard legal documents from the time it takes to produce them.
              </p>
              <div className="mt-8 flex flex-col gap-4 p-6 bg-bg-accent border border-border-neutral rounded-sm">
                <div>
                  <span className="text-lg font-semibold block">Patrick Kelly</span>
                  <span className="text-[11px] uppercase tracking-widest font-bold opacity-50">Solicitor, Chartered Tax Advisor & Founder</span>
                </div>
                
                <div className="space-y-3 pt-4 border-t border-border-neutral/50">
                  <div className="flex items-center gap-3">
                    <Shield size={16} className="text-accent-forest shrink-0" />
                    <span className="text-sm font-medium">Qualified Solicitor (Law Society of Ireland)</span>
                  </div>
                  <div className="flex items-center gap-3 opacity-80">
                    <CheckCircle2 size={16} className="text-ink-body shrink-0" />
                    <span className="text-sm">Chartered Tax Advisor (Irish Tax Institute)</span>
                  </div>
                  <div className="flex items-center gap-3 opacity-80">
                    <CheckCircle2 size={16} className="text-ink-body shrink-0" />
                    <span className="text-sm">Postgraduate Diploma in Tech & IP Law</span>
                  </div>
                </div>

                <div className="pt-4 mt-2 border-t border-border-neutral/50">
                  <span className="text-[10px] uppercase tracking-widest font-bold opacity-40 block mb-3">Professional Background</span>
                  <ul className="text-sm space-y-2 opacity-70">
                    <li className="flex justify-between"><span>Legal Counsel</span> <span>ION Group</span></li>
                    <li className="flex justify-between"><span>Chairperson of the Board</span> <span>Community CU</span></li>
                    <li className="flex justify-between"><span>Tax Associate & Trainee</span> <span>Matheson</span></li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="aspect-[4/3] bg-bg-base border border-border-neutral rounded-sm relative overflow-hidden group">
               <img 
                 src="/patrick-kelly.jpg" 
                 alt="Patrick Kelly, Managing Partner" 
                 className="w-full h-full object-cover object-top filter grayscale group-hover:grayscale-0 transition-all duration-700 relative z-10" 
               />
               <div className="absolute inset-0 bg-gradient-to-t from-bg-base/80 to-transparent z-20 pointer-events-none" />
               <div className="absolute bottom-6 left-6 right-6 z-30">
                 <span className="bg-bg-base text-ink-bold px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-sm shadow-sm backdrop-blur-sm border border-border-neutral inline-block">Managing Partner</span>
               </div>
            </div>
          </div>
        </section>

        {/* FAQs */}
        <section className="py-32 border-b border-border-neutral bg-bg-accent/30">
          <div className="mx-auto max-w-4xl px-6 lg:px-12">
            <h2 className="text-3xl md:text-4xl font-medium tracking-tight mb-16 text-center">Frequently Asked Questions</h2>
            <div className="space-y-4">
              {FAQS.map((faq, index) => (
                <div key={index} className="border border-border-neutral rounded-sm bg-bg-base overflow-hidden">
                  <button 
                    className="w-full text-left px-6 py-5 flex items-center justify-between font-medium text-lg hover:bg-bg-accent/50 transition-colors"
                    onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  >
                    {faq.q}
                    <Plus size={20} className={`transform transition-transform ${openFaq === index ? 'rotate-45 text-accent-forest' : 'opacity-40'}`} />
                  </button>
                  <AnimatePresence>
                    {openFaq === index && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="px-6 pb-6 pt-2 text-ink-body/70 leading-relaxed border-t border-border-neutral/50">
                          {faq.a}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Institutional Confidence */}
        <section id="compliance" className="py-32 bg-bg-base">
          <div className="mx-auto max-w-7xl px-6 lg:px-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-16">
              <div className="space-y-6">
                <div className="h-10 w-10 border border-border-neutral grid place-items-center mb-10 rounded-sm">
                  <Shield size={20} className="text-accent-forest" strokeWidth={1.5} />
                </div>
                <h4 className="text-xl font-semibold tracking-tight">Institutional Credibility</h4>
                <p className="opacity-70 leading-relaxed text-sm">
                  Veritas is a regulated solicitor's practice. Every matter is signed by an officer of the High Court and registered on the Roll of Solicitors.
                </p>
              </div>
              <div className="space-y-6">
                <div className="h-10 w-10 border border-border-neutral grid place-items-center mb-10 rounded-sm">
                  <Clock size={20} className="text-accent-forest" strokeWidth={1.5} />
                </div>
                <h4 className="text-xl font-semibold tracking-tight">Deterministic Delivery</h4>
                <p className="opacity-70 leading-relaxed text-sm">
                  Our workflows are audited by custom AI systems to ensure documentation is DFA-ready before it reaches a human reviewer.
                </p>
              </div>
              <div className="space-y-6">
                <div className="h-10 w-10 border border-border-neutral grid place-items-center mb-10 rounded-sm">
                  <Globe size={20} className="text-accent-forest" strokeWidth={1.5} />
                </div>
                <h4 className="text-xl font-semibold tracking-tight">Data Sovereignty</h4>
                <p className="opacity-70 leading-relaxed text-sm">
                  All infrastructure is EU-West (Dublin) only. We do not use third-party sub-processors outside the EEA for client data.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-bg-accent border-t border-border-neutral py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 mb-20">
            <div className="lg:col-span-4">
              <div className="flex items-center gap-3 mb-8">
                <div className="h-8 w-8 bg-ink-bold grid place-items-center rounded-sm">
                  <span className="text-bg-base font-mono text-lg font-bold leading-none">V</span>
                </div>
                <span className="text-base font-bold tracking-tight uppercase">Veritas Ireland</span>
              </div>
              <p className="text-sm opacity-60 leading-relaxed max-w-sm">
                Veritas Legal (Ireland) Limited. Regulated legal services. Structurally lower costs through rigorous automation.
              </p>
            </div>
            
            <div className="lg:col-span-8 grid grid-cols-2 md:grid-cols-3 gap-12">
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-widest opacity-40 mb-6">Service Pillars</span>
                <ul className="text-sm space-y-4 font-medium opacity-70">
                  <li className="hover:text-accent-forest transition-colors"><Link to="/services/statutory-declarations">Statutory Declarations</Link></li>
                  <li className="hover:text-accent-forest transition-colors"><Link to="/services/wills">Basic Wills</Link></li>
                  <li className="hover:text-accent-forest transition-colors"><Link to="/services/letters-before-action">Letters Before Action</Link></li>
                  <li className="hover:text-accent-forest transition-colors"><Link to="/services/debt-collection">Statutory ROI Calculator</Link></li>
                </ul>
              </div>
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-widest opacity-40 mb-6">Platform</span>
                <ul className="text-sm space-y-4 font-medium opacity-70">
                  <li className="hover:text-accent-forest transition-colors"><Link to="/app">Booking Portal</Link></li>
                  <li className="hover:text-accent-forest transition-colors"><a href="#">Documentation Audit</a></li>
                  <li className="hover:text-accent-forest transition-colors"><a href="#">API Documentation</a></li>
                </ul>
              </div>
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-widest opacity-40 mb-6">Compliance</span>
                <ul className="text-sm space-y-4 font-medium opacity-70">
                  <li className="hover:text-accent-forest transition-colors flex items-center gap-2"><a href="#">Regulatory Filings</a> <ExternalLink size={10} /></li>
                  <li className="hover:text-accent-forest transition-colors"><a href="#">PII Cover Confirmation</a></li>
                  <li className="hover:text-accent-forest transition-colors"><a href="#">Privacy Policy</a></li>
                </ul>
              </div>
            </div>
          </div>

          <div className="pt-12 border-t border-border-neutral flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex gap-10 text-[10px] font-bold uppercase tracking-[0.2em] opacity-40">
              <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 bg-accent-forest rounded-full animate-pulse" /> Systems Operational</span>
              <span>© {new Date().getFullYear()} Veritas Ireland</span>
            </div>
            <div className="flex items-center gap-6">
              <span className="text-[10px] font-bold uppercase tracking-widest opacity-30">Pre-launch Phase A</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
