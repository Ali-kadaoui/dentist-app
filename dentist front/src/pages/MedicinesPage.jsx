import { useState } from 'react';
import { useAsyncData } from '../hooks/useAsyncData';
import {
  createMedicine,
  deleteMedicine,
  getMedicineCategories,
  listMedicines,
  listPatients,
  updateMedicine,
} from '../api/dentistApi';
import PageHeader from '../components/PageHeader';
import Notice from '../components/Notice';
import Field from '../components/Field';
import { describeError, formatDate } from '../lib/format';

const CATEGORY_COLORS = {
  Antibiotique: { bg: '#eff6ff', color: '#1d4ed8' },
  Antalgique: { bg: '#f0fdf4', color: '#15803d' },
  'Anti-inflammatoire': { bg: '#fef2f2', color: '#b91c1c' },
  Antiseptique: { bg: '#fdf4ff', color: '#86198f' },
  Antispasmodique: { bg: '#fffbeb', color: '#b45309' },
  Anesthésique: { bg: '#f1f5f9', color: '#334155' },
};

const COMMON_FORMS = [
  'Comprimé',
  'Comprimé sécable',
  'Comprimé dispersible',
  'Comprimé pelliculé',
  'Gélule',
  'Solution bain de bouche',
  'Sachet pour suspension',
  'Gel buccal',
  'Sirop',
];

const COMMON_CATEGORIES = [
  'Antibiotique',
  'Antalgique',
  'Anti-inflammatoire',
  'Antiseptique',
  'Antispasmodique',
  'Anesthésique',
  'Autre',
];

