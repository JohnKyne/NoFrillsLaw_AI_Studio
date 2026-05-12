import React, { useState } from 'react';
import { 
  ArrowRight, 
  CheckCircle2, 
  Shield, 
  Clock, 
  FileText, 
  Globe, 
  Scale, 
  Menu, 
  X,
  ExternalLink,
  ChevronRight,
  Info,
  AlertCircle,
  Briefcase,
  Search,
  Settings,
  HelpCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';

const PRICING_TIERS = [
  {
    category: "Loss Leaders",
    items: [
      { id: "stat-dec", name: "Statutory Declarations", price: 39, type: "fixed" },
      { id: "will-basic", name: "Basic Wills", price: 99, type: "fixed" },
      { id: "doc-cert", name: "Document Certification", price: 20, type: "fixed" }
    ]
  },
  {
    category: "Standard Core",
    items: [
      { id: "lba", name: "Letters Before Action", price: 145, type: "fixed" },
      { id: "fbr", name: "Foreign Birth Registration", price: 595, type: "fixed" },
      { id: "nat-assist", name: "Naturalisation Assistance", price: 995, type: "fixed" }
    ]
  },
  {
    category: "High-Margin Tail",
    items: [
      { id: "probate", name: "Probate (Uncontested)", price: 1795, type: "fixed" },
      { id: "deed-poll", name: "Deed Poll Name Change", price: 150, type: "fixed" }
    ]
  },
  {
    category: "Recurring Annuity",
    items: [
      { id: "annual-gov", name: "Annual Corporate Governance", price: 495, type: "yearly" },
      { id: "reg-office", name: "Registered Office & Agent", price: 295, type: "yearly" }
    ]
  }
];

const SURCHARGES = [
  { id: "same-day", name: "Same-Day Witnessing", price: 20 },
  { id: "out-of-hours", name: "Out-of-Hours Session", price: 40 },
  { id: "hard-copy", name: "Hard Copy Postage", price: 15 },
  { id: "express-dfa", name: "Express DFA Apostille", price: 60 }
];

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('booking');
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [selectedSurcharges, setSelectedSurcharges] = useState<Record<string, boolean>>({});

  const allItems = PRICING_TIERS.flatMap(tier => tier.items);
  const selectedService = allItems.find(i => i.id === selectedServiceId);

  const toggleSurcharge = (id: string) => {
    setSelectedSurcharges(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const calculateTotal = () => {
    let total = 0;
    if (selectedService) {
      total += selectedService.price;
    }
    SURCHARGES.forEach(surcharge => {
      if (selectedSurcharges[surcharge.id]) {
        total += surcharge.price;
      }
    });
    return total;
  };

  return (
    <div className="min-h-screen font-sans bg-bg-accent text-ink-body flex flex-col md:flex-row">
      <aside className="w-full md:w-64 bg-bg-base border-r border-border-neutral flex-shrink-0 flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-border-neutral">
          <Link to="/" className="flex items-center gap-3">
            <div className="h-6 w-6 bg-ink-bold grid place-items-center rounded-sm">
              <span className="text-bg-base text-xs font-bold font-mono">V</span>
            </div>
            <span className="text-sm font-bold tracking-tight uppercase">Veritas Ireland</span>
          </Link>
        </div>

        <div className="p-4 flex-1 overflow-y-auto">
          <nav className="space-y-1">
            <button 
              onClick={() => setActiveTab('booking')}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-sm transition-colors ${activeTab === 'booking' ? 'bg-border-neutral/50 text-ink-bold' : 'text-ink-body/70 hover:bg-border-neutral/30 hover:text-ink-bold'}`}
            >
              <FileText size={16} />
              New Matter
            </button>
            <button 
              onClick={() => setActiveTab('active')}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-sm transition-colors ${activeTab === 'active' ? 'bg-border-neutral/50 text-ink-bold' : 'text-ink-body/70 hover:bg-border-neutral/30 hover:text-ink-bold'}`}
            >
              <Briefcase size={16} />
              Active Matters
              <span className="ml-auto bg-border-neutral px-1.5 py-0.5 rounded-sm text-[10px] font-mono font-bold">2</span>
            </button>
            <button 
              onClick={() => setActiveTab('compliance')}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-sm transition-colors ${activeTab === 'compliance' ? 'bg-border-neutral/50 text-ink-bold' : 'text-ink-body/70 hover:bg-border-neutral/30 hover:text-ink-bold'}`}
            >
              <Shield size={16} />
              Compliance Log
            </button>
          </nav>
        </div>

        <div className="p-4 border-t border-border-neutral">
          <nav className="space-y-1">
            <button className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-sm text-ink-body/70 hover:bg-border-neutral/30 transition-colors">
              <Settings size={16} />
              Settings
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-sm text-ink-body/70 hover:bg-border-neutral/30 transition-colors">
              <HelpCircle size={16} />
              Help & Support
            </button>
          </nav>
          
          <div className="mt-4 px-3 py-3 bg-bg-accent rounded-sm border border-border-neutral flex flex-col gap-1">
            <span className="text-[10px] uppercase font-bold tracking-widest text-ink-body/50">Current Entity</span>
            <span className="text-xs font-semibold truncate">Caledon Holdings Ltd</span>
            <span className="text-[10px] font-mono text-ink-body/50 mt-1 flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-accent-forest" /> Target: IE/EU
            </span>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="h-16 bg-bg-base border-b border-border-neutral flex items-center justify-between px-6 lg:px-10 flex-shrink-0">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold tracking-tight">Initiate Legal Matter</h1>
            <span className="px-2 py-0.5 border border-border-neutral bg-bg-accent text-[10px] font-bold uppercase tracking-widest rounded-sm text-ink-body/60">Self-Serve Portal</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-body/40" size={14} />
              <input 
                type="text" 
                placeholder="Search matters by ID..." 
                className="pl-9 pr-4 py-1.5 text-sm bg-bg-accent border border-border-neutral focus:outline-none focus:border-ink-bold focus:ring-1 focus:ring-ink-bold transition-shadow rounded-sm w-64"
              />
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-6 lg:px-10 py-8">
            <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-start">
              
              <div className="flex-1 w-full min-w-0 space-y-8">
                <section className="bg-bg-base p-6 lg:p-8 rounded-sm border border-border-neutral shadow-sm">
                  <div className="mb-6 flex items-baseline justify-between border-b border-border-neutral pb-4">
                    <h2 className="text-xl font-semibold">1. Select Matter Category</h2>
                    <span className="text-xs font-mono text-ink-body/50">Required</span>
                  </div>

                  <div className="space-y-8">
                    {PRICING_TIERS.map(tier => (
                      <div key={tier.category}>
                        <h3 className="text-[11px] font-bold uppercase tracking-[0.15em] text-ink-body/60 mb-3">{tier.category}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {tier.items.map(item => (
                            <button
                              key={item.id}
                              onClick={() => setSelectedServiceId(item.id)}
                              className={`text-left p-4 rounded-sm border transition-all ${selectedServiceId === item.id ? 'border-accent-forest bg-accent-forest/5 ring-1 ring-accent-forest' : 'border-border-neutral bg-bg-base hover:border-ink-body/30'}`}
                            >
                              <div className="flex justify-between items-start mb-2">
                                <span className={`text-sm font-medium ${selectedServiceId === item.id ? 'text-accent-forest' : 'text-ink-body'}`}>{item.name}</span>
                                {selectedServiceId === item.id && <CheckCircle2 size={16} className="text-accent-forest" />}
                              </div>
                              <div className="flex items-baseline gap-1 mt-auto pt-2">
                                <span className="text-lg font-mono font-medium">€{item.price}</span>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-ink-body/50">
                                  {item.type === 'yearly' ? 'per year' : 'fixed fee'}
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className={`bg-bg-base p-6 lg:p-8 rounded-sm border transition-colors shadow-sm ${!selectedService ? 'opacity-50 border-border-neutral pointer-events-none' : 'border-border-neutral'}`}>
                  <div className="mb-6 flex items-baseline justify-between border-b border-border-neutral pb-4">
                    <h2 className="text-xl font-semibold">2. Accelerators & Options</h2>
                    <span className="text-xs font-mono text-ink-body/50">Optional</span>
                  </div>

                  <div className="space-y-3">
                    {SURCHARGES.map(surcharge => (
                      <label 
                        key={surcharge.id}
                        className={`flex items-center justify-between p-4 border rounded-sm cursor-pointer transition-colors ${selectedSurcharges[surcharge.id] ? 'bg-bg-accent border-ink-bold/30' : 'bg-bg-base border-border-neutral hover:bg-bg-accent/50'}`}
                      >
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={selectedSurcharges[surcharge.id] || false}
                          onChange={() => toggleSurcharge(surcharge.id)}
                        />
                        <div className="flex items-center gap-3">
                          <div className={`w-4 h-4 rounded-sm border flex items-center justify-center ${selectedSurcharges[surcharge.id] ? 'bg-ink-bold border-ink-bold' : 'border-ink-body/30 bg-bg-base'}`}>
                            {selectedSurcharges[surcharge.id] && <CheckCircle2 size={12} className="text-bg-base" />}
                          </div>
                          <span className="text-sm font-medium">{surcharge.name}</span>
                        </div>
                        <span className="text-sm font-mono">+€{surcharge.price}</span>
                      </label>
                    ))}
                  </div>
                  
                  <div className="mt-6 bg-amber-50 border border-amber-200/50 p-4 rounded-sm flex items-start gap-3 text-amber-900">
                    <Info size={16} className="shrink-0 mt-0.5" />
                    <p className="text-xs leading-relaxed">
                      Custom modifications or failure to provide accurate initial documentation may incur automatic <span className="font-semibold">Complexity Penalties</span> (€30 - €50). By proceeding, you accept our standard deterministic protocol.
                    </p>
                  </div>
                </section>

              </div>

              <div className="w-full lg:w-80 flex-shrink-0">
                <div className="sticky top-8 space-y-6">
                  
                  <div className="bg-bg-base border border-border-neutral rounded-sm shadow-sm overflow-hidden flex flex-col">
                    <div className="p-5 border-b border-border-neutral bg-bg-accent">
                      <h3 className="text-[11px] font-bold uppercase tracking-[0.1em]">Cost Breakdown</h3>
                    </div>
                    
                    <div className="p-5 flex-1 min-h-[150px]">
                      {!selectedService ? (
                        <div className="h-full flex flex-col items-center justify-center text-ink-body/40">
                          <FileText size={24} className="mb-2 opacity-50" />
                          <span className="text-xs">Select a matter to begin</span>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="flex justify-between items-start text-sm">
                            <span className="font-medium pr-4">{selectedService.name}</span>
                            <span className="font-mono">€{selectedService.price}</span>
                          </div>
                          
                          {Object.entries(selectedSurcharges).filter(([_, selected]) => selected).map(([id]) => {
                            const sc = SURCHARGES.find(s => s.id === id)!;
                            return (
                              <div key={id} className="flex justify-between items-start text-sm text-ink-body/70">
                                <span>{sc.name}</span>
                                <span className="font-mono">+€{sc.price}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    
                    <div className="p-5 border-t border-border-neutral bg-bg-accent">
                      <div className="flex justify-between items-end mb-6">
                        <span className="text-xs font-bold uppercase tracking-widest text-ink-body/60">Total (ex. VAT)</span>
                        <div className="text-right">
                          <span className="block text-2xl font-mono font-medium">
                            €{calculateTotal().toFixed(2)}
                          </span>
                        </div>
                      </div>
                      
                      <button 
                        disabled={!selectedService}
                        className={`w-full py-3.5 text-sm font-bold uppercase tracking-widest rounded-sm transition-all flex justify-center items-center gap-2 ${selectedService ? 'bg-accent-forest text-white hover:bg-accent-hover shadow-sm' : 'bg-border-neutral text-ink-body/30 cursor-not-allowed'}`}
                      >
                        Proceed to Verification
                        <ArrowRight size={16} />
                      </button>
                      <p className="text-center text-[10px] uppercase font-bold tracking-widest text-ink-body/40 mt-4">
                        Secure SSL Connection
                      </p>
                    </div>
                  </div>

                  <div className="bg-bg-base border border-border-neutral rounded-sm p-5 space-y-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      <Shield size={16} className="text-accent-forest" />
                      <span className="text-xs font-semibold uppercase tracking-widest">Compliance</span>
                    </div>
                    <ul className="space-y-3">
                      <li className="flex items-start gap-2 text-xs text-ink-body/70">
                        <CheckCircle2 size={14} className="text-accent-forest shrink-0 mt-0.5" />
                        <span>Regulated by the Law Society of Ireland</span>
                      </li>
                      <li className="flex items-start gap-2 text-xs text-ink-body/70">
                        <CheckCircle2 size={14} className="text-accent-forest shrink-0 mt-0.5" />
                        <span>Data held physically in EU-West (Dublin)</span>
                      </li>
                      <li className="flex items-start gap-2 text-xs text-ink-body/70">
                        <CheckCircle2 size={14} className="text-accent-forest shrink-0 mt-0.5" />
                        <span>DFA Apostille Ready Documents</span>
                      </li>
                    </ul>
                  </div>

                </div>
              </div>

            </div>
          </div>
         </div>
      </main>
    </div>
  );
}
