import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Calculator, ChevronRight, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function SmeDebtCollection() {
  const [invoiceAmount, setInvoiceAmount] = useState<number>(5000);
  const [daysLate, setDaysLate] = useState<number>(45);

  // Late Payment in Commercial Transactions Regulations 2012 (Ireland)
  const calculateCompensation = (amount: number) => {
    if (amount <= 1000) return 40;
    if (amount <= 10000) return 70;
    return 100;
  };

  const calculateInterest = (amount: number, days: number) => {
    // Current ECB rate (approx 4%) + 8% statutory penalty = 12% annual
    const annualRate = 0.12; 
    const dailyRate = annualRate / 365;
    return amount * dailyRate * days;
  };

  const compensation = calculateCompensation(invoiceAmount);
  const interest = calculateInterest(invoiceAmount, daysLate);
  const totalClaim = invoiceAmount + compensation + interest;

  // LBA standard fixed fee
  const lbaCost = 145;

  return (
    <div className="min-h-screen bg-bg-base text-ink-body pt-24 pb-32">
      <div className="max-w-4xl mx-auto px-6 lg:px-8">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium opacity-60 hover:opacity-100 transition-opacity mb-12">
          <ChevronRight className="rotate-180" size={16} />
          Back to Services
        </Link>
        
        <div className="mb-12">
          <span className="inline-block px-3 py-1 border border-border-neutral text-[10px] font-bold uppercase tracking-widest mb-6 rounded-sm bg-bg-accent">
            ROI Calculator
          </span>
          <h1 className="text-4xl md:text-5xl font-medium tracking-tight mb-4 text-ink-bold">
            SME Statutory Penalty Calculator
          </h1>
          <p className="text-lg opacity-70 leading-relaxed max-w-2xl">
            Under EU Late Payment Directives, you have a statutory right to claim interest and compensation on B2B debt. Calculate your exact legal entitlement below alongside our fixed cost to issue.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Controls */}
          <div className="p-8 border border-border-neutral bg-bg-accent rounded-sm space-y-8">
            <div>
              <label className="flex justify-between items-center mb-4">
                <span className="font-medium">Principal Invoice Amount</span>
                <span className="font-mono text-xl text-accent-forest">€{invoiceAmount.toLocaleString()}</span>
              </label>
              <input 
                type="range" 
                min="500" 
                max="50000" 
                step="500"
                value={invoiceAmount} 
                onChange={(e) => setInvoiceAmount(Number(e.target.value))}
                className="w-full accent-ink-bold"
              />
              <div className="flex justify-between text-xs opacity-40 mt-2 font-mono">
                <span>€500</span>
                <span>€50k+</span>
              </div>
            </div>

            <div>
              <label className="flex justify-between items-center mb-4">
                <span className="font-medium">Days Overdue</span>
                <span className="font-mono text-xl text-accent-forest">{daysLate} days</span>
              </label>
              <input 
                type="range" 
                min="1" 
                max="365" 
                value={daysLate} 
                onChange={(e) => setDaysLate(Number(e.target.value))}
                className="w-full accent-ink-bold"
              />
              <div className="flex justify-between text-xs opacity-40 mt-2 font-mono">
                <span>1 day</span>
                <span>1 year</span>
              </div>
            </div>
            
            <div className="mt-8 p-4 bg-bg-base border border-border-neutral text-xs leading-relaxed opacity-70">
              Assumes an ECB reference rate of 4.00%. The statutory interest penalty is ECB + 8%.
            </div>
          </div>

          {/* Results */}
          <div className="space-y-6">
            <div className="p-8 border border-border-neutral bg-bg-base rounded-sm shadow-sm">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.15em] mb-6 opacity-50">Statutory Entitlement</h3>
              
              <div className="space-y-4 mb-6">
                <div className="flex justify-between items-center pb-4 border-b border-border-neutral/50">
                  <span className="text-sm">Principal Debt</span>
                  <span className="font-mono font-medium">€{invoiceAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center pb-4 border-b border-border-neutral/50">
                  <span className="text-sm">Statutory Interest (12% p.a.)</span>
                  <span className="font-mono font-medium text-accent-forest">+€{interest.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center pb-4 border-b border-border-neutral/50">
                  <span className="text-sm">Fixed EU Compensation</span>
                  <span className="font-mono font-medium text-accent-forest">+€{compensation.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex justify-between items-end mb-8 pt-4">
                <span className="font-semibold text-lg">Total Claim Value</span>
                <span className="font-mono text-3xl font-medium text-ink-bold">€{totalClaim.toFixed(2)}</span>
              </div>

              <div className="bg-bg-accent p-5 rounded-sm border border-border-neutral flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Calculator size={16} />
                    <span className="text-sm font-medium">Veritas Fixed Fee (LBA)</span>
                  </div>
                  <span className="font-mono font-bold text-ink-bold">€{lbaCost.toFixed(2)}</span>
                </div>
                
                {/* ROI Logic */}
                {totalClaim - invoiceAmount > lbaCost ? (
                  <p className="text-xs text-accent-forest font-medium border-t border-border-neutral pt-4">
                    The statutory penalties cover your legal costs entirely. You will net a profit on the recovery.
                  </p>
                ) : (
                  <p className="text-xs opacity-60 border-t border-border-neutral pt-4">
                    Statutory claim offsets {((((totalClaim - invoiceAmount)/lbaCost)*100)).toFixed(0)}% of your legal costs.
                  </p>
                )}
              </div>
            </div>

            <Link to="/services/letters-before-action" className="w-full bg-ink-bold text-bg-base p-5 flex justify-between items-center hover:bg-ink-body transition-colors rounded-sm group">
              <span className="text-sm font-bold uppercase tracking-widest">Verify LBA Eligibility</span>
              <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
