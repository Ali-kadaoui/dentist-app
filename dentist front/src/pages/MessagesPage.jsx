import { useState, useEffect } from 'react';
import { useAsyncData } from '../hooks/useAsyncData';
import {
  getGatewayHealth,
  getSmsSettings,
  updateSmsSettings,
  processDueSms,
  listAppointments,
  listDueReminders,
  listMessages,
  sendSms,
} from '../api/dentistApi';
import PageHeader from '../components/PageHeader';
import Notice from '../components/Notice';
import Field from '../components/Field';
import { describeError, formatDate, formatTime, formatNumber } from '../lib/format';

const MAX_LENGTH = 160;

const DEFAULT_REMINDER_TEMPLATE =
  "Bonjour {nom}, rappel de votre rendez-vous au cabinet dentaire le {date} a {heure}. Merci de confirmer votre presence.";

const DEFAULT_BOOKING_TEMPLATE =
  "Bonjour {nom}, votre rendez-vous au cabinet dentaire a bien ete reserve pour le {date} a {heure}.";

function CountdownBadge({ sendDate, sendTime }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!sendDate || !sendTime) {
    return <span className="pill pill-neutral">—</span>;
  }

  const target = new Date(`${sendDate}T${sendTime}:00`);
  const diffMs = target.getTime() - now;

  if (Number.isNaN(diffMs)) {
    return <span className="pill pill-neutral">—</span>;
  }

  if (diffMs <= 0) {
    const todayStr = new Date().toISOString().slice(0, 10);
    const isToday = sendDate === todayStr;
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          background: isToday ? '#dcfce7' : '#f1f5f9',
          color: isToday ? '#15803d' : '#475569',
          border: isToday ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
          padding: '4px 10px',
          borderRadius: '20px',
          fontSize: '11.5px',
          fontWeight: 700,
        }}
      >
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: isToday ? '#16a34a' : '#64748b',
            boxShadow: isToday ? '0 0 6px #16a34a' : 'none',
          }}
        />
        {isToday ? "Envoi imminent (Aujourd'hui)" : 'En file active'}
      </span>
    );
  }

  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  let text = '';
  if (days > 0) {
    text = `${days}j ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m`;
  } else if (hours > 0) {
    text = `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
  } else {
    text = `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        background: '#eff6ff',
        color: 'var(--blue)',
        border: '1px solid #bfdbfe',
        padding: '4px 10px',
        borderRadius: '20px',
        fontSize: '12px',
        fontWeight: 700,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <span>⏳</span>
      Dans {text}
    </span>
  );
}

