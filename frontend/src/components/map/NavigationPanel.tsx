'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Navigation,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Volume2,
  VolumeX,
  Minimize2,
  Maximize2,
  ArrowUp,
  ArrowRight,
  MapPin,
} from 'lucide-react';
import { NavigationState, Customer, MultiRouteCalculationResult } from '@/types';
import { speakInstruction, stopSpeech } from '@/utils/speech';

interface NavigationPanelProps {
  navState: NavigationState;
  onExitNavigation: () => void;
  onCollectPayment?: (customer?: Customer) => void;
  onRecalculateRoute?: () => void;
  isMuted?: boolean;
  onToggleMute?: () => void;
  multiRoute?: MultiRouteCalculationResult | null;
  currentStopIndex?: number;
  onSelectStopIndex?: (index: number) => void;
}

// Pure helper — determines direction arrow icon from instruction text
function getDirectionIcon(instruction: string) {
  const lower = instruction.toLowerCase();
  if (lower.includes('right')) return <ArrowRight className="w-7 h-7 text-white" />;
  if (lower.includes('left')) return <ArrowRight className="w-7 h-7 text-white transform scale-x-[-1]" />;
  if (lower.includes('u-turn')) return <ArrowLeft className="w-7 h-7 text-white" />;
  return <ArrowUp className="w-7 h-7 text-white" />;
}

export default function NavigationPanel({
  navState,
  onExitNavigation,
  onCollectPayment,
  onRecalculateRoute,
  isMuted: isMutedProp,
  onToggleMute,
  multiRoute,
  currentStopIndex = 0,
  onSelectStopIndex,
}: NavigationPanelProps) {
  // Use external mute state if provided, otherwise manage internally
  const [isMutedInternal, setIsMutedInternal] = useState<boolean>(false);
  const isMuted = isMutedProp !== undefined ? isMutedProp : isMutedInternal;
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const prevInstructionRef = useRef<string>('');

  const target = navState.targetCustomer;
  const currentInstruction = target
    ? navState.currentStepInstruction || `Proceed along main road towards consumer meter`
    : '';

  const handleToggleMute = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (onToggleMute) {
      // Controlled from outside (MapControls)
      onToggleMute();
    } else {
      setIsMutedInternal((prev) => {
        const next = !prev;
        if (next) {
          stopSpeech();
        } else if (target?.name) {
          speakInstruction(target.name, isMuted);
        }
        return next;
      });
    }
  };

  // ── ALL HOOKS BEFORE ANY CONDITIONAL RETURN ──────────────────────────────

  // Audio: speak live navigation instructions including customer name
  const prevAudioTextRef = useRef<string>('');
  useEffect(() => {
    if (!navState.active || !target?.name || !currentInstruction) return;
    const fullAudioText = `Navigating to ${target.name}. ${currentInstruction}`;
    if (fullAudioText !== prevAudioTextRef.current) {
      prevAudioTextRef.current = fullAudioText;
      speakInstruction(fullAudioText, isMuted);
    }
  }, [target?.name, currentInstruction, navState.active, isMuted]);

  // Audio: announce off-route alert
  useEffect(() => {
    if (navState.isOffRoute && navState.active && target?.name) {
      speakInstruction(`You are off route navigating to ${target.name}. Recalculating path.`, isMuted);
    }
  }, [navState.isOffRoute, navState.active, target?.name, isMuted]);

  // ── CONDITIONAL RETURNS AFTER ALL HOOKS ──────────────────────────────────

  if (!navState.active || !target) return null;

  // Minimized pill view
  if (isMinimized) {
    return (
      <div className="absolute top-4 left-4 z-40 animate-fade-in">
        <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-full px-3.5 py-2 shadow-2xl flex items-center gap-3 text-white">
          <button
            onClick={() => setIsMinimized(false)}
            className="w-8 h-8 rounded-full bg-sky-600 flex items-center justify-center text-white shrink-0 shadow-xs hover:bg-sky-500 transition-colors"
            title="Expand Navigation Panel"
          >
            <Navigation className="w-4 h-4 fill-white stroke-none transform rotate-45" />
          </button>

          <div onClick={() => setIsMinimized(false)} className="cursor-pointer flex items-center gap-2">
            <span className="text-sm font-black text-sky-400">
              {navState.durationText || 'Calculating...'}
            </span>
            <span className="text-xs text-slate-400 font-semibold">
              ({navState.distanceText})
            </span>
          </div>

          <button
            onClick={handleToggleMute}
            className={`p-1.5 rounded-full border transition-colors cursor-pointer ${
              isMuted
                ? 'bg-slate-800 text-rose-400 border-slate-700 hover:bg-slate-700'
                : 'bg-blue-600/30 text-sky-300 border-blue-500/40 hover:bg-blue-600/50'
            }`}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={() => setIsMinimized(false)}
            className="p-1.5 rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700 transition-colors"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // All UI elements from Image 1 removed — only returning null while keeping background speech instructions active
  return null;
}

