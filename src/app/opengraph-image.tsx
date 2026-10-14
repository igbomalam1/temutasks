import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'TemuTasks — Available Balance ₦10,000.00 | Buy Airtime & Instant Cashout';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0F172A',
          backgroundImage:
            'radial-gradient(circle at 25% 25%, rgba(249, 87, 0, 0.25) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(0, 144, 254, 0.2) 0%, transparent 50%)',
          padding: '40px 60px',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Brand Top Bar */}
        <div
          style={{
            display: 'flex',
            width: '100%',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '28px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                backgroundColor: '#F95700',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                fontSize: '26px',
                fontWeight: 'bold',
                boxShadow: '0 4px 12px rgba(249, 87, 0, 0.4)',
              }}
            >
              T
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span
                style={{
                  fontSize: '28px',
                  fontWeight: '800',
                  color: '#FFFFFF',
                  letterSpacing: '-0.5px',
                }}
              >
                TemuTasks<span style={{ color: '#F95700' }}>.top</span>
              </span>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              padding: '8px 18px',
              borderRadius: '999px',
              color: '#10B981',
              fontSize: '15px',
              fontWeight: '600',
            }}
          >
            ● Verified Daily Payouts
          </div>
        </div>

        {/* Centerpiece: Balance Card */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            backgroundColor: '#FFFFFF',
            borderRadius: '24px',
            padding: '36px 44px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
          }}
        >
          {/* Card Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '10px',
            }}
          >
            <span
              style={{
                fontSize: '15px',
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                color: '#64748B',
              }}
            >
              Available Wallet Balance
            </span>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: '#ECFDF5',
                color: '#059669',
                padding: '4px 12px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '700',
              }}
            >
              Instant Withdrawal Ready
            </div>
          </div>

          {/* Big Balance Number */}
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: '6px',
              marginBottom: '24px',
            }}
          >
            <span
              style={{
                fontSize: '66px',
                fontWeight: '900',
                color: '#0F172A',
                letterSpacing: '-2px',
                lineHeight: '1',
              }}
            >
              ₦10,000
            </span>
            <span
              style={{
                fontSize: '32px',
                fontWeight: '700',
                color: '#94A3B8',
              }}
            >
              .00
            </span>
          </div>

          {/* Action Buttons Row */}
          <div
            style={{
              display: 'flex',
              gap: '16px',
              width: '100%',
            }}
          >
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#F95700',
                color: '#FFFFFF',
                padding: '16px 20px',
                borderRadius: '14px',
                fontSize: '18px',
                fontWeight: '700',
                boxShadow: '0 6px 16px rgba(249, 87, 0, 0.3)',
              }}
            >
              📱 Buy Airtime (VTU)
            </div>

            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#0F172A',
                color: '#FFFFFF',
                padding: '16px 20px',
                borderRadius: '14px',
                fontSize: '18px',
                fontWeight: '700',
              }}
            >
              💸 Instant Cashout (Bank)
            </div>
          </div>
        </div>

        {/* Footer Tagline */}
        <div
          style={{
            display: 'flex',
            width: '100%',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '24px',
          }}
        >
          <span
            style={{
              fontSize: '16px',
              color: '#CBD5E1',
              fontWeight: '500',
            }}
          >
            Complete simple Temu tasks • Earn ₦1,000 to ₦5,000 everyday
          </span>

          <span
            style={{
              fontSize: '16px',
              color: '#F95700',
              fontWeight: '700',
            }}
          >
            temutasks.top
          </span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
