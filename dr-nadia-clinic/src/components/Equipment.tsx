import { CheckCircle2 } from 'lucide-react';
import equipmentImg from '../assets/equipment.jpg';

export function Equipment() {
  const features = [
    'Fauteuil dentaire ergonomique de dernière génération',
    'Caméra intra-orale pour un diagnostic précis',
    'Environnement de soins moderne et apaisant',
    'Stérilisation rigoureuse aux normes internationales',
    'Équipement radiologique haute définition',
    'Matériaux de pointe pour des résultats durables'
  ];

  return (
    <section id="equipement" className="py-20 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-800 mb-4">
            Plateau Technique & Équipement
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Nous investissons continuellement dans les technologies dentaires les plus récentes 
            pour vous garantir des soins d'une qualité exceptionnelle dans un confort absolu.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="relative group rounded-2xl overflow-hidden shadow-2xl">
            <div className="absolute inset-0 bg-blue-600/10 group-hover:bg-transparent transition-colors duration-500 z-10 pointer-events-none"></div>
            <img 
              src={equipmentImg} 
              alt="Équipement de pointe du cabinet dentaire" 
              className="w-full h-auto lg:h-[500px] object-cover transform group-hover:scale-105 transition-transform duration-700"
            />
          </div>

          <div className="space-y-8">
            <div>
              <h3 className="text-2xl font-bold text-slate-800 mb-4">
                L'innovation au service de votre sourire
              </h3>
              <p className="text-slate-600 leading-relaxed mb-6">
                Notre salle de soins est pensée pour votre bien-être. De l'ergonomie de notre 
                fauteuil dentaire jusqu'à la précision de nos outils de diagnostic, chaque détail 
                a été choisi pour rendre votre visite la plus agréable et efficace possible.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {features.map((feature, index) => (
                <div key={index} className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-700 font-medium">{feature}</span>
                </div>
              ))}
            </div>

            <div className="pt-6 border-t border-slate-200">
              <p className="text-slate-500 italic">
                « La qualité de nos équipements reflète notre engagement envers l'excellence de vos soins. »
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
