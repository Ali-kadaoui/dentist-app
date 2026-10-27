import { useState } from 'react';
import { useAsyncData } from '../hooks/useAsyncData';
import {
  createPatient,
  getPatient,
  listPatients,
  updatePatient,
} from '../api/dentistApi';
import PageHeader from '../components/PageHeader';
import Notice from '../components/Notice';
import Field from '../components/Field';
import { describeError, formatDate, initials } from '../lib/format';

const EMPTY_FORM = {
  firstName: '',
  lastName: '',
  fullName: '',
  dateOfBirth: '',
  profession: '',
  cin: '',
  phone: '',
  address: '',
  email: '',
  gender: '',
  notes: '',
};

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

function getPatientInitials(fullName, firstName, lastName) {
  if (fullName) {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    if (parts.length === 1 && parts[0].length > 0) return parts[0].slice(0, 2).toUpperCase();
  }
  return initials(firstName, lastName);
}

export default function PatientsPage({ onNavigate }) {
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPatient, setEditingPatient] = useState(null);
  const [viewingPatient, setViewingPatient] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  const openViewModal = async (item) => {
    setViewingPatient(item);
    try {
      const full = await getPatient(item.id);
      setViewingPatient(full);
    } catch {
      // Keep item as fallback
    }
  };

  const patients = useAsyncData(() => listPatients({ search, page, pageSize: 25 }), [search, page]);
  const items = patients.data?.items ?? [];
  const totalPages = patients.data?.totalPages ?? 0;
  const total = patients.data?.total ?? 0;

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    setSearch(draft.trim());
  };

  const handleClearSearch = () => {
    setDraft('');
    setSearch('');
    setPage(1);
  };

  const openCreateModal = () => {
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowCreateModal(true);
  };

  const openEditModal = async (item) => {
    setFormError(null);
    setSaving(true);
    try {
      const full = await getPatient(item.id);
      setEditingPatient(full);
      setForm({
        firstName: full.firstName ?? '',
        lastName: full.lastName ?? '',
        fullName: full.fullName || `${full.firstName || ''} ${full.lastName || ''}`.trim(),
        dateOfBirth: full.dateOfBirth ? full.dateOfBirth.slice(0, 10) : '',
        profession: full.profession ?? '',
        cin: full.cin ?? '',
        phone: full.phone ?? '',
        address: full.address ?? '',
        email: full.email ?? '',
        gender: full.gender ?? '',
        notes: full.notes ?? '',
      });
    } catch {
      setEditingPatient(item);
      setForm({
        firstName: item.firstName ?? '',
        lastName: item.lastName ?? '',
        fullName: item.fullName || `${item.firstName || ''} ${item.lastName || ''}`.trim(),
        dateOfBirth: item.dateOfBirth ? item.dateOfBirth.slice(0, 10) : '',
        profession: item.profession ?? '',
        cin: item.cin ?? '',
        phone: item.phone ?? '',
        address: item.address ?? '',
        email: item.email ?? '',
        gender: item.gender ?? '',
        notes: item.notes ?? '',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((curr) => {
      const next = { ...curr, [name]: value };
      if (name === 'firstName' || name === 'lastName') {
        next.fullName = `${next.firstName || ''} ${next.lastName || ''}`.trim();
      }
      return next;
    });
  };

  const handleSaveCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);

    try {
      const fName = form.firstName.trim();
      const lName = form.lastName.trim();
      const full = form.fullName.trim() || `${fName} ${lName}`.trim();
      await createPatient({
        firstName: fName || null,
        lastName: lName || null,
        fullName: full,
        dateOfBirth: form.dateOfBirth || null,
        profession: form.profession.trim() || null,
        cin: form.cin.trim() || null,
        phone: form.phone.trim(),
        address: form.address.trim() || null,
        email: form.email.trim() || null,
        gender: form.gender || null,
        notes: form.notes.trim() || null,
      });

      setShowCreateModal(false);
      setForm(EMPTY_FORM);
      setPage(1);
      patients.reload();
    } catch (problem) {
      setFormError(problem);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingPatient) return;

    setSaving(true);
    setFormError(null);

    try {
      const fName = form.firstName.trim();
      const lName = form.lastName.trim();
      const full = form.fullName.trim() || `${fName} ${lName}`.trim();
      await updatePatient(editingPatient.id, {
        firstName: fName || null,
        lastName: lName || null,
        fullName: full,
        dateOfBirth: form.dateOfBirth || null,
        profession: form.profession.trim() || null,
        cin: form.cin.trim() || null,
        phone: form.phone.trim(),
        address: form.address.trim() || null,
        email: form.email.trim() || null,
        gender: form.gender || null,
        notes: form.notes.trim() || null,
      });

      setEditingPatient(null);
      patients.reload();
    } catch (problem) {
      setFormError(problem);
    } finally {
      setSaving(false);
    }
  };

  const formAge = calculateAge(form.dateOfBirth);

  return (
    <>
      <PageHeader
        title="Patients"
        subtitle="Création, modification et gestion complète des fiches et coordonnées des patients."
        eyebrow="RÉPERTOIRE PATIENTS"
      >
        <button type="button" className="button" onClick={openCreateModal}>
          <span style={{ fontSize: '16px', marginRight: '6px', fontWeight: 800 }}>+</span>
          Nouveau Patient
        </button>
      </PageHeader>

      {/* SEARCH STRIP */}
      <div className="card patient-search-card">
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Rechercher par nom, CIN, téléphone, profession ou adresse..."
              style={{ width: '100%', paddingLeft: '36px' }}
            />
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#94a3b8"
              strokeWidth="2"
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>

          <button type="submit" className="button" style={{ padding: '8px 18px' }}>
            Rechercher
          </button>

          {(search || draft) && (
            <button type="button" className="button button-ghost" onClick={handleClearSearch}>
              Effacer
            </button>
          )}

          <div style={{ marginLeft: 'auto', fontSize: '13px', color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>
            Total : <strong style={{ color: 'var(--navy)' }}>{total}</strong> patient{total > 1 ? 's' : ''}
          </div>
        </form>
      </div>

      {patients.error ? <Notice>{describeError(patients.error)}</Notice> : null}

      {/* Patient Directory Table */}
      <div className="card" style={{ padding: 0, overflow: 'visible' }}>
        <table className="table patient-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ minWidth: '180px' }}>Nom complet</th>
              <th>CIN</th>
              <th>Téléphone</th>
              <th>Date de naissance &amp; Âge</th>
              <th style={{ minWidth: '240px' }}>Notes &amp; Antécédents</th>
              <th style={{ textAlign: 'right', paddingRight: '20px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {patients.loading && !patients.data && (
              <tr>
                <td colSpan="6" className="empty">
                  Chargement des fiches patients…
                </td>
              </tr>
            )}

            {!patients.loading && items.length === 0 && (
              <tr>
                <td colSpan="6" className="empty">
                  {search ? `Aucun patient trouvé pour « ${search} ».` : 'Aucun patient enregistré.'}
                </td>
              </tr>
            )}

            {items.map((item) => {
              const displayFullName = item.fullName || `${item.firstName || ''} ${item.lastName || ''}`.trim();
              const age = item.age ?? calculateAge(item.dateOfBirth);

              return (
                <tr
                  key={item.id}
                  className="clickable-row"
                  onClick={() => openViewModal(item)}
                  title="Cliquer pour afficher la fiche complète du patient"
                >
                  <td>
                    <strong className="patient-name-text">
                      {displayFullName}
                    </strong>
                  </td>
                  <td>
                    {item.cin ? (
                      <span className="cin-pill">
                        {item.cin}
                      </span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    <a
                      href={`tel:${item.phone}`}
                      className="patient-phone-link"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {item.phone}
                    </a>
                  </td>
                  <td>
                    {item.dateOfBirth ? (
                      <div>
                        <span style={{ fontWeight: 600, color: 'var(--navy)' }}>
                          {formatDate(item.dateOfBirth)}
                        </span>
                        {age !== null && (
                          <span className="muted" style={{ fontSize: '11.5px', marginLeft: '6px' }}>
                            ({age} ans)
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    {item.notes ? (
                      <div
                        className="patient-note-cell"
                        onClick={(e) => {
                          e.stopPropagation();
                          openViewModal(item);
                        }}
                      >
                        <div className="patient-note-preview">
                          {item.notes}
                        </div>
                        <div className="patient-note-tooltip">
                          <div style={{ fontWeight: 700, marginBottom: '4px', color: '#93c5fd' }}>
                            Notes médicales &amp; antécédents :
                          </div>
                          {item.notes}
                        </div>
                      </div>
                    ) : (
                      <span className="muted" style={{ fontSize: '12px' }}>—</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right', paddingRight: '16px' }}>
                    <div
                      style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="button button-ghost"
                        style={{ padding: '5px 10px', fontSize: '12px' }}
                        onClick={() => openViewModal(item)}
                        title="Voir la fiche détaillée du patient"
                      >
                        Fiche
                      </button>

                      <button
                        type="button"
                        className="button button-subtle"
                        style={{ padding: '5px 10px', fontSize: '12px' }}
                        onClick={() => openEditModal(item)}
                        title="Modifier la fiche du patient"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '4px' }}>
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                        Modifier
                      </button>

                      <button
                        type="button"
                        className="button"
                        style={{ padding: '5px 12px', fontSize: '12px', backgroundColor: 'var(--navy)' }}
                        onClick={() => onNavigate && onNavigate('dossiers', item.id)}
                        title="Ouvrir le dossier clinique &amp; planifier un RDV"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '4px' }}>
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <line x1="16" y1="13" x2="8" y2="13" />
                          <line x1="16" y1="17" x2="8" y2="17" />
                          <polyline points="10 9 9 9 8 9" />
                        </svg>
                        Dossier
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="card-foot" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderTop: '1px solid var(--border)' }}>
            <span className="muted" style={{ fontSize: '12px' }}>
              Page {page} sur {totalPages}
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="button button-ghost"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Précédent
              </button>
              <button
                type="button"
                className="button button-ghost"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CREATE PATIENT MODAL */}
      {showCreateModal && (
        <div className="modal-backdrop" onClick={() => !saving && setShowCreateModal(false)}>
          <div className="modal patient-form-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h2>Nouveau Patient</h2>
                <p className="muted">Informations complètes du dossier patient.</p>
              </div>
              <button
                type="button"
                className="button button-ghost"
                onClick={() => setShowCreateModal(false)}
                disabled={saving}
              >
                ✕
              </button>
            </div>

            {formError ? <Notice>{describeError(formError)}</Notice> : null}

            <form onSubmit={handleSaveCreate}>
              {/* Row 1: Prénom, Nom, Genre */}
              <div className="patient-form-row-3">
                <Field label="Prénom *">
                  <input
                    name="firstName"
                    value={form.firstName}
                    onChange={handleFormChange}
                    required
                    maxLength={80}
                    autoFocus
                  />
                </Field>

                <Field label="Nom *">
                  <input
                    name="lastName"
                    value={form.lastName}
                    onChange={handleFormChange}
                    required
                    maxLength={80}
                  />
                </Field>

                <Field label="Genre">
                  <select name="gender" value={form.gender} onChange={handleFormChange}>
                    <option value="">—</option>
                    <option value="M">Homme</option>
                    <option value="F">Femme</option>
                  </select>
                </Field>
              </div>

              {/* Row 2: Téléphone, CIN, Date de naissance */}
              <div className="patient-form-row-3 equal">
                <Field label="Téléphone *">
                  <input
                    name="phone"
                    value={form.phone}
                    onChange={handleFormChange}
                    required
                    maxLength={32}
                  />
                </Field>

                <Field label="CIN">
                  <input
                    name="cin"
                    value={form.cin}
                    onChange={handleFormChange}
                    maxLength={50}
                  />
                </Field>

                <Field
                  label={
                    <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Date de naissance</span>
                      {formAge !== null && (
                        <span style={{ color: 'var(--blue)', fontWeight: 700, fontSize: '10.5px' }}>
                          ({formAge} ans)
                        </span>
                      )}
                    </span>
                  }
                >
                  <input
                    name="dateOfBirth"
                    type="date"
                    value={form.dateOfBirth}
                    onChange={handleFormChange}
                  />
                </Field>
              </div>

              {/* Row 3: Profession, Adresse */}
              <div className="patient-form-row-2">
                <Field label="Profession">
                  <input
                    name="profession"
                    value={form.profession}
                    onChange={handleFormChange}
                    maxLength={120}
                  />
                </Field>

                <Field label="Adresse">
                  <input
                    name="address"
                    value={form.address}
                    onChange={handleFormChange}
                    maxLength={250}
                  />
                </Field>
              </div>

              {/* Row 4: Email, Notes médicales */}
              <div className="patient-form-row-2">
                <Field label="Email">
                  <input
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleFormChange}
                  />
                </Field>

                <Field label="Notes médicales / Antécédents">
                  <textarea
                    name="notes"
                    value={form.notes}
                    onChange={handleFormChange}
                    rows={2}
                  />
                </Field>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="button button-ghost"
                  onClick={() => setShowCreateModal(false)}
                  disabled={saving}
                >
                  Annuler
                </button>
                <button type="submit" className="button" disabled={saving}>
                  {saving ? 'Enregistrement…' : 'Créer le patient'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT PATIENT MODAL */}
      {editingPatient && (
        <div className="modal-backdrop" onClick={() => !saving && setEditingPatient(null)}>
          <div className="modal patient-form-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h2>Modifier le Patient</h2>
                <p className="muted">{editingPatient.fullName || `${editingPatient.firstName} ${editingPatient.lastName}`}</p>
              </div>
              <button
                type="button"
                className="button button-ghost"
                onClick={() => setEditingPatient(null)}
                disabled={saving}
              >
                ✕
              </button>
            </div>

            {formError ? <Notice>{describeError(formError)}</Notice> : null}

            <form onSubmit={handleSaveEdit}>
              {/* Row 1: Prénom, Nom, Genre */}
              <div className="patient-form-row-3">
                <Field label="Prénom *">
                  <input
                    name="firstName"
                    value={form.firstName}
                    onChange={handleFormChange}
                    required
                    maxLength={80}
                    autoFocus
                  />
                </Field>

                <Field label="Nom *">
                  <input
                    name="lastName"
                    value={form.lastName}
                    onChange={handleFormChange}
                    required
                    maxLength={80}
                  />
                </Field>

                <Field label="Genre">
                  <select name="gender" value={form.gender} onChange={handleFormChange}>
                    <option value="">—</option>
                    <option value="M">Homme</option>
                    <option value="F">Femme</option>
                  </select>
                </Field>
              </div>

              {/* Row 2: Téléphone, CIN, Date de naissance */}
              <div className="patient-form-row-3 equal">
                <Field label="Téléphone *">
                  <input
                    name="phone"
                    value={form.phone}
                    onChange={handleFormChange}
                    required
                    maxLength={32}
                  />
                </Field>

                <Field label="CIN">
                  <input
                    name="cin"
                    value={form.cin}
                    onChange={handleFormChange}
                    maxLength={50}
                  />
                </Field>

                <Field
                  label={
                    <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Date de naissance</span>
                      {formAge !== null && (
                        <span style={{ color: 'var(--blue)', fontWeight: 700, fontSize: '10.5px' }}>
                          ({formAge} ans)
                        </span>
                      )}
                    </span>
                  }
                >
                  <input
                    name="dateOfBirth"
                    type="date"
                    value={form.dateOfBirth}
                    onChange={handleFormChange}
                  />
                </Field>
              </div>

              {/* Row 3: Profession, Adresse */}
              <div className="patient-form-row-2">
                <Field label="Profession">
                  <input
                    name="profession"
                    value={form.profession}
                    onChange={handleFormChange}
                    maxLength={120}
                  />
                </Field>

                <Field label="Adresse">
                  <input
                    name="address"
                    value={form.address}
                    onChange={handleFormChange}
                    maxLength={250}
                  />
                </Field>
              </div>

              {/* Row 4: Email, Notes médicales */}
              <div className="patient-form-row-2">
                <Field label="Email">
                  <input
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleFormChange}
                  />
                </Field>

                <Field label="Notes médicales / Antécédents">
                  <textarea
                    name="notes"
                    value={form.notes}
                    onChange={handleFormChange}
                    rows={2}
                  />
                </Field>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="button button-ghost"
                  onClick={() => setEditingPatient(null)}
                  disabled={saving}
                >
                  Annuler
                </button>
                <button type="submit" className="button" disabled={saving}>
                  {saving ? 'Enregistrement…' : 'Enregistrer les modifications'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* PATIENT DETAIL MODAL (FICHE PATIENT) */}
      {viewingPatient && (
        <div className="modal-backdrop" onClick={() => setViewingPatient(null)}>
          <div className="modal wide" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
            <div className="modal-head" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '14px' }}>
              <div>
                <span className="eyebrow" style={{ fontSize: '10px' }}>FICHE PATIENT</span>
                <h2 style={{ margin: '2px 0 0', fontSize: '19px', color: 'var(--navy)' }}>
                  {viewingPatient.fullName || `${viewingPatient.firstName || ''} ${viewingPatient.lastName || ''}`.trim()}
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                  {viewingPatient.cin && (
                    <span className="cin-pill">
                      CIN: {viewingPatient.cin}
                    </span>
                  )}
                  {viewingPatient.profession && (
                    <span className="pill" style={{ background: '#f1f5f9', color: 'var(--navy)', fontWeight: 600, fontSize: '11px' }}>
                      {viewingPatient.profession}
                    </span>
                  )}
                  <span className="pill" style={{ fontSize: '11px' }}>
                    {viewingPatient.gender === 'F' ? 'Femme' : viewingPatient.gender === 'M' ? 'Homme' : 'Patient'}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  className="button button-subtle"
                  style={{ fontSize: '12px', padding: '5px 12px' }}
                  onClick={() => {
                    const pat = viewingPatient;
                    setViewingPatient(null);
                    openEditModal(pat);
                  }}
                  title="Modifier les coordonnées du patient"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '5px' }}>
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  Modifier
                </button>

                <button
                  type="button"
                  className="button button-ghost"
                  onClick={() => setViewingPatient(null)}
                  aria-label="Fermer"
                >
                  ✕
                </button>
              </div>
            </div>

            <div style={{ padding: '16px 0', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Grid with key patient data points */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                {/* 1. Date of Birth & Age */}
                <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div className="muted" style={{ fontSize: '10.5px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>
                    Date de naissance &amp; Âge
                  </div>
                  <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--foreground)', marginTop: '3px' }}>
                    {viewingPatient.dateOfBirth ? (
                      <span>
                        {formatDate(viewingPatient.dateOfBirth)}{' '}
                        <strong style={{ color: 'var(--blue)' }}>
                          ({viewingPatient.age ?? calculateAge(viewingPatient.dateOfBirth)} ans)
                        </strong>
                      </span>
                    ) : (
                      <span className="muted" style={{ fontWeight: 400 }}>Non renseignée</span>
                    )}
                  </div>
                </div>

                {/* 2. Phone */}
                <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div className="muted" style={{ fontSize: '10.5px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>
                    Numéro de téléphone
                  </div>
                  <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--blue)', marginTop: '3px' }}>
                    <a href={`tel:${viewingPatient.phone}`} style={{ color: 'inherit' }}>
                      {viewingPatient.phone}
                    </a>
                  </div>
                </div>

                {/* 3. CIN */}
                <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div className="muted" style={{ fontSize: '10.5px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>
                    CIN / Identifiant National
                  </div>
                  <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--foreground)', marginTop: '3px' }}>
                    {viewingPatient.cin || <span className="muted" style={{ fontWeight: 400 }}>Non renseigné</span>}
                  </div>
                </div>

                {/* 4. Profession */}
                <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div className="muted" style={{ fontSize: '10.5px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>
                    Profession
                  </div>
                  <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--foreground)', marginTop: '3px' }}>
                    {viewingPatient.profession || <span className="muted" style={{ fontWeight: 400 }}>Non renseignée</span>}
                  </div>
                </div>

                {/* 5. Address */}
                <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div className="muted" style={{ fontSize: '10.5px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>
                    Adresse
                  </div>
                  <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--foreground)', marginTop: '3px' }}>
                    {viewingPatient.address || <span className="muted" style={{ fontWeight: 400 }}>Non renseignée</span>}
                  </div>
                </div>
              </div>

              {/* Email if present */}
              {viewingPatient.email && (
                <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div className="muted" style={{ fontSize: '10.5px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>
                    Email
                  </div>
                  <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--foreground)', marginTop: '3px' }}>
                    {viewingPatient.email}
                  </div>
                </div>
              )}

              {/* Medical Notes if present */}
              {viewingPatient.notes ? (
                <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', padding: '12px 14px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                    Notes médicales &amp; Antécédents :
                  </div>
                  <div style={{ fontSize: '13px', color: '#0c4a6e', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                    {viewingPatient.notes}
                  </div>
                </div>
              ) : (
                <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: 'var(--muted-foreground)' }}>
                  Aucune note médicale enregistrée pour ce patient.
                </div>
              )}
            </div>

            <div className="modal-actions" style={{ borderTop: '1px solid var(--border)', paddingTop: '14px', justifyContent: 'space-between' }}>
              <button
                type="button"
                className="button button-ghost"
                onClick={() => setViewingPatient(null)}
              >
                Fermer
              </button>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="button button-subtle"
                  onClick={() => {
                    const pat = viewingPatient;
                    setViewingPatient(null);
                    openEditModal(pat);
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '5px' }}>
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  Modifier la fiche
                </button>

                <button
                  type="button"
                  className="button"
                  style={{ backgroundColor: 'var(--navy)' }}
                  onClick={() => {
                    const id = viewingPatient.id;
                    setViewingPatient(null);
                    onNavigate && onNavigate('dossiers', id);
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '5px' }}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                  Dossier Clinique
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
