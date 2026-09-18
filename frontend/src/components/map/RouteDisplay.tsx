'use client';

import React, { useState } from 'react';
import { Navigation, Clock, StopCircle, CreditCard, ArrowRight, CornerUpRight, MoveUp, ChevronRight, ChevronLeft, MapPin } from 'lucide-react';
import { RouteCalculationResult, Customer } from '@/types';
import { formatCurrency } from '@/utils/formatters';

interface RouteDisplayProps {
  route: RouteCalculationResult | null;
  customer: Customer;
  officerCoords?: { latitude: number; longitude: number } | null;
  onStopNavigation: () => void;
  onCollectPayment: (customer?: Customer) => void;
}

export default function RouteDisplay({
  route,
  customer,
  officerCoords,
  onStopNavigation,
  onCollectPayment,
}: RouteDisplayProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  if (!route) return null;

  const steps = route.steps && route.steps.length > 0 ? route.steps : [
    {
      instruction: 'Proceed straight to electricity meter location',
      distance_text: route.distance_text,
      duration_text: route.duration_text,
    }
  ];

  const currentStep = steps[currentStepIndex] || steps[0];

  const handleNextStep = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    }
  };

  const handlePrevStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  return (
    <div className="fixed top-20 left-4 right-4 md:left-auto md:right-6 md:w-96 z-40 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden text-slate-900 animate-slide-up">
      {/* Top Navigation Banner (Navy Header Bar) */}
      <div className="bg-slate-900 px-4 py-2.5 flex items-center justify-between text-white shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-blue-600 flex items-center justify-center text-white">
            <CornerUpRight className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-300">In-App GPS Navigation</p>
            <p className="text-base font-bold tracking-tight">{route.distance_text}</p>
          </div>
        </div>

        <button
          onClick={onStopNavigation}
          className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs border border-slate-700 flex items-center gap-1 transition-colors"
        >
          <StopCircle className="w-3.5 h-3.5" />
          <span>Exit</span>
        </button>
      </div>

      <div className="p-3.5 space-y-3">
        {/* Turn-by-Turn Instruction Step Navigator */}
        <div className="bg-slate-50 p-3 rounded-md border border-slate-200 space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <MoveUp className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">
                Step {currentStepIndex + 1} of {steps.length}
              </span>
            </div>
            {steps.length > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={handlePrevStep}
                  disabled={currentStepIndex === 0}
                  className="p-1 rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title="Previous Step"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleNextStep}
                  disabled={currentStepIndex === steps.length - 1}
                  className="p-1 rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title="Next Step"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
          <p className="font-semibold text-slate-900 text-xs leading-relaxed">{currentStep.instruction}</p>
          {(currentStep.distance_text || currentStep.duration_text) && (
            <p className="text-[10px] text-slate-500 font-medium">
              {currentStep.distance_text} • {currentStep.duration_text}
            </p>
          )}
        </div>

        {/* Destination Summary & ETA */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-slate-50 p-2.5 rounded-md border border-slate-200">
            <p className="text-[10px] text-slate-500 font-semibold uppercase">Consumer</p>
            <p className="font-bold text-slate-900 line-clamp-1">{customer.name}</p>
            <p className="text-[10px] text-amber-700 font-bold mt-0.5">{formatCurrency(customer.pending_amount)}</p>
          </div>

          <div className="bg-slate-50 p-2.5 rounded-md border border-slate-200">
            <p className="text-[10px] text-slate-500 font-semibold uppercase">Est. Travel</p>
            <p className="font-bold text-emerald-700">{route.duration_text}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Meter #{customer.meter_number}</p>
          </div>
        </div>

        {/* Primary Action Button */}
        <div className="pt-0.5">
          <button
            onClick={() => onCollectPayment(customer)}
            className="w-full py-2.5 px-4 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs flex items-center justify-center gap-2 transition-colors text-center"
          >
            <CreditCard className="w-4 h-4" />
            <span>Collect Payment ({formatCurrency(customer.pending_amount)})</span>
          </button>
        </div>
      </div>
    </div>
  );
}

