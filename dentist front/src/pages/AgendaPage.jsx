import { useState, useMemo } from 'react';
import { useAsyncData } from '../hooks/useAsyncData';
import { createAppointment, deleteAppointment, listAppointments, listPatients } from '../api/dentistApi';
import PageHeader from '../components/PageHeader';
import Notice from '../components/Notice';
import Field from '../components/Field';
import { describeError, formatDate, formatNumber, initials } from '../lib/format';

const WEEKDAYS = [
  { short: 'Lun', full: 'Lundi' },
  { short: 'Mar', full: 'Mardi' },
  { short: 'Mer', full: 'Mercredi' },
  { short: 'Jeu', full: 'Jeudi' },
  { short: 'Ven', full: 'Vendredi' },
  { short: 'Sam', full: 'Samedi', isWeekend: true },
  { short: 'Dim', full: 'Dimanche', isWeekend: true },
];

const WINDOWS = [
  { days: 7, label: '7 prochains jours' },
  { days: 30, label: '30 prochains jours' },
  { days: 90, label: '90 prochains jours' },
];

const pad = (value) => String(value).padStart(2, '0');

const toDateKey = (year, month, day) =>
  `${year}-${pad(month + 1)}-${pad(day)}`;

const getTodayKey = () => {
  const now = new Date();
  return toDateKey(now.getFullYear(), now.getMonth(), now.getDate());
};

const fullDateFormatter = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const monthTitleFormatter = new Intl.DateTimeFormat('fr-FR', {
  month: 'long',
  year: 'numeric',
});

