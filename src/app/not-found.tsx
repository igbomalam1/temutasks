import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#F7F7F8] flex flex-col items-center justify-center p-4 text-center">
      <Logo size="lg" />
      <h1 className="text-4xl font-extrabold text-[#111827] mt-6 mb-2">404</h1>
      <p className="text-base text-[#6B7280] mb-6">Page not found or has been moved.</p>
      <Link href="/dashboard">
        <Button size="md" variant="primary">
          Back to Dashboard
        </Button>
      </Link>
    </div>
  );
}
