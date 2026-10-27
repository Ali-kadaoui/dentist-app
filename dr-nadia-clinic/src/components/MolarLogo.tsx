export const MolarLogo = ({ className = "w-10 h-10" }: { className?: string }) => (
  <div className={`bg-white rounded-lg flex items-center justify-center p-1 ${className}`}>
    <img src="/custom_logo.png" alt="Dr. Nadia Atlassi Logo" className="w-full h-full object-contain" />
  </div>
);
