import { useState } from 'react';
import { useAsyncData } from '../hooks/useAsyncData';
import {
  createPayment,
  deletePayment,
  listPatients,
  listPayments,
  updatePayment,
} from '../api/dentistApi';
import PageHeader from '../components/PageHeader';
import Notice from '../components/Notice';
import Field from '../components/Field';
import { describeError, formatDate, formatNumber } from '../lib/format';

const PRESET_TREATMENTS = [
  'Consultation & Bilan',
  'Détartrage & Polissage',
  'Soin Carie & Composite',
  'Dévitalisation / Endodontie',
  'Extraction Simple',
  'Extraction Chirurgicale / Sagesse',
  'Couronne Céramique / Zircone',
  'Pose d’Implant Dentaire',
  'Blanchiment Dentaire',
  'Prothèse Amovible',
];

const PAYMENT_METHODS = [
  { id: 'Espèces', label: '💵 Espèces' },
  { id: 'Carte Bancaire', label: '💳 Carte Bancaire' },
  { id: 'Chèque', label: '📝 Chèque' },
  { id: 'Virement', label: '🏦 Virement' },
];

function getTodayIso() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function PaymentsPage({ onNavigate }) {
  const [search, setSearch] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [page, setPage] = useState(1);

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [receiptPayment, setReceiptPayment] = useState(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    patientId: '',
    treatment: 'Consultation & Bilan',
    totalAmount: '',
    paidAmount: '',
    paymentMethod: 'Espèces',
    status: 'Payé',
    paymentDate: getTodayIso(),
    notes: '',
  });

  const paymentsQuery = useAsyncData(
    () =>
      listPayments({
        search,
        status: statusFilter,
        paymentMethod: methodFilter,
        page,
        pageSize: 50,
      }),
    [search, statusFilter, methodFilter, page]
  );

  const patientsQuery = useAsyncData(
    () => listPatients({ pageSize: 200 }),
    []
  );

  const items = paymentsQuery.data?.items ?? [];
  const summary = paymentsQuery.data?.summary ?? {
    totalCollected: 0,
    totalPending: 0,
    totalCount: 0,
  };
  const totalBilled = summary.totalCollected + summary.totalPending;
  const recoveryRate =
    totalBilled > 0
      ? Math.round((summary.totalCollected / totalBilled) * 100)
      : 100;

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchDraft.trim());
  };

  const handleClearSearch = () => {
    setSearchDraft('');
    setSearch('');
    setStatusFilter('');
    setMethodFilter('');
    setPage(1);
  };

  const openCreateModal = () => {
    const firstPatientId = patientsQuery.data?.items?.[0]?.id || '';
    setEditingPayment(null);
    setFormData({
      patientId: firstPatientId,
      treatment: 'Consultation & Bilan',
      totalAmount: '400',
      paidAmount: '400',
      paymentMethod: 'Espèces',
      status: 'Payé',
      paymentDate: getTodayIso(),
      notes: '',
    });
    setModalError(null);
    setShowModal(true);
  };

  const openEditModal = (p) => {
    setEditingPayment(p);
    setFormData({
      patientId: p.patientId,
      treatment: p.treatment,
      totalAmount: String(p.totalAmount),
      paidAmount: String(p.paidAmount),
      paymentMethod: p.paymentMethod,
      status: p.status,
      paymentDate: p.paymentDate ? p.paymentDate.slice(0, 10) : getTodayIso(),
      notes: p.notes ?? '',
    });
    setModalError(null);
    setShowModal(true);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const next = { ...prev, [name]: value };
      // Auto-update status if amounts change and status wasn't manually overridden
      if (name === 'totalAmount' || name === 'paidAmount') {
        const total = parseFloat(next.totalAmount) || 0;
        const paid = parseFloat(next.paidAmount) || 0;
        if (paid >= total && total > 0) {
          next.status = 'Payé';
        } else if (paid > 0 && paid < total) {
          next.status = 'Partiel';
        } else if (paid === 0) {
          next.status = 'En attente';
        }
      }
      return next;
    });
  };

  const handleSavePayment = async (e) => {
    e.preventDefault();
    setSaving(true);
    setModalError(null);

    const total = parseFloat(formData.totalAmount);
    const paid = parseFloat(formData.paidAmount);

    if (Number.isNaN(total) || total < 0) {
      setModalError(new Error('Le montant total doit être un nombre valide.'));
      setSaving(false);
      return;
    }

    if (!formData.patientId) {
      setModalError(new Error('Veuillez sélectionner un patient.'));
      setSaving(false);
      return;
    }

    try {
      const payload = {
        patientId: formData.patientId,
        treatment: formData.treatment.trim() || 'Consultation',
        totalAmount: total,
        paidAmount: Number.isNaN(paid) ? 0 : paid,
        paymentMethod: formData.paymentMethod,
        status: formData.status,
        paymentDate: formData.paymentDate
          ? new Date(`${formData.paymentDate}T12:00:00Z`).toISOString()
          : new Date().toISOString(),
        notes: formData.notes.trim() || null,
      };

      if (editingPayment) {
        await updatePayment(editingPayment.id, payload);
      } else {
        await createPayment(payload);
      }

      setShowModal(false);
      paymentsQuery.reload();
    } catch (err) {
      setModalError(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (paymentId) => {
    if (!window.confirm('Confirmer la suppression de cette transaction ?')) {
      return;
    }

    try {
      await deletePayment(paymentId);
      paymentsQuery.reload();
    } catch (err) {
      alert(`Erreur lors de la suppression: ${describeError(err)}`);
    }
  };

  return (
    <>
      <PageHeader
        title="Paiements & Règlements"
        subtitle="Suivi des encaissements, facturation des soins et gestion des soldes patients."
        eyebrow="GESTION FINANCIÈRE"
      >
        <button
          type="button"
          className="button button-ghost"
          onClick={() => paymentsQuery.reload()}
        >
          Actualiser
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
          Nouveau Règlement
        </button>
      </PageHeader>

      {/* Filter and Search Bar */}
      <div className="card" style={{ marginBottom: '20px', padding: '16px 20px' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
            <input
              type="search"
              placeholder="Rechercher par patient, CIN, téléphone ou soin (ex: Karim, Détartrage)..."
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

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            style={{ minWidth: '150px' }}
          >
            <option value="">Tous les statuts</option>
            <option value="Payé">Payé en totalité</option>
            <option value="Partiel">Paiement partiel</option>
            <option value="En attente">En attente / Impayé</option>
          </select>

          <select
            value={methodFilter}
            onChange={(e) => {
              setMethodFilter(e.target.value);
              setPage(1);
            }}
            style={{ minWidth: '150px' }}
          >
            <option value="">Tous modes</option>
            <option value="Espèces">💵 Espèces</option>
            <option value="Carte Bancaire">💳 Carte Bancaire</option>
            <option value="Chèque">📝 Chèque</option>
            <option value="Virement">🏦 Virement</option>
          </select>

          <button type="submit" className="button">
            Filtrer
          </button>

          {(search || searchDraft || statusFilter || methodFilter) && (
            <button type="button" className="button button-ghost" onClick={handleClearSearch}>
              Réinitialiser
            </button>
          )}

          <span className="muted" style={{ marginLeft: 'auto', fontSize: '12.5px' }}>
            {paymentsQuery.data?.total ?? 0} transaction(s)
          </span>
        </form>
      </div>

      {paymentsQuery.error && <Notice tone="error">{describeError(paymentsQuery.error)}</Notice>}

      {/* Transactions Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
              <th style={{ padding: '12px 16px' }}>Date</th>
              <th style={{ padding: '12px 16px' }}>Patient</th>
              <th style={{ padding: '12px 16px' }}>Acte / Traitement</th>
              <th style={{ padding: '12px 16px' }}>Total (DH)</th>
              <th style={{ padding: '12px 16px' }}>Versé (DH)</th>
              <th style={{ padding: '12px 16px' }}>Reste (DH)</th>
              <th style={{ padding: '12px 16px' }}>Règlement</th>
              <th style={{ padding: '12px 16px' }}>Statut</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paymentsQuery.loading && !paymentsQuery.data ? (
              <tr>
                <td colSpan={9} style={{ padding: '36px', textAlign: 'center' }} className="muted">
                  Chargement des transactions financières…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: '40px', textAlign: 'center' }}>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>💳</div>
                  <strong style={{ display: 'block', fontSize: '15px', color: 'var(--navy)' }}>
                    Aucune transaction trouvée
                  </strong>
                  <p className="muted" style={{ fontSize: '12.5px', marginTop: '4px' }}>
                    Enregistrez un nouveau règlement pour ce patient pour débuter son suivi financier.
                  </p>
                  <button
                    type="button"
                    className="button"
                    onClick={openCreateModal}
                    style={{ marginTop: '14px' }}
                  >
                    + Enregistrer un premier paiement
                  </button>
                </td>
              </tr>
            ) : (
              items.map((p) => {
                const isPaidFull = p.remainingAmount <= 0;
                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', fontSize: '12.5px' }}>
                      <strong>{formatDate(p.paymentDate)}</strong>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--navy)' }}>
                        {p.patientFullName}
                      </div>
                      <div style={{ fontSize: '11.5px', color: 'var(--muted-foreground)', display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <span>{p.patientPhone}</span>
                        {p.patientCin && (
                          <span style={{ background: '#e0e7ff', color: '#3730a3', padding: '0 4px', borderRadius: '3px', fontSize: '10px' }}>
                            {p.patientCin}
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '13px' }}>
                      <span style={{ fontWeight: 500 }}>{p.treatment}</span>
                      {p.notes && (
                        <div style={{ fontSize: '11px', color: 'var(--muted-foreground)', fontStyle: 'italic' }}>
                          {p.notes}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                      {formatNumber(p.totalAmount)}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: '#16a34a' }}>
                      {formatNumber(p.paidAmount)}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {isPaidFull ? (
                        <span className="pill" style={{ background: 'var(--ok-soft)', color: 'var(--ok)', fontWeight: 600 }}>
                          ✓ Réglé
                        </span>
                      ) : (
                        <span
                          className="pill"
                          style={{
                            background: '#fef2f2',
                            color: '#b91c1c',
                            fontWeight: 700,
                          }}
                        >
                          {formatNumber(p.remainingAmount)} DH
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '12px' }}>
                      <span className="pill" style={{ background: '#f1f5f9', color: '#334155' }}>
                        {p.paymentMethod}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        className="pill"
                        style={{
                          background:
                            p.status === 'Payé'
                              ? 'var(--ok-soft)'
                              : p.status === 'Partiel'
                              ? '#fffbeb'
                              : '#fef2f2',
                          color:
                            p.status === 'Payé'
                              ? 'var(--ok)'
                              : p.status === 'Partiel'
                              ? '#b45309'
                              : '#b91c1c',
                          fontWeight: 600,
                        }}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        className="button button-ghost"
                        style={{ padding: '4px 8px', fontSize: '11.5px', marginRight: '6px' }}
                        title="Imprimer un reçu patient"
                        onClick={() => setReceiptPayment(p)}
                      >
                        🖨️ Reçu
                      </button>
                      <button
                        type="button"
                        className="button button-ghost"
                        style={{ padding: '4px 8px', fontSize: '11.5px', marginRight: '6px' }}
                        onClick={() => openEditModal(p)}
                      >
                        Modifier
                      </button>
                      <button
                        type="button"
                        className="button button-danger"
                        style={{ padding: '4px 8px', fontSize: '11.5px' }}
                        onClick={() => handleDelete(p.id)}
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

      {/* CREATE / EDIT MODAL */}
      {showModal && (
        <div className="modal-overlay" onClick={() => !saving && setShowModal(false)}>
          <div className="modal card" style={{ maxWidth: '580px', width: '92%' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--navy)' }}>
                {editingPayment ? 'Modifier le Règlement' : 'Enregistrer un Nouveau Règlement'}
              </h3>
              <p className="muted" style={{ fontSize: '12.5px' }}>
                Enregistrez le montant versé et générez le reçu du soin dentaire.
              </p>
            </div>

            {modalError && <Notice tone="error">{describeError(modalError)}</Notice>}

            <form onSubmit={handleSavePayment}>
              {/* Patient Selector */}
              <div style={{ marginBottom: '14px' }}>
                <Field label="Patient concerné *">
                  <select
                    name="patientId"
                    value={formData.patientId}
                    onChange={handleFormChange}
                    required
                    disabled={saving}
                    style={{ width: '100%', fontSize: '13.5px' }}
                  >
                    <option value="">Sélectionnez un patient…</option>
                    {(patientsQuery.data?.items ?? []).map((pt) => (
                      <option key={pt.id} value={pt.id}>
                        {pt.fullName || `${pt.firstName} ${pt.lastName}`.trim()} — {pt.phone} {pt.cin ? `(CIN: ${pt.cin})` : ''}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              {/* Treatment Name & Presets */}
              <div style={{ marginBottom: '14px' }}>
                <Field label="Acte / Soin Dentaire *">
                  <input
                    type="text"
                    name="treatment"
                    value={formData.treatment}
                    onChange={handleFormChange}
                    placeholder="Ex: Détartrage, Soin carie, Pose couronne..."
                    required
                    disabled={saving}
                    style={{ width: '100%', marginBottom: '8px' }}
                  />
                </Field>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {PRESET_TREATMENTS.map((tr) => (
                    <button
                      key={tr}
                      type="button"
                      className="button button-ghost"
                      style={{ padding: '3px 8px', fontSize: '11px', borderRadius: '4px' }}
                      onClick={() => setFormData((prev) => ({ ...prev, treatment: tr }))}
                    >
                      {tr}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amounts Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <Field label="Montant Total du Soin (DH) *">
                  <input
                    type="number"
                    step="0.01"
                    name="totalAmount"
                    value={formData.totalAmount}
                    onChange={handleFormChange}
                    placeholder="0.00"
                    required
                    disabled={saving}
                  />
                </Field>

                <Field label="Montant Versé / Encaissé (DH) *">
                  <input
                    type="number"
                    step="0.01"
                    name="paidAmount"
                    value={formData.paidAmount}
                    onChange={handleFormChange}
                    placeholder="0.00"
                    required
                    disabled={saving}
                  />
                </Field>
              </div>

              {/* Reste Calculé Badge */}
              <div style={{ marginBottom: '14px', padding: '10px 14px', borderRadius: '6px', background: '#f8fafc', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12.5px', color: 'var(--muted-foreground)' }}>
                  Solde restant après ce versement :
                </span>
                <strong style={{ fontSize: '14px', color: (parseFloat(formData.totalAmount) - parseFloat(formData.paidAmount)) > 0 ? '#b91c1c' : '#16a34a' }}>
                  {formatNumber(Math.max(0, (parseFloat(formData.totalAmount) || 0) - (parseFloat(formData.paidAmount) || 0)))} DH
                </strong>
              </div>

              {/* Method, Status & Date */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <Field label="Mode de Paiement">
                  <select
                    name="paymentMethod"
                    value={formData.paymentMethod}
                    onChange={handleFormChange}
                    disabled={saving}
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Statut">
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleFormChange}
                    disabled={saving}
                  >
                    <option value="Payé">Payé en totalité</option>
                    <option value="Partiel">Paiement partiel</option>
                    <option value="En attente">En attente</option>
                  </select>
                </Field>

                <Field label="Date de Paiement">
                  <input
                    type="date"
                    name="paymentDate"
                    value={formData.paymentDate}
                    onChange={handleFormChange}
                    disabled={saving}
                  />
                </Field>
              </div>

              {/* Notes */}
              <div style={{ marginBottom: '20px' }}>
                <Field label="Remarques / N° Chèque (optionnel)">
                  <input
                    type="text"
                    name="notes"
                    value={formData.notes}
                    onChange={handleFormChange}
                    placeholder="Ex: Chèque n° 481942 Attijariwafa, solde prévu au prochain RDV..."
                    disabled={saving}
                  />
                </Field>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="button button-ghost"
                  onClick={() => setShowModal(false)}
                  disabled={saving}
                >
                  Annuler
                </button>
                <button type="submit" className="button" disabled={saving}>
                  {saving ? 'Enregistrement…' : editingPayment ? 'Mettre à jour' : 'Confirmer le règlement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINTABLE RECEIPT MODAL */}
      {receiptPayment && (
        <div className="modal-overlay" onClick={() => setReceiptPayment(null)}>
          <div
            className="modal card"
            style={{ maxWidth: '520px', width: '92%', background: '#fff', padding: '28px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div id="receipt-print-area">
              <div style={{ textAlign: 'center', borderBottom: '2px solid var(--navy)', paddingBottom: '14px', marginBottom: '18px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--navy)', letterSpacing: '0.5px' }}>
                  CABINET DENTAIRE
                </h2>
                <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', marginTop: '2px' }}>
                  Chirurgie Dentaire &amp; Implantologie
                </p>
                <p style={{ fontSize: '11px', color: 'var(--muted-foreground)' }}>
                  Tél : 05 22 00 00 00 • Email : cabinet@dentaire.ma
                </p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', fontSize: '12.5px' }}>
                <div>
                  <span className="muted" style={{ display: 'block', fontSize: '11px' }}>REÇU N°</span>
                  <strong>REC-{receiptPayment.id.slice(0, 8).toUpperCase()}</strong>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="muted" style={{ display: 'block', fontSize: '11px' }}>DATE</span>
                  <strong>{formatDate(receiptPayment.paymentDate)}</strong>
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '6px', marginBottom: '18px' }}>
                <span className="muted" style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>
                  PATIENT
                </span>
                <strong style={{ fontSize: '15px', color: 'var(--navy)' }}>
                  {receiptPayment.patientFullName}
                </strong>
                <div style={{ fontSize: '12px', color: 'var(--muted-foreground)', marginTop: '2px' }}>
                  Tél : {receiptPayment.patientPhone} {receiptPayment.patientCin ? `| CIN : ${receiptPayment.patientCin}` : ''}
                </div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '18px', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                    <th style={{ padding: '8px 0' }}>Description des soins</th>
                    <th style={{ padding: '8px 0', textAlign: 'right' }}>Montant</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: '10px 0' }}>
                      <strong>{receiptPayment.treatment}</strong>
                      {receiptPayment.notes && (
                        <div style={{ fontSize: '11px', color: 'var(--muted-foreground)' }}>
                          {receiptPayment.notes}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '10px 0', textAlign: 'right', fontWeight: 600 }}>
                      {formatNumber(receiptPayment.totalAmount)} DH
                    </td>
                  </tr>
                  <tr style={{ borderTop: '1px solid #e2e8f0', color: '#16a34a' }}>
                    <td style={{ padding: '8px 0', fontWeight: 600 }}>Montant Versé ({receiptPayment.paymentMethod}) :</td>
                    <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 800 }}>
                      {formatNumber(receiptPayment.paidAmount)} DH
                    </td>
                  </tr>
                  <tr style={{ borderTop: '1px solid #e2e8f0', color: receiptPayment.remainingAmount > 0 ? '#b91c1c' : 'var(--muted-foreground)' }}>
                    <td style={{ padding: '8px 0' }}>Reste à payer :</td>
                    <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 700 }}>
                      {formatNumber(receiptPayment.remainingAmount)} DH
                    </td>
                  </tr>
                </tbody>
              </table>

              <div style={{ marginTop: '26px', display: 'flex', justifyContent: 'flex-end', textAlign: 'center' }}>
                <div>
                  <p style={{ fontSize: '11.5px', color: 'var(--muted-foreground)', marginBottom: '40px' }}>
                    Cachet &amp; Signature du Cabinet
                  </p>
                  <div style={{ width: '160px', borderBottom: '1px dashed #cbd5e1' }} />
                </div>
              </div>
            </div>

            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <button
                type="button"
                className="button button-ghost"
                onClick={() => setReceiptPayment(null)}
              >
                Fermer
              </button>
              <button
                type="button"
                className="button"
                onClick={() => window.print()}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              >
                🖨️ Imprimer le Reçu
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
