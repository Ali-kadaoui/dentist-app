
import { Stethoscope, Shield, Sparkles, CheckCircle, Clock } from 'lucide-react';

export const Services = () => (
  <section id="soins" className="py-24 px-4 bg-white">
    <div className="container mx-auto max-w-6xl">
      <div className="text-center max-w-3xl mx-auto mb-16">
        <h3 className="text-blue-600 font-bold tracking-wider text-sm mb-2 uppercase">Soins de Qualité</h3>
        <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Découvrez l'ensemble de nos services</h2>
        <p className="text-slate-600 text-lg">
          La dentisterie moderne offre des solutions de plus en plus élaborées pour garder vos dents le plus longtemps possible.
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        {[
          {
            icon: <Stethoscope className="w-8 h-8 text-blue-600" />,
            title: 'Soins Dentaires',
            desc: 'Traitements référant aux dernières données de la science, avec une parfaite maîtrise des nouvelles techniques.',
            tags: ['Détartrage', 'Soins des caries']
          },
          {
            icon: <Shield className="w-8 h-8 text-blue-600" />,
            title: 'Prothèses Dentaires',
            desc: 'Pour le remplacement d\'une ou plusieurs dents, la prothèse est la solution numéro 1 pour retrouver votre sourire.',
            tags: ['Couronnes', 'Implants']
          },
          {
            icon: <Sparkles className="w-8 h-8 text-blue-600" />,
            title: 'Esthétique Dentaire',
            desc: 'Le sourire est la vitrine de votre visage. Plusieurs solutions existent pour le rendre éclatant.',
            tags: ['Blanchiment', 'Facettes']
          },
          {
            icon: <CheckCircle className="w-8 h-8 text-blue-600" />,
            title: 'Orthodontie',
            desc: 'Dispositifs contribuant à rétablir la position des dents et de la mâchoire pour un alignement parfait.',
            tags: ['Gouttières invisibles', 'Bagues']
          },
          {
            icon: <Clock className="w-8 h-8 text-blue-600" />,
            title: 'Urgences',
            desc: 'Une urgence dentaire peut se présenter sous plusieurs formes. Nous agissons rapidement pour soulager la douleur.',
            tags: ['Douleurs', 'Traumatismes']
          }
        ].map((service, idx) => (
          <div key={idx} className="bg-slate-50 rounded-2xl p-8 border border-slate-100 hover:shadow-xl transition-all hover:-translate-y-1 group">
            <div className="bg-blue-100 w-16 h-16 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              {service.icon}
            </div>
            <h4 className="text-xl font-bold text-slate-900 mb-3">{service.title}</h4>
            <p className="text-slate-600 mb-6 text-sm leading-relaxed">{service.desc}</p>
            <div className="flex flex-wrap gap-2">
              {service.tags.map((tag, i) => (
                <span key={i} className="bg-white border border-slate-200 text-slate-700 text-xs px-3 py-1 rounded-full font-medium">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);
