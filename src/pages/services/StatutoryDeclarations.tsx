import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, CheckCircle2, Shield, AlertCircle, FileText, ChevronRight, CornerDownRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function StatutoryDeclarations() {
  const [step, setStep] = useState(1);
  const [purpose, setPurpose] = useState<string | null>(null);
  const [hasDraft, setHasDraft] = useState<boolean | null>(null);

  const getRecommendation = () => {
    if (purpose === 'complex' || (purpose === 'property' && !hasDraft)) {
      return {
        title: "Requires Traditional Solicitor",
        description: "Your matter requires bespoke legal drafting or complex judgment. We cannot process this under our deterministic protocol.",
        canProceed: false
      };
    }
    return {
      title: "Eligible for Processing",
      description: "Based on your inputs, this fits our standard processing parameters. We can witness and execute this today.",
      canProceed: true,
      price: 39
    };
  };

  const handleReset = () => {
    setStep(1);
    setPurpose(null);
    setHasDraft(null);
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
            Statutory Declaration Wizard
          </h1>
          <p className="text-lg opacity-70 leading-relaxed">
            Determine eligibility for our express witnessing service. By defining exact parameters upfront, we guarantee immediate processing without consultation fees.
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
                <h3 className="text-xl font-medium mb-6">What is the purpose of the declaration?</h3>
                <div className="space-y-3">
                  {[
                    { id: 'passport', label: 'Passport / Identity Loss' },
                    { id: 'marital', label: 'Freedom to Marry' },
                    { id: 'property', label: 'Property / Boundary (Family Home Protection)' },
                    { id: 'complex', label: 'Contested Legal Matter / Evidence' }
                  ].map(option => (
                    <button
                      key={option.id}
                      onClick={() => {
                        setPurpose(option.id);
                        setStep(option.id === 'complex' ? 3 : 2);
                      }}
                      className="w-full text-left p-4 border border-border-neutral bg-bg-base hover:border-ink-bold transition-colors rounded-sm flex justify-between items-center group"
                    >
                      <span className="font-medium">{option.label}</span>
                      <ArrowRight size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step-2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <h3 className="text-xl font-medium mb-6">Do you have a pre-drafted document?</h3>
                <p className="text-sm opacity-70 mb-6 -mt-2">
                  Some institutions provide a template. If not, we have standard DFA-compliant templates available.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    onClick={() => {
                      setHasDraft(true);
                      setStep(3);
                    }}
                    className="p-6 border border-border-neutral bg-bg-base hover:border-ink-bold transition-colors rounded-sm text-left flex flex-col gap-4"
                  >
                    <FileText size={24} className="text-accent-forest" />
                    <span className="font-medium">Yes, I have the drafted form</span>
                  </button>
                  <button
                    onClick={() => {
                      setHasDraft(false);
                      setStep(3);
                    }}
                    className="p-6 border border-border-neutral bg-bg-base hover:border-ink-bold transition-colors rounded-sm text-left flex flex-col gap-4"
                  >
                    <CornerDownRight size={24} className="text-ink-bold opacity-40" />
                    <span className="font-medium">No, I need a template generated</span>
                  </button>
                </div>
                <button 
                  onClick={() => setStep(1)}
                  className="mt-8 text-sm font-medium opacity-60 hover:opacity-100"
                >
                  ← Back to previous question
                </button>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step-3"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                {getRecommendation().canProceed ? (
                  <div className="space-y-6">
                    <div className="h-12 w-12 rounded-full border-2 border-accent-forest text-accent-forest grid place-items-center mb-6">
                      <CheckCircle2 size={24} />
                    </div>
                    <h3 className="text-2xl font-medium text-ink-bold">{getRecommendation().title}</h3>
                    <p className="text-lg opacity-70">{getRecommendation().description}</p>
                    
                    <div className="p-4 bg-bg-base border border-border-neutral rounded-sm flex justify-between items-center mt-6">
                      <span className="font-medium">Fixed Fee</span>
                      <span className="font-mono text-xl">€{getRecommendation().price}</span>
                    </div>

                    <div className="pt-6">
                      <Link to="/app" className="block w-full text-center bg-accent-forest text-bg-base text-sm font-bold uppercase tracking-widest py-4 rounded-sm hover:bg-accent-hover transition-colors">
                        Proceed to Booking
                      </Link>
                      <button onClick={handleReset} className="w-full mt-4 text-[11px] font-bold uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity">
                        Start Over
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                     <div className="h-12 w-12 rounded-full border-2 border-red-500 text-red-500 grid place-items-center mb-6">
                      <AlertCircle size={24} />
                    </div>
                    <h3 className="text-2xl font-medium text-ink-bold">{getRecommendation().title}</h3>
                    <p className="text-lg opacity-70">{getRecommendation().description}</p>
                    
                    <div className="p-4 border border-red-500/20 bg-red-500/5 rounded-sm mt-6 text-sm text-red-900 leading-relaxed">
                      Our model relies on operational predictability. Matters requiring custom legal drafting on complex facts fall outside our risk perimeter. We decline this instruction without charge.
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
