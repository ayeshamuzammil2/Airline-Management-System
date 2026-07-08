const session = requireRole('admin');
let airportsCache = [];
let flightsCache = [];
let editingFlightId = null;
let deleteFlightId = null;
let charts = {};

document.querySelectorAll('.side-nav button[data-view]').forEach((btn) => btn.addEventListener('click', () => switchView(btn.dataset.view)));

function switchView(name) {
  document.querySelectorAll('.side-nav button[data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  document.getElementById(`view-${name}`).classList.add('active');
  if (name === 'overview') loadOverview();
  if (name === 'flights') loadFlights();
  if (name === 'bookings') loadBookings();
  if (name === 'payments') loadPayments();
  if (name === 'users') loadUsers();
}

document.getElementById('logout-btn').addEventListener('click', () => { clearSession(); window.location.href = 'index.html'; });

function initUser() {
  const label = session.user.username || 'Admin';
  document.getElementById('side-av').textContent = initials(label);
  document.getElementById('side-name').textContent = label;
}

const CHART_COLORS = { amber: '#F2A93B', steel: '#2F5D8C', midnight: '#0B1F3A', success: '#1F9D6B', line: '#E3E8F0' };

function ensureChartDefaults() {
  if (typeof Chart === 'undefined') return false;
  Chart.defaults.font.family = "'Inter', sans-serif";
  Chart.defaults.color = '#6B7280';
  return true;
}

// ---------------- Overview + charts ----------------
async function loadOverview() {
  try {
    const overview = await api('/stats/overview');
    document.getElementById('stat-flights').textContent = overview.flights;
    document.getElementById('stat-users').textContent = overview.users;
    document.getElementById('stat-bookings').textContent = overview.bookings;
    document.getElementById('stat-revenue').textContent = formatMoney(overview.revenue);
  } catch (err) {
    toast('Could not load overview stats: ' + err.message, 'error');
  }

  if (!ensureChartDefaults()) {
    toast('Charts library failed to load — check your internet connection and reload.', 'error');
    return;
  }

  try {
    const { trend } = await api('/stats/trend');
    const labels = trend.map((t) => new Date(t.day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }));

    renderChart('chart-trend', 'line', {
      labels,
      datasets: [{
        label: 'Bookings', data: trend.map((t) => Number(t.bookings)),
        borderColor: CHART_COLORS.steel, backgroundColor: 'rgba(47,93,140,.12)', fill: true, tension: .35, pointRadius: 2,
      }],
    });

    renderChart('chart-revenue', 'bar', {
      labels,
      datasets: [{ label: 'Revenue (PKR)', data: trend.map((t) => Number(t.revenue)), backgroundColor: CHART_COLORS.amber, borderRadius: 6, maxBarThickness: 22 }],
    });
  } catch (err) {
    toast('Could not load trend charts: ' + err.message, 'error');
  }

  try {
    const { routes } = await api('/stats/top-routes');
    renderChart('chart-routes', 'bar', {
      labels: routes.length ? routes.map((r) => `${r.origin_code}\u2192${r.destination_code}`) : ['No bookings yet'],
      datasets: [{ label: 'Bookings', data: routes.length ? routes.map((r) => Number(r.bookings)) : [0], backgroundColor: CHART_COLORS.midnight, borderRadius: 6, maxBarThickness: 26 }],
    }, { indexAxis: 'y' });
  } catch (err) {
    toast('Could not load top routes: ' + err.message, 'error');
  }

  try {
    const { split } = await api('/stats/class-split');
    renderChart('chart-class', 'doughnut', {
      labels: split.length ? split.map((s) => s.class[0].toUpperCase() + s.class.slice(1)) : ['No bookings yet'],
      datasets: [{ data: split.length ? split.map((s) => Number(s.count)) : [1], backgroundColor: split.length ? [CHART_COLORS.steel, CHART_COLORS.amber] : [CHART_COLORS.line], borderWidth: 0 }],
    }, { cutout: '65%' });
  } catch (err) {
    toast('Could not load class split: ' + err.message, 'error');
  }

  try {
    const { occupancy } = await api('/stats/occupancy');
    renderChart('chart-occupancy', 'bar', {
      labels: occupancy.map((o) => o.flight_number),
      datasets: [
        { label: 'Booked', data: occupancy.map((o) => Number(o.booked_seats)), backgroundColor: CHART_COLORS.amber, borderRadius: 6, stack: 's' },
        { label: 'Available', data: occupancy.map((o) => Number(o.total_seats) - Number(o.booked_seats)), backgroundColor: CHART_COLORS.line, borderRadius: 6, stack: 's' },
      ],
    }, { scales: { x: { stacked: true }, y: { stacked: true } } });
  } catch (err) {
    toast('Could not load occupancy: ' + err.message, 'error');
  }
}

