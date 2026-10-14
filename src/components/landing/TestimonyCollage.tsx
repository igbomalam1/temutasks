'use client';

import React, { useState } from 'react';
import { Gift } from 'lucide-react';

interface FreeGiftWinnerCard {
  id: string;
  filename: string;
  rotation: string;
  zIndex: string;
  margin: string;
  label: string;
}

const WINNERS_PHOTOS: FreeGiftWinnerCard[] = [
  {
    id: 'ts1',
    filename: '/images/testimonies/ts1.png',
    rotation: '-rotate-6 hover:-rotate-1',
    zIndex: 'z-10',
    margin: 'mt-2',
    label: 'Claimed Free Gift',
  },
  {
    id: 'ts2',
    filename: '/images/testimonies/ts2.png',
    rotation: 'rotate-3 hover:rotate-0',
    zIndex: 'z-20',
    margin: '-mt-3',
    label: 'Temu Winner',
  },
  {
    id: 'ts3',
    filename: '/images/testimonies/ts3.png',
    rotation: '-rotate-3 hover:rotate-1',
    zIndex: 'z-30',
    margin: 'mt-4',
    label: '100% Slashed',
  },
  {
    id: 'ts4',
    filename: '/images/testimonies/ts4.png',
    rotation: 'rotate-6 hover:rotate-2',
    zIndex: 'z-20',
    margin: '-mt-2',
    label: 'Package Received',
  },
  {
    id: 'ts5',
    filename: '/images/testimonies/ts5.png',
    rotation: '-rotate-4 hover:rotate-0',
    zIndex: 'z-30',
    margin: 'mt-3',
    label: 'Hat-Trick Winner',
  },
  {
    id: 'ts6',
    filename: '/images/testimonies/ts6.png',
    rotation: 'rotate-4 hover:rotate-1',
    zIndex: 'z-10',
    margin: '-mt-1',
    label: 'Free Delivery',
  },
];

export const TestimonyCollage: React.FC = () => {
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const handleImageError = (id: string) => {
    setFailedImages((prev) => ({ ...prev, [id]: true }));
  };

  return (
    <section className="w-full py-8 sm:py-12 px-4 sm:px-6 overflow-hidden">
      {/* Spread out, shuffled cards container */}
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-5 md:gap-6 py-4">
          {WINNERS_PHOTOS.map((item, idx) => {
            const isError = failedImages[item.id];

            return (
              <div
                key={item.id}
                className={`transform transition-all duration-300 hover:scale-108 hover:z-40 ${item.rotation} ${item.zIndex} ${item.margin}`}
              >
                {/* Polaroids / Card Style with white border and drop shadow */}
                <div
                  className="bg-white p-2.5 sm:p-3 rounded-2xl shadow-md hover:shadow-xl border border-[#E5E7EB] transition-all flex flex-col items-center"
                  style={{
                    width: 'clamp(140px, 26vw, 175px)',
                    height: 'clamp(190px, 35vw, 235px)',
                  }}
                >
                  {/* Photo area */}
                  <div className="w-full flex-1 rounded-xl bg-[#F7F7F8] border border-[#F3F4F6] overflow-hidden relative flex items-center justify-center">
                    {!isError ? (
                      <img
                        src={item.filename}
                        alt="Temu Free Gift Winner Proof"
                        className="w-full h-full object-cover rounded-lg"
                        onError={() => handleImageError(item.id)}
                      />
                    ) : (
                      /* Placeholder card until you upload ts1.png-ts6.png */
                      <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-gradient-to-b from-[#FFF5F0] to-[#FFFFFF]">
                        <div className="w-10 h-10 rounded-full bg-[#FFF5F0] border border-[#F95700]/30 flex items-center justify-center text-[#F95700] mb-2 shadow-xs">
                          <Gift className="w-5 h-5 text-[#F95700]" />
                        </div>
                        <span className="text-[11px] font-black text-[#111827] uppercase tracking-wide">
                          {item.id}.png
                        </span>
                        <span className="text-[9px] text-[#6B7280] mt-0.5 font-medium">
                          Temu Winner Photo
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Minimalistic Polaroid bottom label - no quotes/reviews */}
                  <div className="pt-2 pb-0.5 text-center w-full flex items-center justify-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                    <span className="text-[11px] font-bold text-[#111827] tracking-tight truncate">
                      {item.label}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
