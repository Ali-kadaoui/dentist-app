import { Phone, MessageCircle, Star, Award, Sparkles } from 'lucide-react';

export const Hero = () => (
  <section id="accueil" className="pt-32 pb-20 lg:pt-48 lg:pb-32 px-4 relative overflow-hidden bg-slate-50">
    {/* Faint pattern bg */}
    <div className="absolute inset-0 z-0 opacity-5 bg-[url('/hero_bg.jpg')] bg-cover bg-center mix-blend-multiply"></div>
    
    {/* Background image covering the whole section */}
    <div className="absolute inset-0 z-0">
      <img 
        src="/logo.jpg" 
        alt="Salle d'attente confortable du cabinet" 
        className="w-full h-full object-cover object-center"
      />
      {/* Uniform semi-transparent overlay to keep the image visible everywhere while text remains readable */}
      <div className="absolute inset-0 bg-white/70"></div>
    </div>

    <div className="container mx-auto max-w-6xl relative z-10">
      <div className="max-w-2xl">
        <span className="inline-block py-1.5 px-4 rounded-full bg-blue-100 text-blue-800 text-sm font-bold tracking-wide mb-6 shadow-sm border border-blue-200">
          Cabinet Dentaire Marrakech
        </span>
        <h2 className="text-4xl md:text-5xl lg:text-7xl font-extrabold text-slate-900 leading-tight mb-6 tracking-tight">
          Retrouvez un sourire <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500 drop-shadow-sm">éclatant</span> et sain.
        </h2>
        <p className="text-lg md:text-xl text-slate-800 font-medium mb-10 leading-relaxed max-w-xl">
          Le Dr. Nadia Atlassi vous accueille dans un cadre moderne et chaleureux à Marrakech pour des soins dentaires d'excellence, adaptés à toute la famille.
        </p>
        
        <div className="flex flex-row gap-3 sm:gap-4 mb-14 max-w-lg">
          <a 
            href="tel:0524055200"
            className="bg-blue-600 flex-1 text-white px-2 py-3 sm:px-8 sm:py-4 rounded-full font-semibold hover:bg-blue-700 transition-all shadow-xl hover:shadow-blue-600/30 flex items-center justify-center gap-2 text-sm sm:text-lg"
          >
            <Phone size={20} className="sm:w-[22px] sm:h-[22px]" />
            Appelez-nous
          </a>
          <a 
            href="https://wa.me/212624905942"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[#25D366] flex-1 text-white px-2 py-3 sm:px-8 sm:py-4 rounded-full font-semibold hover:bg-[#20b858] transition-all shadow-xl hover:shadow-[#25D366]/30 flex items-center justify-center gap-2 text-sm sm:text-lg"
          >
            <MessageCircle size={20} className="sm:w-[22px] sm:h-[22px]" />
            Contactez-nous
          </a>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 pt-8 border-t border-slate-300/60 max-w-lg">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1 text-amber-500">
              <Star size={18} fill="currentColor" />
              <Star size={18} fill="currentColor" />
              <Star size={18} fill="currentColor" />
              <Star size={18} fill="currentColor" />
              <Star size={18} fill="currentColor" />
            </div>
            <span className="text-sm font-bold text-slate-900 mt-1">Patients Satisfaits</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xl font-bold text-slate-900 flex items-center gap-1">
              <Award size={22} className="text-blue-600"/> 18+ Ans
            </span>
            <span className="text-sm font-semibold text-slate-700 mt-1">D'expérience</span>
          </div>
          <div className="flex flex-col gap-1 hidden sm:flex">
            <span className="text-xl font-bold text-slate-900 flex items-center gap-1">
              <Sparkles size={22} className="text-blue-600"/> Sans Douleur
            </span>
            <span className="text-sm font-semibold text-slate-700 mt-1">Soins douceur</span>
          </div>
        </div>
      </div>
    </div>
  </section>
);
