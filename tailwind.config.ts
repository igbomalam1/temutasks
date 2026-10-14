import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#F95700', // Fairly-Used Brand Orange
          hover: '#E04E00',
          light: '#FFF5F0',
        },
        navy: {
          DEFAULT: '#111827', // Midnight Navy
          light: '#1F2937',
        },
        accent: {
          blue: '#0090FE',
          gold: '#F59E0B',
          goldBg: '#FFFBEB',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          background: '#F7F7F8',
          hover: '#F9FAFB',
          active: '#F3F4F6',
        },
        status: {
          success: '#10B981',
          danger: '#EF4444',
          warning: '#F59E0B',
        },
        border: {
          DEFAULT: '#E5E7EB',
          light: '#F3F4F6',
          focus: '#F95700',
        },
        text: {
          primary: '#111827',
          secondary: '#6B7280',
          tertiary: '#9CA3AF',
          light: '#D1D5DB',
        }
      },
      borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        '2xl': '20px',
      },
      boxShadow: {
        sm: '0px 1px 3px rgba(0, 0, 0, 0.05), 0px 1px 2px rgba(0, 0, 0, 0.03)',
        md: '0px 4px 6px -1px rgba(0, 0, 0, 0.08), 0px 2px 4px -1px rgba(0, 0, 0, 0.04)',
        lg: '0px 10px 15px -3px rgba(0, 0, 0, 0.08), 0px 4px 6px -2px rgba(0, 0, 0, 0.04)',
      }
    },
  },
  plugins: [],
};
export default config;
