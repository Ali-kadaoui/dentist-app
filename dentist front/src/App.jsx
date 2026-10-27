import { useState, useEffect, useCallback } from 'react';
import DashboardPage from './pages/DashboardPage';
import AgendaPage from './pages/AgendaPage';
import PatientsPage from './pages/PatientsPage';
import DossierPage from './pages/DossierPage';
import PaymentsPage from './pages/PaymentsPage';
import MedicinesPage from './pages/MedicinesPage';
import MessagesPage from './pages/MessagesPage';
import Sidebar from './components/Sidebar';

const VIEWS = {
  dashboard: DashboardPage,
  agenda: AgendaPage,
  patients: PatientsPage,
  dossiers: DossierPage,
  payments: PaymentsPage,
  medicines: MedicinesPage,
  messages: MessagesPage,
};

const VALID_VIEWS = Object.keys(VIEWS);

function parseCurrentLocation() {
  const path = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
  const searchParams = new URLSearchParams(window.location.search);
  const patientId = searchParams.get('patientId') || null;

  if (VALID_VIEWS.includes(path)) {
    return { view: path, patientId };
  }
  return { view: 'dashboard', patientId };
}

export default function App() {
  const initial = parseCurrentLocation();
  const [view, setView] = useState(initial.view);
  const [activePatientId, setActivePatientId] = useState(initial.patientId);

  const ActivePage = VIEWS[view] ?? DashboardPage;

  const handleNavigate = useCallback((nextView, patientId = null, replace = false) => {
    setActivePatientId(patientId);
    setView(nextView);

    const targetPath = nextView === 'dashboard' ? '/' : `/${nextView}`;
    const targetSearch = patientId ? `?patientId=${encodeURIComponent(patientId)}` : '';
    const targetUrl = `${targetPath}${targetSearch}`;

    if (window.location.pathname + window.location.search !== targetUrl) {
      if (replace) {
        window.history.replaceState({ view: nextView, patientId }, '', targetUrl);
      } else {
        window.history.pushState({ view: nextView, patientId }, '', targetUrl);
      }
    }
  }, []);

  // Listen to browser Back / Forward buttons (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const loc = parseCurrentLocation();
      setView(loc.view);
      setActivePatientId(loc.patientId);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const todayFormatted = new Date().toLocaleDateString('fr-FR', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="app-shell">
      <Sidebar activeView={view} onNavigate={handleNavigate} />
      <div className={`main page-${view}`}>
        <header>
          <div className="header-spacer" />
          <div className="header-actions">
            <span className="header-date">{todayFormatted}</span>
            <div className="header-divider" />
            <button
              type="button"
              className="icon-button"
              aria-label="Notifications"
              onClick={() => handleNavigate('messages')}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <i />
            </button>
          </div>
        </header>

        <div className="content">
          <ActivePage
            onNavigate={handleNavigate}
            initialPatientId={activePatientId}
            onSelectPatient={setActivePatientId}
          />
        </div>
      </div>
    </div>
  );
}
