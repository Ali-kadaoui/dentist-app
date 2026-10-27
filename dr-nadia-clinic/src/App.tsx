import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { About } from './components/About';
import { Services } from './components/Services';
import { Cases } from './components/Cases';
import { Reviews } from './components/Reviews';
import { Equipment } from './components/Equipment';
import { Footer } from './components/Footer';

export default function App() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('accueil');

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);

      const sections = ['accueil', 'a-propos', 'soins', 'equipement', 'cas-cliniques', 'avis', 'contact'];
      let current = '';

      for (const section of sections) {
        const element = document.getElementById(section);
        if (element) {
          const rect = element.getBoundingClientRect();
          if (rect.top <= 100 && rect.bottom >= 100) {
            current = section;
            break;
          }
        }
      }

      if (current && current !== activeSection) {
        setActiveSection(current);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [activeSection]);

  const scrollToSection = (sectionId: string) => {
    setIsMobileMenuOpen(false);
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const navLinks = [
    { name: 'Accueil', id: 'accueil' },
    { name: 'À Propos', id: 'a-propos' },
    { name: 'Soins', id: 'soins' },
    { name: 'Équipement', id: 'equipement' },
    { name: 'Cas Cliniques', id: 'cas-cliniques' },
    { name: 'Avis Patients', id: 'avis' },
    { name: 'Contact', id: 'contact' },
  ];

  return (
    <div className="min-h-screen bg-white text-slate-800 font-sans selection:bg-blue-600 selection:text-white">
      <Header 
        isScrolled={isScrolled}
        activeSection={activeSection}
        scrollToSection={scrollToSection}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        navLinks={navLinks}
      />
      <Hero />
      <About />
      <Services />
      <Equipment />
      <Cases />
      <Reviews />
      <Footer />
    </div>
  );
}