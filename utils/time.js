function to12Hour(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return timeStr || '';
  const parts = timeStr.trim().split(':');
  if (parts.length < 2) return timeStr;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return timeStr;
  const period = h >= 12 ? 'PM' : 'AM';
  let hour12 = h % 12;
  if (hour12 === 0) hour12 = 12;
  const mm = m.toString().padStart(2, '0');
  return `${hour12}:${mm} ${period}`;
}

function todayDateIST() {
  // Return YYYY-MM-DD for current date in Asia/Kolkata
  try {
    return new Date().toLocaleString('en-CA', { timeZone: 'Asia/Kolkata' }).slice(0, 10);
  } catch (e) {
    // Fallback to simple UTC-based date
    return new Date().toISOString().slice(0, 10);
  }
}

function formatDateTimeIST(input) {
  if (!input) return '';
  try {
    const d = new Date(input);
    return d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  } catch (e) {
    return String(input);
  }
}

module.exports = { to12Hour, todayDateIST, formatDateTimeIST }; 

