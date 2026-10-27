import { useState } from 'react';
import Field from './Field';
import Notice from './Notice';
import { describeError, formatDate } from '../lib/format';

export const COMMON_DENTAL_ACTS = [
  'Consultation & Bilan bucco-dentaire',
  'Détartrage & Polissage supra-gingival',
  'Obturation composite 1 face',
  'Obturation composite 2 faces / foulage',
  'Traitement endodontique canalaire (Dévitalisation)',
  'Reprise de traitement endodontique',
  'Extraction simple',
  'Extraction chirurgicale (dent de sagesse / incluse)',
  'Extraction d’une canine incluse',
  'Pose de couronne céramique / zircone',
  'Pose de couronne provisoire',
  'Pose d’implant dentaire ostéo-intégré',
  'Pose d’inlay / onlay esthétique',
  'Surfaçage radiculaire & curetage parodontal',
  'Gingivectomie / Élongation coronaire',
  'Pose d’appareil de contention',
  'Blanchiment dentaire au cabinet',
];

function getTodayIso() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function DentalTreatmentsLedger({
  treatments = [],
  loading = false,
  onCreateTreatment,
  onUpdateTreatment,
  onDeleteTreatment,
  prefilledTooth = null,
  onClearPrefilledTooth,
}) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTreatment, setEditingTreatment] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Filter state
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterTooth, setFilterTooth] = useState('');

  // Form State
  const [formDate, setFormDate] = useState(getTodayIso());
  const [formTooth, setFormTooth] = useState('');
  const [formActName, setFormActName] = useState('Détartrage & Polissage supra-gingival');
  const [formStatus, setFormStatus] = useState('Terminé');
  const [formNotes, setFormNotes] = useState('');

  // Open modal if prefilledTooth changes from chart click
  const openCreateForTooth = (toothNum) => {
    setEditingTreatment(null);
    setFormDate(getTodayIso());
    setFormTooth(toothNum ? String(toothNum) : '');
    setFormActName('Obturation composite 1 face');
    setFormStatus('Terminé');
    setFormNotes('');
    setError(null);
    setShowAddModal(true);
  };

  const openCreateModal = () => {
    setEditingTreatment(null);
    setFormDate(getTodayIso());
    setFormTooth(prefilledTooth ? String(prefilledTooth) : '');
    setFormActName('Détartrage & Polissage supra-gingival');
    setFormStatus('Terminé');
    setFormNotes('');
    setError(null);
    setShowAddModal(true);
  };

  const openEditModal = (t) => {
    setEditingTreatment(t);
    setFormDate(t.date || getTodayIso());
    setFormTooth(t.toothNumbers || '');
    setFormActName(t.actName || '');
    setFormStatus(t.status || 'Terminé');
    setFormNotes(t.notes || '');
    setError(null);
    setShowAddModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formActName.trim()) {
      setError(new Error("Le nom de l'acte de soin est requis."));
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      date: formDate,
      toothNumbers: formTooth.trim() || 'Général',
      actName: formActName.trim(),
      status: formStatus,
      notes: formNotes.trim() || null,
    };

    try {
      if (editingTreatment) {
        await onUpdateTreatment(editingTreatment.id, payload);
      } else {
        await onCreateTreatment(payload);
      }
      setShowAddModal(false);
      onClearPrefilledTooth && onClearPrefilledTooth();
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer cet acte de soin de l’historique médical ?')) {
      return;
    }
    try {
      await onDeleteTreatment(id);
    } catch (err) {
      alert(`Erreur de suppression: ${describeError(err)}`);
    }
  };

  // Filtered list
  const filteredTreatments = treatments.filter((t) => {
    if (filterStatus !== 'all' && t.status !== filterStatus) return false;
    if (filterTooth.trim()) {
      const q = filterTooth.trim().toLowerCase();
      if (!t.toothNumbers?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="card" style={{ padding: '22px', border: '1px solid var(--border)', background: '#fff' }}>
      {/* HEADER & CHAIRSIDE ACTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '18px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '18px' }}>📋</span>
            <h3 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--navy)', margin: 0 }}>
              Traitements Cliniques Enregistrés
            </h3>
            <span className="pill" style={{ background: '#f1f5f9', color: 'var(--navy)', fontWeight: 700, fontSize: '11px' }}>
              {treatments.length} acte{treatments.length > 1 ? 's' : ''}
            </span>
          </div>
          <p className="muted" style={{ fontSize: '12px', marginTop: '3px' }}>
            Registre médical des soins réalisés et prévus au fauteuil (sans données financières).
          </p>
        </div>

        <button
          type="button"
          className="button"
          onClick={openCreateModal}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--navy)' }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          + Enregistrer un Soin
        </button>
      </div>

      {/* FILTER CONTROLS */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '16px', background: '#f8fafc', padding: '10px 14px', borderRadius: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>Statut :</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{ fontSize: '12px', padding: '4px 8px' }}
          >
            <option value="all">Tous les statuts ({treatments.length})</option>
            <option value="Terminé">✓ Terminé</option>
            <option value="Prévu">⏳ Prévu / À faire</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>N° Dent :</span>
          <input
            type="text"
            placeholder="ex: 16, 21..."
            value={filterTooth}
            onChange={(e) => setFilterTooth(e.target.value)}
            style={{ width: '90px', fontSize: '12px', padding: '4px 8px' }}
          />
        </div>

        {(filterStatus !== 'all' || filterTooth) && (
          <button
            type="button"
            className="button button-ghost"
            style={{ fontSize: '11px', padding: '3px 8px' }}
            onClick={() => {
              setFilterStatus('all');
              setFilterTooth('');
            }}
          >
            Réinitialiser filtres
          </button>
        )}

        <span className="muted" style={{ marginLeft: 'auto', fontSize: '11.5px' }}>
          {filteredTreatments.length} affiché(s)
        </span>
      </div>

      {/* CLINICAL TREATMENTS TABLE (STRICTLY MEDICAL - NO FINANCIAL/CURRENCY COLUMNS) */}
      <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
        <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
              <th style={{ padding: '10px 14px', width: '120px' }}>Date</th>
              <th style={{ padding: '10px 14px', width: '90px' }}>Dent(s)</th>
              <th style={{ padding: '10px 14px' }}>Acte Médical &amp; Traitement Réalisé</th>
              <th style={{ padding: '10px 14px', width: '110px' }}>Statut</th>
              <th style={{ padding: '10px 14px' }}>Observations Cliniques</th>
              <th style={{ padding: '10px 14px', width: '90px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && treatments.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '30px', textAlign: 'center' }} className="muted">
                  Chargement des soins cliniques…
                </td>
              </tr>
            ) : filteredTreatments.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '34px', textAlign: 'center' }}>
                  <div style={{ fontSize: '26px', marginBottom: '6px' }}>🩺</div>
                  <strong style={{ display: 'block', fontSize: '14px', color: 'var(--navy)' }}>
                    Aucun traitement clinique enregistré
                  </strong>
                  <p className="muted" style={{ fontSize: '12px', marginTop: '2px' }}>
                    Cliquez sur une dent dans l'odontogramme ou sur « + Enregistrer un Soin » pour tracer les interventions.
                  </p>
                </td>
              </tr>
            ) : (
              filteredTreatments.map((t) => (
                <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                    <strong>{formatDate(t.date)}</strong>
                  </td>

                  <td style={{ padding: '10px 14px' }}>
                    <span
                      className="pill"
                      style={{
                        background: t.toothNumbers === 'Général' ? '#f1f5f9' : '#e0e7ff',
                        color: t.toothNumbers === 'Général' ? '#475569' : '#3730a3',
                        fontWeight: 700,
                        fontSize: '11.5px',
                      }}
                    >
                      {t.toothNumbers}
                    </span>
                  </td>

                  <td style={{ padding: '10px 14px', color: 'var(--navy)', fontWeight: 600 }}>
                    {t.actName}
                  </td>

                  <td style={{ padding: '10px 14px' }}>
                    <span
                      className="pill"
                      style={{
                        background: t.status === 'Terminé' ? 'var(--ok-soft)' : '#eff6ff',
                        color: t.status === 'Terminé' ? 'var(--ok)' : 'var(--blue)',
                        fontWeight: 700,
                        fontSize: '11px',
                      }}
                    >
                      {t.status === 'Terminé' ? '✓ Terminé' : '⏳ Prévu'}
                    </span>
                  </td>

                  <td style={{ padding: '10px 14px', color: '#475569', fontSize: '12px', maxWidth: '320px' }}>
                    {t.notes ? <span>{t.notes}</span> : <span className="muted">—</span>}
                  </td>

                  <td style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button
                      type="button"
                      className="button button-ghost"
                      style={{ padding: '3px 7px', fontSize: '11.5px', marginRight: '4px' }}
                      onClick={() => openEditModal(t)}
                    >
                      Modifier
                    </button>
                    <button
                      type="button"
                      className="button button-danger"
                      style={{ padding: '3px 7px', fontSize: '11.5px' }}
                      onClick={() => handleDelete(t.id)}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL: CREATE / EDIT CLINICAL TREATMENT */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => !saving && setShowAddModal(false)}>
          <div
            className="modal card"
            style={{ maxWidth: '580px', width: '92%', padding: '24px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--navy)' }}>
                  {editingTreatment ? 'Modifier l’Acte de Soin' : 'Enregistrer un Nouvel Acte de Soin'}
                </h3>
                <p className="muted" style={{ fontSize: '12px' }}>
                  Inscription au dossier clinique du patient (strictly procedural &amp; medical).
                </p>
              </div>
              <button
                type="button"
                className="button button-ghost"
                onClick={() => setShowAddModal(false)}
              >
                ✕
              </button>
            </div>

            {error && <Notice tone="error">{describeError(error)}</Notice>}

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <Field label="Date de l’intervention *">
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    required
                    disabled={saving}
                  />
                </Field>

                <Field label="N° Dent(s) FDI">
                  <input
                    type="text"
                    placeholder="ex: 16 ou 14, 15"
                    value={formTooth}
                    onChange={(e) => setFormTooth(e.target.value)}
                    disabled={saving}
                  />
                </Field>

                <Field label="Statut">
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value)}
                    disabled={saving}
                  >
                    <option value="Terminé">✓ Terminé</option>
                    <option value="Prévu">⏳ Prévu (À faire)</option>
                  </select>
                </Field>
              </div>

              {/* Act Name & Presets */}
              <div style={{ marginBottom: '14px' }}>
                <Field label="Acte Médical &amp; Traitement *">
                  <input
                    type="text"
                    value={formActName}
                    onChange={(e) => setFormActName(e.target.value)}
                    placeholder="ex: Extraction chirurgicale d'une canine incluse..."
                    required
                    disabled={saving}
                    style={{ width: '100%', marginBottom: '8px' }}
                  />
                </Field>

                {/* Quick Presets */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', maxHeight: '110px', overflowY: 'auto' }}>
                  {COMMON_DENTAL_ACTS.map((act) => (
                    <button
                      key={act}
                      type="button"
                      className="button button-ghost"
                      style={{
                        padding: '3px 8px',
                        fontSize: '11px',
                        borderRadius: '4px',
                        background: formActName === act ? '#e0e7ff' : '#f8fafc',
                        color: formActName === act ? '#3730a3' : 'var(--foreground)',
                      }}
                      onClick={() => setFormActName(act)}
                    >
                      {act}
                    </button>
                  ))}
                </div>
              </div>

              {/* Clinical Observations */}
              <div style={{ marginBottom: '20px' }}>
                <Field label="Observations Cliniques &amp; Détails techniques">
                  <textarea
                    rows={3}
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="ex: Anesthésie tronculaire sans incident, décollement du lambeau, suture fil résorbable 4-0, bonne hémostase..."
                    disabled={saving}
                    style={{ width: '100%', fontSize: '12.5px' }}
                  />
                </Field>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="button button-ghost"
                  onClick={() => setShowAddModal(false)}
                  disabled={saving}
                >
                  Annuler
                </button>
                <button type="submit" className="button" disabled={saving}>
                  {saving ? 'Enregistrement…' : editingTreatment ? 'Mettre à jour' : 'Enregistrer le soin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
