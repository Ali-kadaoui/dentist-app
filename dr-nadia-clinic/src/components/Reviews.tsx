
import { Star } from 'lucide-react';

export const Reviews = () => (
  <section id="avis" className="py-24 px-4 bg-slate-50">
    <div className="container mx-auto max-w-6xl">
      <div className="text-center max-w-3xl mx-auto mb-16">
        <h3 className="text-blue-600 font-bold tracking-wider text-sm mb-2 uppercase">Avis Patients</h3>
        <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Votre témoignage, notre reconnaissance</h2>
        <p className="text-slate-600 text-lg">
          Nous prospérons grâce à votre confiance et nous vous en remercions.
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { name: 'Leila Nahi', text: 'Première visite chez cette dentiste, je recommande vivement ! Elle m\'a très bien expliqué ce que j\'avais et elle m\'a bien rassurée, moi qui n\'aime pas beaucoup aller chez le dentiste ! J\'y retournerai avec plaisir.' },
          { name: 'Adam', text: 'Très bien soigné! J\'ai peur des dentistes mais malgré tout j\'étais en confiance! pas eu mal ! et rendez vous plutôt rapide par rapport a mon ancien dentiste Merci pour mes dents.' },
          { name: 'Nadia Radi', text: 'Je suis venu de la part d\'une amie suivie depuis longtemps par cette dentiste. Moi qui avais si peur depuis toujours, je l\'ai trouvée particulièrement douce et rassurante et je n\'hésiterai plus à prendre rdv !' },
          { name: 'Raja Manie', text: 'Enfin un dentiste à l\'écoute de ses patients ! Le docteur Nadia est une vraie professionnelle qui prend en charge ses patients dans une démarche globale. La sympathie et l\'humour en plus.' }
        ].map((review, idx) => (
          <div key={idx} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
            <div>
              <div className="flex text-amber-400 mb-4">
                {[...Array(5)].map((_, i) => <Star key={i} size={16} fill="currentColor" />)}
              </div>
              <p className="text-slate-600 text-sm leading-relaxed mb-6 italic">"{review.text}"</p>
            </div>
            <div className="flex items-center gap-3 border-t border-slate-50 pt-4">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold">
                {review.name.charAt(0)}
              </div>
              <div>
                <h5 className="font-bold text-slate-900 text-sm">{review.name}</h5>
                <span className="text-xs text-slate-500">Patient(e)</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);
