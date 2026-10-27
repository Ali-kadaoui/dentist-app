import { useEffect, useState, useMemo } from 'react';
import { useAsyncData } from '../hooks/useAsyncData';
import {
  createAppointment,
  createDentalTreatment,
  createPatientState,
  createPayment,
  deleteAppointment,
  deleteDentalTreatment,
  deletePatientState,
  getDentalChart,
  getPatient,
  listAppointments,
  listDentalTreatments,
  listMedicines,
  listPatients,
  listPatientStates,
  saveDentalChart,
  sendReminder,
  updateDentalTreatment,
} from '../api/dentistApi';
import PageHeader from '../components/PageHeader';
import Notice from '../components/Notice';
import Field from '../components/Field';
import DentalChart from '../components/DentalChart';
import DentalTreatmentsLedger from '../components/DentalTreatmentsLedger';
import { describeError, formatDate, formatNumber, initials } from '../lib/format';

function calculateAge(dobString) {
  if (!dobString) return null;
  const birth = new Date(dobString);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  return age >= 0 ? age : null;
}

function getTodayString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getFutureDateString(daysAhead) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const TICKET_PRESET_TREATMENTS = [
  'Consultation & Bilan',
  'Détartrage & Polissage',
  'Soin Carie & Composite',
  'Dévitalisation / Endodontie',
  'Extraction Simple',
  'Extraction Chirurgicale / Sagesse',
  'Couronne Céramique',
  'Pose d’Implant Dentaire',
  'Blanchiment Dentaire',
];

