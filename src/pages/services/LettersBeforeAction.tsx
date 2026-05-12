import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, CheckCircle2, AlertCircle, ChevronRight, FileText, Briefcase, UserX } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function LettersBeforeAction() {
  const [step, setStep] = useState(1);
  const [debtType, setDebtType] = useState<string | null>(null);

  const getResult = () => {
    if (debtType === 'disputed' || debtType === 'injury') {
      return {
        title: "Ineligible for Automated LBA",
        description: "Your matter is fundamentally contested or relies on tort outside a strict contract gap. Issuing a standard LBA here is legally reckless.",
        canProceed: false
      };
    }
    
    return {
      title: "Valid for Immediate Issue",
      description: "This is a standard undisputed commercial or contractual debt. We can issue a structurally sound Solicitor's Letter Before Action immediately.",
      canProceed: true,
      price: 145
    };
  };

  const handleReset = () => {
    setStep(1);
    setDebtType(null);
  };

  return (
    <div className="min-h-screen bg-bg-base text-ink-body pt-24 pb-32">
      <div className="max-w-3xl mx-auto px-6 lg:px-8">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium opacity-60 hover:opacity-100 transition-opacity mb-12">
          <ChevronRight className="rotate-180" size={16} />
          Back to Services
        </Link>
        
        <div className="mb-12">
          <span className="inline-block px-3 py-1 border border-border-neutral text-[10px] font-bold uppercase tracking-widest mb-6 rounded-sm bg-bg-accent">
            Interactive Protocol
          </span>
          <h1 className="text-4xl md:text-5xl font-medium tracking-tight mb-4 text-ink-bold">
            LBA Viability Decision
          </h1>
          <p className="text-lg opacity-70 leading-relaxed">
            A Letter Before Action is only effective if the debt is undisputed and properly documented. 
            Select the nature of your claim below.
          </p>
        </div>

        <div className="bg-bg-accent border border-border-neutral p-8 rounded-sm">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step-1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <h3 className="text-xl font-medium mb-6">What is the nature of the pursued debt?</h3>
                <div className="space-y-4">
                  {[
                    { id: 'b2b_unpaid', label: 'B2B Unpaid Invoice (Goods/Services Delivered)', icon: Briefcase },
                    { id: 'contract', label: 'Clear Contractual Breach (Quantifiable)', icon: FileText },
                    { id: 'disputed', label: 'Disputed Quality / Withheld Payment', icon: AlertCircle },
                    { id: 'injury', label: 'Defamation / Personal Injury Claim', icon: UserX }
                  ].map(option => {
                    const Icon = option.icon;
                    return (
                      <button
                        key={option.id}
                        onClick={() => {
                          setDebtType(option.id);
                          setStep(2);
                        }}
                        className="w-full p-4 border border-border-neutral bg-bg-base hover:border-ink-bold transition-colors rounded-sm flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 bg-bg-accent border border-border-neutral rounded-sm flex items-center justify-center group-hover:bg-ink-bold group-hover:text-bg-base transition-colors">
                            <Icon size={18} />
                          </div>
                          <span className="font-medium text-left">{option.label}</span>
                        </div>
                        <ArrowRight size={16} className="opacity-0 group-hover:opacity-100 transition-opacity mr-2" />
                      </button>
                    )
                  })}
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step-2"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                {getResult().canProceed ? (
                  <div className="space-y-6">
                    <div className="h-12 w-12 rounded-full border-2 border-accent-forest text-accent-forest grid place-items-center mb-6">
                      <CheckCircle2 size={24} />
                    </div>
                    <h3 className="text-2xl font-medium text-ink-bold">{getResult().title}</h3>
                    <p className="text-lg opacity-70">{getResult().description}</p>
                    
                    <div className="p-4 bg-bg-base border border-border-neutral rounded-sm flex justify-between items-center mt-6">
                      <span className="font-medium">Solicitor-Issued Action Letter</span>
                      <span className="font-mono text-xl">€{getResult().price}</span>
                    </div>

                    <div className="mt-4 p-4 border border-border-neutral bg-bg-base rounded-sm text-xs opacity-70 leading-relaxed">
                      We will require you to upload the unpaid invoice, proof of delivery/contract, and debtor details in the next step.
                    </div>

                    <div className="pt-6">
                      <Link to="/app" className="block w-full text-center bg-accent-forest text-bg-base text-sm font-bold uppercase tracking-widest py-4 rounded-sm hover:bg-accent-hover transition-colors">
                        Proceed to Intake Form
                      </Link>
                      <button onClick={handleReset} className="w-full mt-4 text-[11px] font-bold uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity">
                        Recalculate
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                     <div className="h-12 w-12 rounded-full border-2 border-red-500 text-red-500 grid place-items-center mb-6">
                      <AlertCircle size={24} />
                    </div>
                    <h3 className="text-2xl font-medium text-ink-bold">{getResult().title}</h3>
                    <p className="text-lg opacity-70">{getResult().description}</p>
                    
                    <div className="p-4 border border-red-500/20 bg-red-500/5 rounded-sm mt-6 text-sm text-red-900 leading-relaxed">
                      We strictly decline action on disputed matters or torts. Issuing an LBA for a disputed claim involves strategic legal maneuvering that requires a traditional hourly-rate litigator.
                    </div>
                    
                    <button onClick={handleReset} className="mt-8 text-sm font-medium opacity-60 hover:opacity-100">
                      ← Start Over
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>
    </div>
  );
}