function renderChart(canvasId, type, data, extraOptions = {}) {
  const ctx = document.getElementById(canvasId);
  if (charts[canvasId]) charts[canvasId].destroy();
  charts[canvasId] = new Chart(ctx, {
    type, data,
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: type === 'doughnut' || (data.datasets.length > 1), labels: { boxWidth: 12, padding: 14 } } },
      scales: type === 'doughnut' ? {} : { y: { beginAtZero: true, grid: { color: CHART_COLORS.line } }, x: { grid: { display: false } } },
      ...extraOptions,
    },
  });
}

// ---------------- Flights ----------------
async function loadAirportsIfNeeded() {
  if (airportsCache.length) return;
  const { airports } = await api('/airports');
  airportsCache = airports;
  const opts = airports.map((a) => `<option value="${a.code}">${a.city} (${a.code})</option>`).join('');
  document.getElementById('f-origin').innerHTML = opts;
  document.getElementById('f-destination').innerHTML = opts;
}

async function loadFlights() {
  const { flights } = await api('/flights');
  flightsCache = flights;
  const body = document.getElementById('flights-body');
  const empty = document.getElementById('flights-empty');
  if (!flights.length) { body.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  body.innerHTML = flights.map((f) => `
    <tr>
      <td class="id-mono">${f.flight_number}</td>
      <td><b>${f.origin_code}</b> \u2192 <b>${f.destination_code}</b></td>
      <td>${formatDate(f.departure_time)}<br/><span style="color:var(--muted);font-size:.78rem;">${formatTime(f.departure_time)}</span></td>
      <td>Eco ${formatMoney(f.economy_price)}<br/><span style="color:var(--muted);font-size:.78rem;">Biz ${formatMoney(f.business_price)}</span></td>
      <td>${f.economy_available}E / ${f.business_available}B</td>
      <td><span class="badge ${f.status}">${f.status}</span></td>
      <td class="row-actions">
        <button class="icon-btn" onclick="openEditFlight(${f.id})" title="Edit"><i class="fa-solid fa-pen"></i></button>
        <button class="icon-btn danger" onclick="openDeleteFlight(${f.id}, '${f.flight_number}')" title="Delete"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>`).join('');
}

document.getElementById('add-flight-btn').addEventListener('click', async () => {
  await loadAirportsIfNeeded();
  editingFlightId = null;
  document.getElementById('flight-modal-title').textContent = 'Add flight';
  document.getElementById('flight-form').reset();
  document.getElementById('f-eco-seats').value = 24;
  document.getElementById('f-biz-seats').value = 8;
  document.getElementById('seat-count-fields').style.display = 'grid';
  document.getElementById('status-field').style.display = 'none';
  document.getElementById('flight-modal').classList.add('show');
});

async function openEditFlight(id) {
  await loadAirportsIfNeeded();
  const f = flightsCache.find((x) => x.id === id);
  editingFlightId = id;
  document.getElementById('flight-modal-title').textContent = `Edit ${f.flight_number}`;
  document.getElementById('f-number').value = f.flight_number;
  document.getElementById('f-origin').value = f.origin_code;
  document.getElementById('f-destination').value = f.destination_code;
  document.getElementById('f-departure').value = toLocalInput(f.departure_time);
  document.getElementById('f-arrival').value = toLocalInput(f.arrival_time);
  document.getElementById('f-eco-price').value = f.economy_price;
  document.getElementById('f-biz-price').value = f.business_price;
  document.getElementById('f-status').value = f.status;
  document.getElementById('seat-count-fields').style.display = 'none';
  document.getElementById('status-field').style.display = 'block';
  document.getElementById('flight-modal').classList.add('show');
}
function toLocalInput(dt) {
  const d = new Date(dt);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

document.getElementById('flight-modal-cancel').addEventListener('click', () => document.getElementById('flight-modal').classList.remove('show'));

document.getElementById('flight-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    flight_number: document.getElementById('f-number').value.trim(),
    origin_code: document.getElementById('f-origin').value,
    destination_code: document.getElementById('f-destination').value,
    departure_time: document.getElementById('f-departure').value,
    arrival_time: document.getElementById('f-arrival').value,
    economy_price: document.getElementById('f-eco-price').value,
    business_price: document.getElementById('f-biz-price').value,
  };
  if (payload.origin_code === payload.destination_code) {
    toast('Origin and destination cannot be the same.', 'error');
    return;
  }

  const btn = document.getElementById('flight-modal-save');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-circle-notch spin"></i> Saving...';
  try {
    if (editingFlightId) {
      payload.status = document.getElementById('f-status').value;
      await api(`/flights/${editingFlightId}`, { method: 'PUT', body: JSON.stringify(payload) });
      toast('Flight updated.');
    } else {
      payload.economy_seats = document.getElementById('f-eco-seats').value;
      payload.business_seats = document.getElementById('f-biz-seats').value;
      await api('/flights', { method: 'POST', body: JSON.stringify(payload) });
      toast('Flight added.');
    }
    document.getElementById('flight-modal').classList.remove('show');
    loadFlights();
    loadOverview();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Save flight';
  }
});

