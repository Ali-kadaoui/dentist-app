import { apiFetch } from './client';

const withQuery = (path, params) => {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  });

  const suffix = query.toString();
  return suffix ? `${path}?${suffix}` : path;
};

// --- patients ---------------------------------------------------------------
export const listPatients = ({ search = '', page = 1, pageSize = 25 } = {}) =>
  apiFetch(withQuery('/patients', { search, page, pageSize }));

export const getPatient = (id) =>
  apiFetch(`/patients/${id}`);

export const createPatient = (payload) =>
  apiFetch('/patients', { method: 'POST', body: payload });

export const updatePatient = (id, payload) =>
  apiFetch(`/patients/${id}`, { method: 'PUT', body: payload });

// --- agenda -----------------------------------------------------------------
export const listAppointments = ({ from, to, page = 1, pageSize = 100 } = {}) =>
  apiFetch(withQuery('/appointments', { from, to, page, pageSize }));

export const createAppointment = (payload) =>
  apiFetch('/appointments', { method: 'POST', body: payload });

export const deleteAppointment = (id) =>
  apiFetch(`/appointments/${id}`, { method: 'DELETE' });

// --- patient state ----------------------------------------------------------
export const listPatientStates = (patientId) =>
  apiFetch(`/patients/${patientId}/states`);

export const createPatientState = (patientId, payload) =>
  apiFetch(`/patients/${patientId}/states`, { method: 'POST', body: payload });

export const deletePatientState = (patientId, stateId) =>
  apiFetch(`/patients/${patientId}/states/${stateId}`, { method: 'DELETE' });

// --- reminders --------------------------------------------------------------
export const listDueReminders = ({ horizonDays = 30 } = {}) =>
  apiFetch(withQuery('/sms/reminders/due', { horizonDays }));

export const sendReminder = ({ appointmentId, message }) =>
  apiFetch('/sms/reminders/send', {
    method: 'POST',
    body: { appointmentId, message: message ?? null },
  });

// --- messages ---------------------------------------------------------------
export const listMessages = ({ status, page = 1, pageSize = 20 } = {}) =>
  apiFetch(withQuery('/sms', { status, page, pageSize }));

export const sendSms = (payload) =>
  apiFetch('/sms', { method: 'POST', body: payload });

export const getGatewayHealth = () => apiFetch('/sms/gateway');

export const getSmsSettings = () => apiFetch('/sms/settings');

export const updateSmsSettings = (payload) =>
  apiFetch('/sms/settings', { method: 'PUT', body: payload });

export const processDueSms = () =>
  apiFetch('/sms/process-due', { method: 'POST' });

export const getDashboardSummary = () =>
  apiFetch('/dashboard/summary');

// --- payments ---------------------------------------------------------------
export const listPayments = ({ search = '', patientId = '', status = '', paymentMethod = '', page = 1, pageSize = 50 } = {}) =>
  apiFetch(withQuery('/payments', { search, patientId, status, paymentMethod, page, pageSize }));

export const getPayment = (id) =>
  apiFetch(`/payments/${id}`);

export const createPayment = (payload) =>
  apiFetch('/payments', { method: 'POST', body: payload });

export const updatePayment = (id, payload) =>
  apiFetch(`/payments/${id}`, { method: 'PUT', body: payload });

export const deletePayment = (id) =>
  apiFetch(`/payments/${id}`, { method: 'DELETE' });

// --- medicines --------------------------------------------------------------
export const listMedicines = ({ search = '', category = '', page = 1, pageSize = 100 } = {}) =>
  apiFetch(withQuery('/medicines', { search, category, page, pageSize }));

export const getMedicineCategories = () =>
  apiFetch('/medicines/categories');

export const getMedicine = (id) =>
  apiFetch(`/medicines/${id}`);

export const createMedicine = (payload) =>
  apiFetch('/medicines', { method: 'POST', body: payload });

export const updateMedicine = (id, payload) =>
  apiFetch(`/medicines/${id}`, { method: 'PUT', body: payload });

export const deleteMedicine = (id) =>
  apiFetch(`/medicines/${id}`, { method: 'DELETE' });

// --- dental treatments & chart ----------------------------------------------
export const listDentalTreatments = (patientId) =>
  apiFetch(`/patients/${patientId}/dental-treatments`);

export const createDentalTreatment = (patientId, payload) =>
  apiFetch(`/patients/${patientId}/dental-treatments`, { method: 'POST', body: payload });

export const updateDentalTreatment = (patientId, treatmentId, payload) =>
  apiFetch(`/patients/${patientId}/dental-treatments/${treatmentId}`, { method: 'PUT', body: payload });

export const deleteDentalTreatment = (patientId, treatmentId) =>
  apiFetch(`/patients/${patientId}/dental-treatments/${treatmentId}`, { method: 'DELETE' });

export const getDentalChart = (patientId) =>
  apiFetch(`/patients/${patientId}/dental-chart`);

export const saveDentalChart = (patientId, payload) =>
  apiFetch(`/patients/${patientId}/dental-chart`, { method: 'PUT', body: payload });