export default function DossierPage({ initialPatientId, onNavigate, onSelectPatient }) {
  // If initialPatientId is provided (e.g. navigated from Patients tab), open that dossier directly; otherwise start on list
  const [selectedPatientId, setSelectedPatientId] = useState(initialPatientId || null);

  // Search & filter in client dossiers list
  const [searchDraft, setSearchDraft] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Dropdown switcher inside the active dossier
  const [showQuickSwitcher, setShowQuickSwitcher] = useState(false);
  const [quickSwitchSearch, setQuickSwitchSearch] = useState('');

  // --- Ticket / PDF Generator State ---
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [ticketConsultationDate, setTicketConsultationDate] = useState(getTodayString());
  const [ticketTreatment, setTicketTreatment] = useState('Consultation & Bilan');
  const [ticketTotalAmount, setTicketTotalAmount] = useState('400');
  const [ticketPaidAmount, setTicketPaidAmount] = useState('400');
  const [ticketPaymentMethod, setTicketPaymentMethod] = useState('Espèces');
  const [ticketIsEnd, setTicketIsEnd] = useState(false);
  const [ticketNextDate, setTicketNextDate] = useState('');
  const [ticketNextTime, setTicketNextTime] = useState('10:00');
  const [ticketMedicines, setTicketMedicines] = useState([]);
  const [ticketSaving, setTicketSaving] = useState(false);

  // New Appointment Form state
  const [appointmentDate, setAppointmentDate] = useState(getTodayString());
  const [bookingSaving, setBookingSaving] = useState(false);
  const [bookingError, setBookingError] = useState(null);
  const [bookingSuccess, setBookingSuccess] = useState(null);

  // New Clinical State Form state
  const [newProblem, setNewProblem] = useState('');
  const [newProgress, setNewProgress] = useState('');
  const [stateSaving, setStateSaving] = useState(false);
  const [stateError, setStateError] = useState(null);

  // SMS Reminder action state
  const [sendingSmsId, setSendingSmsId] = useState(null);

  // Synchronize if initialPatientId changes from props
  useEffect(() => {
    setSelectedPatientId(initialPatientId || null);
  }, [initialPatientId]);

  // Load clients list for the main selector view
  const clientsQuery = useAsyncData(
    () => listPatients({ search: searchTerm, pageSize: 60 }),
    [searchTerm]
  );
  const clientsList = clientsQuery.data?.items ?? [];
  const totalClients = clientsQuery.data?.total ?? 0;

  // Load active patient details when a dossier is selected
  const activePatientQuery = useAsyncData(
    () => (selectedPatientId ? getPatient(selectedPatientId) : Promise.resolve(null)),
    [selectedPatientId]
  );
  const patient = activePatientQuery.data;

  // Load clinical notes / states for active patient
  const statesQuery = useAsyncData(
    () => (selectedPatientId ? listPatientStates(selectedPatientId) : Promise.resolve([])),
    [selectedPatientId]
  );
  const clinicalStates = statesQuery.data ?? [];

  // Load appointments (generous window to filter by active patient)
  const appointmentsQuery = useAsyncData(
    () => listAppointments({ pageSize: 200 }),
    [selectedPatientId]
  );
  const allAppointments = appointmentsQuery.data?.items ?? [];
  const patientAppointments = allAppointments
    .filter((a) => a.patientId === selectedPatientId)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  // --- DENTAL CHART & TREATMENTS DATA ---
  const chartQuery = useAsyncData(
    () => (selectedPatientId ? getDentalChart(selectedPatientId) : Promise.resolve(null)),
    [selectedPatientId]
  );

  const parsedChartData = useMemo(() => {
    if (!chartQuery.data) return { dentitionMode: 'auto', teethStates: {}, excludedTeeth: [], customAddedTeeth: [] };
    try {
      const parsed = JSON.parse(chartQuery.data.teethDataJson || '{}');
      return {
        dentitionMode: chartQuery.data.dentitionMode || 'auto',
        teethStates: parsed.teethStates || {},
        excludedTeeth: parsed.excludedTeeth || [],
        customAddedTeeth: parsed.customAddedTeeth || [],
      };
    } catch {
      return { dentitionMode: 'auto', teethStates: {}, excludedTeeth: [], customAddedTeeth: [] };
    }
  }, [chartQuery.data]);

  const treatmentsQuery = useAsyncData(
    () => (selectedPatientId ? listDentalTreatments(selectedPatientId) : Promise.resolve([])),
    [selectedPatientId]
  );
  const dentalTreatments = treatmentsQuery.data ?? [];

  const [prefilledToothForTreatment, setPrefilledToothForTreatment] = useState(null);

  const handleSaveChart = async (newChartData) => {
    if (!selectedPatientId) return;
    try {
      await saveDentalChart(selectedPatientId, {
        dentitionMode: newChartData.dentitionMode,
        teethDataJson: JSON.stringify({
          teethStates: newChartData.teethStates,
          excludedTeeth: newChartData.excludedTeeth,
          customAddedTeeth: newChartData.customAddedTeeth,
        }),
      });
      chartQuery.reload();
    } catch (err) {
      console.error('Erreur sauvegarde schéma dentaire:', err);
    }
  };

  const handleCreateDentalTreatment = async (payload) => {
    if (!selectedPatientId) return;
    await createDentalTreatment(selectedPatientId, payload);
    treatmentsQuery.reload();
  };

  const handleUpdateDentalTreatment = async (treatmentId, payload) => {
    if (!selectedPatientId) return;
    await updateDentalTreatment(selectedPatientId, treatmentId, payload);
    treatmentsQuery.reload();
  };

  const handleDeleteDentalTreatment = async (treatmentId) => {
    if (!selectedPatientId) return;
    await deleteDentalTreatment(selectedPatientId, treatmentId);
    treatmentsQuery.reload();
  };

  // Switch to a client dossier
  const selectClient = (patientId) => {
    setSelectedPatientId(patientId);
    if (onSelectPatient) onSelectPatient(patientId);
    setShowQuickSwitcher(false);
    setPrefilledToothForTreatment(null);
    setBookingError(null);
    setBookingSuccess(null);
    setStateError(null);
  };

  // Back to list view
  const handleBackToList = () => {
    setSelectedPatientId(null);
    if (onSelectPatient) onSelectPatient(null);
    setShowQuickSwitcher(false);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setSearchTerm(searchDraft.trim());
  };

  const handleClearSearch = () => {
    setSearchDraft('');
    setSearchTerm('');
  };

  // --- Handlers: Appointments ---
  const handleBookAppointment = async (e) => {
    e.preventDefault();
    if (!selectedPatientId || !appointmentDate) return;

    setBookingSaving(true);
    setBookingError(null);
    setBookingSuccess(null);

    try {
      await createAppointment({
        patientId: selectedPatientId,
        date: appointmentDate,
      });

      setBookingSuccess(`Rendez-vous planifié pour le ${formatDate(appointmentDate)}.`);
      appointmentsQuery.reload();
      setTimeout(() => setBookingSuccess(null), 4000);
    } catch (err) {
      setBookingError(err);
    } finally {
      setBookingSaving(false);
    }
  };

  const handleDeleteAppointment = async (appointmentId, date) => {
    if (!window.confirm(`Confirmer l'annulation du rendez-vous du ${formatDate(date)} ?`)) {
      return;
    }

    try {
      await deleteAppointment(appointmentId);
      appointmentsQuery.reload();
    } catch (err) {
      alert(`Erreur lors de l'annulation: ${describeError(err)}`);
    }
  };

  const handleSendReminderSms = async (appointmentId) => {
    setSendingSmsId(appointmentId);
    try {
      await sendReminder({ appointmentId });
      appointmentsQuery.reload();
      alert('SMS de rappel envoyé avec succès.');
    } catch (err) {
      alert(`Erreur d'envoi SMS: ${describeError(err)}`);
    } finally {
      setSendingSmsId(null);
    }
  };

  // --- Handlers: Clinical Updates ---
  const handleAddClinicalState = async (e) => {
    e.preventDefault();
    if (!selectedPatientId) return;

    setStateSaving(true);
    setStateError(null);

    try {
      await createPatientState(selectedPatientId, {
        problem: newProblem.trim(),
        progress: newProgress.trim(),
      });

      setNewProblem('');
      setNewProgress('');
      statesQuery.reload();
    } catch (err) {
      setStateError(err);
    } finally {
      setStateSaving(false);
    }
  };

  const handleDeleteClinicalState = async (stateId) => {
    if (!window.confirm('Supprimer cette observation clinique du dossier ?')) {
      return;
    }

    try {
      await deletePatientState(selectedPatientId, stateId);
      statesQuery.reload();
    } catch (err) {
      alert(`Erreur lors de la suppression: ${describeError(err)}`);
    }
  };

  // Load medicines catalog for ticket selection
  const medicinesCatalog = useAsyncData(
    () => (showTicketModal ? listMedicines({ pageSize: 100 }) : Promise.resolve({ items: [] })),
    [showTicketModal]
  );

  const openTicketModal = () => {
    // Find next upcoming appointment
    const upcoming = patientAppointments.find(
      (a) => new Date(`${a.date}T23:59:59`) >= new Date()
    );

    setTicketConsultationDate(getTodayString());
    setTicketTreatment('Consultation & Bilan');
    setTicketTotalAmount('400');
    setTicketPaidAmount('400');
    setTicketPaymentMethod('Espèces');
    setTicketMedicines([]);

    if (upcoming) {
      setTicketNextDate(upcoming.date);
      setTicketIsEnd(false);
    } else {
      setTicketNextDate('');
      setTicketIsEnd(false);
    }

    setShowTicketModal(true);
  };

  const cleanMedicalText = (str) => {
    if (!str) return '';
    return String(str)
      .replace(/comprim\?\?/gi, 'comprimé')
      .replace(/pellicul\?\?/gi, 'pelliculé')
      .replace(/d\?\?but/gi, 'début')
      .replace(/dur\?\?e/gi, 'durée')
      .replace(/p\?\?riode/gi, 'période')
      .replace(/journ\?\?e/gi, 'journée')
      .replace(/g\?\?lule/gi, 'gélule')
      .replace(/cuill\?\?re/gi, 'cuillère')
      .replace(/apr\?\?s/gi, 'après')
      .replace(/pr\?\?s/gi, 'près')
      .replace(/\?\?/g, 'é');
  };

  const handleAddMedicineToTicket = (med) => {
    if (ticketMedicines.some((m) => m.id === med.id)) return;
    setTicketMedicines((prev) => [
      ...prev,
      {
        id: med.id,
        name: cleanMedicalText(med.name),
        dosage: med.dosage,
        form: cleanMedicalText(med.form),
        instructions: cleanMedicalText(med.defaultDosageInstructions || '1 comprimé matin et soir pendant 6 jours au milieu des repas'),
      },
    ]);
  };

  const handleRemoveMedicineFromTicket = (medId) => {
    setTicketMedicines((prev) => prev.filter((m) => m.id !== medId));
  };

  const handleUpdateMedicineInstruction = (medId, newInst) => {
    setTicketMedicines((prev) =>
      prev.map((m) => (m.id === medId ? { ...m, instructions: newInst } : m))
    );
  };

  const printTicketOnly = () => {
    const ticketElem = document.getElementById('consultation-ticket-print-area');
    if (!ticketElem) {
      window.print();
      return;
    }

    let iframe = document.getElementById('ticket-print-iframe');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'ticket-print-iframe';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.opacity = '0';
      iframe.style.pointerEvents = 'none';
      document.body.appendChild(iframe);
    }

    const patientDisplayName = (patient?.fullName || `${patient?.firstName || ''} ${patient?.lastName || ''}`.trim() || 'Patient');
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Fiche_Visite_${patientDisplayName.replace(/[^a-zA-Z0-9_-]/g, '_')}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 15mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: #ffffff;
      color: #0f172a;
      line-height: 1.45;
      font-size: 13px;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .ticket-print-wrapper {
      width: 100%;
      max-width: 100%;
      margin: 0 auto;
      border: 2px solid #132f51;
      border-radius: 8px;
      padding: 22px 26px;
      background: #ffffff;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
  </style>
</head>
<body>
  <div class="ticket-print-wrapper">
    ${ticketElem.innerHTML}
  </div>
</body>
</html>`);
    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (err) {
        console.error('Erreur impression iframe:', err);
        window.print();
      }
    }, 250);
  };

  const handlePrintTicket = async () => {
    setTicketSaving(true);
    try {
      if (selectedPatientId && parseFloat(ticketPaidAmount) > 0) {
        const total = parseFloat(ticketTotalAmount) || 0;
        const paid = parseFloat(ticketPaidAmount) || 0;
        await createPayment({
          patientId: selectedPatientId,
          treatment: ticketTreatment.trim() || 'Consultation',
          totalAmount: total,
          paidAmount: paid,
          paymentMethod: ticketPaymentMethod,
          status: paid >= total ? 'Payé' : paid > 0 ? 'Partiel' : 'En attente',
          paymentDate: new Date(`${ticketConsultationDate}T12:00:00Z`).toISOString(),
          notes: `Ticket de consultation - ${ticketMedicines.length} médicament(s) prescrit(s)`,
        });
      }
    } catch (err) {
      console.error('Erreur enregistrement paiement ticket:', err);
    } finally {
      setTicketSaving(false);
    }

    printTicketOnly();
  };

  const patientAge = patient ? calculateAge(patient.dateOfBirth) : null;

  // =========================================================================
  // VIEW 1: CLIENTS DIRECTORY / DOSSIERS LIST (when no client is selected)
  // =========================================================================
  if (!selectedPatientId) {
    return (
      <>
        <PageHeader
          title="Dossiers Patients"
          subtitle="Sélectionnez un client pour consulter son dossier médical, planifier ses rendez-vous et suivre ses soins."
          eyebrow="ESPACE CLIENTS & DOSSIERS"
        >
          <button
            type="button"
            className="button"
            onClick={() => onNavigate && onNavigate('patients')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Nouveau patient
          </button>
        </PageHeader>

        {/* Search Bar */}
        <div className="card" style={{ marginBottom: '20px', padding: '14px 20px' }}>
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                type="search"
                placeholder="Rechercher un dossier par nom, CIN, profession, adresse ou tél..."
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                style={{ width: '100%', paddingLeft: '34px', fontSize: '13.5px' }}
              />
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }}
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>

            <button type="submit" className="button" style={{ minWidth: '110px' }}>
              Rechercher
            </button>

            {(searchDraft || searchTerm) && (
              <button type="button" className="button button-ghost" onClick={handleClearSearch}>
                Réinitialiser
              </button>
            )}

            <span className="muted" style={{ marginLeft: 'auto', fontSize: '12.5px', whiteSpace: 'nowrap' }}>
              {totalClients} client(s) disponible(s)
            </span>
          </form>
        </div>

        {clientsQuery.error && <Notice>{describeError(clientsQuery.error)}</Notice>}

        {/* Clients Dossiers Grid */}
        {clientsQuery.loading && !clientsQuery.data && (
          <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
            <p className="empty">Chargement des dossiers clients…</p>
          </div>
        )}

        {!clientsQuery.loading && clientsList.length === 0 && (
          <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
            <p className="empty">
              {searchTerm ? `Aucun dossier trouvé pour « ${searchTerm} ».` : 'Aucun patient enregistré.'}
            </p>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
          {clientsList.map((client) => {
            const age = calculateAge(client.dateOfBirth);
            return (
              <div
                key={client.id}
                onClick={() => selectClient(client.id)}
                className="card"
                style={{
                  padding: '18px 20px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 2px 8px rgba(24, 35, 52, 0.03)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--blue)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 18px rgba(24, 35, 52, 0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(24, 35, 52, 0.03)';
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '12px' }}>
                    <span
                      className="avatar"
                      style={{
                        width: '46px',
                        height: '46px',
                        fontSize: '15px',
                        fontWeight: 700,
                        background: 'var(--brand-soft)',
                        color: 'var(--navy)',
                      }}
                    >
                      {initials(
                        client.firstName || client.fullName?.split(' ')[0],
                        client.lastName || client.fullName?.split(' ').slice(1).join(' ')
                      )}
                    </span>
                    <div style={{ overflow: 'hidden' }}>
                      <strong style={{ fontSize: '15.5px', color: 'var(--navy)', display: 'block' }}>
                        {client.fullName || `${client.firstName || ''} ${client.lastName || ''}`.trim()}
                      </strong>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '12.5px', color: 'var(--blue)', fontWeight: 600 }}>
                          {client.phone}
                        </span>
                        {client.cin && (
                          <span style={{ fontSize: '11px', background: '#e0e7ff', color: '#3730a3', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                            CIN: {client.cin}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: '12px', color: 'var(--muted-foreground)', display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
                    {client.profession && (
                      <span title="Profession">💼 {client.profession}</span>
                    )}
                    {client.dateOfBirth && (
                      <span>
                        📅 {formatDate(client.dateOfBirth)} {age !== null && `(${age} ans)`}
                      </span>
                    )}
                    {client.address && (
                      <span title="Adresse">{client.address}</span>
                    )}
                    {client.email && <span>✉️ {client.email}</span>}
                  </div>
                </div>

                <div
                  style={{
                    paddingTop: '12px',
                    borderTop: '1px solid #f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span className="muted" style={{ fontSize: '11.5px' }}>
                    Dossier médical &amp; RDV
                  </span>
                  <button
                    type="button"
                    className="button"
                    style={{ padding: '6px 14px', fontSize: '12px', backgroundColor: 'var(--navy)' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      selectClient(client.id);
                    }}
                  >
                    Ouvrir le dossier →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </>
    );
  }

  // =========================================================================
  // VIEW 2: SELECTED CLIENT'S DETAILED CLINICAL DOSSIER
  // =========================================================================
  return (
    <>
      <div className="dossier-page-content no-print">
        {/* Top Header with prominent Back Button */}
        <div style={{ marginBottom: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <button
          type="button"
          onClick={handleBackToList}
          className="button button-ghost"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: 600,
            fontSize: '13px',
            color: 'var(--navy)',
            padding: '7px 14px',
            background: '#ffffff',
            border: '1px solid var(--border)',
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Tous les dossiers clients
        </button>

        <div style={{ position: 'relative' }}>
          <button
            type="button"
            className="button button-ghost"
            onClick={() => setShowQuickSwitcher((prev) => !prev)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '12.5px' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            Changer de client…
          </button>

          {/* Quick Switch Dropdown */}
          {showQuickSwitcher && (
            <div
              className="card"
              style={{
                position: 'absolute',
                right: 0,
                top: '100%',
                marginTop: '6px',
                width: '320px',
                zIndex: 50,
                padding: '12px',
                boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
              }}
            >
              <input
                type="search"
                placeholder="Rechercher un autre client..."
                value={quickSwitchSearch}
                onChange={(e) => setQuickSwitchSearch(e.target.value)}
                style={{ width: '100%', marginBottom: '8px' }}
                autoFocus
              />
              <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {clientsList
                  .filter((c) => {
                    if (!quickSwitchSearch) return true;
                    const q = quickSwitchSearch.toLowerCase();
                    return (
                      (c.fullName && c.fullName.toLowerCase().includes(q)) ||
                      `${c.firstName || ''} ${c.lastName || ''}`.toLowerCase().includes(q) ||
                      (c.phone && c.phone.toLowerCase().includes(q)) ||
                      (c.cin && c.cin.toLowerCase().includes(q)) ||
                      (c.profession && c.profession.toLowerCase().includes(q))
                    );
                  })
                  .map((c) => (
                    <div
                      key={c.id}
                      onClick={() => selectClient(c.id)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '4px',
                        background: c.id === selectedPatientId ? 'var(--brand-soft)' : 'transparent',
                        cursor: 'pointer',
                        fontSize: '12.5px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <strong style={{ color: 'var(--navy)' }}>
                        {c.fullName || `${c.firstName || ''} ${c.lastName || ''}`.trim()}
                      </strong>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {c.cin && (
                          <span style={{ fontSize: '10.5px', background: '#e0e7ff', color: '#3730a3', padding: '1px 5px', borderRadius: '3px', fontWeight: 600 }}>
                            {c.cin}
                          </span>
                        )}
                        <span className="muted" style={{ fontSize: '11.5px' }}>{c.phone}</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ACTIVE CLIENT IDENTITY BANNER */}
      {patient ? (
        <div
          className="card"
          style={{
            marginBottom: '22px',
            padding: '20px 24px',
            background: 'linear-gradient(135deg, #ffffff 0%, #f9fbfe 100%)',
            border: '1px solid var(--border)',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span
              className="avatar"
              style={{
                width: '56px',
                height: '56px',
                fontSize: '18px',
                fontWeight: 700,
                background: 'var(--navy)',
                color: '#fff',
              }}
            >
              {initials(
                patient.firstName || patient.fullName?.split(' ')[0],
                patient.lastName || patient.fullName?.split(' ').slice(1).join(' ')
              )}
            </span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: '21px', fontWeight: 700, color: 'var(--navy)' }}>
                  {patient.fullName || `${patient.firstName || ''} ${patient.lastName || ''}`.trim()}
                </h2>
                {patient.cin && (
                  <span className="pill" style={{ background: '#e0e7ff', color: '#3730a3', fontWeight: 700, fontSize: '11.5px' }}>
                    CIN: {patient.cin}
                  </span>
                )}
                {patient.profession && (
                  <span className="pill" style={{ background: '#f1f5f9', color: '#334155', fontSize: '11.5px' }}>
                    💼 {patient.profession}
                  </span>
                )}
                <span className="pill" style={{ textTransform: 'capitalize' }}>
                  {patient.gender === 'F' ? 'Femme' : patient.gender === 'M' ? 'Homme' : patient.gender || 'Client'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '6px', fontSize: '13px', color: 'var(--muted-foreground)', flexWrap: 'wrap' }}>
                <span>
                  <strong>Téléphone :</strong>{' '}
                  <a href={`tel:${patient.phone}`} style={{ color: 'var(--blue)', fontWeight: 600 }}>
                    {patient.phone}
                  </a>
                </span>
                {patient.dateOfBirth && (
                  <span>
                    <strong>Naissance :</strong> {formatDate(patient.dateOfBirth)}{' '}
                    {patientAge !== null && `(${patientAge} ans)`}
                  </span>
                )}
                {patient.address && (
                  <span>
                    <strong>Adresse :</strong> {patient.address}
                  </span>
                )}
                {patient.email && (
                  <span>
                    <strong>Email :</strong> {patient.email}
                  </span>
                )}
              </div>

              {patient.notes && (
                <div style={{ marginTop: '8px', fontSize: '12px', color: '#c53030', background: '#fff5f5', padding: '4px 10px', borderRadius: '4px', display: 'inline-block' }}>
                  <strong>Antécédents / Allergies :</strong> {patient.notes}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              className="button"
              onClick={openTicketModal}
              style={{
                fontSize: '12.5px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: 'var(--navy)',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              Créer Ticket &amp; Ordonnance (PDF)
            </button>
            <button
              type="button"
              className="button button-subtle"
              onClick={() => onNavigate && onNavigate('patients')}
              style={{ fontSize: '12px' }}
            >
              Modifier coordonnées
            </button>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: '30px', textAlign: 'center', marginBottom: '20px' }}>
          <p className="empty">Chargement de la fiche client…</p>
        </div>
      )}

      {/* =================================================================== */}
      {/* CLINICAL ODONTOGRAM / DENTAL CHART (AGE-AWARE & DYNAMIC)            */}
      {/* =================================================================== */}
      {patient && (
        <DentalChart
          patient={patient}
          chartData={parsedChartData}
          onSaveChart={handleSaveChart}
          treatments={dentalTreatments}
          onOpenTreatmentWithTooth={(toothNum) => {
            setPrefilledToothForTreatment(toothNum);
          }}
        />
      )}

      {/* =================================================================== */}
      {/* CLINICAL TREATMENT HISTORY (STRICTLY MEDICAL - NO FINANCIAL DATA)   */}
      {/* =================================================================== */}
      {patient && (
        <div style={{ marginBottom: '24px' }}>
          <DentalTreatmentsLedger
            treatments={dentalTreatments}
            loading={treatmentsQuery.loading}
            onCreateTreatment={handleCreateDentalTreatment}
            onUpdateTreatment={handleUpdateDentalTreatment}
            onDeleteTreatment={handleDeleteDentalTreatment}
            prefilledTooth={prefilledToothForTreatment}
            onClearPrefilledTooth={() => setPrefilledToothForTreatment(null)}
          />
        </div>
      )}

      {/* 2-COLUMN CLINICAL WORKSPACE */}
      {patient && (
        <div className="split" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1.4fr)', gap: '22px' }}>
          
          {/* COLUMN 1: GIVING APPOINTMENTS & VISITS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* BOOK APPOINTMENT CARD */}
            <div className="card" style={{ padding: '20px' }}>
              <div className="card-head" style={{ marginBottom: '14px' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--navy)' }}>
                    Donner un Rendez-vous
                  </h3>
                  <p className="muted" style={{ fontSize: '12px' }}>
                    Planifiez une consultation pour {patient.firstName}.
                  </p>
                </div>
              </div>

              {bookingError && <Notice>{describeError(bookingError)}</Notice>}
              {bookingSuccess && (
                <div style={{ padding: '10px 14px', borderRadius: '6px', background: 'var(--ok-soft)', color: 'var(--ok)', fontWeight: 600, fontSize: '12.5px', marginBottom: '14px' }}>
                  ✓ {bookingSuccess}
                </div>
              )}

              <form onSubmit={handleBookAppointment}>
                <Field label="Date de la consultation *">
                  <input
                    type="date"
                    value={appointmentDate}
                    onChange={(e) => setAppointmentDate(e.target.value)}
                    required
                    style={{ width: '100%', fontSize: '14px', fontWeight: 600 }}
                  />
                </Field>

                {/* Quick Date Presets */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px', marginBottom: '16px' }}>
                  <button
                    type="button"
                    className="button button-ghost"
                    style={{ padding: '4px 8px', fontSize: '11px' }}
                    onClick={() => setAppointmentDate(getTodayString())}
                  >
                    Aujourd'hui
                  </button>
                  <button
                    type="button"
                    className="button button-ghost"
                    style={{ padding: '4px 8px', fontSize: '11px' }}
                    onClick={() => setAppointmentDate(getFutureDateString(1))}
                  >
                    Demain
                  </button>
                  <button
                    type="button"
                    className="button button-ghost"
                    style={{ padding: '4px 8px', fontSize: '11px' }}
                    onClick={() => setAppointmentDate(getFutureDateString(7))}
                  >
                    +1 semaine
                  </button>
                  <button
                    type="button"
                    className="button button-ghost"
                    style={{ padding: '4px 8px', fontSize: '11px' }}
                    onClick={() => setAppointmentDate(getFutureDateString(14))}
                  >
                    +2 semaines
                  </button>
                  <button
                    type="button"
                    className="button button-ghost"
                    style={{ padding: '4px 8px', fontSize: '11px' }}
                    onClick={() => setAppointmentDate(getFutureDateString(30))}
                  >
                    +1 mois
                  </button>
                </div>

                <button
                  type="submit"
                  className="button"
                  disabled={bookingSaving}
                  style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  {bookingSaving ? 'Enregistrement…' : 'Valider le rendez-vous'}
                </button>
              </form>
            </div>

            {/* APPOINTMENTS HISTORY CARD */}
            <div className="card" style={{ padding: '20px' }}>
              <div className="card-head" style={{ marginBottom: '14px' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--navy)' }}>
                    Rendez-vous ({patientAppointments.length})
                  </h3>
                  <p className="muted" style={{ fontSize: '12px' }}>
                    Consultations planifiées et antérieures.
                  </p>
                </div>
              </div>

              {appointmentsQuery.loading && !appointmentsQuery.data && (
                <p className="empty">Chargement des rendez-vous…</p>
              )}

              {!appointmentsQuery.loading && patientAppointments.length === 0 && (
                <p className="empty">Aucun rendez-vous fixé pour ce client.</p>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {patientAppointments.map((apt) => {
                  const isPast = new Date(apt.date) < new Date(getTodayString());
                  return (
                    <div
                      key={apt.id}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                        background: isPast ? '#fcfdfd' : '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--navy)' }}>
                            {formatDate(apt.date)}
                          </span>
                          {isPast && (
                            <span className="pill" style={{ fontSize: '10px', padding: '1px 6px' }}>
                              Passé
                            </span>
                          )}
                        </div>
                        <div style={{ marginTop: '4px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {apt.hasSms ? (
                            <span style={{ color: 'var(--green)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <span className="pill-dot ok" /> SMS envoyé
                            </span>
                          ) : (
                            <span style={{ color: 'var(--gold)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <span className="pill-dot pending" /> Rappel en attente
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        {!apt.hasSms && !isPast && (
                          <button
                            type="button"
                            className="button button-ghost"
                            style={{ padding: '5px 9px', fontSize: '11.5px' }}
                            disabled={sendingSmsId === apt.id}
                            onClick={() => handleSendReminderSms(apt.id)}
                            title="Envoyer le rappel SMS maintenant"
                          >
                            {sendingSmsId === apt.id ? '…' : 'Envoyer SMS'}
                          </button>
                        )}
                        <button
                          type="button"
                          className="button button-ghost"
                          style={{ padding: '5px 8px', color: 'var(--rose)' }}
                          onClick={() => handleDeleteAppointment(apt.id, apt.date)}
                          title="Annuler ce rendez-vous"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* COLUMN 2: CLINICAL CASE UPDATES & EVOLUTION */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* ADD CLINICAL NOTE CARD */}
            <div className="card" style={{ padding: '20px' }}>
              <div className="card-head" style={{ marginBottom: '14px' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--navy)' }}>
                    Nouvelle Observation Clinique
                  </h3>
                  <p className="muted" style={{ fontSize: '12px' }}>
                    Enregistrez le motif de consultation, les soins réalisés et l'évolution.
                  </p>
                </div>
              </div>

              {stateError && <Notice>{describeError(stateError)}</Notice>}

              <form onSubmit={handleAddClinicalState}>
                <Field label="Motif / Problème ou diagnostic constaté *">
                  <input
                    value={newProblem}
                    onChange={(e) => setNewProblem(e.target.value)}
                    placeholder="ex: Carie occlusale molaire 16, douleur aiguë à la pression..."
                    required
                    maxLength={300}
                    style={{ width: '100%', marginBottom: '12px' }}
                  />
                </Field>

                <Field label="Soins réalisés & Évolution clinique *">
                  <textarea
                    value={newProgress}
                    onChange={(e) => setNewProgress(e.target.value)}
                    placeholder="ex: Anesthésie locale, pulpectomie complète, obturation composite et ordonnance délivrée..."
                    rows={4}
                    required
                    style={{ width: '100%' }}
                  />
                </Field>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px' }}>
                  <button
                    type="submit"
                    className="button"
                    disabled={stateSaving}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                      <polyline points="17 21 17 13 7 13 7 21" />
                      <polyline points="7 3 7 8 15 8" />
                    </svg>
                    {stateSaving ? 'Enregistrement…' : 'Ajouter au dossier médical'}
                  </button>
                </div>
              </form>
            </div>

            {/* CLINICAL TIMELINE CARD */}
            <div className="card" style={{ padding: '20px' }}>
              <div className="card-head" style={{ marginBottom: '14px' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--navy)' }}>
                    Journal d'Évolution Médicale ({clinicalStates.length})
                  </h3>
                  <p className="muted" style={{ fontSize: '12px' }}>
                    Historique chronologique des problèmes et actes dentaires réalisés.
                  </p>
                </div>
              </div>

              {statesQuery.loading && !statesQuery.data && (
                <p className="empty">Chargement de l'historique clinique…</p>
              )}

              {!statesQuery.loading && clinicalStates.length === 0 && (
                <p className="empty">Aucune observation enregistrée dans ce dossier.</p>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {clinicalStates.map((st, index) => (
                  <div
                    key={st.id}
                    style={{
                      padding: '16px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      background: '#ffffff',
                      position: 'relative',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            background: 'var(--brand-soft)',
                            color: 'var(--navy)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '11px',
                            fontWeight: 700,
                          }}
                        >
                          #{clinicalStates.length - index}
                        </span>
                        <h4 style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--foreground)' }}>
                          {st.problem}
                        </h4>
                      </div>

                      <button
                        type="button"
                        className="button button-ghost"
                        style={{ padding: '3px 8px', fontSize: '12px', color: 'var(--rose)' }}
                        onClick={() => handleDeleteClinicalState(st.id)}
                        title="Supprimer cette observation"
                      >
                        ✕
                      </button>
                    </div>

                    <div
                      style={{
                        padding: '10px 14px',
                        background: '#f8fafc',
                        borderRadius: '6px',
                        borderLeft: '3px solid var(--blue)',
                        fontSize: '13px',
                        color: 'var(--foreground)',
                        lineHeight: 1.5,
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {st.progress}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>
      )}
      </div>

      {/* ========================================================================= */}
      {/* TICKET DE CONSULTATION, ORDONNANCE & REÇU MODAL (PRINT / PDF)            */}
      {/* ========================================================================= */}
      {showTicketModal && patient && (
        <div className="modal-overlay" onClick={() => !ticketSaving && setShowTicketModal(false)}>
          <div
            className="modal card"
            style={{ maxWidth: '860px', width: '95%', maxHeight: '92vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--navy)' }}>
                  Ticket de Consultation, Ordonnance &amp; Reçu
                </h3>
                <p className="muted" style={{ fontSize: '12px' }}>
                  Renseignez les soins, médicaments prescrits, règlement et prochain rendez-vous, puis imprimez ou exportez en PDF.
                </p>
              </div>
              <button
                type="button"
                className="button button-ghost"
                onClick={() => setShowTicketModal(false)}
              >
                ✕
              </button>
            </div>

            {/* FORM CONFIGURATION ACCORDION / BOX */}
            <div className="modal-form-config no-print" style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '20px' }}>
              <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--navy)', marginBottom: '12px' }}>
                ⚙️ Paramètres du Ticket pour {patient.fullName || `${patient.firstName} ${patient.lastName}`.trim()}
              </h4>

              {/* Row 1: Date & Treatment */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px', marginBottom: '10px' }}>
                <Field label="Date de consultation">
                  <input
                    type="date"
                    value={ticketConsultationDate}
                    onChange={(e) => setTicketConsultationDate(e.target.value)}
                  />
                </Field>

                <Field label="Acte / Soin dentaire réalisé">
                  <input
                    type="text"
                    value={ticketTreatment}
                    onChange={(e) => setTicketTreatment(e.target.value)}
                    placeholder="Ex: Détartrage, Soin carie, Extraction, Couronne..."
                  />
                </Field>
              </div>

              {/* Presets */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
                {TICKET_PRESET_TREATMENTS.map((tr) => (
                  <button
                    key={tr}
                    type="button"
                    className="button button-ghost"
                    style={{ padding: '2px 8px', fontSize: '11px', borderRadius: '4px' }}
                    onClick={() => setTicketTreatment(tr)}
                  >
                    {tr}
                  </button>
                ))}
              </div>

              {/* Row 2: Payment & Method */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: '12px', marginBottom: '14px' }}>
                <Field label="Montant Total Soin (DH)">
                  <input
                    type="number"
                    step="0.01"
                    value={ticketTotalAmount}
                    onChange={(e) => setTicketTotalAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </Field>

                <Field label="Montant Versé / Payé (DH)">
                  <input
                    type="number"
                    step="0.01"
                    value={ticketPaidAmount}
                    onChange={(e) => setTicketPaidAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </Field>

                <Field label="Mode de Paiement">
                  <select
                    value={ticketPaymentMethod}
                    onChange={(e) => setTicketPaymentMethod(e.target.value)}
                  >
                    <option value="Espèces">💵 Espèces</option>
                    <option value="Carte Bancaire">💳 Carte Bancaire</option>
                    <option value="Chèque">📝 Chèque</option>
                    <option value="Virement">🏦 Virement</option>
                  </select>
                </Field>
              </div>

              {/* Row 3: Next Appointment or End of Treatment */}
              <div style={{ padding: '12px', background: '#fff', borderRadius: '6px', border: '1px solid var(--border)', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: ticketIsEnd ? '0' : '10px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: 'var(--navy)' }}>
                    <input
                      type="checkbox"
                      checked={ticketIsEnd}
                      onChange={(e) => setTicketIsEnd(e.target.checked)}
                      style={{ width: '16px', height: '16px', accentColor: 'var(--navy)' }}
                    />
                    Fin de traitement (Aucun prochain rendez-vous requis)
                  </label>
                  {ticketIsEnd && (
                    <span className="pill" style={{ background: 'var(--ok-soft)', color: 'var(--ok)', fontWeight: 600 }}>
                      ✓ Traitement achevé
                    </span>
                  )}
                </div>

                {!ticketIsEnd && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <Field label="Date du prochain rendez-vous">
                      <input
                        type="date"
                        value={ticketNextDate}
                        onChange={(e) => setTicketNextDate(e.target.value)}
                      />
                    </Field>
                    <Field label="Heure / Précision">
                      <input
                        type="text"
                        value={ticketNextTime}
                        onChange={(e) => setTicketNextTime(e.target.value)}
                        placeholder="Ex: 15h30"
                      />
                    </Field>
                  </div>
                )}
              </div>

              {/* Row 4: Medicines Picker from Catalog */}
              <div style={{ padding: '12px', background: '#fff', borderRadius: '6px', border: '1px solid var(--border)' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--navy)', marginBottom: '6px' }}>
                  💊 Médicaments Prescrits (sélectionnez depuis le catalogue pour insérer sur l'ordonnance) :
                </label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', maxHeight: '95px', overflowY: 'auto', marginBottom: '10px' }}>
                  {(medicinesCatalog.data?.items ?? []).map((m) => {
                    const added = ticketMedicines.some((tm) => tm.id === m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        className="button button-ghost"
                        style={{
                          padding: '3px 8px',
                          fontSize: '11px',
                          borderRadius: '4px',
                          background: added ? '#e2e8f0' : '#f8fafc',
                          opacity: added ? 0.6 : 1,
                        }}
                        disabled={added}
                        onClick={() => handleAddMedicineToTicket(m)}
                      >
                        + {m.name} {m.dosage ? `(${m.dosage})` : ''}
                      </button>
                    );
                  })}
                </div>

                {ticketMedicines.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {ticketMedicines.map((tm, idx) => (
                      <div key={tm.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', background: '#f8fafc', padding: '6px 10px', borderRadius: '4px' }}>
                        <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--navy)', minWidth: '150px' }}>
                          {idx + 1}. {tm.name} {tm.dosage ? `(${tm.dosage})` : ''}
                        </span>
                        <input
                          type="text"
                          value={tm.instructions}
                          onChange={(e) => handleUpdateMedicineInstruction(tm.id, e.target.value)}
                          style={{ flex: 1, fontSize: '12px', padding: '4px 8px' }}
                          placeholder="Posologie..."
                        />
                        <button
                          type="button"
                          className="button button-danger"
                          style={{ padding: '3px 8px', fontSize: '11px' }}
                          title="Retirer ce médicament"
                          onClick={() => handleRemoveMedicineFromTicket(tm.id)}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* PRINT-READY TICKET PREVIEW */}
            <div
              id="consultation-ticket-print-area"
              style={{
                background: '#ffffff',
                border: '2px solid #132f51',
                borderRadius: '8px',
                padding: '24px 28px',
                marginBottom: '20px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
              }}
            >
              {/* 1. Clinic Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2.5px solid #132f51', paddingBottom: '14px', marginBottom: '16px' }}>
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#132f51', margin: 0, letterSpacing: '0.5px' }}>
                    CABINET DENTAIRE
                  </h2>
                  <p style={{ fontSize: '12px', color: '#1d4ed8', fontWeight: 600, margin: '3px 0 0' }}>
                    Chirurgie Dentaire • Implantologie • Orthodontie • Esthétique
                  </p>
                  <p style={{ fontSize: '11px', color: '#64748b', margin: '3px 0 0' }}>
                    12 Rue Hassan II, Casablanca • Tél : 05 22 00 00 00 • cabinet@dentaire.ma
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ display: 'inline-block', background: '#132f51', color: '#ffffff', padding: '5px 12px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>
                    FICHE DE VISITE &amp; REÇU
                  </span>
                  <div style={{ fontSize: '12px', color: '#475569', marginTop: '6px' }}>
                    Date : <strong>{formatDate(ticketConsultationDate)}</strong>
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                    Réf. Dossier : <strong>#{patient.cin || String(patient.id).padStart(5, '0')}</strong>
                  </div>
                </div>
              </div>

              {/* 2. Patient Block */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '12px 16px', borderRadius: '6px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <span style={{ fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.8px', color: '#64748b', fontWeight: 600, display: 'block' }}>PATIENT</span>
                  <strong style={{ fontSize: '16px', color: '#132f51' }}>
                    {patient.fullName || `${patient.firstName} ${patient.lastName}`.trim()}
                  </strong>
                </div>
                <div style={{ fontSize: '12px', color: '#475569', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  {patient.cin && <span><strong>CIN :</strong> {patient.cin}</span>}
                  {patientAge !== null && <span><strong>Âge :</strong> {patientAge} ans</span>}
                  <span><strong>Tél :</strong> {patient.phone}</span>
                  {patient.address && <span><strong>Adresse :</strong> {patient.address}</span>}
                </div>
              </div>

              {/* 3. Section: Soins et Règlement */}
              <div style={{ marginBottom: '16px', borderBottom: '1px dashed #cbd5e1', paddingBottom: '14px' }}>
                <h4 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.8px', color: '#132f51', marginBottom: '8px', fontWeight: 700 }}>
                  SOINS EFFECTUÉS &amp; RÈGLEMENT
                </h4>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '6px 0', color: '#1e293b' }}>
                        <strong>Acte réalisé :</strong> {ticketTreatment || 'Consultation & Bilan'}
                      </td>
                      <td style={{ padding: '6px 0', textAlign: 'right' }}>
                        Montant des soins : <strong>{formatNumber(parseFloat(ticketTotalAmount) || 0)} DH</strong>
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '6px 0', color: '#15803d', fontWeight: 600 }}>
                        Montant réglé ({ticketPaymentMethod}) :
                      </td>
                      <td style={{ padding: '6px 0', textAlign: 'right', color: '#15803d', fontWeight: 700, fontSize: '13.5px' }}>
                        {formatNumber(parseFloat(ticketPaidAmount) || 0)} DH
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '6px 0', color: (parseFloat(ticketTotalAmount) - parseFloat(ticketPaidAmount) > 0) ? '#b91c1c' : '#64748b' }}>
                        Solde restant dû :
                      </td>
                      <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 700, color: (parseFloat(ticketTotalAmount) - parseFloat(ticketPaidAmount) > 0) ? '#b91c1c' : '#15803d' }}>
                        {parseFloat(ticketTotalAmount) - parseFloat(ticketPaidAmount) > 0
                          ? `${formatNumber(parseFloat(ticketTotalAmount) - parseFloat(ticketPaidAmount))} DH`
                          : '✓ Réglé intégralement'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* 4. Section: Ordonnance Médicale */}
              <div style={{ marginBottom: '16px', borderBottom: '1px dashed #cbd5e1', paddingBottom: '14px' }}>
                <h4 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.8px', color: '#132f51', marginBottom: '8px', fontWeight: 700 }}>
                  ORDONNANCE MÉDICALE
                </h4>
                {ticketMedicines.length === 0 ? (
                  <p style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic', margin: '4px 0' }}>
                    Aucun médicament prescrit pour cette consultation.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {ticketMedicines.map((tm, idx) => (
                      <div key={tm.id} style={{ fontSize: '12.5px' }}>
                        <strong style={{ color: '#0f172a' }}>
                          {idx + 1}. {cleanMedicalText(tm.name)} {tm.dosage ? `— ${tm.dosage}` : ''} {tm.form ? `(${cleanMedicalText(tm.form)})` : ''}
                        </strong>
                        <div style={{ color: '#334155', fontStyle: 'italic', paddingLeft: '16px', marginTop: '2px' }}>
                          → {cleanMedicalText(tm.instructions)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 5. Section: Suivi & Prochain RDV */}
              <div style={{ marginBottom: '18px', background: '#f8fafc', padding: '10px 14px', borderRadius: '6px', border: '1px solid #f1f5f9' }}>
                <h4 style={{ fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.8px', color: '#132f51', margin: '0 0 4px', fontWeight: 700 }}>
                  SUIVI &amp; PROCHAIN RENDEZ-VOUS
                </h4>
                {ticketIsEnd ? (
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#15803d' }}>
                    ✓ Fin de traitement — Aucun rendez-vous ultérieur requis
                  </div>
                ) : ticketNextDate ? (
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#132f51' }}>
                    📅 Prochain rendez-vous planifié le : {formatDate(ticketNextDate)} {ticketNextTime ? `à ${ticketNextTime}` : ''}
                  </div>
                ) : (
                  <div style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic' }}>
                    À convenir ultérieurement selon disponibilité du patient.
                  </div>
                )}
              </div>

              {/* 6. Section: Cachet et Signature (DEDICATED SPACES FOR CASH/STAMP & SIGNATURE) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '16px', marginBottom: '14px' }}>
                {/* Cachet officiel */}
                <div
                  style={{
                    border: '1.5px dashed #94a3b8',
                    borderRadius: '6px',
                    padding: '10px 14px',
                    minHeight: '105px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    background: '#fcfdfd',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#475569' }}>
                      Cachet du Cabinet
                    </span>
                    <span style={{ fontSize: '10px', color: '#94a3b8', fontStyle: 'italic' }}>
                      (Tampon officiel)
                    </span>
                  </div>
                  <div style={{ textAlign: 'center', color: '#cbd5e1', fontSize: '11px', paddingBottom: '10px' }}>
                    Emplacement Cachet
                  </div>
                </div>

                {/* Signature du Praticien */}
                <div
                  style={{
                    border: '1.5px dashed #94a3b8',
                    borderRadius: '6px',
                    padding: '10px 14px',
                    minHeight: '105px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    background: '#fcfdfd',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#475569' }}>
                      Signature du Médecin Dentiste
                    </span>
                    <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                      Dr. Chirurgien-Dentiste
                    </span>
                  </div>
                  <div style={{ borderBottom: '1px solid #94a3b8', margin: '38px 10px 6px' }} />
                </div>
              </div>

              {/* 7. Footer note */}
              <div style={{ textAlign: 'center', fontSize: '10.5px', color: '#94a3b8', borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
                Ce document officiel tient lieu de fiche de visite, ordonnance médicale et justificatif de paiement pour le patient.
              </div>
            </div>

            {/* Modal Action Buttons */}
            <div className="modal-action-buttons no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                className="button button-ghost"
                onClick={() => setShowTicketModal(false)}
                disabled={ticketSaving}
              >
                Fermer
              </button>
              <button
                type="button"
                className="button"
                onClick={handlePrintTicket}
                disabled={ticketSaving}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 6 2 18 2 18 9" />
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                  <rect x="6" y="14" width="12" height="8" />
                </svg>
                {ticketSaving ? 'Enregistrement…' : '🖨️ Imprimer / Sauvegarder en PDF'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