function openDeleteFlight(id, num) {
  deleteFlightId = id;
  document.getElementById('delete-text').textContent = `This will permanently remove flight ${num}.`;
  document.getElementById('delete-modal').classList.add('show');
}
document.getElementById('delete-cancel').addEventListener('click', () => document.getElementById('delete-modal').classList.remove('show'));
document.getElementById('delete-confirm').addEventListener('click', async () => {
  try {
    await api(`/flights/${deleteFlightId}`, { method: 'DELETE' });
    toast('Flight deleted.');
    document.getElementById('delete-modal').classList.remove('show');
    loadFlights();
    loadOverview();
  } catch (err) {
    toast(err.message, 'error');
  }
});

// ---------------- Bookings ----------------
async function loadBookings() {
  const { bookings } = await api('/bookings');
  const body = document.getElementById('bookings-body');
  const empty = document.getElementById('bookings-empty');
  if (!bookings.length) { body.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  body.innerHTML = bookings.map((b) => `
    <tr>
      <td class="id-mono">${b.booking_ref}</td>
      <td><b>${b.passenger_name}</b></td>
      <td>${b.origin_code} \u2192 ${b.destination_code}</td>
      <td>${b.flight_number}<br/><span style="color:var(--muted);font-size:.78rem;">${formatDate(b.departure_time)}</span></td>
      <td>${b.seat_number} <span class="badge ${b.class}">${b.class}</span></td>
      <td>${formatMoney(b.amount)}</td>
      <td style="text-transform:capitalize;">${paymentMethodLabel(b)}</td>
      <td><span class="badge ${b.payment_status}">${b.payment_status}</span></td>
      <td><span class="badge ${b.status}">${b.status}</span></td>
    </tr>`).join('');
}

function paymentMethodLabel(b) {
  if (b.payment_method === 'card') return `Card •••• ${b.card_last4 || ''}`;
  if (b.payment_method === 'wallet') return 'Wallet';
  return 'Cash';
}

// ---------------- Payments ----------------
async function loadPayments() {
  const { bookings } = await api('/bookings');
  const body = document.getElementById('payments-body');
  const empty = document.getElementById('payments-empty');
  if (!bookings.length) { body.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  body.innerHTML = bookings.map((b) => `
    <tr>
      <td class="id-mono">${b.booking_ref}</td>
      <td><b>${b.passenger_name}</b></td>
      <td>${b.flight_number}</td>
      <td>${formatMoney(b.amount)}</td>
      <td style="text-transform:capitalize;">${paymentMethodLabel(b)}</td>
      <td><span class="badge ${b.payment_status}">${b.payment_status}</span></td>
      <td>${b.payment_status === 'pending' && b.status === 'confirmed'
        ? `<button class="btn btn-amber btn-sm" onclick="markPaid(${b.id})"><i class="fa-solid fa-check"></i> Mark as paid</button>`
        : ''}</td>
    </tr>`).join('');
}

async function markPaid(id) {
  try {
    await api(`/bookings/${id}/mark-paid`, { method: 'POST' });
    toast('Booking marked as paid.');
    loadPayments();
    loadBookings();
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ---------------- Users ----------------
async function loadUsers() {
  const { users } = await api('/users');
  const body = document.getElementById('users-body');
  const empty = document.getElementById('users-empty');
  if (!users.length) { body.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  body.innerHTML = users.map((u) => `
    <tr>
      <td><b>${u.name}</b></td>
      <td>${u.email}</td>
      <td>${u.phone || '\u2014'}</td>
      <td><b>${formatMoney(u.wallet_balance)}</b></td>
      <td>${formatDate(u.created_at)}</td>
    </tr>`).join('');
}

initUser();
loadOverview();
