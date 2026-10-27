
import { MapPin, Phone, MessageCircle } from 'lucide-react';

export const Footer = () => (
  <footer id="contact" className="bg-slate-900 text-slate-300 pt-20 pb-10 border-t-4 border-blue-600 relative z-20">
    <div className="container mx-auto max-w-6xl px-4">
      <div className="grid md:grid-cols-2 lg:grid-cols-12 gap-12 lg:gap-8 mb-16">
        
        <div className="lg:col-span-4">
          <div className="flex items-center gap-3 mb-6">
            <div>
              <h3 className="text-xl font-bold text-white leading-tight">Dr. Nadia Atlassi</h3>
              <p className="text-xs text-blue-400 font-medium tracking-wide">DENTISTE PROFESSIONNELLE</p>
            </div>
          </div>
          <p className="text-slate-400 text-sm leading-relaxed mb-8">
            Votre dentiste de confiance à Marrakech pour des soins complets, de la prévention à l'esthétique, dans un environnement doux et professionnel.
          </p>

        </div>

        <div className="lg:col-span-4">
          <h4 className="text-white font-bold mb-6 text-lg">Contact & Accès</h4>
          <ul className="flex flex-col gap-5">
            <li className="flex items-start gap-3">
              <MapPin className="text-blue-500 shrink-0 mt-1" size={20} />
              <span className="text-sm">
                N 3 1 er étage, immeuble E al Boustane,<br/>
                2 Bd Allal Al Fassi, Marrakech 40000<br/>
                <span className="text-slate-500 text-xs mt-1 block">(Les Jardins Des Orangers)</span>
              </span>
            </li>
            <li className="flex items-center gap-3">
              <Phone className="text-blue-500 shrink-0" size={20} />
              <a href="tel:0524055200" className="text-sm hover:text-white transition-colors">05 24 05 52 00</a>
            </li>
            <li className="flex items-center gap-3">
              <MessageCircle className="text-[#25D366] shrink-0" size={20} />
              <a href="https://wa.me/212624905942" className="text-sm hover:text-white transition-colors">06 24 90 59 42</a>
            </li>
          </ul>
        </div>

        <div className="lg:col-span-4">
          <h4 className="text-white font-bold mb-6 text-lg">Horaires d'ouverture</h4>
          <ul className="flex flex-col gap-3">
            <li className="flex justify-between text-sm border-b border-slate-800 pb-2">
              <span>Lundi - Vendredi</span>
              <span className="text-white font-medium">09:00 - 19:00</span>
            </li>
            <li className="flex justify-between text-sm border-b border-slate-800 pb-2">
              <span>Samedi</span>
              <span className="text-white font-medium">09:00 - 14:00</span>
            </li>
            <li className="flex justify-between text-sm text-red-400">
              <span>Dimanche</span>
              <span>Fermé</span>
            </li>
          </ul>
        </div>

      </div>

      <div className="w-full h-[350px] rounded-2xl overflow-hidden shadow-2xl mb-12 border border-slate-800">
         <iframe 
            src="https://maps.google.com/maps?q=Cabinet%20dr%20Nadia%20atlassi%20Plus%20de%2018ans%20d%20exp%C3%A9rience&t=&z=16&ie=UTF8&iwloc=&output=embed"
            width="100%" 
            height="100%" 
            style={{ border: 0 }} 
            allowFullScreen={false} 
            loading="lazy" 
            referrerPolicy="no-referrer-when-downgrade"
          ></iframe>
      </div>

      <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-slate-500">
        <p>&copy; 2026 Dr. Nadia Atlassi. Tous droits réservés.</p>
        <div className="flex gap-4">
          <a href="#" className="hover:text-white transition-colors">Mentions légales</a>
          <a href="#" className="hover:text-white transition-colors">Politique de confidentialité</a>
        </div>
      </div>
    </div>
  </footer>
);
