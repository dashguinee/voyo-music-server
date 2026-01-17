/**
 * DASH Auth - Universal Authentication for DASH Ecosystem
 * Connect to Command Center for DASH ID + PIN login
 *
 * Usage:
 *   import { DashAuthBadge, signInWithDashId, useDashCitizen } from './lib/dash-auth';
 *   <DashAuthBadge productCode="V" /> // Shows "V00AAD" when logged in
 */

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Command Center Supabase - THE source of truth
const COMMAND_CENTER_URL = 'https://mclbbkmpovnvcfmwsoqt.supabase.co';
const COMMAND_CENTER_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jbGJia21wb3ZudmNmbXdzb3F0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY2MjMxNTMsImV4cCI6MjA1MjE5OTE1M30.vEuCNf0xCB1TvsSF9DxN3ZJxPMZk0rD5N4X-4rHv3TI';
const commandCenter = createClient(COMMAND_CENTER_URL, COMMAND_CENTER_ANON_KEY);

// Product codes for the DASH ecosystem
type ProductCode = 'E' | 'DC' | 'V' | 'TV' | 'AMP' | 'AME' | 'DF' | 'DT' | 'DH' | 'N';

// Storage key for session persistence
const STORAGE_KEY = 'dash_citizen_storage';

export interface DashUser {
  core_id: string;
  full_name: string;
  phone?: string;
  role: string;
  country_code?: string;
}

export interface DashSession {
  user: DashUser;
  displayId: string;  // e.g., "V00AAD" for VOYO
}

/**
 * Sign in with DASH ID + PIN via Command Center
 */
export async function signInWithDashId(
  coreId: string,
  pin: string,
  productCode: string = 'V'
): Promise<{ success: boolean; session?: DashSession; error?: string }> {
  try {
    const { data, error } = await commandCenter.rpc('sign_in_with_passcode', {
      p_core_id: coreId.toUpperCase(),
      p_passcode: pin
    });

    if (error) {
      console.error('[DASH Auth] Sign in error:', error);
      return { success: false, error: error.message };
    }

    if (!data.success) {
      return { success: false, error: data.error };
    }

    const user: DashUser = {
      core_id: data.user.core_id,
      full_name: data.user.full_name,
      phone: data.user.phone,
      role: data.user.role,
      country_code: data.user.country_code,
    };

    const session: DashSession = {
      user,
      displayId: `${productCode}${user.core_id}`,
    };

    // Save to localStorage for persistence
    const storageData = {
      state: {
        citizen: {
          coreId: user.core_id,
          fullName: user.full_name,
          phone: user.phone,
          countryCode: user.country_code || 'GN',
          isActivated: true,
          role: user.role,
        },
        isAuthenticated: true,
      },
      version: 0
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storageData));

    return { success: true, session };
  } catch (e) {
    console.error('[DASH Auth] Connection error:', e);
    return { success: false, error: 'Connection failed' };
  }
}

/**
 * Get current DASH session from localStorage
 */
export function getDashSession(productCode: string = 'V'): DashSession | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const data = JSON.parse(stored);
    if (!data.state?.citizen || !data.state?.isAuthenticated) return null;

    const citizen = data.state.citizen;
    return {
      user: {
        core_id: citizen.coreId,
        full_name: citizen.fullName,
        phone: citizen.phone,
        role: citizen.role || 'user',
        country_code: citizen.countryCode,
      },
      displayId: `${productCode}${citizen.coreId}`,
    };
  } catch {
    return null;
  }
}

/**
 * Sign out - clear DASH session
 */
export function signOutDash(): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      data.state.isAuthenticated = false;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  } catch {
    // Ignore
  }
}

/**
 * Check if user is authenticated
 */
export function isDashAuthenticated(): boolean {
  return getDashSession() !== null;
}

interface CitizenSession {
  coreId: string;         // "0046AAD"
  displayId: string;      // "E0046AAD" (with product prefix)
  fullName: string;
  initials: string;
  sequence: number;
}

interface DashAuthBadgeProps {
  productCode: ProductCode;
  className?: string;
  showName?: boolean;
  onClick?: () => void;
}

