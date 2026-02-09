import { LandingHeader } from "@/components/landing/LandingHeader";

export default function SignUpLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-muted/30">
      <LandingHeader />
      {children}
    </div>
  );
}