export default function AgendaPage({ onNavigate }) {
  const today = new Date();
  const todayKey = getTodayKey();

  // Navigation & view states
  const [viewMode, setViewMode] = useState('month'); // 'month' | 'list'
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth()); // 0-11
  const [selectedDate, setSelectedDate] = useState(todayKey);

  // Form states
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ patientId: '', date: todayKey });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  // List view window state
  const [listDays, setListDays] = useState(30);

  // Generate calendar grid cells (Monday-Sunday)
  const calendarCells = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    // (0: Sunday, 1: Monday -> shift to Monday=0, Sunday=6)
    const firstDayOfWeek = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

    const cells = [];

    // Previous month padding
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i;
      const prevDate = new Date(currentYear, currentMonth - 1, day);
      const dateKey = toDateKey(prevDate.getFullYear(), prevDate.getMonth(), day);
      cells.push({
        day,
        dateKey,
        isOutside: true,
        year: prevDate.getFullYear(),
        month: prevDate.getMonth(),
      });
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = toDateKey(currentYear, currentMonth, day);
      cells.push({
        day,
        dateKey,
        isOutside: false,
        year: currentYear,
        month: currentMonth,
      });
    }

    // Next month padding (complete grid to multiple of 7, up to 35 or 42 cells)
    const remaining = (7 - (cells.length % 7)) % 7;
    for (let day = 1; day <= remaining; day++) {
      const nextDate = new Date(currentYear, currentMonth + 1, day);
      const dateKey = toDateKey(nextDate.getFullYear(), nextDate.getMonth(), day);
      cells.push({
        day,
        dateKey,
        isOutside: true,
        year: nextDate.getFullYear(),
        month: nextDate.getMonth(),
      });
    }

    return cells;
  }, [currentYear, currentMonth]);

  // Load patients
  const patients = useAsyncData(() => listPatients({ pageSize: 100 }), []);

  // Load appointments: monthly window in month view, or forward days in list view
  const schedule = useAsyncData(() => {
    if (viewMode === 'month') {
      const from = calendarCells[0]?.dateKey ?? toDateKey(currentYear, currentMonth, 1);
      const to = calendarCells[calendarCells.length - 1]?.dateKey ?? toDateKey(currentYear, currentMonth, 31);
      return listAppointments({ from, to, pageSize: 200 });
    }

    // List view window
    const from = todayKey;
    const toDate = new Date();
    toDate.setDate(toDate.getDate() + listDays);
    const to = toDateKey(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());
    return listAppointments({ from, to, pageSize: 200 });
  }, [viewMode, currentYear, currentMonth, listDays, calendarCells]);

  const patientItems = patients.data?.items ?? [];
  const appointments = schedule.data?.items ?? [];

  // Group appointments by date key for O(1) lookup
  const appointmentsByDate = useMemo(() => {
    const map = {};
    appointments.forEach((apt) => {
      if (!map[apt.date]) map[apt.date] = [];
      map[apt.date].push(apt);
    });
    return map;
  }, [appointments]);

  // Appointments for the currently selected day
  const selectedDayAppointments = appointmentsByDate[selectedDate] ?? [];

  // Month navigation handlers
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleToday = () => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth());
    setSelectedDate(todayKey);
  };

  const handleDayClick = (cell) => {
    setSelectedDate(cell.dateKey);
    // If clicking outside month, smoothly switch to that month
    if (cell.isOutside) {
      setCurrentYear(cell.year);
      setCurrentMonth(cell.month);
    }
  };

  const openBookingForDate = (dateKey) => {
    setForm({ patientId: '', date: dateKey || selectedDate });
    setShowForm(true);
    setFormError(null);
  };

  const update = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    setSaving(true);
    setFormError(null);

    try {
      await createAppointment({
        patientId: form.patientId,
        date: form.date,
      });

      setShowForm(false);
      setSelectedDate(form.date);
      setForm({ patientId: '', date: form.date });
      schedule.reload();
    } catch (problem) {
      setFormError(problem);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (appointment) => {
    const confirmed = window.confirm(
      `Supprimer le rendez-vous de ${appointment.patientName} le ${formatDate(appointment.date)} ?`,
    );

    if (!confirmed) return;

    setBusyId(appointment.id);
    setActionError(null);

    try {
      await deleteAppointment(appointment.id);
      schedule.reload();
    } catch (problem) {
      setActionError(problem);
    } finally {
      setBusyId(null);
    }
  };

  // Month title formatted (e.g., "Octobre 2026")
  const currentMonthTitle = monthTitleFormatter.format(new Date(currentYear, currentMonth, 1));

  // Selected date formatted in French (e.g. "samedi 24 octobre 2026")
  const formattedSelectedDate = (() => {
    const parts = selectedDate.split('-');
    if (parts.length === 3) {
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      return fullDateFormatter.format(d);
    }
    return formatDate(selectedDate);
  })();

  // Month metrics
  const monthAppointments = useMemo(() => {
    return appointments.filter((apt) => {
      const parts = apt.date.split('-');
      return Number(parts[0]) === currentYear && Number(parts[1]) - 1 === currentMonth;
    });
  }, [appointments, currentYear, currentMonth]);

  const appointmentsWithSms = monthAppointments.filter((a) => a.hasSms).length;
  const appointmentsPendingSms = monthAppointments.length - appointmentsWithSms;

  return (
    <>
      <PageHeader
        title="Agenda des consultations"
        subtitle="Planning mensuel complet des rendez-vous et suivi des consultations."
        eyebrow="CALENDRIER DU CABINET"
      >
        <button
          type="button"
          className="button button-ghost"
          onClick={() => {
            patients.reload();
            schedule.reload();
          }}
        >
          Actualiser
        </button>
        <button
          type="button"
          className="button"
          onClick={() => openBookingForDate(selectedDate)}
        >
          {showForm ? 'Masquer le formulaire' : 'Nouveau rendez-vous'}
        </button>
      </PageHeader>

      {/* Booking Form Card */}
      {showForm ? (
        <form className="card form-card" onSubmit={handleCreate}>
          <div className="card-head">
            <div>
              <h2>Prendre un rendez-vous</h2>
              <p className="muted">Sélectionnez le patient et la date de consultation.</p>
            </div>
            <button type="button" className="button button-ghost" onClick={() => setShowForm(false)}>
              Fermer
            </button>
          </div>

          {patients.error ? <Notice tone="error">{describeError(patients.error)}</Notice> : null}
          {formError ? <Notice tone="error">{describeError(formError)}</Notice> : null}
          {!patients.loading && patientItems.length === 0 ? (
            <Notice tone="info">
              Aucun patient enregistré. Créez d'abord un dossier patient —{' '}
              <button type="button" className="link-button" onClick={() => onNavigate('patients')}>
                ouvrir Patients
              </button>
              .
            </Notice>
          ) : null}

          <div className="form-grid">
            <Field label="Patient">
              <select name="patientId" value={form.patientId} onChange={update} required>
                <option value="">Sélectionnez un patient…</option>
                {patientItems.map((patient) => (
                  <option key={patient.id} value={patient.id}>
                    {patient.lastName.toUpperCase()} {patient.firstName} · {patient.phone}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Date du rendez-vous">
              <input type="date" name="date" value={form.date} onChange={update} required />
            </Field>
          </div>

          <div className="form-actions">
            <button type="submit" className="button" disabled={saving || patientItems.length === 0}>
              {saving ? 'Enregistrement…' : 'Confirmer le rendez-vous'}
            </button>
          </div>
        </form>
      ) : null}

      {schedule.error ? <Notice tone="error">{describeError(schedule.error)}</Notice> : null}
      {actionError ? <Notice tone="error">{describeError(actionError)}</Notice> : null}

      {/* Calendar & Inspector Split Layout */}
      <div className={`agenda-layout${viewMode === 'list' ? ' full-width' : ''}`}>
        <section className="card calendar-card">
          {/* Calendar Header with Navigation & View Toggles */}
          <div className="calendar-header">
            <div className="calendar-title-group">
              <div className="calendar-nav-buttons">
                <button
                  type="button"
                  className="calendar-nav-btn"
                  onClick={handlePrevMonth}
                  aria-label="Mois précédent"
                  title="Mois précédent"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="calendar-nav-btn calendar-today-btn"
                  onClick={handleToday}
                  title="Revenir à aujourd'hui"
                >
                  Aujourd'hui
                </button>
                <button
                  type="button"
                  className="calendar-nav-btn"
                  onClick={handleNextMonth}
                  aria-label="Mois suivant"
                  title="Mois suivant"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>

              <h2 className="calendar-title">{currentMonthTitle}</h2>
            </div>

            {/* View Mode Toggle: Mois vs Liste */}
            <div className="calendar-view-toggle">
              <button
                type="button"
                className={`calendar-view-btn${viewMode === 'month' ? ' is-active' : ''}`}
                onClick={() => setViewMode('month')}
              >
                📅 Mois
              </button>
              <button
                type="button"
                className={`calendar-view-btn${viewMode === 'list' ? ' is-active' : ''}`}
                onClick={() => setViewMode('list')}
              >
                📋 Liste
              </button>
            </div>
          </div>

          {/* Month Summary Bar */}
          {viewMode === 'month' ? (
            <div className="calendar-summary-bar">
              <div className="summary-metric">
                <span className="muted">Total ce mois :</span>
                <strong>{formatNumber(monthAppointments.length)} consultation(s)</strong>
              </div>
              <span className="summary-divider" style={{ width: '1px', height: '12px', background: 'var(--border)', margin: '0 4px' }} />
              <div className="summary-metric">
                <span className="pill-dot ok" />
                <span>SMS envoyé(s) : <strong>{appointmentsWithSms}</strong></span>
              </div>
              <span className="summary-divider" style={{ width: '1px', height: '12px', background: 'var(--border)', margin: '0 4px' }} />
              <div className="summary-metric">
                <span className="pill-dot pending" />
                <span>Rappels en attente : <strong>{appointmentsPendingSms}</strong></span>
              </div>
            </div>
          ) : null}

          {/* VIEW 1: MONTH CALENDAR GRID */}
          {viewMode === 'month' ? (
            <>
              {/* Day headers: Lun - Dim */}
              <div className="calendar-weekdays">
                {WEEKDAYS.map((w) => (
                  <div
                    key={w.short}
                    className={`calendar-weekday${w.isWeekend ? ' is-weekend' : ''}`}
                    title={w.full}
                  >
                    {w.short}
                  </div>
                ))}
              </div>

              {/* 7-column Calendar Grid */}
              <div className="calendar-grid">
                {calendarCells.map((cell) => {
                  const dayApts = appointmentsByDate[cell.dateKey] ?? [];
                  const isToday = cell.dateKey === todayKey;
                  const isSelected = cell.dateKey === selectedDate;

                  return (
                    <div
                      key={cell.dateKey}
                      className={`calendar-cell${cell.isOutside ? ' is-outside' : ''}${
                        isToday ? ' is-today' : ''
                      }${isSelected ? ' is-selected' : ''}`}
                      onClick={() => handleDayClick(cell)}
                    >
                      <div className="cell-top">
                        <span className="cell-date-badge">{cell.day}</span>
                        {dayApts.length > 0 ? (
                          <span className="cell-count-tag" title={`${dayApts.length} rendez-vous`}>
                            {dayApts.length}
                          </span>
                        ) : null}
                      </div>

                      {/* Appointment Chips inside Day Cell */}
                      <div className="cell-appointments">
                        {dayApts.slice(0, 2).map((apt) => (
                          <div
                            key={apt.id}
                            className={`cell-appointment-pill ${apt.hasSms ? 'has-sms' : 'no-sms'}`}
                            title={`${apt.patientName} (${apt.hasSms ? 'SMS envoyé' : 'Pas de SMS'})`}
                          >
                            <span className={`pill-dot ${apt.hasSms ? 'ok' : 'pending'}`} />
                            <span>{apt.patientName}</span>
                          </div>
                        ))}
                        {dayApts.length > 2 ? (
                          <div className="cell-more-pill">
                            +{dayApts.length - 2} autre{dayApts.length - 2 > 1 ? 's' : ''}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            /* VIEW 2: CLASSIC LIST VIEW */
            <div style={{ padding: '16px 20px' }}>
              <div className="chips" style={{ marginBottom: '16px' }}>
                {WINDOWS.map((option) => (
                  <button
                    key={option.days}
                    type="button"
                    className={`chip${listDays === option.days ? ' is-active' : ''}`}
                    aria-pressed={listDays === option.days}
                    onClick={() => setListDays(option.days)}
                  >
                    {option.label}
                  </button>
                ))}
                <span className="counter">{formatNumber(appointments.length)} rendez-vous</span>
              </div>

              {appointments.length === 0 ? (
                <p className="empty">Aucun rendez-vous sur cette période.</p>
              ) : (
                <table className="table agenda-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Patient</th>
                      <th>Statut SMS</th>
                      <th aria-label="Actions" style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {appointments.map((appointment) => (
                      <tr key={appointment.id}>
                        <td>
                          <strong>{formatDate(appointment.date)}</strong>
                        </td>
                        <td>
                          <span className="person">
                            <span className="avatar" aria-hidden="true">
                              {initials(
                                appointment.patientName.split(' ')[0],
                                appointment.patientName.split(' ').at(-1),
                              )}
                            </span>
                            <span>
                              <strong>{appointment.patientName}</strong>
                              <a className="muted block" href={`tel:${appointment.patientPhone}`}>
                                {appointment.patientPhone}
                              </a>
                            </span>
                          </span>
                        </td>
                        <td>
                          {appointment.hasSms ? (
                            <span className="badge badge-active">SMS Envoyé</span>
                          ) : (
                            <span className="badge badge-pending">Pas de SMS</span>
                          )}
                        </td>
                        <td className="cell-actions">
                          <button
                            type="button"
                            className="button button-quiet"
                            disabled={busyId === appointment.id}
                            onClick={() => remove(appointment)}
                          >
                            {busyId === appointment.id ? 'Suppression…' : 'Supprimer'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </section>

        {/* SIDEBAR: Selected Day Inspector (in Month View) */}
        {viewMode === 'month' ? (
          <aside className="card day-inspector">
            <div className="inspector-date-header">
              <div>
                <span className="muted block" style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 700 }}>
                  Jour sélectionné
                </span>
                <h3 className="inspector-date-title">{formattedSelectedDate}</h3>
              </div>
              <button
                type="button"
                className="button"
                style={{ padding: '6px 10px', fontSize: '11.5px' }}
                onClick={() => openBookingForDate(selectedDate)}
                title="Ajouter un rendez-vous pour cette date"
              >
                + Ajouter
              </button>
            </div>

            {selectedDayAppointments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 8px' }}>
                <p className="muted" style={{ fontSize: '12px', margin: '0 0 12px' }}>
                  Aucun rendez-vous prévu pour cette date.
                </p>
                <button
                  type="button"
                  className="button button-ghost"
                  style={{ fontSize: '12px' }}
                  onClick={() => openBookingForDate(selectedDate)}
                >
                  Planifier une consultation
                </button>
              </div>
            ) : (
              <div className="inspector-appointment-list">
                {selectedDayAppointments.map((apt) => (
                  <div key={apt.id} className="inspector-card">
                    <div className="inspector-card-main">
                      <div className="inspector-patient-info">
                        <span className="avatar blue" style={{ width: '28px', height: '28px', fontSize: '9px' }}>
                          {initials(
                            apt.patientName.split(' ')[0],
                            apt.patientName.split(' ').at(-1),
                          )}
                        </span>
                        <div>
                          <strong style={{ fontSize: '12.5px', color: 'var(--foreground)' }}>
                            {apt.patientName}
                          </strong>
                          <a
                            href={`tel:${apt.patientPhone}`}
                            className="muted block"
                            style={{ fontSize: '11px', textDecoration: 'none' }}
                          >
                            {apt.patientPhone}
                          </a>
                        </div>
                      </div>

                      {apt.hasSms ? (
                        <span className="badge badge-active" style={{ fontSize: '10px', padding: '2px 6px' }}>
                          SMS OK
                        </span>
                      ) : (
                        <span className="badge badge-pending" style={{ fontSize: '10px', padding: '2px 6px' }}>
                          Sans SMS
                        </span>
                      )}
                    </div>

                    <div className="inspector-actions">
                      <button
                        type="button"
                        className="link-button"
                        style={{ fontSize: '11px' }}
                        onClick={() => onNavigate('messages')}
                      >
                        Gérer SMS →
                      </button>
                      <button
                        type="button"
                        className="button button-quiet"
                        style={{ fontSize: '11px', padding: '4px 8px' }}
                        disabled={busyId === apt.id}
                        onClick={() => remove(apt)}
                      >
                        {busyId === apt.id ? 'Suppression…' : 'Supprimer'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </aside>
        ) : null}
      </div>
    </>
  );
}
