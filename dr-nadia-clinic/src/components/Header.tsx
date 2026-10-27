
import { Phone, MessageCircle, Menu, X } from 'lucide-react';

interface HeaderProps {
  isScrolled: boolean;
  activeSection: string;
  scrollToSection: (id: string) => void;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
  navLinks: { name: string; id: string }[];
}

export const Header = ({ isScrolled, activeSection, scrollToSection, isMobileMenuOpen, setIsMobileMenuOpen, navLinks }: HeaderProps) => (
  <>
    <header className={`fixed w-full top-0 z-50 transition-all duration-300 ${isScrolled ? 'bg-slate-900/95 backdrop-blur-sm shadow-md py-3' : 'bg-slate-900 py-5'}`}>
      <div className="container mx-auto max-w-[90rem] px-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-xl font-bold text-white leading-tight">Dr. Nadia Atlassi</h1>
            <p className="text-xs text-blue-300 font-medium tracking-wide">DENTISTE PROFESSIONNELLE</p>
          </div>
        </div>

        <nav className="hidden lg:flex items-center gap-4 xl:gap-8">
          <ul className="flex gap-4 xl:gap-6">
            {navLinks.map((link) => (
              <li key={link.id}>
                <button 
                  onClick={() => scrollToSection(link.id)}
                  className={`text-sm font-medium whitespace-nowrap transition-colors hover:text-blue-400 ${activeSection === link.id ? 'text-blue-400 border-b-2 border-blue-400 pb-1' : 'text-slate-300'}`}
                >
                  {link.name}
                </button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2 xl:gap-3">
            <a href="tel:0524055200" className="bg-blue-600 text-white px-4 xl:px-5 py-2.5 rounded-full font-medium hover:bg-blue-700 transition-all shadow-lg hover:shadow-blue-600/30 flex items-center gap-2 text-sm whitespace-nowrap">
              <Phone size={18} /> Appelez-nous
            </a>
            <a href="https://wa.me/212624905942" target="_blank" rel="noopener noreferrer" className="bg-[#25D366] text-white px-4 xl:px-5 py-2.5 rounded-full font-medium hover:bg-[#20b858] transition-all shadow-lg hover:shadow-[#25D366]/30 flex items-center gap-2 text-sm whitespace-nowrap">
              <MessageCircle size={18} /> Contactez-nous
            </a>
          </div>
        </nav>

        <button className="md:hidden text-white p-2" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>
    </header>

    {isMobileMenuOpen && (
      <div className="fixed inset-0 z-40 bg-slate-900 pt-[100px] pb-8 px-4 md:hidden flex flex-col">
        <ul className="flex flex-col gap-4">
          {navLinks.map((link) => (
            <li key={link.id}>
              <button 
                onClick={() => scrollToSection(link.id)}
                className={`text-lg font-medium block w-full text-left ${activeSection === link.id ? 'text-blue-400' : 'text-white'}`}
              >
                {link.name}
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-auto flex flex-col gap-4">
           <a href="tel:0524055200" className="bg-blue-600 text-white px-6 py-4 rounded-xl font-semibold text-center hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
            <Phone size={20} /> Appelez-nous
          </a>
          <a href="https://wa.me/212624905942" target="_blank" rel="noopener noreferrer" className="bg-[#25D366] text-white px-6 py-4 rounded-xl font-semibold text-center hover:bg-[#20b858] transition-colors flex items-center justify-center gap-2">
            <MessageCircle size={20} /> WhatsApp
          </a>
        </div>
      </div>
    )}
  </>
);
