export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="-m-6 flex min-h-screen items-center justify-center bg-muted/30">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