export default function MessagesPage() {
  const [activeTab, setActiveTab] = useState('auto'); // 'auto' | 'due' | 'history' | 'direct'
  const [feedback, setFeedback] = useState(null);

  // Auto-SMS settings form
  const [settingsForm, setSettingsForm] = useState({
    autoSendEnabled: true,
    sendOnBooking: true,
    sendReminderBefore: true,
    reminders: [
      { daysBefore: 1, time: '18:00' },
    ],
    daysBefore: 1,
    sendHour: 18,
    sendMinute: 0,
    maxReminders: 1,
    reminderTemplate: DEFAULT_REMINDER_TEMPLATE,
    bookingTemplate: DEFAULT_BOOKING_TEMPLATE,
  });

  // Action states
  const [savingSettings, setSavingSettings] = useState(false);
  const [triggeringAuto, setTriggeringAuto] = useState(false);
  const [directSending, setDirectSending] = useState(false);

  // Direct SMS form
  const [directForm, setDirectForm] = useState({ appointmentId: '', message: '' });

  // Modal for editing reminder schedule
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [modalDraft, setModalDraft] = useState(null);

  // Pagination for history
  const [historyPage, setHistoryPage] = useState(1);

  // Data queries
  const gateway = useAsyncData(getGatewayHealth, []);
  const settingsData = useAsyncData(getSmsSettings, []);
  const due = useAsyncData(() => listDueReminders({ horizonDays: 30 }), []);
  const history = useAsyncData(() => listMessages({ page: historyPage, pageSize: 25 }), [historyPage]);
  const appointments = useAsyncData(() => listAppointments({ pageSize: 200 }), []);

  useEffect(() => {
    if (settingsData.data) {
      const rawRules = settingsData.data.reminders;
      const reminders = Array.isArray(rawRules) && rawRules.length > 0
        ? rawRules
        : [
            {
              daysBefore: settingsData.data.daysBefore ?? 1,
              time: `${String(settingsData.data.sendHour ?? 18).padStart(2, '0')}:${String(settingsData.data.sendMinute ?? 0).padStart(2, '0')}`,
            },
          ];

      setSettingsForm((curr) => ({
        ...curr,
        ...settingsData.data,
        reminders,
        reminderTemplate: settingsData.data.reminderTemplate || DEFAULT_REMINDER_TEMPLATE,
        bookingTemplate: settingsData.data.bookingTemplate || DEFAULT_BOOKING_TEMPLATE,
      }));
    }
  }, [settingsData.data]);

  // Periodic poll for gateway status
  useEffect(() => {
    const timer = setInterval(() => {
      gateway.reload();
    }, 10000);
    return () => clearInterval(timer);
  }, [gateway]);

  const dueItems = due.data ?? [];
  const historyItems = history.data?.items ?? [];
  const totalHistory = history.data?.total ?? 0;
  const totalHistoryPages = history.data?.totalPages ?? 0;
  const modem = gateway.data?.modem;
  const isGatewayReady = gateway.data?.status === 'ok';

  // --- Modal Schedule Handlers ---
  const openScheduleModal = () => {
    setModalDraft({
      autoSendEnabled: settingsForm.autoSendEnabled,
      sendOnBooking: settingsForm.sendOnBooking,
      sendReminderBefore: settingsForm.sendReminderBefore,
      reminders: JSON.parse(JSON.stringify(settingsForm.reminders || [{ daysBefore: 1, time: '18:00' }])),
    });
    setShowScheduleModal(true);
  };

  const closeScheduleModal = () => {
    setShowScheduleModal(false);
    setModalDraft(null);
  };

  const handleAddDraftReminder = () => {
    setModalDraft((prev) => {
      if (!prev) return prev;
      const current = prev.reminders || [];
      if (current.length >= 5) return prev;
      const last = current[current.length - 1];
      const nextDays = last ? (last.daysBefore > 1 ? last.daysBefore - 1 : 0) : 1;
      return {
        ...prev,
        reminders: [...current, { daysBefore: nextDays, time: '09:00' }],
      };
    });
  };

  const handleUpdateDraftReminder = (index, field, value) => {
    setModalDraft((prev) => {
      if (!prev) return prev;
      const current = [...(prev.reminders || [])];
      current[index] = { ...current[index], [field]: value };
      return { ...prev, reminders: current };
    });
  };

  const handleRemoveDraftReminder = (index) => {
    setModalDraft((prev) => {
      if (!prev) return prev;
      const current = prev.reminders || [];
      if (current.length <= 1) return prev;
      return {
        ...prev,
        reminders: current.filter((_, i) => i !== index),
      };
    });
  };

  const handleSaveScheduleModal = async (e) => {
    if (e) e.preventDefault();
    if (!modalDraft) return;

    setSavingSettings(true);
    setFeedback(null);

    try {
      const cleanReminders = (modalDraft.reminders || []).map((r) => ({
        daysBefore: Math.max(0, Number(r.daysBefore) || 0),
        time: r.time ? r.time.slice(0, 5) : '18:00', // strictly HH:mm
      }));

      const updated = await updateSmsSettings({
        autoSendEnabled: modalDraft.autoSendEnabled,
        sendOnBooking: modalDraft.sendOnBooking,
        sendReminderBefore: modalDraft.sendReminderBefore,
        reminders: cleanReminders,
        daysBefore: cleanReminders[0]?.daysBefore ?? 1,
        sendHour: Number(cleanReminders[0]?.time?.split(':')[0]) || 18,
        sendMinute: Number(cleanReminders[0]?.time?.split(':')[1]) || 0,
        maxReminders: cleanReminders.length,
        reminderTemplate: settingsForm.reminderTemplate.trim(),
        bookingTemplate: settingsForm.bookingTemplate.trim(),
      });

      setSettingsForm((curr) => ({
        ...curr,
        ...updated,
        reminders: updated.reminders || cleanReminders,
      }));
      setShowScheduleModal(false);
      setModalDraft(null);
      setFeedback({ tone: 'ok', text: 'Planification des rappels enregistrée avec succès.' });
      settingsData.reload();
    } catch (err) {
      setFeedback({ tone: 'error', text: describeError(err) });
    } finally {
      setSavingSettings(false);
    }
  };

  // --- Handlers for saving Template on the page ---
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    setFeedback(null);

    try {
      const cleanReminders = (settingsForm.reminders || []).map((r) => ({
        daysBefore: Math.max(0, Number(r.daysBefore) || 0),
        time: r.time ? r.time.slice(0, 5) : '18:00',
      }));

      const updated = await updateSmsSettings({
        autoSendEnabled: settingsForm.autoSendEnabled,
        sendOnBooking: settingsForm.sendOnBooking,
        sendReminderBefore: settingsForm.sendReminderBefore,
        reminders: cleanReminders,
        daysBefore: cleanReminders[0]?.daysBefore ?? 1,
        sendHour: Number(cleanReminders[0]?.time?.split(':')[0]) || 18,
        sendMinute: Number(cleanReminders[0]?.time?.split(':')[1]) || 0,
        maxReminders: cleanReminders.length,
        reminderTemplate: settingsForm.reminderTemplate.trim(),
        bookingTemplate: settingsForm.bookingTemplate.trim(),
      });

      setSettingsForm((curr) => ({
        ...curr,
        ...updated,
        reminders: updated.reminders || cleanReminders,
      }));
      setFeedback({ tone: 'ok', text: 'Modèle de message enregistré avec succès.' });
      settingsData.reload();
    } catch (err) {
      setFeedback({ tone: 'error', text: describeError(err) });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleTriggerAutoNow = async () => {
    setTriggeringAuto(true);
    setFeedback(null);

    try {
      const res = await processDueSms();
      setFeedback({
        tone: 'ok',
        text: `Traitement automatique exécuté : ${res.sent ?? 0} SMS envoyé(s), ${res.failed ?? 0} échec(s) sur ${res.total ?? 0} rappel(s) dû(s).`,
      });
      history.reload();
      due.reload();
    } catch (err) {
      setFeedback({ tone: 'error', text: describeError(err) });
    } finally {
      setTriggeringAuto(false);
    }
  };

  const handleSendDirectSms = async (e) => {
    e.preventDefault();
    if (!directForm.appointmentId || !directForm.message.trim()) return;

    setDirectSending(true);
    setFeedback(null);

    try {
      const res = await sendSms({
        appointmentId: directForm.appointmentId,
        message: directForm.message.trim(),
      });

      setDirectForm((prev) => ({ ...prev, message: '' }));
      setFeedback({ tone: 'ok', text: `Message envoyé à ${res.patientName} (${res.phone}).` });
      history.reload();
      due.reload();
    } catch (err) {
      setFeedback({ tone: 'error', text: describeError(err) });
    } finally {
      setDirectSending(false);
    }
  };

  const insertReminderVariable = (variableKey) => {
    setSettingsForm((prev) => ({
      ...prev,
      reminderTemplate: (prev.reminderTemplate || '') + ` {${variableKey}}`,
    }));
  };

  const insertBookingVariable = (variableKey) => {
    setSettingsForm((prev) => ({
      ...prev,
      bookingTemplate: (prev.bookingTemplate || '') + ` {${variableKey}}`,
    }));
  };

  const handleToggleSendOnBooking = async () => {
    const nextVal = !settingsForm.sendOnBooking;
    setSettingsForm((prev) => ({ ...prev, sendOnBooking: nextVal }));
    try {
      const cleanReminders = (settingsForm.reminders || []).map((r) => ({
        daysBefore: Math.max(0, Number(r.daysBefore) || 0),
        time: r.time ? r.time.slice(0, 5) : '18:00',
      }));

      await updateSmsSettings({
        autoSendEnabled: settingsForm.autoSendEnabled,
        sendOnBooking: nextVal,
        sendReminderBefore: settingsForm.sendReminderBefore,
        reminders: cleanReminders,
        daysBefore: cleanReminders[0]?.daysBefore ?? 1,
        sendHour: Number(cleanReminders[0]?.time?.split(':')[0]) || 18,
        sendMinute: Number(cleanReminders[0]?.time?.split(':')[1]) || 0,
        maxReminders: cleanReminders.length,
        reminderTemplate: (settingsForm.reminderTemplate || DEFAULT_REMINDER_TEMPLATE).trim(),
        bookingTemplate: (settingsForm.bookingTemplate || DEFAULT_BOOKING_TEMPLATE).trim(),
      });

      setFeedback({
        tone: 'ok',
        text: nextVal ? 'Confirmation immédiate activée avec succès.' : 'Confirmation immédiate désactivée.',
      });
      settingsData.reload();
    } catch (err) {
      setFeedback({ tone: 'error', text: describeError(err) });
    }
  };

  return (
    <>
      <PageHeader
        title="SMS & Rappels Automatiques"
        subtitle="Pilotage des envois automatiques depuis le serveur, file des rappels et journal des messages."
        eyebrow="COMMUNICATION MODEM & SMS"
      >
        <button
          type="button"
          className="button button-ghost"
          onClick={() => {
            due.reload();
            gateway.reload();
          }}
          title="Actualiser la file des prochains envois"
        >
          🔄 Actualiser la file
        </button>

        <button
          type="button"
          className="button button-ghost"
          disabled={triggeringAuto}
          onClick={handleTriggerAutoNow}
          title="Déclencher immédiatement une vérification des rappels à envoyer"
        >
          {triggeringAuto ? 'Exécution…' : '⚡ Déclencher maintenant'}
        </button>
      </PageHeader>

      {feedback && <Notice tone={feedback.tone}>{feedback.text}</Notice>}

      {/* SYSTEM STATUS STRIP */}
      <div
        className="card"
        style={{
          marginBottom: '20px',
          padding: '14px 20px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          background: '#ffffff',
          border: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
          
          {/* Status 1: Backend Auto-SMS Daemon */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: settingsForm.autoSendEnabled ? 'var(--green)' : 'var(--gold)',
                boxShadow: settingsForm.autoSendEnabled ? '0 0 6px var(--green)' : 'none',
              }}
            />
            <div>
              <span className="muted" style={{ fontSize: '11px', display: 'block' }}>MOTEUR BACKEND</span>
              <strong style={{ fontSize: '13px', color: 'var(--foreground)' }}>
                {settingsForm.autoSendEnabled
                  ? `Auto-SMS Actif (${settingsForm.reminders?.length || 1} rappel(s) : ${scheduleSummary})`
                  : 'Auto-SMS Suspendu'}
              </strong>
            </div>
          </div>

          <div style={{ width: '1px', height: '24px', background: 'var(--border)' }} />

          {/* Status 2: Hardware Modem Gateway */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: isGatewayReady ? 'var(--green)' : '#94a3b8',
              }}
            />
            <div>
              <span className="muted" style={{ fontSize: '11px', display: 'block' }}>MODEM USB (HUAWEI)</span>
              <strong style={{ fontSize: '13px', color: 'var(--foreground)' }}>
                {isGatewayReady
                  ? `Prêt · Port ${modem?.port ?? 'Auto'}`
                  : modem?.error
                  ? 'Modem non détecté'
                  : 'Passerelle connectée'}
              </strong>
            </div>
          </div>

          <div style={{ width: '1px', height: '24px', background: 'var(--border)' }} />

          {/* Status 3: Due reminders count */}
          <div>
            <span className="muted" style={{ fontSize: '11px', display: 'block' }}>RAPPELS DUS</span>
            <strong style={{ fontSize: '13px', color: dueItems.length > 0 ? 'var(--blue)' : 'var(--foreground)' }}>
              {dueItems.length} rendez-vous
            </strong>
          </div>
        </div>

        <button
          type="button"
          className="button button-ghost"
          style={{ padding: '5px 10px', fontSize: '11.5px' }}
          onClick={() => {
            gateway.reload();
            due.reload();
            history.reload();
          }}
        >
          ↻ Actualiser
        </button>
      </div>

      {/* MODERN TAB NAVIGATION */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid var(--border)',
          marginBottom: '20px',
          paddingBottom: '2px',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('auto')}
          style={{
            padding: '10px 18px',
            border: 'none',
            background: 'none',
            fontSize: '13.5px',
            fontWeight: activeTab === 'auto' ? 700 : 500,
            color: activeTab === 'auto' ? 'var(--navy)' : 'var(--muted-foreground)',
            borderBottom: activeTab === 'auto' ? '2.5px solid var(--navy)' : '2.5px solid transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
          Paramètres &amp; Planification Auto-SMS
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('due')}
          style={{
            padding: '10px 18px',
            border: 'none',
            background: 'none',
            fontSize: '13.5px',
            fontWeight: activeTab === 'due' ? 700 : 500,
            color: activeTab === 'due' ? 'var(--navy)' : 'var(--muted-foreground)',
            borderBottom: activeTab === 'due' ? '2.5px solid var(--navy)' : '2.5px solid transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          File d'attente ({dueItems.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          style={{
            padding: '10px 18px',
            border: 'none',
            background: 'none',
            fontSize: '13.5px',
            fontWeight: activeTab === 'history' ? 700 : 500,
            color: activeTab === 'history' ? 'var(--navy)' : 'var(--muted-foreground)',
            borderBottom: activeTab === 'history' ? '2.5px solid var(--navy)' : '2.5px solid transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          Historique des SMS ({totalHistory})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('direct')}
          style={{
            padding: '10px 18px',
            border: 'none',
            background: 'none',
            fontSize: '13.5px',
            fontWeight: activeTab === 'direct' ? 700 : 500,
            color: activeTab === 'direct' ? 'var(--navy)' : 'var(--muted-foreground)',
            borderBottom: activeTab === 'direct' ? '2.5px solid var(--navy)' : '2.5px solid transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
          Envoi direct
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: AUTO-SMS SETTINGS & DUAL-COLUMN LAYOUT (PLANNED vs INSTANT) */}
      {/* ========================================================================= */}
      {activeTab === 'auto' && (
        <form
          onSubmit={handleSaveSettings}
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
            gap: '18px',
            alignItems: 'start',
          }}
        >
          {/* ===================================================================== */}
          {/* LEFT COLUMN: RAPPELS PROGRAMMÉS + MODÈLE DU RAPPEL */}
          {/* ===================================================================== */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Card 1: Planned Schedule Overview */}
            <div className="card" style={{ padding: '18px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <h3 style={{ fontSize: '15.5px', fontWeight: 700, color: 'var(--navy)', margin: 0 }}>
                    Rappels Programmés
                  </h3>
                  <p className="muted" style={{ fontSize: '11.5px', margin: '2px 0 0' }}>
                    Anticipation avant le RDV et heures d'envoi.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={openScheduleModal}
                  className="button button-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', padding: '6px 12px' }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                  Modifier les horaires
                </button>
              </div>

              {/* Status Banner */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: '7px',
                  background: settingsForm.autoSendEnabled ? '#f0fdf4' : '#fffbeb',
                  border: settingsForm.autoSendEnabled ? '1px solid #bbf7d0' : '1px solid #fde68a',
                  marginBottom: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      width: '9px',
                      height: '9px',
                      borderRadius: '50%',
                      background: settingsForm.autoSendEnabled ? 'var(--green)' : '#d97706',
                      boxShadow: settingsForm.autoSendEnabled ? '0 0 5px rgba(16, 185, 129, 0.4)' : 'none',
                    }}
                  />
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--foreground)' }}>
                    {settingsForm.autoSendEnabled ? 'Service automatique actif' : 'Service automatique suspendu'}
                  </span>
                </div>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '10.5px',
                    fontWeight: 700,
                    background: settingsForm.autoSendEnabled ? '#dcfce7' : '#fef3c7',
                    color: settingsForm.autoSendEnabled ? '#15803d' : '#b45309',
                  }}
                >
                  {settingsForm.autoSendEnabled ? 'ACTIF' : 'EN PAUSE'}
                </span>
              </div>

              {/* Reminders List Badges */}
              <div style={{ marginBottom: '10px' }}>
                <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: '6px' }}>
                  Rappels configurés ({settingsForm.reminders?.length || 0})
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {(settingsForm.reminders || []).map((rem, idx) => {
                    const label = rem.daysBefore === 0
                      ? 'Jour J'
                      : rem.daysBefore === 1
                      ? 'J-1 (Veille)'
                      : `J-${rem.daysBefore}`;
                    return (
                      <span
                        key={idx}
                        style={{
                          background: '#f8fafc',
                          border: '1px solid var(--border)',
                          borderRadius: '6px',
                          padding: '4px 9px',
                          fontSize: '11.5px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <strong style={{ color: 'var(--navy)', fontSize: '11px' }}>#{idx + 1}</strong>
                        <span>{label}</span>
                        <strong style={{ color: 'var(--blue)', background: '#edf4fb', padding: '1px 5px', borderRadius: '4px' }}>
                          {rem.time || '18:00'}
                        </strong>
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Order Flow */}
              <div
                style={{
                  padding: '6px 10px',
                  background: '#f1f5f9',
                  borderRadius: '6px',
                  fontSize: '11px',
                  color: '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  flexWrap: 'wrap',
                }}
              >
                <strong style={{ color: 'var(--navy)' }}>Ordre :</strong>
                {(settingsForm.reminders || []).map((r, i) => (
                  <span key={i} style={{ background: '#fff', padding: '1px 6px', borderRadius: '4px', border: '1px solid #cbd5e1', fontWeight: 600 }}>
                    {i + 1}. {r.daysBefore === 0 ? 'Jour J' : `J-${r.daysBefore}`} à {r.time}
                  </span>
                ))}
              </div>
            </div>

            {/* Card 2: Planned Reminder Template */}
            <div className="card" style={{ padding: '18px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div>
                  <h4 style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--navy)', margin: 0 }}>
                    Modèle du Message de Rappel
                  </h4>
                  <p className="muted" style={{ fontSize: '11px', margin: '2px 0 0' }}>
                    Texte envoyé avant le rendez-vous.
                  </p>
                </div>
                <span className="muted" style={{ fontSize: '11px' }}>
                  {settingsForm.reminderTemplate.length} / {MAX_LENGTH} car.
                </span>
              </div>

              {/* Clickable Variable Pills */}
              <div style={{ marginBottom: '8px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                  {[
                    { key: 'nom', label: '{nom}' },
                    { key: 'prenom', label: '{prenom}' },
                    { key: 'date', label: '{date}' },
                    { key: 'heure', label: '{heure}' },
                    { key: 'cabinet', label: '{cabinet}' },
                  ].map((v) => (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() => insertReminderVariable(v.key)}
                      style={{
                        padding: '3px 8px',
                        background: '#edf4fb',
                        color: 'var(--navy)',
                        border: '1px solid #dceaf8',
                        borderRadius: '16px',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      + {v.label}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                name="reminderTemplate"
                rows={4}
                value={settingsForm.reminderTemplate}
                onChange={(e) => setSettingsForm((prev) => ({ ...prev, reminderTemplate: e.target.value }))}
                maxLength={MAX_LENGTH}
                style={{ width: '100%', fontSize: '12.5px', lineHeight: 1.45, padding: '10px', borderRadius: '7px' }}
                required
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button
                  type="submit"
                  className="button button-primary"
                  disabled={savingSettings}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 14px' }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                    <polyline points="17 21 17 13 7 13 7 21" />
                    <polyline points="7 3 7 8 15 8" />
                  </svg>
                  {savingSettings ? 'Enregistrement…' : 'Enregistrer le rappel'}
                </button>
              </div>
            </div>
          </div>

          {/* ===================================================================== */}
          {/* RIGHT COLUMN: CONFIRMATION IMMÉDIATE + MODÈLE ASSOCIE */}
          {/* ===================================================================== */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Card 1: Instant Confirmation Overview */}
            <div className="card" style={{ padding: '18px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <h3 style={{ fontSize: '15.5px', fontWeight: 700, color: 'var(--navy)', margin: 0 }}>
                    Confirmation Immédiate
                  </h3>
                  <p className="muted" style={{ fontSize: '11.5px', margin: '2px 0 0' }}>
                    Envoi instantané dès qu'un rendez-vous est fixé.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleToggleSendOnBooking}
                  className={`button ${settingsForm.sendOnBooking ? 'button-secondary' : 'button-ghost'}`}
                  style={{ fontSize: '11.5px', padding: '6px 12px' }}
                >
                  {settingsForm.sendOnBooking ? 'Désactiver' : 'Activer'}
                </button>
              </div>

              {/* Status Banner */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: '7px',
                  background: settingsForm.sendOnBooking ? '#f0fdf4' : '#fffbeb',
                  border: settingsForm.sendOnBooking ? '1px solid #bbf7d0' : '1px solid #fde68a',
                  marginBottom: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      width: '9px',
                      height: '9px',
                      borderRadius: '50%',
                      background: settingsForm.sendOnBooking ? 'var(--green)' : '#d97706',
                      boxShadow: settingsForm.sendOnBooking ? '0 0 5px rgba(16, 185, 129, 0.4)' : 'none',
                    }}
                  />
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--foreground)' }}>
                    {settingsForm.sendOnBooking ? 'Envoi immédiat activé' : 'Envoi immédiat désactivé'}
                  </span>
                </div>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '10.5px',
                    fontWeight: 700,
                    background: settingsForm.sendOnBooking ? '#dcfce7' : '#fef3c7',
                    color: settingsForm.sendOnBooking ? '#15803d' : '#b45309',
                  }}
                >
                  {settingsForm.sendOnBooking ? 'ACTIF' : 'DÉSACTIVÉ'}
                </span>
              </div>

              {/* Description box */}
              <div
                style={{
                  padding: '9px 12px',
                  background: '#f8fafc',
                  border: '1px solid var(--border)',
                  borderRadius: '7px',
                  fontSize: '11.5px',
                  color: '#475569',
                  lineHeight: 1.45,
                }}
              >
                <strong style={{ color: 'var(--navy)', display: 'block', marginBottom: '3px' }}>
                  Déclenchement instantané
                </strong>
                Dès qu'une consultation est réservée depuis l'<strong>Agenda</strong> ou la <strong>Fiche Patient</strong>, un SMS de confirmation est immédiatement envoyé avec la date et l'heure du RDV.
              </div>
            </div>

            {/* Card 2: Instant Confirmation Template */}
            <div className="card" style={{ padding: '18px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div>
                  <h4 style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--navy)', margin: 0 }}>
                    Modèle de Confirmation de RDV
                  </h4>
                  <p className="muted" style={{ fontSize: '11px', margin: '2px 0 0' }}>
                    Texte envoyé instantanément lors de la réservation.
                  </p>
                </div>
                <span className="muted" style={{ fontSize: '11px' }}>
                  {(settingsForm.bookingTemplate || '').length} / {MAX_LENGTH} car.
                </span>
              </div>

              {/* Clickable Variable Pills */}
              <div style={{ marginBottom: '8px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                  {[
                    { key: 'nom', label: '{nom}' },
                    { key: 'prenom', label: '{prenom}' },
                    { key: 'date', label: '{date}' },
                    { key: 'heure', label: '{heure}' },
                    { key: 'cabinet', label: '{cabinet}' },
                  ].map((v) => (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() => insertBookingVariable(v.key)}
                      style={{
                        padding: '3px 8px',
                        background: '#edf4fb',
                        color: 'var(--navy)',
                        border: '1px solid #dceaf8',
                        borderRadius: '16px',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      + {v.label}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                name="bookingTemplate"
                rows={4}
                value={settingsForm.bookingTemplate}
                onChange={(e) => setSettingsForm((prev) => ({ ...prev, bookingTemplate: e.target.value }))}
                maxLength={MAX_LENGTH}
                style={{ width: '100%', fontSize: '12.5px', lineHeight: 1.45, padding: '10px', borderRadius: '7px' }}
                required
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button
                  type="submit"
                  className="button button-primary"
                  disabled={savingSettings}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 14px' }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                    <polyline points="17 21 17 13 7 13 7 21" />
                    <polyline points="7 3 7 8 15 8" />
                  </svg>
                  {savingSettings ? 'Enregistrement…' : 'Enregistrer la confirmation'}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: DUE REMINDERS QUEUE */}
      {/* ========================================================================= */}
      {activeTab === 'due' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--navy)' }}>
                File des prochains envois automatiques ({dueItems.length})
              </h3>
              <p className="muted" style={{ fontSize: '12px', margin: '2px 0 0 0' }}>
                Consultations planifiées : le serveur envoie chaque rappel automatiquement à l'heure programmée.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  background: '#f0fdf4',
                  color: 'var(--green)',
                  border: '1px solid #bbf7d0',
                  padding: '5px 12px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />
                Mode 100% Automatique
              </span>
            </div>
          </div>

          <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>Patient & Téléphone</th>
                <th>Date du rendez-vous</th>
                <th>Date & heure du prochain SMS</th>
                <th>Temps restant</th>
                <th>Message qui sera envoyé</th>
                <th style={{ textAlign: 'center' }}>Statut</th>
              </tr>
            </thead>
            <tbody>
              {due.loading && !due.data && (
                <tr>
                  <td colSpan="6" className="empty">Chargement de la file d'attente…</td>
                </tr>
              )}

              {!due.loading && dueItems.length === 0 && (
                <tr>
                  <td colSpan="6" className="empty">
                    ✓ Aucun rappel en attente. Tous les messages ont été programmés ou expédiés !
                  </td>
                </tr>
              )}

              {dueItems.map((item) => {
                const sendDate = item.nextSendDate || item.date;
                const sendTime = item.nextSendTime || '18:00';

                return (
                  <tr key={item.appointmentId}>
                    <td>
                      <div>
                        <strong style={{ fontSize: '13.5px', color: 'var(--foreground)' }}>
                          {item.patientName}
                        </strong>
                        <div style={{ marginTop: '2px' }}>
                          <a href={`tel:${item.phone}`} style={{ color: 'var(--blue)', fontWeight: 600, fontSize: '12px' }}>
                            {item.phone}
                          </a>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontWeight: 700, color: 'var(--navy)', fontSize: '13px' }}>
                        📅 {formatDate(item.date)}
                      </span>
                    </td>
                    <td>
                      <div>
                        <strong style={{ color: 'var(--foreground)', fontSize: '13px' }}>
                          {formatDate(sendDate)} à {sendTime}
                        </strong>
                        <span className="muted" style={{ display: 'block', fontSize: '11px', marginTop: '2px' }}>
                          Horodatage prévu
                        </span>
                      </div>
                    </td>
                    <td>
                      {item.lastSmsStatus === 'FAILED' ? (
                        <div>
                          <span
                            className="pill"
                            style={{
                              background: '#fff7ed',
                              color: '#c2410c',
                              border: '1px solid #fed7aa',
                              fontWeight: 700,
                              fontSize: '11.5px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '4px 10px',
                              borderRadius: '20px',
                            }}
                          >
                            ⚠️ En attente du modem
                          </span>
                          {item.lastSmsAttemptAt && (
                            <div className="muted" style={{ fontSize: '11px', marginTop: '3px' }}>
                              Échec à {formatTime(item.lastSmsAttemptAt)} · Nouvel essai en cours
                            </div>
                          )}
                        </div>
                      ) : (
                        <CountdownBadge sendDate={sendDate} sendTime={sendTime} />
                      )}
                    </td>
                    <td>
                      <div
                        style={{
                          fontSize: '12px',
                          color: 'var(--foreground)',
                          maxWidth: '320px',
                          lineHeight: 1.45,
                          background: '#f8fafc',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: '1px solid #e2e8f0',
                        }}
                      >
                        {item.message || item.suggestedMessage}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {item.lastSmsStatus === 'FAILED' ? (
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                          <span
                            className="pill"
                            style={{
                              background: '#fef2f2',
                              color: '#b91c1c',
                              border: '1px solid #fecaca',
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '5px 12px',
                              borderRadius: '20px',
                              boxShadow: '0 1px 3px rgba(185,28,28,0.08)',
                            }}
                            title={`❌ ÉCHEC D'ENVOI DU SMS :\n${item.lastSmsError || 'Erreur lors de la communication avec le modem'}\n\n🕒 Horodatage : ${item.lastSmsAttemptAt ? formatTime(item.lastSmsAttemptAt) : 'Tentative récente'}\n\nℹ️ Le serveur réessaiera automatiquement dès que la carte SIM et le modem seront prêts.`}
                          >
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#dc2626' }} />
                            ❌ Non envoyé (Erreur)
                          </span>
                        </div>
                      ) : (
                        <span
                          className="pill"
                          style={{
                            background: '#f0fdf4',
                            color: 'var(--green)',
                            border: '1px solid #bbf7d0',
                            fontSize: '12px',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '5px 12px',
                            borderRadius: '20px',
                          }}
                          title="Envoi programmé : le serveur l'expédiera automatiquement à l'heure prévue"
                        >
                          ⚡ Automatique
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: SENT MESSAGES HISTORY */}
      {/* ========================================================================= */}
      {activeTab === 'history' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--navy)' }}>
              Historique des SMS envoyés ({totalHistory})
            </h3>
            <p className="muted" style={{ fontSize: '12px' }}>
              Journal complet de tous les SMS et rappels délivrés par le cabinet.
            </p>
          </div>

          <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ width: '180px' }}>Patient</th>
                <th>Rendez-vous associé</th>
                <th>Message envoyé</th>
                <th style={{ textAlign: 'right', paddingRight: '20px' }}>Statut</th>
              </tr>
            </thead>
            <tbody>
              {history.loading && !history.data && (
                <tr>
                  <td colSpan="4" className="empty">Chargement de l'historique…</td>
                </tr>
              )}

              {!history.loading && historyItems.length === 0 && (
                <tr>
                  <td colSpan="4" className="empty">Aucun message envoyé pour le moment.</td>
                </tr>
              )}

              {historyItems.map((msg) => (
                <tr key={msg.id}>
                  <td>
                    <strong>{msg.patientName}</strong>
                  </td>
                  <td>
                    <span style={{ fontWeight: 600, color: 'var(--navy)' }}>
                      📅 {formatDate(msg.date ?? msg.appointmentDate)}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontSize: '12.5px', color: 'var(--foreground)', maxWidth: '480px' }}>
                      {msg.message}
                    </div>
                  </td>
                  <td style={{ textAlign: 'right', paddingRight: '20px' }}>
                    <span
                      className="pill"
                      style={{
                        background: '#edf8f3',
                        color: 'var(--green)',
                        border: '1px solid #d1fae5',
                        fontWeight: 600,
                        fontSize: '12px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      ✓ Envoyé et confirmé
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalHistoryPages > 1 && (
            <div className="card-foot" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderTop: '1px solid var(--border)' }}>
              <span className="muted" style={{ fontSize: '12px' }}>
                Page {historyPage} sur {totalHistoryPages}
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="button button-ghost"
                  disabled={historyPage <= 1}
                  onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                >
                  Précédent
                </button>
                <button
                  type="button"
                  className="button button-ghost"
                  disabled={historyPage >= totalHistoryPages}
                  onClick={() => setHistoryPage((p) => Math.min(totalHistoryPages, p + 1))}
                >
                  Suivant
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: DIRECT SINGLE SMS */}
      {/* ========================================================================= */}
      {activeTab === 'direct' && (
        <div className="card" style={{ maxWidth: '640px', padding: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--navy)', marginBottom: '6px' }}>
            Composer un SMS direct
          </h3>
          <p className="muted" style={{ fontSize: '12px', marginBottom: '18px' }}>
            Sélectionnez une consultation pour envoyer un SMS personnalisé immédiatement.
          </p>

          <form onSubmit={handleSendDirectSms}>
            <Field label="Rendez-vous du patient *">
              <select
                name="appointmentId"
                value={directForm.appointmentId}
                onChange={(e) => setDirectForm((prev) => ({ ...prev, appointmentId: e.target.value }))}
                required
                style={{ width: '100%', marginBottom: '16px' }}
              >
                <option value="">Sélectionnez un rendez-vous…</option>
                {(appointments.data?.items ?? []).map((apt) => (
                  <option key={apt.id} value={apt.id}>
                    {apt.patientName} — {formatDate(apt.date)} {apt.hasSms ? '(SMS déjà envoyé)' : ''}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Message SMS *">
              <textarea
                name="message"
                value={directForm.message}
                onChange={(e) => setDirectForm((prev) => ({ ...prev, message: e.target.value }))}
                rows={4}
                required
                maxLength={MAX_LENGTH}
                placeholder="Tapez le texte du message à envoyer..."
                style={{ width: '100%', marginBottom: '8px' }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '11px', color: 'var(--muted-foreground)' }}>
                {directForm.message.length} / {MAX_LENGTH} caractères
              </div>
            </Field>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button
                type="submit"
                className="button"
                disabled={directSending}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              >
                {directSending ? 'Envoi en cours…' : 'Envoyer le message'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: EDIT AUTOMATION RULES & REMINDER TIMES */}
      {showScheduleModal && modalDraft && (
        <div className="modal-backdrop" onClick={closeScheduleModal}>
          <div
            className="modal wide"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '680px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
          >
            <div className="modal-head" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '14px' }}>
              <div>
                <span className="eyebrow" style={{ fontSize: '10px' }}>PARAMÈTRES SMS</span>
                <h2 style={{ margin: '2px 0 0', fontSize: '18px', color: 'var(--navy)' }}>
                  Modifier la planification des rappels
                </h2>
              </div>
              <button
                type="button"
                className="button button-ghost"
                onClick={closeScheduleModal}
                style={{ padding: '4px 8px' }}
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveScheduleModal} style={{ overflowY: 'auto', padding: '16px 0', flex: 1 }}>
              {/* Master Toggle */}
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  padding: '12px 14px',
                  background: modalDraft.autoSendEnabled ? '#f0fdf4' : '#f8fafc',
                  border: modalDraft.autoSendEnabled ? '1.5px solid var(--green)' : '1px solid var(--border)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  marginBottom: '16px',
                }}
              >
                <input
                  type="checkbox"
                  name="autoSendEnabled"
                  checked={modalDraft.autoSendEnabled}
                  onChange={(e) => setModalDraft((prev) => ({ ...prev, autoSendEnabled: e.target.checked }))}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <div>
                  <strong style={{ fontSize: '13.5px', color: 'var(--foreground)' }}>
                    Activer l'envoi automatique des SMS (Service d'arrière-plan)
                  </strong>
                  <p className="muted" style={{ fontSize: '11.5px', margin: '2px 0 0' }}>
                    Le serveur exécute les vérifications et envoie les SMS automatiquement.
                  </p>
                </div>
              </label>

              {/* Reminders list header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div>
                  <strong style={{ fontSize: '13.5px', color: 'var(--navy)' }}>
                    Rappels programmés ({modalDraft.reminders?.length || 1})
                  </strong>
                  <p className="muted" style={{ fontSize: '11.5px', margin: '2px 0 0' }}>
                    Délai d'anticipation et heure d'envoi exacte (HH:mm)
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleAddDraftReminder}
                  disabled={!modalDraft.autoSendEnabled || (modalDraft.reminders?.length ?? 0) >= 5}
                  className="button"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    padding: '6px 12px',
                    background: 'var(--blue)',
                    color: '#fff',
                    borderRadius: '6px',
                    border: 'none',
                    cursor: (!modalDraft.autoSendEnabled || (modalDraft.reminders?.length ?? 0) >= 5) ? 'not-allowed' : 'pointer',
                  }}
                >
                  <span style={{ fontSize: '16px', fontWeight: 800 }}>+</span>
                  Ajouter un rappel
                </button>
              </div>

              {/* Reminders items */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                {modalDraft.reminders?.map((rem, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      background: '#ffffff',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      flexWrap: 'wrap',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                    }}
                  >
                    <span
                      style={{
                        background: 'var(--navy)',
                        color: '#fff',
                        fontSize: '10.5px',
                        fontWeight: 700,
                        padding: '4px 10px',
                        borderRadius: '20px',
                      }}
                    >
                      #{idx + 1}
                    </span>

                    <div style={{ flex: '1 1 180px' }}>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>
                        Délai avant le RDV
                      </label>
                      <select
                        value={rem.daysBefore}
                        disabled={!modalDraft.autoSendEnabled}
                        onChange={(e) => handleUpdateDraftReminder(idx, 'daysBefore', Number(e.target.value))}
                        style={{
                          width: '100%',
                          padding: '6px 10px',
                          fontSize: '12.5px',
                          borderRadius: '6px',
                          border: '1px solid var(--border)',
                          background: '#fff',
                        }}
                      >
                        <option value="0">Le jour même (J-0)</option>
                        <option value="1">1 jour avant (J-1 · Veille)</option>
                        <option value="2">2 jours avant (J-2)</option>
                        <option value="3">3 jours avant (J-3)</option>
                        <option value="4">4 jours avant (J-4)</option>
                        <option value="5">5 jours avant (J-5)</option>
                        <option value="7">7 jours avant (1 semaine)</option>
                        <option value="10">10 jours avant (J-10)</option>
                        <option value="14">14 jours avant (2 semaines)</option>
                      </select>
                    </div>

                    <div style={{ flex: '0 0 130px' }}>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>
                        Heure d'envoi
                      </label>
                      <input
                        type="time"
                        value={rem.time || '18:00'}
                        disabled={!modalDraft.autoSendEnabled}
                        onChange={(e) => handleUpdateDraftReminder(idx, 'time', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '5px 8px',
                          fontSize: '13px',
                          borderRadius: '6px',
                          border: '1px solid var(--border)',
                          background: '#fff',
                          fontWeight: 600,
                        }}
                      />
                    </div>

                    <div style={{ paddingTop: '16px' }}>
                      <button
                        type="button"
                        disabled={!modalDraft.autoSendEnabled || (modalDraft.reminders?.length ?? 1) <= 1}
                        onClick={() => handleRemoveDraftReminder(idx)}
                        title={
                          (modalDraft.reminders?.length ?? 1) <= 1
                            ? 'Il faut conserver au moins 1 rappel programmé'
                            : 'Supprimer ce rappel'
                        }
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: (modalDraft.reminders?.length ?? 1) <= 1 ? '#cbd5e1' : 'var(--red)',
                          cursor: (modalDraft.reminders?.length ?? 1) <= 1 ? 'not-allowed' : 'pointer',
                          padding: '6px 8px',
                          fontSize: '12px',
                          fontWeight: 600,
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Chronological order hint */}
              <div
                style={{
                  padding: '8px 12px',
                  background: '#f1f5f9',
                  borderRadius: '6px',
                  fontSize: '11.5px',
                  color: '#475569',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  flexWrap: 'wrap',
                }}
              >
                <strong style={{ color: 'var(--navy)' }}>Ordre :</strong>
                {(modalDraft.reminders || []).map((r, i) => (
                  <span
                    key={i}
                    style={{
                      background: '#fff',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      border: '1px solid #cbd5e1',
                      fontWeight: 600,
                    }}
                  >
                    {i + 1}. {r.daysBefore === 0 ? 'Jour J' : `J-${r.daysBefore}`} à {r.time}
                  </span>
                ))}
              </div>

              {/* Extra Checkboxes */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '6px 0 10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={modalDraft.sendReminderBefore}
                    disabled={!modalDraft.autoSendEnabled}
                    onChange={(e) => setModalDraft((prev) => ({ ...prev, sendReminderBefore: e.target.checked }))}
                    style={{ width: '16px', height: '16px' }}
                  />
                  <span style={{ fontSize: '12.5px' }}>
                    Envoyer le <strong>rappel d'avant-consultation</strong>
                  </span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={modalDraft.sendOnBooking}
                    disabled={!modalDraft.autoSendEnabled}
                    onChange={(e) => setModalDraft((prev) => ({ ...prev, sendOnBooking: e.target.checked }))}
                    style={{ width: '16px', height: '16px' }}
                  />
                  <span style={{ fontSize: '12.5px' }}>
                    Envoyer une <strong>confirmation immédiate</strong> dès qu'un rendez-vous est fixé
                  </span>
                </label>
              </div>

              {/* Modal Actions */}
              <div
                className="modal-actions"
                style={{
                  borderTop: '1px solid var(--border)',
                  paddingTop: '14px',
                  marginTop: '10px',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '10px',
                }}
              >
                <button
                  type="button"
                  className="button button-ghost"
                  onClick={closeScheduleModal}
                  disabled={savingSettings}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="button button-primary"
                  disabled={savingSettings}
                >
                  {savingSettings ? 'Enregistrement…' : 'Enregistrer la planification'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