export default function MedicinesPage({ onNavigate }) {
  const [search, setSearch] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  // Modals
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState(null);
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState(null);

  // Form State for Medicine
  const [formData, setFormData] = useState({
    name: '',
    dosage: '',
    form: 'Comprimé',
    category: 'Antibiotique',
    defaultDosageInstructions: '',
    notes: '',
  });

  // Prescription Generator State
  const [prescriptionPatientId, setPrescriptionPatientId] = useState('');
  const [prescriptionDate, setPrescriptionDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [prescriptionItems, setPrescriptionItems] = useState([]);

  const medicinesQuery = useAsyncData(
    () => listMedicines({ search, category: selectedCategory, pageSize: 100 }),
    [search, selectedCategory]
  );

  const categoriesQuery = useAsyncData(() => getMedicineCategories(), []);
  const patientsQuery = useAsyncData(() => listPatients({ pageSize: 200 }), []);

  const items = medicinesQuery.data?.items ?? [];
  const categories = categoriesQuery.data ?? COMMON_CATEGORIES;

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setSearch(searchDraft.trim());
  };

  const handleClearSearch = () => {
    setSearchDraft('');
    setSearch('');
    setSelectedCategory('');
  };

  const openCreateModal = () => {
    setEditingMedicine(null);
    setFormData({
      name: '',
      dosage: '',
      form: 'Comprimé',
      category: 'Antibiotique',
      defaultDosageInstructions: '',
      notes: '',
    });
    setModalError(null);
    setShowEditModal(true);
  };

  const openEditModal = (m) => {
    setEditingMedicine(m);
    setFormData({
      name: m.name,
      dosage: m.dosage ?? '',
      form: m.form ?? 'Comprimé',
      category: m.category,
      defaultDosageInstructions: m.defaultDosageInstructions ?? '',
      notes: m.notes ?? '',
    });
    setModalError(null);
    setShowEditModal(true);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveMedicine = async (e) => {
    e.preventDefault();
    setSaving(true);
    setModalError(null);

    if (!formData.name.trim()) {
      setModalError(new Error('Le nom du médicament est requis.'));
      setSaving(false);
      return;
    }

    try {
      const payload = {
        name: formData.name.trim(),
        dosage: formData.dosage.trim() || null,
        form: formData.form.trim() || null,
        category: formData.category.trim() || 'Général',
        defaultDosageInstructions: formData.defaultDosageInstructions.trim() || null,
        notes: formData.notes.trim() || null,
      };

      if (editingMedicine) {
        await updateMedicine(editingMedicine.id, payload);
      } else {
        await createMedicine(payload);
      }

      setShowEditModal(false);
      medicinesQuery.reload();
      categoriesQuery.reload();
    } catch (err) {
      setModalError(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (medicineId) => {
    if (!window.confirm('Supprimer ce médicament du catalogue ?')) {
      return;
    }

    try {
      await deleteMedicine(medicineId);
      medicinesQuery.reload();
    } catch (err) {
      alert(`Erreur lors de la suppression: ${describeError(err)}`);
    }
  };

  // Prescription Generator Handlers
  const openPrescriptionMaker = () => {
    const firstPatient = patientsQuery.data?.items?.[0];
    setPrescriptionPatientId(firstPatient ? firstPatient.id : '');
    // Pre-populate with first 2 items if empty
    if (prescriptionItems.length === 0 && items.length > 0) {
      setPrescriptionItems([
        {
          id: items[0].id,
          name: items[0].name,
          dosage: items[0].dosage,
          form: items[0].form,
          instructions: items[0].defaultDosageInstructions || '1 comprimé matin et soir pendant 6 jours',
        },
      ]);
    }
    setShowPrescriptionModal(true);
  };

  const addMedicineToPrescription = (med) => {
    if (prescriptionItems.some((pi) => pi.id === med.id)) return;
    setPrescriptionItems((prev) => [
      ...prev,
      {
        id: med.id,
        name: med.name,
        dosage: med.dosage,
        form: med.form,
        instructions: med.defaultDosageInstructions || 'Selon avis médical',
      },
    ]);
  };

  const removeMedicineFromPrescription = (medId) => {
    setPrescriptionItems((prev) => prev.filter((pi) => pi.id !== medId));
  };

  const updatePrescriptionItemInstruction = (medId, newInstruction) => {
    setPrescriptionItems((prev) =>
      prev.map((pi) => (pi.id === medId ? { ...pi, instructions: newInstruction } : pi))
    );
  };

  const selectedPatient = (patientsQuery.data?.items ?? []).find(
    (p) => p.id === prescriptionPatientId
  );

  return (
    <>
      <PageHeader
        title="Médicaments & Pharmacie"
        subtitle="Catalogue des spécialités pharmaceutiques dentaires, posologies de référence et prescriptions."
        eyebrow="PHARMACOTHÉRAPIE & ORDONNANCES"
      >
        <button
          type="button"
          className="button button-ghost"
          onClick={() => {
            medicinesQuery.reload();
            categoriesQuery.reload();
          }}
        >
          Actualiser
        </button>
        <button
          type="button"
          className="button button-subtle"
          onClick={openPrescriptionMaker}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          📝 Rédiger une Ordonnance
        </button>
        <button
          type="button"
          className="button"
          onClick={openCreateModal}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nouveau Médicament
        </button>
      </PageHeader>

      {/* Category Filter Badges */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '10px', marginBottom: '16px' }}>
        <button
          type="button"
          className="pill"
          style={{
            cursor: 'pointer',
            padding: '6px 14px',
            fontSize: '12.5px',
            background: !selectedCategory ? 'var(--navy)' : 'var(--card)',
            color: !selectedCategory ? '#fff' : 'var(--foreground)',
            border: '1px solid var(--border)',
            fontWeight: 600,
          }}
          onClick={() => setSelectedCategory('')}
        >
          Tous ({medicinesQuery.data?.total ?? 0})
        </button>
        {categories.map((cat) => {
          const isSelected = selectedCategory === cat;
          const style = CATEGORY_COLORS[cat] || { bg: '#f1f5f9', color: '#334155' };
          return (
            <button
              key={cat}
              type="button"
              className="pill"
              style={{
                cursor: 'pointer',
                padding: '6px 14px',
                fontSize: '12.5px',
                background: isSelected ? 'var(--navy)' : style.bg,
                color: isSelected ? '#fff' : style.color,
                border: '1px solid var(--border)',
                fontWeight: 600,
              }}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Search & Actions Bar */}
      <div className="card" style={{ marginBottom: '20px', padding: '14px 20px' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              type="search"
              placeholder="Rechercher par nom, dosage, forme galénique ou posologie (ex: Amoxicilline, 1g, Doliprane)..."
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

          <button type="submit" className="button">
            Rechercher
          </button>

          {(search || searchDraft || selectedCategory) && (
            <button type="button" className="button button-ghost" onClick={handleClearSearch}>
              Réinitialiser
            </button>
          )}

          <span className="muted" style={{ marginLeft: 'auto', fontSize: '12.5px', whiteSpace: 'nowrap' }}>
            {items.length} médicament(s) affiché(s)
          </span>
        </form>
      </div>

      {medicinesQuery.error && <Notice tone="error">{describeError(medicinesQuery.error)}</Notice>}

      {/* Medicines Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
              <th style={{ padding: '12px 16px' }}>Nom &amp; Spécialité</th>
              <th style={{ padding: '12px 16px' }}>Dosage &amp; Forme</th>
              <th style={{ padding: '12px 16px' }}>Classe Thérapeutique</th>
              <th style={{ padding: '12px 16px' }}>Posologie Référencée</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {medicinesQuery.loading && !medicinesQuery.data ? (
              <tr>
                <td colSpan={6} style={{ padding: '36px', textAlign: 'center' }} className="muted">
                  Chargement des spécialités médicales…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '40px', textAlign: 'center' }}>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>💊</div>
                  <strong style={{ display: 'block', fontSize: '15px', color: 'var(--navy)' }}>
                    Aucun médicament trouvé
                  </strong>
                  <p className="muted" style={{ fontSize: '12.5px', marginTop: '4px' }}>
                    Ajoutez les spécialités et antibiotiques couramment prescrits dans votre cabinet.
                  </p>
                  <button
                    type="button"
                    className="button"
                    onClick={openCreateModal}
                    style={{ marginTop: '14px' }}
                  >
                    + Ajouter un médicament
                  </button>
                </td>
              </tr>
            ) : (
              items.map((m) => {
                const catStyle = CATEGORY_COLORS[m.category] || { bg: '#f1f5f9', color: '#334155' };
                return (
                  <tr key={m.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '16px' }}>💊</span>
                        <div>
                          <strong style={{ fontSize: '14px', color: 'var(--navy)' }}>{m.name}</strong>
                          {m.notes && (
                            <div style={{ fontSize: '11px', color: 'var(--muted-foreground)' }}>
                              {m.notes}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '12.5px' }}>
                      <strong>{m.dosage || '—'}</strong>
                      {m.form && <div className="muted" style={{ fontSize: '11.5px' }}>{m.form}</div>}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        className="pill"
                        style={{
                          background: catStyle.bg,
                          color: catStyle.color,
                          fontWeight: 700,
                          fontSize: '11.5px',
                        }}
                      >
                        {m.category}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '12.5px', maxWidth: '320px' }}>
                      {m.defaultDosageInstructions ? (
                        <span>{m.defaultDosageInstructions}</span>
                      ) : (
                        <span className="muted">Non définie</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        className="button button-ghost"
                        style={{ padding: '4px 8px', fontSize: '11.5px', marginRight: '6px' }}
                        onClick={() => openEditModal(m)}
                      >
                        Modifier
                      </button>
                      <button
                        type="button"
                        className="button button-danger"
                        style={{ padding: '4px 8px', fontSize: '11.5px' }}
                        onClick={() => handleDelete(m.id)}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* CREATE / EDIT MEDICINE MODAL */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => !saving && setShowEditModal(false)}>
          <div className="modal card" style={{ maxWidth: '540px', width: '92%' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--navy)' }}>
                {editingMedicine ? 'Modifier le Médicament' : 'Ajouter un Médicament au Répertoire'}
              </h3>
              <p className="muted" style={{ fontSize: '12.5px' }}>
                Enregistrez la posologie et les instructions d'usage pour faciliter vos ordonnances.
              </p>
            </div>

            {modalError && <Notice tone="error">{describeError(modalError)}</Notice>}

            <form onSubmit={handleSaveMedicine}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <Field label="Nom Commercial / Molécule *">
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleFormChange}
                    placeholder="Ex: Augmentin, Doliprane, Amoxicilline..."
                    required
                    disabled={saving}
                  />
                </Field>

                <Field label="Dosage">
                  <input
                    type="text"
                    name="dosage"
                    value={formData.dosage}
                    onChange={handleFormChange}
                    placeholder="Ex: 1g, 500mg, 100mg..."
                    disabled={saving}
                  />
                </Field>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <Field label="Forme Galénique">
                  <select
                    name="form"
                    value={formData.form}
                    onChange={handleFormChange}
                    disabled={saving}
                  >
                    {COMMON_FORMS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Catégorie / Classe">
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleFormChange}
                    disabled={saving}
                  >
                    {COMMON_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <Field label="Posologie recommandée par défaut">
                  <textarea
                    name="defaultDosageInstructions"
                    value={formData.defaultDosageInstructions}
                    onChange={handleFormChange}
                    placeholder="Ex: 1 comprimé matin et soir pendant 6 jours au milieu des repas..."
                    rows={2}
                    disabled={saving}
                  />
                </Field>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <Field label="Notes / Remarques">
                  <input
                    type="text"
                    name="notes"
                    value={formData.notes}
                    onChange={handleFormChange}
                    placeholder="Ex: À prendre au début du repas, contre-indiqué en cas d'allergie..."
                    disabled={saving}
                  />
                </Field>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="button button-ghost"
                  onClick={() => setShowEditModal(false)}
                  disabled={saving}
                >
                  Annuler
                </button>
                <button type="submit" className="button" disabled={saving}>
                  {saving ? 'Enregistrement…' : editingMedicine ? 'Mettre à jour' : 'Ajouter au catalogue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EXPRESS PRESCRIPTION GENERATOR MODAL */}
      {showPrescriptionModal && (
        <div className="modal-overlay" onClick={() => setShowPrescriptionModal(false)}>
          <div
            className="modal card"
            style={{ maxWidth: '780px', width: '95%', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--navy)' }}>
                  Générateur d'Ordonnance Médicale
                </h3>
                <p className="muted" style={{ fontSize: '12px' }}>
                  Composez et imprimez une ordonnance personnalisée pour votre patient.
                </p>
              </div>
              <button
                type="button"
                className="button button-ghost"
                onClick={() => setShowPrescriptionModal(false)}
              >
                ✕
              </button>
            </div>

            {/* Patient & Date Selection */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '14px', marginBottom: '18px' }}>
              <Field label="Patient *">
                <select
                  value={prescriptionPatientId}
                  onChange={(e) => setPrescriptionPatientId(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="">Sélectionnez un patient…</option>
                  {(patientsQuery.data?.items ?? []).map((pt) => (
                    <option key={pt.id} value={pt.id}>
                      {pt.fullName || `${pt.firstName} ${pt.lastName}`.trim()} {pt.dateOfBirth ? `(${pt.age ?? ''} ans)` : ''} {pt.cin ? `[CIN: ${pt.cin}]` : ''}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Date de Prescription">
                <input
                  type="date"
                  value={prescriptionDate}
                  onChange={(e) => setPrescriptionDate(e.target.value)}
                />
              </Field>
            </div>

            {/* Quick Medicine Picker Bar */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--navy)', marginBottom: '6px' }}>
                + Ajouter des médicaments depuis le catalogue :
              </label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', maxHeight: '110px', overflowY: 'auto', padding: '6px', background: '#f8fafc', borderRadius: '6px', border: '1px solid var(--border)' }}>
                {items.map((m) => {
                  const alreadyAdded = prescriptionItems.some((pi) => pi.id === m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      className="button button-ghost"
                      style={{
                        padding: '3px 8px',
                        fontSize: '11px',
                        borderRadius: '4px',
                        background: alreadyAdded ? '#e2e8f0' : '#fff',
                        opacity: alreadyAdded ? 0.6 : 1,
                      }}
                      disabled={alreadyAdded}
                      onClick={() => addMedicineToPrescription(m)}
                    >
                      + {m.name} {m.dosage ? `(${m.dosage})` : ''}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* PRINT-READY PREVIEW SHEET */}
            <div
              id="prescription-print-area"
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '30px 36px',
                marginBottom: '20px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid var(--navy)', paddingBottom: '16px', marginBottom: '20px' }}>
                <div>
                  <h2 style={{ fontSize: '19px', fontWeight: 800, color: 'var(--navy)', margin: 0 }}>
                    DR. CABINET DENTAIRE
                  </h2>
                  <p style={{ fontSize: '12px', color: 'var(--navy)', fontWeight: 600, margin: '2px 0 0' }}>
                    Chirurgien-Dentiste
                  </p>
                  <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', margin: '2px 0 0' }}>
                    Soins • Chirurgie • Prothèses • Implantologie
                  </p>
                </div>
                <div style={{ textAlign: 'right', fontSize: '11.5px', color: 'var(--muted-foreground)' }}>
                  <p style={{ margin: 0 }}>12 Rue Hassan II, Casablanca</p>
                  <p style={{ margin: 0 }}>Tél : 05 22 00 00 00</p>
                  <p style={{ margin: 0 }}>cabinet@dentaire.ma</p>
                </div>
              </div>

              {/* Patient info & date line */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', fontSize: '13px' }}>
                <div>
                  <span>Nom du Patient : </span>
                  <strong style={{ fontSize: '15px', color: 'var(--navy)' }}>
                    {selectedPatient ? (selectedPatient.fullName || `${selectedPatient.firstName} ${selectedPatient.lastName}`.trim()) : '...................................................'}
                  </strong>
                  {selectedPatient?.age && <span className="muted"> ({selectedPatient.age} ans)</span>}
                </div>
                <div>
                  <span>Fait le : </span>
                  <strong>{formatDate(prescriptionDate)}</strong>
                </div>
              </div>

              {/* Prescription Items */}
              <div style={{ minHeight: '180px', marginBottom: '30px' }}>
                <h4 style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--navy)', marginBottom: '14px', borderBottom: '1px dashed #e2e8f0', paddingBottom: '6px' }}>
                  ORDONNANCE
                </h4>

                {prescriptionItems.length === 0 ? (
                  <p className="empty" style={{ padding: '20px 0' }}>
                    Aucun médicament sélectionné. Cliquez sur un médicament ci-dessus pour l'ajouter.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {prescriptionItems.map((pi, index) => (
                      <div key={pi.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--navy)' }}>
                            {index + 1}. {pi.name} {pi.dosage ? `— ${pi.dosage}` : ''} {pi.form ? `(${pi.form})` : ''}
                          </div>
                          <input
                            type="text"
                            value={pi.instructions}
                            onChange={(e) => updatePrescriptionItemInstruction(pi.id, e.target.value)}
                            style={{
                              width: '100%',
                              marginTop: '4px',
                              fontSize: '12.5px',
                              fontStyle: 'italic',
                              padding: '4px 8px',
                              border: '1px solid #e2e8f0',
                              borderRadius: '4px',
                            }}
                            placeholder="Posologie et durée du traitement..."
                          />
                        </div>
                        <button
                          type="button"
                          className="button button-danger"
                          style={{ padding: '2px 6px', fontSize: '11px', marginTop: '4px' }}
                          title="Retirer de l'ordonnance"
                          onClick={() => removeMedicineFromPrescription(pi.id)}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Signature stamp area */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', textAlign: 'center', marginTop: '20px' }}>
                <div>
                  <p style={{ fontSize: '11.5px', color: 'var(--muted-foreground)', marginBottom: '50px' }}>
                    Signature &amp; Cachet du Praticien
                  </p>
                  <div style={{ width: '180px', borderBottom: '1px dashed #94a3b8' }} />
                </div>
              </div>
            </div>

            {/* Bottom Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                className="button button-ghost"
                onClick={() => setShowPrescriptionModal(false)}
              >
                Fermer
              </button>
              <button
                type="button"
                className="button"
                onClick={() => window.print()}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              >
                🖨️ Imprimer l'Ordonnance
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
