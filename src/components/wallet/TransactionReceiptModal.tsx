'use client';

import React, { useRef, useState } from 'react';
import { toPng, toBlob } from 'html-to-image';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';
import { formatNaira } from '@/lib/utils';
import {
  CheckCircle2,
  Download,
  Share2,
  Copy,
  Check,
  X,
  ExternalLink,
  Smartphone,
  ShieldCheck,
  ArrowDownLeft,
  ArrowUpRight,
  Sparkles,
  Wallet,
  Receipt,
  Image as ImageIcon,
} from 'lucide-react';

export interface TransactionReceiptData {
  id?: string;
  reference: string;
  description: string;
  transactionType: string;
  direction: 'credit' | 'debit';
  amountKobo: number | bigint;
  date: string;
  balanceAfterKobo?: number | bigint;
  status?: string;
  metadata?: any;
}

interface TransactionReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  tx: TransactionReceiptData | null;
  onRechargeAnother?: () => void;
}

export const TransactionReceiptModal: React.FC<TransactionReceiptModalProps> = ({
  isOpen,
  onClose,
  tx,
  onRechargeAnother,
}) => {
  const [copied, setCopied] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !tx) return null;

  // Extract smart details based on transaction type and description
  const parseDetails = () => {
    const desc = tx.description || '';
    const type = tx.transactionType || '';

    // Airtime
    if (type.includes('airtime') || desc.toLowerCase().includes('airtime')) {
      const netMatch = desc.match(/(MTN|AIRTEL|GLO|9MOBILE)/i);
      const phoneMatch = desc.match(/(?:0|234)\d{10}/);
      const feeMatch = desc.match(/₦(\d+)\s*\+\s*₦(\d+)\s*.*=\s*₦(\d+)/);

      return {
        category: 'airtime',
        title: 'Airtime Recharge (VTU)',
        network: netMatch ? netMatch[1].toUpperCase() : undefined,
        phone: phoneMatch ? phoneMatch[0] : undefined,
        faceValue: feeMatch ? `₦${feeMatch[1]}` : undefined,
        fee: feeMatch ? `₦${feeMatch[2]}` : undefined,
      };
    }

    // Cashout / Withdrawal
    if (type.includes('withdraw') || desc.toLowerCase().includes('withdraw') || desc.toLowerCase().includes('cashout')) {
      const bankMatch = desc.match(/(OPay|PalmPay|Moniepoint)/i);
      const accMatch = desc.match(/\b\d{10}\b/);
      const grossMatch = desc.match(/Gross:\s*₦(\d[\d,]*)/i);
      const feeMatch = desc.match(/₦(\d[\d,]*)\s*fee/i);
      const payoutMatch = desc.match(/payout:\s*₦(\d[\d,]*)/i);

      return {
        category: 'withdrawal',
        title: 'Bank Withdrawal / Cashout',
        bank: tx.metadata?.destination || (bankMatch ? bankMatch[1].toUpperCase() : 'Bank Transfer'),
        accountNumber: tx.metadata?.accountNumber || (accMatch ? accMatch[0] : undefined),
        accountName: tx.metadata?.accountName || undefined,
        grossAmount: tx.metadata?.grossAmount ? `₦${tx.metadata.grossAmount}` : (grossMatch ? `₦${grossMatch[1]}` : undefined),
        fee: tx.metadata?.fee ? `₦${tx.metadata.fee}` : (feeMatch ? `₦${feeMatch[1]}` : '₦50'),
        netPayout: tx.metadata?.netPayout ? `₦${tx.metadata.netPayout}` : (payoutMatch ? `₦${payoutMatch[1]}` : undefined),
      };
    }

    // Deposit / Topup
    if (type.includes('deposit') || desc.toLowerCase().includes('deposit')) {
      return {
        category: 'deposit',
        title: 'Wallet Deposit (Novac)',
        channel: 'Instant Bank / Card Checkout',
      };
    }

    // Task Reward
    if (type.includes('reward') || desc.toLowerCase().includes('reward')) {
      return {
        category: 'reward',
        title: 'Temu Task Reward',
        details: desc.replace(/^Reward for completing Temu task:\s*/i, ''),
      };
    }

    // Referral Commission
    if (type.includes('commission') || desc.toLowerCase().includes('referral') || desc.toLowerCase().includes('commission')) {
      return {
        category: 'commission',
        title: 'Referral Lifetime Commission',
        details: desc,
      };
    }

    // Pro Membership
    if (type.includes('pro') || desc.toLowerCase().includes('pro')) {
      return {
        category: 'pro',
        title: 'TemuTasks Pro Membership',
        details: desc,
      };
    }

    return {
      category: 'general',
      title: 'Ledger Transaction',
      details: desc,
    };
  };

  const details = parseDetails();
  const isCredit = tx.direction === 'credit';
  const amountFormatted = formatNaira(BigInt(tx.amountKobo));

  const handleCopyRef = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(tx.reference);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  // Download crisp 2x PNG image of the exact receipt ticket
  const handleDownloadImage = async () => {
    if (!receiptRef.current) return;
    try {
      setIsDownloading(true);
      const dataUrl = await toPng(receiptRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      });
      const link = document.createElement('a');
      link.download = `temutasks-receipt-${tx.reference}.png`;
      link.href = dataUrl;
      link.click();
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 2500);
    } catch (err) {
      console.error('Failed to export receipt image:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  // Share actual receipt image via Web Share API Level 2 (files) or fallback
  const handleShare = async () => {
    if (!receiptRef.current) return;
    setIsSharing(true);
    try {
      const blob = await toBlob(receiptRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      });

      if (!blob) throw new Error('Could not generate receipt image');

      const file = new File([blob], `receipt-${tx.reference}.png`, { type: 'image/png' });

      // Check if navigator.canShare supports files (mobile Chrome, Safari, etc.)
      if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `TemuTasks Receipt #${tx.reference}`,
          text: `Official Transaction Receipt: ${details.title} (${amountFormatted}) on TemuTasks.`,
        });
      } else {
        // Fallback for desktop browsers:
        // 1. Download image
        const dataUrl = await toPng(receiptRef.current, { cacheBust: true, pixelRatio: 2, backgroundColor: '#ffffff' });
        const link = document.createElement('a');
        link.download = `temutasks-receipt-${tx.reference}.png`;
        link.href = dataUrl;
        link.click();

        // 2. Try copying image directly to clipboard if supported
        if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
          try {
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          } catch {
            // ignore
          }
        }

        // 3. Open WhatsApp with formatted verification
        const shareText = `📄 TemuTasks Receipt #${tx.reference}\n${details.title} — ${amountFormatted}\n(Receipt image downloaded to your device)\nVerify at https://temutasks.top`;
        const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
        window.open(whatsappUrl, '_blank');
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.error('Error sharing receipt:', err);
        handleDownloadImage();
      }
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="max-w-md w-full max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2.5rem)] flex flex-col my-auto">
        {/* Scrollable Printable Ticket Receipt */}
        <div className="flex-1 overflow-y-auto rounded-2xl shadow-2xl border border-[#E5E7EB] bg-white">
          <div
            id="printable-tx-receipt"
            ref={receiptRef}
            className="bg-white overflow-hidden relative"
          >
            {/* Header Brand Bar */}
            <div className="bg-[#111827] text-white p-4 sm:p-5 flex items-center justify-between border-b border-white/10">
            <div className="flex items-center gap-3">
              <Logo size="sm" showText={false} />
              <div>
                <span className="font-extrabold text-base tracking-tight text-white block">
                  Temu<span className="text-[#F95700]">Tasks</span>
                </span>
                <span className="text-[11px] text-[#9CA3AF] block">
                  Official Financial Receipt
                </span>
              </div>
            </div>

            <div className="text-right">
              <a
                href="https://temutasks.top"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-[#F95700] hover:underline inline-flex items-center gap-1 font-semibold"
              >
                temutasks.top <ExternalLink className="w-3 h-3" />
              </a>
              <span className="text-[10px] text-[#9CA3AF] block font-mono">
                Verified Ledger
              </span>
            </div>
          </div>

          {/* Receipt Body */}
          <div className="p-6 space-y-5">
            {/* Status & Hero Amount */}
            <div className="text-center space-y-2">
              <div
                className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto shadow-xs border ${
                  isCredit
                    ? 'bg-[#ECFDF5] border-[#A7F3D0] text-[#10B981]'
                    : 'bg-[#FFF5F0] border-[#FDBA74] text-[#F95700]'
                }`}
              >
                {isCredit ? (
                  <ArrowDownLeft className="w-8 h-8" />
                ) : (
                  <ArrowUpRight className="w-8 h-8" />
                )}
              </div>

              <div>
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                    isCredit
                      ? 'bg-[#ECFDF5] text-[#059669]'
                      : 'bg-[#F3F4F6] text-[#4B5563]'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {tx.status || 'Transaction Completed'}
                </span>
              </div>

              <div>
                <div
                  className={`text-3xl sm:text-4xl font-black tracking-tight ${
                    isCredit ? 'text-[#10B981]' : 'text-[#111827]'
                  }`}
                >
                  {isCredit ? '+' : '-'}
                  {amountFormatted}
                </div>
                <p className="text-xs text-[#6B7280] mt-0.5">{tx.date}</p>
              </div>
            </div>

            {/* Perforated Receipt Cutout Divider */}
            <div className="relative py-1">
              <div className="border-t-2 border-dashed border-[#E5E7EB] w-full" />
              <div className="absolute -left-8 -top-2.5 w-5 h-5 bg-[#1F2937]/10 sm:bg-black/60 rounded-full" />
              <div className="absolute -right-8 -top-2.5 w-5 h-5 bg-[#1F2937]/10 sm:bg-black/60 rounded-full" />
            </div>

            {/* Itemized Table */}
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between py-1">
                <span className="text-[#6B7280]">Transaction Type:</span>
                <span className="font-bold text-[#111827]">{details.title}</span>
              </div>

              {/* Airtime Specific Details */}
              {details.network && (
                <div className="flex items-center justify-between py-1">
                  <span className="text-[#6B7280]">Mobile Network:</span>
                  <span className="font-bold px-2 py-0.5 rounded-md border text-[11px] bg-[#FFF5F0] text-[#F95700] border-[#FDBA74]">
                    {details.network}
                  </span>
                </div>
              )}

              {details.phone && (
                <div className="flex items-center justify-between py-1">
                  <span className="text-[#6B7280]">Recipient Mobile:</span>
                  <span className="font-mono font-bold text-[#111827]">{details.phone}</span>
                </div>
              )}

              {details.faceValue && (
                <div className="flex items-center justify-between py-1">
                  <span className="text-[#6B7280]">Airtime Value:</span>
                  <span className="font-semibold text-[#111827]">{details.faceValue}</span>
                </div>
              )}

              {details.fee && (
                <div className="flex items-center justify-between py-1">
                  <span className="text-[#6B7280]">Platform Reward Fee:</span>
                  <span className="font-semibold text-[#F95700]">+{details.fee}</span>
                </div>
              )}

              {/* Withdrawal Specific Details */}
              {details.bank && (
                <div className="flex items-center justify-between py-1">
                  <span className="text-[#6B7280]">Destination Bank / Wallet:</span>
                  <span className="font-bold text-[#111827]">{details.bank}</span>
                </div>
              )}

              {details.accountNumber && (
                <div className="flex items-center justify-between py-1">
                  <span className="text-[#6B7280]">Account Number:</span>
                  <span className="font-mono font-bold text-[#111827]">
                    {details.accountNumber}
                  </span>
                </div>
              )}

              {details.accountName && (
                <div className="flex items-center justify-between py-1">
                  <span className="text-[#6B7280]">Account Name:</span>
                  <span className="font-bold text-[#111827]">
                    {details.accountName}
                  </span>
                </div>
              )}

              {details.grossAmount && (
                <div className="flex items-center justify-between py-1">
                  <span className="text-[#6B7280]">Withdrawal Amount:</span>
                  <span className="font-semibold text-[#111827]">{details.grossAmount}</span>
                </div>
              )}

              {details.fee && details.category === 'withdrawal' && (
                <div className="flex items-center justify-between py-1">
                  <span className="text-[#6B7280]">Processing Fee:</span>
                  <span className="font-semibold text-[#EF4444]">-{details.fee}</span>
                </div>
              )}

              {details.netPayout && (
                <div className="flex items-center justify-between py-1 bg-[#ECFDF5] px-2 rounded border border-[#A7F3D0]/60">
                  <span className="text-[#059669] font-semibold">Net Bank Payout:</span>
                  <span className="font-extrabold text-[#059669] text-sm">{details.netPayout}</span>
                </div>
              )}

              {/* Description / Summary */}
              <div className="py-1 border-t border-[#F3F4F6]">
                <span className="text-[#6B7280] block mb-0.5">Description:</span>
                <p className="font-medium text-[#111827] leading-relaxed">
                  {tx.description}
                </p>
              </div>

              {/* Balance After */}
              {tx.balanceAfterKobo !== undefined && (
                <div className="flex items-center justify-between py-1 border-t border-[#F3F4F6]">
                  <span className="text-[#6B7280]">Wallet Balance After:</span>
                  <span className="font-bold text-[#111827]">
                    {formatNaira(BigInt(tx.balanceAfterKobo))}
                  </span>
                </div>
              )}

              {/* Reference */}
              <div className="flex items-center justify-between py-1 pt-1.5 border-t border-[#F3F4F6]">
                <span className="text-[#6B7280]">Reference:</span>
                <button
                  type="button"
                  onClick={handleCopyRef}
                  className="font-mono text-[11px] font-bold text-[#111827] bg-[#F3F4F6] hover:bg-[#E5E7EB] px-2 py-0.5 rounded flex items-center gap-1 transition-colors"
                  title="Click to copy reference"
                >
                  {tx.reference}
                  {copied ? (
                    <Check className="w-3 h-3 text-[#10B981]" />
                  ) : (
                    <Copy className="w-3 h-3 text-[#6B7280]" />
                  )}
                </button>
              </div>
            </div>

            {/* Simulated Barcode */}
            <div className="pt-3 border-t border-[#E5E7EB] text-center space-y-1.5">
              <div className="flex justify-center items-center gap-1 opacity-75">
                {[3, 2, 5, 1, 4, 2, 6, 1, 3, 5, 2, 4, 1, 6, 3, 2, 5, 4, 2].map((w, i) => (
                  <span
                    key={i}
                    className="inline-block bg-[#111827] h-6 rounded-xs"
                    style={{ width: `${w * 1.5}px` }}
                  />
                ))}
              </div>
              <p className="text-[10px] font-mono text-[#9CA3AF]">
                TEMUTASKS-LEDGER-{tx.reference} • VERIFIED
              </p>
              <p className="text-[10px] text-[#6B7280]">
                Support: <a href="mailto:support@temutasks.top" className="text-[#F95700] hover:underline">support@temutasks.top</a>
              </p>
            </div>
            </div>
          </div>
        </div>

        {/* Modal Buttons (Pinned / Sticky at Bottom) */}
        <div className="space-y-2 pt-2.5 sm:pt-3 shrink-0">
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={handleDownloadImage}
              isLoading={isDownloading}
              leftIcon={
                downloadSuccess ? (
                  <Check className="w-4 h-4 text-white" />
                ) : (
                  <Download className="w-4 h-4" />
                )
              }
              className="w-full text-xs font-bold shadow-md bg-[#F95700] hover:bg-[#E04E00] text-white"
            >
              {downloadSuccess ? 'Image Saved!' : 'Download Image'}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={handleShare}
              leftIcon={<Share2 className="w-4 h-4" />}
              isLoading={isSharing}
              className="w-full text-xs font-bold bg-white text-[#111827] hover:border-[#F95700]"
            >
              Share Image
            </Button>
          </div>

          <div className="flex gap-2">
            {onRechargeAnother && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  onClose();
                  onRechargeAnother();
                }}
                className="flex-1 text-xs text-[#4B5563] bg-white"
              >
                Recharge Another
              </Button>
            )}

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onClose}
              className="flex-1 text-xs font-semibold bg-[#111827] hover:bg-[#1F2937] text-white"
            >
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
