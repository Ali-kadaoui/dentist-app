import { useState, useMemo } from 'react';
import { useAsyncData } from '../hooks/useAsyncData';
import {
  getDashboardSummary,
  listAppointments,
  listPatients,
  listDueReminders,
} from '../api/dentistApi';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import Notice from '../components/Notice';
import { describeError, formatDate, initials } from '../lib/format';

export default function DashboardPage({ onNavigate }) {
  const summary = useAsyncData(getDashboardSummary, []);
  const todayDate = new Date().toISOString().split('T')[0];
  const upcomingSchedule = useAsyncData(
    () => listAppointments({ from: todayDate, pageSize: 20 }),
    []
  );
  const dueReminders = useAsyncData(() => listDueReminders({ horizonDays: 7 }), []);
  const patients = useAsyncData(() => listPatients({ pageSize: 10 }), []);

  const [refreshing, setRefreshing] = useState(false);
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'today'
  const [searchQuery, setSearchQuery] = useState('');

  const data = summary.data;
  const rawAppointments = upcomingSchedule.data?.items ?? [];
  const due = dueReminders.data ?? [];
  const patientList = patients.data?.items ?? [];

  const handleRefreshAll = async () => {
    setRefreshing(true);
    await Promise.all([
      summary.reload(),
      upcomingSchedule.reload(),
      dueReminders.reload(),
      patients.reload(),
    ]);
    setTimeout(() => setRefreshing(false), 300);
  };

  const todayFormatted = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const todayCount = useMemo(() => {
    return rawAppointments.filter((a) => a.date === todayDate).length;
  }, [rawAppointments, todayDate]);

  const filteredAppointments = useMemo(() => {
    let list = rawAppointments;
    if (filterMode === 'today') {
      list = list.filter((a) => a.date === todayDate);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (a) =>
          (a.patientName && a.patientName.toLowerCase().includes(q)) ||
          (a.patientPhone && a.patientPhone.includes(q))
      );
    }
    return list;
  }, [rawAppointments, filterMode, todayDate, searchQuery]);

  return (
    <div className="dashboard-container">
      {/* Top Header */}
      <PageHeader
        title="Tableau de Bord Clinique"
        subtitle={`Cabinet Dentaire · ${todayFormatted.charAt(0).toUpperCase() + todayFormatted.slice(1)} · Vue d'ensemble et suivi des consultations.`}
        eyebrow="CABINET DENTAIRE · GESTION CLINIQUE"
      >
        <button
          type="button"
          className="button button-ghost"
          onClick={handleRefreshAll}
          disabled={refreshing}
          title="Actualiser les données"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            style={{
              transition: 'transform 0.5s ease',
              transform: refreshing ? 'rotate(360deg)' : 'none',
              marginRight: '6px',
            }}
          >
            <path d="M23 4v6h-6" />
            <path d="M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          Actualiser
        </button>

        <button
          type="button"
          className="button button-secondary"
          onClick={() => onNavigate && onNavigate('patients')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ marginRight: '6px' }}>
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nouveau Patient
        </button>

        <button
          type="button"
          className="button button-primary"
          onClick={() => onNavigate && onNavigate('agenda')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ marginRight: '6px' }}>
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          Nouveau Rendez-vous
        </button>
      </PageHeader>

      {summary.error ? <Notice tone="error">{describeError(summary.error)}</Notice> : null}

      {/* KPI Stats */}
      <section className="stats-grid">
        <StatCard
          label="Dossiers Patients"
          value={data?.totalPatients ?? '—'}
          hint="Patients suivis au cabinet"
          tone="default"
        />
        <StatCard
          label="Au Fauteuil Aujourd'hui"
          value={data?.appointmentsToday ?? todayCount}
          hint="Consultations prévues ce jour"
          tone="accent"
        />
        <StatCard
          label="Soins Programmés"
          value={data?.upcomingAppointments ?? '—'}
          hint="Prochains rendez-vous"
          tone="ok"
        />
        <StatCard
          label="Rappels SMS Actifs"
          value={data?.messages ?? '—'}
          hint="Confirmations automatiques"
          tone="warn"
        />
      </section>

      {/* Quick Access Shortcuts Strip */}
      <section className="dashboard-shortcuts">
        <div
          className="shortcut-card"
          onClick={() => onNavigate && onNavigate('dossiers')}
        >
          <div className="shortcut-icon teal">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2C9.5 2 7.5 3.5 7 5.5c-.8 3-2 6-2 9.5 0 2.5 1.5 5 3.5 5 1.5 0 2-1.5 3.5-1.5s2 1.5 3.5 1.5c2 0 3.5-2.5 3.5-5 0-3.5-1.2-6.5-2-9.5C16.5 3.5 14.5 2 12 2z" />
            </svg>
          </div>
          <div className="shortcut-info">
            <strong>Schéma Dentaire FDI</strong>
            <span>Odontogramme & soins</span>
          </div>
          <span className="shortcut-arrow">→</span>
        </div>

        <div
          className="shortcut-card"
          onClick={() => onNavigate && onNavigate('medicines')}
        >
          <div className="shortcut-icon blue">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.5 20.5l10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7z" />
              <line x1="8.5" y1="8.5" x2="15.5" y2="15.5" />
            </svg>
          </div>
          <div className="shortcut-info">
            <strong>Ordonnances & Médicaments</strong>
            <span>Prescriptions & posologies</span>
          </div>
          <span className="shortcut-arrow">→</span>
        </div>

        <div
          className="shortcut-card"
          onClick={() => onNavigate && onNavigate('payments')}
        >
          <div className="shortcut-icon amber">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
          </div>
          <div className="shortcut-info">
            <strong>Règlements & Factures</strong>
            <span>Honoraires & paiements</span>
          </div>
          <span className="shortcut-arrow">→</span>
        </div>

        <div
          className="shortcut-card"
          onClick={() => onNavigate && onNavigate('messages')}
        >
          <div className="shortcut-icon purple">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <div className="shortcut-info">
            <strong>Rappels & SMS</strong>
            <span>Passerelle d'envoi</span>
          </div>
          <span className="shortcut-arrow">→</span>
        </div>
      </section>

      {/* Main Table: Prochains Rendez-vous au Fauteuil */}
      <section className="card table-panel dashboard-panel">
        <div className="dashboard-table-header">
          <div className="dashboard-table-title">
            <div className="panel-badge-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <div>
              <h2>Prochains Rendez-vous au Fauteuil</h2>
              <p className="muted">Consultations et soins programmés</p>
            </div>
          </div>

          <div className="dashboard-table-controls">
            {/* Filter Tabs */}
            <div className="dashboard-pill-toggle">
              <button
                type="button"
                className={`pill-toggle-btn ${filterMode === 'all' ? 'is-active' : ''}`}
                onClick={() => setFilterMode('all')}
              >
                Tous ({rawAppointments.length})
              </button>
              <button
                type="button"
                className={`pill-toggle-btn ${filterMode === 'today' ? 'is-active' : ''}`}
                onClick={() => setFilterMode('today')}
              >
                Aujourd'hui ({todayCount})
              </button>
            </div>

            {/* Quick search */}
            <div className="dashboard-search">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Filtrer par nom ou tél…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery ? (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => setSearchQuery('')}
                  title="Effacer"
                >
                  ×
                </button>
              ) : null}
            </div>

            <button
              type="button"
              className="button button-ghost"
              style={{ padding: '6px 12px', fontSize: '11.5px' }}
              onClick={() => onNavigate && onNavigate('agenda')}
            >
              Calendrier complet →
            </button>
          </div>
        </div>

        {upcomingSchedule.loading && !upcomingSchedule.data ? (
          <p className="empty" style={{ padding: '24px' }}>Chargement des consultations…</p>
        ) : null}

        {!upcomingSchedule.loading && filteredAppointments.length === 0 ? (
          <div style={{ padding: '36px 20px', textAlign: 'center' }}>
            <p className="empty" style={{ margin: 0 }}>
              {searchQuery
                ? 'Aucun rendez-vous correspondant à cette recherche.'
                : filterMode === 'today'
                ? 'Aucune consultation prévue pour aujourd’hui.'
                : 'Aucun rendez-vous à venir sur le planning.'}
            </p>
            <button
              type="button"
              className="button button-ghost"
              style={{ marginTop: '12px' }}
              onClick={() => onNavigate && onNavigate('agenda')}
            >
              Planifier un rendez-vous
            </button>
          </div>
        ) : null}

        {filteredAppointments.length > 0 ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Date & Heure</th>
                  <th>Patient</th>
                  <th>Téléphone</th>
                  <th>Statut SMS</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAppointments.map((item) => (
                  <tr
                    key={item.id}
                    className="dashboard-table-row"
                    onClick={() => onNavigate && onNavigate('dossiers', item.patientId)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <span className={`date-badge ${item.date === todayDate ? 'is-today' : ''}`}>
                        {item.date === todayDate ? "Aujourd'hui" : formatDate(item.date)}
                      </span>
                    </td>
                    <td>
                      <div className="person">
                        <span className="avatar avatar-teal">
                          {initials(
                            item.patientName.split(' ')[0],
                            item.patientName.split(' ').at(-1)
                          )}
                        </span>
                        <div>
                          <strong style={{ display: 'block', fontSize: '13px' }}>
                            {item.patientName}
                          </strong>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>
                            Consultation programmée
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <a
                        href={`tel:${item.patientPhone}`}
                        className="muted"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          color: '#475569',
                          fontWeight: 500,
                          fontSize: '12px',
                        }}
                      >
                        {item.patientPhone}
                      </a>
                    </td>
                    <td>
                      {item.hasSms ? (
                        <span className="status-tag status-ok">
                          ✓ SMS Confirmé
                        </span>
                      ) : (
                        <span className="status-tag status-pending">
                          En attente d'envoi
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div
                        style={{ display: 'inline-flex', gap: '6px' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="button button-secondary"
                          style={{ padding: '4px 10px', fontSize: '11px' }}
                          onClick={() => onNavigate && onNavigate('dossiers', item.patientId)}
                          title="Consulter le dossier médical"
                        >
                          Dossier
                        </button>
                        <button
                          type="button"
                          className="button button-ghost"
                          style={{ padding: '4px 8px', fontSize: '11px' }}
                          onClick={() => onNavigate && onNavigate('messages')}
                          title="Envoyer un rappel SMS"
                        >
                          SMS
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {/* Grid: Rappels SMS dus & Nouveaux Patients */}
      <div className="split">
        {/* Card: Rappels SMS */}
        <section className="card dashboard-card">
          <div className="card-head">
            <div>
              <h2>Rappels SMS Préventifs (7 jours)</h2>
              <p className="muted">Rendez-vous proches sans confirmation envoyée</p>
            </div>
            <button
              type="button"
              className="link-button"
              style={{ fontSize: '12px', fontWeight: 600 }}
              onClick={() => onNavigate && onNavigate('messages')}
            >
              Passerelle →
            </button>
          </div>

          <div style={{ padding: '14px 18px' }}>
            {due.length === 0 ? (
              <p className="empty" style={{ margin: '14px 0' }}>
                ✓ Tous les rappels sont à jour. Aucun SMS en attente !
              </p>
            ) : (
              <ul className="due-list" style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {due.slice(0, 4).map((reminder) => (
                  <li
                    className="due-item"
                    key={reminder.appointmentId}
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '10px 12px',
                    }}
                  >
                    <div className="due-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <div>
                        <strong style={{ fontSize: '12.5px', color: '#0f2744' }}>{reminder.patientName}</strong>
                        <span className="muted block" style={{ fontSize: '11px' }}>
                          {formatDate(reminder.date)} · {reminder.phone}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="button button-primary"
                        style={{ padding: '3px 9px', fontSize: '11px' }}
                        onClick={() => onNavigate && onNavigate('messages')}
                      >
                        Envoyer
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Card: Dossiers Patients Récents */}
        <section className="card dashboard-card">
          <div className="card-head">
            <div>
              <h2>Dossiers Patients Récents</h2>
              <p className="muted">Accès direct aux fiches et historiques</p>
            </div>
            <button
              type="button"
              className="link-button"
              style={{ fontSize: '12px', fontWeight: 600 }}
              onClick={() => onNavigate && onNavigate('patients')}
            >
              Tous les patients →
            </button>
          </div>

          {patientList.length === 0 ? (
            <p className="empty" style={{ padding: '24px 20px' }}>Aucun dossier patient trouvé.</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Téléphone</th>
                    <th style={{ textAlign: 'right' }}>Fiche</th>
                  </tr>
                </thead>
                <tbody>
                  {patientList.map((pt) => (
                    <tr
                      key={pt.id}
                      onClick={() => onNavigate && onNavigate('dossiers', pt.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <div className="person">
                          <span className="avatar avatar-teal">
                            {initials(pt.firstName, pt.lastName)}
                          </span>
                          <div>
                            <strong style={{ fontSize: '12.5px' }}>
                              {pt.firstName} {pt.lastName}
                            </strong>
                            {pt.profession ? (
                              <span style={{ fontSize: '10.5px', color: '#64748b', display: 'block' }}>
                                {pt.profession}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: '12px', color: '#475569' }}>
                          {pt.phone}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="button button-secondary"
                          style={{ padding: '3px 8px', fontSize: '11px' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigate && onNavigate('dossiers', pt.id);
                          }}
                        >
                          Dossier →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
