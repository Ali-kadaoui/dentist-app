const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const dateTimeFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const timeFormatter = new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit',
  minute: '2-digit',
});

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function toDate(value) {
  if (!value) return null;

  // DateOnly values ("2026-04-08") must be parsed as local dates, otherwise
  // they can shift by one day in negative UTC offsets.
  const date = DATE_ONLY.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export const formatDate = (value) => {
  const date = toDate(value);
  return date ? dateFormatter.format(date) : '—';
};

export const formatDateTime = (value) => {
  const date = toDate(value);
  return date ? dateTimeFormatter.format(date) : '—';
};

export const formatTime = (value) => {
  const date = toDate(value);
  return date ? timeFormatter.format(date) : '—';
};

export const formatNumber = (value) =>
  typeof value === 'number' ? value.toLocaleString('en-GB') : '—';

export const initials = (firstName = '', lastName = '') =>
  `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || '?';

/**
 * Turns an ApiError (RFC 9457 problem details) into one readable line.
 * Validation problems carry per-field messages in `problem.errors`.
 */
export function describeError(error) {
  if (!error) return '';

  const problem = error.problem;
  const validation = problem?.errors;
  if (validation && typeof validation === 'object') {
    const [field, messages] = Object.entries(validation)[0] ?? [];
    if (field) {
      const text = Array.isArray(messages) ? messages.join(' ') : String(messages);
      return `${field}: ${text}`;
    }
  }

  // Detailed modem/gateway errors
  const code = error.code || problem?.code;
  const detail = problem?.detail || error.message;

  if (code === 'MODEM_UNAVAILABLE') {
    return 'Modem is disconnected or not reachable on its COM port. Check USB connection.';
  }
  if (code === 'GATEWAY_UNREACHABLE') {
    return 'SMS Gateway service is not running. Please start the gateway.';
  }
  if (code === 'MODEM_BUSY') {
    return 'Modem is currently busy. Please wait a moment and try again.';
  }
  if (code === 'SEND_REJECTED') {
    return `SMS could not be delivered: ${detail || 'Check SIM balance, subscription, or network signal.'}`;
  }

  return detail || error.message || 'Something went wrong.';
}