// Product metadata - matches actual brand colors
const PRODUCTS: Record<ProductCode, { name: string; color: string }> = {
  'E': { name: 'Dash Edu', color: '#10b981' },       // Emerald
  'DC': { name: 'DaClub', color: '#06b6d4' },        // Cyan
  'V': { name: 'VOYO', color: '#8b5cf6' },           // Purple
  'TV': { name: 'TV+', color: '#9D4EDD' },           // Violet
  'AMP': { name: 'Aftermeet Pro', color: '#8b5cf6' }, // Violet (Meetel, Presento)
  'AME': { name: 'Aftermeet Edu', color: '#a855f7' }, // Purple (Edutel, Graspit)
  'DF': { name: 'Dash Fashion', color: '#FF0099' },  // Hot Pink
  'DT': { name: 'Dash Travel', color: '#FF7900' },   // Orange
  'DH': { name: 'Dash Hub', color: '#FF7900' },      // Orange
  'N': { name: 'Neva', color: '#64748b' },           // Slate
};

/**
 * Get current citizen from Command Center storage
 */
function getCitizen(productCode: ProductCode): CitizenSession | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const data = JSON.parse(stored);
    if (!data.state?.citizen || !data.state?.isAuthenticated) return null;

    const citizen = data.state.citizen;
    const initials = citizen.initials || citizen.fullName?.split(' ').map((n: string) => n[0]?.toUpperCase() || '').join('') || '';
    return {
      coreId: citizen.coreId,
      displayId: `${productCode}${citizen.coreId}`,
      fullName: citizen.fullName,
      initials,
      sequence: citizen.sequence || parseInt(citizen.coreId?.match(/\d+/)?.[0] || '0'),
    };
  } catch {
    return null;
  }
}

/**
 * DASH Auth Badge Component
 * Shows citizen ID with product prefix in the app's header
 */
export function DashAuthBadge({
  productCode,
  className = '',
  showName = false,
  onClick,
}: DashAuthBadgeProps) {
  const [citizen, setCitizen] = useState<CitizenSession | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const product = PRODUCTS[productCode];

  useEffect(() => {
    // Initial load
    setCitizen(getCitizen(productCode));

    // Listen for changes (cross-tab sync)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setCitizen(getCitizen(productCode));
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [productCode]);

  // Not logged in - show login prompt
  if (!citizen) {
    return (
      <button
        onClick={() => window.open('https://hub.dasuperhub.com', '_blank')}
        className={`
          px-3 py-1.5 rounded-full text-xs font-medium
          bg-white/5 hover:bg-white/10 border border-white/10
          transition-all cursor-pointer flex items-center gap-2
          ${className}
        `}
        style={{ color: product.color }}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
        <span>Sign in</span>
      </button>
    );
  }

  // Logged in - show citizen ID
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
        px-3 py-1.5 rounded-full text-xs font-mono font-bold
        border transition-all cursor-pointer flex items-center gap-2
        ${className}
      `}
      style={{
        background: isHovered ? `${product.color}20` : `${product.color}10`,
        borderColor: `${product.color}30`,
        color: product.color,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full animate-pulse"
        style={{ background: product.color }}
      />
      <span>{citizen.displayId}</span>
      {showName && (
        <span className="text-white/40 font-normal">
          {citizen.fullName.split(' ')[0]}
        </span>
      )}
    </button>
  );
}

/**
 * Hook for accessing citizen data in components
 */
export function useDashCitizen(productCode: ProductCode) {
  const [citizen, setCitizen] = useState<CitizenSession | null>(null);

  useEffect(() => {
    setCitizen(getCitizen(productCode));

    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setCitizen(getCitizen(productCode));
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [productCode]);

  return {
    citizen,
    isAuthenticated: !!citizen,
    displayId: citizen?.displayId || null,
    coreId: citizen?.coreId || null,
    openCommandCenter: () => window.open('https://hub.dasuperhub.com', '_blank'),
  };
}

/**
 * Export for standalone use
 */
export default DashAuthBadge;
