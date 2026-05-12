import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, CheckCircle2, AlertCircle, ChevronRight, HelpCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Wills() {
  const [step, setStep] = useState(1);
  const [answers, setAnswers] = useState<Record<number, boolean>>({});

  const handleAnswer = (val: boolean) => {
    setAnswers(prev => ({ ...prev, [step]: val }));
    if (step < 4) {
      setStep(s => s + 1);
    } else {
      setStep(5); // Result phase
    }
  };

  const getResult = () => {
    const hasForeignAssets = answers[2];
    const hasComplexTrusts = answers[3];
    const anticipatesContest = answers[4];

    if (hasForeignAssets || hasComplexTrusts || anticipatesContest) {
      return {
        title: "Requires Complex Tax/Trust Advice",
        description: "Your estate requires nuanced tax planning, multiple jurisdiction considerations, or advanced trust structures. We do not provide bespoke tax structuring.",
        canProceed: false
      };
    }

    return {
      title: "Standard Will Profile",
      description: "Your estate falls within standard parameters. We can cleanly draft your legacies, appoint executors, and establish straightforward guardianships.",
      canProceed: true,
      price: 99
    };
  };

  const questions = [
    {
      q: "Do you have minor children?",
      hint: "We can include standard guardianship appointments."
    },
    {
      q: "Do you hold significant assets outside of Ireland?",
      hint: "Foreign assets often require parallel wills in other jurisdictions."
    },
    {
      q: "Do you require complex discretionary trusts for beneficiaries?",
      hint: "e.g., locking assets for beneficiaries with specific vulnerabilities."
    },
    {
      q: "Have you been married previously, and anticipate a challenge to the estate?",
      hint: "Section 117 applications or prior marital agreements."
    }
  ];

  const handleReset = () => {
    setStep(1);
    setAnswers({});
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
            Will Assessment Matrix
          </h1>
          <p className="text-lg opacity-70 leading-relaxed">
            Determine if your estate requires simple distribution or complex tax structuring. 
            We only onboard clients where standard distribution applies.
          </p>
        </div>

        <div className="bg-bg-accent border border-border-neutral p-8 rounded-sm">
          <div className="flex gap-2 mb-8">
             {questions.map((_, i) => (
                <div key={i} className={`h-1 flex-1 rounded-full ${step > i + 1 ? 'bg-accent-forest' : step === i + 1 ? 'bg-ink-bold/30' : 'bg-border-neutral'}`} />
             ))}
             <div className={`h-1 flex-1 rounded-full ${step === 5 ? 'bg-accent-forest' : 'bg-border-neutral'}`} />
          </div>

          <AnimatePresence mode="wait">
            {step <= 4 && (
              <motion.div
                key={`q-${step}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <div className="flex items-start gap-4 mb-8">
                  <h3 className="text-2xl font-medium text-ink-bold">{questions[step - 1].q}</h3>
                </div>
                <div className="mb-8 p-4 bg-bg-base border border-border-neutral rounded-sm flex gap-3 text-sm opacity-80">
                  <HelpCircle size={18} className="shrink-0 text-accent-forest mt-0.5" />
                  <p>{questions[step - 1].hint}</p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    onClick={() => handleAnswer(true)}
                    className="p-5 p-y-6 border border-border-neutral bg-bg-base hover:border-ink-bold transition-colors rounded-sm font-medium text-lg"
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => handleAnswer(false)}
                    className="p-5 p-y-6 border border-border-neutral bg-bg-base hover:border-ink-bold transition-colors rounded-sm font-medium text-lg"
                  >
                    No
                  </button>
                </div>
                
                {step > 1 && (
                  <button 
                    onClick={() => setStep(s => s - 1)}
                    className="mt-8 text-sm font-medium opacity-60 hover:opacity-100"
                  >
                    ← Back
                  </button>
                )}
              </motion.div>
            )}

            {step === 5 && (
              <motion.div
                key="result"
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
                      <span className="font-medium">Fixed Fee Drafting & Execution</span>
                      <span className="font-mono text-xl">€{getResult().price}</span>
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
                      We decline this instruction. Attempting to force complex estate planning into a standard template will lead to probate failure down the line. We recommend seeking a specialist tax planner.
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
