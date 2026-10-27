import { useState, useRef } from 'react';

const BeforeAfterSlider = ({ beforeImage, afterImage }: { beforeImage: string, afterImage: string }) => {
  const [sliderPosition, setSliderPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = (event: React.MouseEvent | React.TouchEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percent = Math.max(0, Math.min((x / rect.width) * 100, 100));
    setSliderPosition(percent);
  };

  return (
    <div 
      className="relative w-full h-full cursor-ew-resize select-none overflow-hidden group touch-none"
      ref={containerRef}
      onMouseMove={(e) => e.buttons === 1 && handleMove(e)}
      onTouchMove={handleMove}
      onMouseDown={handleMove}
      onTouchStart={handleMove}
    >
      <img src={afterImage} alt="Après" className="absolute top-0 left-0 w-full h-full object-cover pointer-events-none" />
      
      <img 
        src={beforeImage} 
        alt="Avant" 
        className="absolute top-0 left-0 w-full h-full object-cover pointer-events-none" 
        style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }} 
      />

      <div 
        className="absolute top-0 bottom-0 w-1 bg-white flex items-center justify-center shadow-[0_0_5px_rgba(0,0,0,0.3)] z-20 pointer-events-none transition-opacity opacity-70 group-hover:opacity-100"
        style={{ left: `calc(${sliderPosition}% - 2px)` }}
      >
        <div className="w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center">
           <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-600">
             <path d="M10 8L6 12L10 16 M14 8L18 12L14 16" />
           </svg>
        </div>
      </div>
      
      <div className="absolute top-4 left-4 bg-slate-900/80 backdrop-blur text-white text-[10px] sm:text-xs font-bold px-2 py-1 rounded uppercase tracking-wider z-30 pointer-events-none">
        Avant
      </div>
      <div className="absolute top-4 right-4 bg-blue-600/90 backdrop-blur text-white text-[10px] sm:text-xs font-bold px-2 py-1 rounded uppercase tracking-wider z-30 pointer-events-none">
        Après
      </div>
    </div>
  );
};

export const Cases = () => (
  <section id="cas-cliniques" className="py-24 px-4 bg-slate-900 text-white overflow-hidden relative">
    <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-10 pointer-events-none">
      <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-blue-500 blur-[120px]"></div>
      <div className="absolute -bottom-[20%] -right-[10%] w-[50%] h-[50%] rounded-full bg-cyan-500 blur-[120px]"></div>
    </div>
    
    <div className="container mx-auto max-w-6xl relative z-10">
      <div className="text-center max-w-3xl mx-auto mb-16">
        <h3 className="text-blue-400 font-bold tracking-wider text-sm mb-2 uppercase">Excellence Clinique</h3>
        <h2 className="text-3xl md:text-4xl font-bold mb-4">Cas Cliniques</h2>
        <p className="text-slate-300 text-lg">
          Découvrez les transformations réalisées au cabinet. Des résultats réels pour des sourires retrouvés.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {[
          {
            title: "Blanchiment Dentaire",
            isSlider: true,
            imgBefore: "/case1_before.jpg",
            imgAfter: "/case1_after.jpg",
            desc: "Résultat après 2 séances de blanchiment au fauteuil."
          },
          {
            title: "Facettes Esthétiques",
            isSlider: false,
            img: "/case_2.jpg",
            desc: "Correction de l'alignement et de la teinte avec 6 facettes."
          },
          {
            title: "Orthodontie",
            isSlider: false,
            img: "/case_3.jpg",
            desc: "Alignement réalisé par gouttières transparentes en 8 mois."
          }
        ].map((caseItem, idx) => (
          <div key={idx} className="bg-slate-800 rounded-2xl overflow-hidden border border-slate-700 hover:border-blue-500 transition-colors">
            <div className="aspect-[4/3] relative">
              {caseItem.isSlider ? (
                <BeforeAfterSlider beforeImage={caseItem.imgBefore!} afterImage={caseItem.imgAfter!} />
              ) : (
                <>
                  <img src={caseItem.img} alt={caseItem.title} className="w-full h-full object-cover" />
                  <div className="absolute top-4 left-4 bg-slate-900/80 backdrop-blur text-white text-[10px] sm:text-xs font-bold px-2 py-1 rounded uppercase tracking-wider">
                    Avant / Après
                  </div>
                </>
              )}
            </div>
            <div className="p-6">
              <h4 className="text-xl font-bold mb-2">{caseItem.title}</h4>
              <p className="text-slate-400 text-sm">{caseItem.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);
