import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNaira(amountKobo: number | bigint): string {
  const kobo = typeof amountKobo === 'bigint' ? Number(amountKobo) : amountKobo;
  const naira = kobo / 100;
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(naira).replace('NGN', '₦');
}

export function formatNairaPlain(nairaAmount: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(nairaAmount).replace('NGN', '₦');
}

export function generateRef(prefix: string = 'TT'): string {
  const cleanPrefix = prefix.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `${cleanPrefix}${timestamp}${random}`;
}

export const DEFAULT_TASK_INSTRUCTIONS =
  'click on the link and open on your temu app, make sure to accept invite link, then come back to submit task details, temu name and email for verification, if you are a pro user you can submit as many temu name and email as posible for verification and get reward if they all completed the task';

export function parseTaskTitleAndInstructions(
  rawTitle: string | null | undefined
): { title: string; instructions: string; durationHours?: number; expiresAt?: string } {
  if (!rawTitle) {
    return { title: 'Temu Invitation Task', instructions: DEFAULT_TASK_INSTRUCTIONS };
  }
  if (rawTitle.includes('|||')) {
    const parts = rawTitle.split('|||');
    const t = parts[0]?.trim() || 'Temu Invitation Task';
    const inst = parts[1]?.trim() || DEFAULT_TASK_INSTRUCTIONS;
    const dur = parts[2] ? parseInt(parts[2].trim(), 10) : undefined;
    const exp = parts[3]?.trim() || undefined;

    return {
      title: t,
      instructions: inst,
      durationHours: dur && !isNaN(dur) ? dur : undefined,
      expiresAt: exp,
    };
  }
  return { title: rawTitle.trim(), instructions: DEFAULT_TASK_INSTRUCTIONS };
}
