
import { CheckCircle } from 'lucide-react';

export const About = () => (
  <section id="a-propos" className="py-20 bg-slate-50 px-4">
    <div className="container mx-auto max-w-6xl">
      <div className="flex flex-col md:flex-row gap-12 items-center">
        <div className="w-full md:w-1/3">
          <div className="relative rounded-2xl overflow-hidden shadow-xl aspect-[3/4]">
            <img 
              src="/about_doctor.jpg" 
              alt="Dr. Nadia Atlassi" 
              className="w-full h-full object-cover"
            />
          </div>
        </div>
        <div className="w-full md:w-2/3">
          <h3 className="text-blue-600 font-bold tracking-wider text-sm mb-2 uppercase">À Propos De Nous</h3>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6">Dr. Nadia Atlassi</h2>
          <p className="text-lg text-slate-600 mb-6 leading-relaxed">
            Notre mission est de faire la différence pour chacun de nos patients en leur donnant toute l'information pour qu'ils se prennent en main avec des solutions respectant le corps humain. Notre approche holistique vous permet de réaliser comment influencer votre bien-être global, ou tout simplement vous permet de retrouver un sourire resplendissant.
          </p>
          
          <ul className="grid sm:grid-cols-2 gap-4 mt-8">
            {[
              "Plus de 18 ans d'expérience",
              "Prise en charge personnalisée",
              "Équipements de dernière génération",
              "Approche douce et sans douleur",
              "Urgences dentaires acceptées",
              "Hygiène et stérilisation rigoureuses"
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-3">
                <CheckCircle className="text-green-500 shrink-0 w-5 h-5 mt-0.5" />
                <span className="font-medium text-slate-700">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  </section>
);
