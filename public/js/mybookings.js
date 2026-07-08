const session = requireRole('user');
let pendingCancelId = null;

document.querySelectorAll('.side-nav button[data-view]').forEach((btn) => btn.addEventListener('click', () => switchView(btn.dataset.view)));
document.querySelectorAll('[data-goto]').forEach((btn) => btn.addEventListener('click', () => switchView(btn.dataset.goto)));

function switchView(name) {
  document.querySelectorAll('.side-nav button[data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  document.getElementById(`view-${name}`).classList.add('active');
  if (name === 'bookings') loadBookings();
  if (name === 'wallet') loadWallet();
  if (name === 'book') loadAirportsForBooking();
}

document.getElementById('logout-btn').addEventListener('click', () => { clearSession(); window.location.href = 'index.html'; });

function initUser() {
  document.getElementById('side-av').textContent = initials(session.user.name);
  document.getElementById('side-name').textContent = session.user.name;
  document.getElementById('ov-name').textContent = session.user.name.split(' ')[0];
}

async function loadAirportsForBooking() {
  const { airports } = await api('/airports');
  const opts = airports.map((a) => `<option value="${a.code}">${a.city} (${a.code})</option>`).join('');
  document.getElementById('from-select').innerHTML = opts;
  document.getElementById('to-select').innerHTML = opts;
  document.getElementById('to-select').selectedIndex = 1;
  const dateInput = document.getElementById('date-select');
  dateInput.min = new Date().toISOString().slice(0, 10);
  if (!dateInput.value) dateInput.value = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
}
document.getElementById('go-search-btn').addEventListener('click', () => {
  const from = document.getElementById('from-select').value;
  const to = document.getElementById('to-select').value;
  const date = document.getElementById('date-select').value;
  const params = new URLSearchParams({ from, to });
  if (date) params.set('date', date);
  window.location.href = `flights.html?${params.toString()}`;
});

function bookingCard(b) {
  return `
    <div class="pass-card">
      <div class="pass-main">
        <div class="pass-top">
          <span class="ref">${b.booking_ref}</span>
          <span class="badge ${b.status}">${b.status}</span>
        </div>
        <div class="pass-route">
          <div><div class="city">${b.origin_code}</div><div class="sub">${b.origin_city}</div></div>
          <div class="path-mid"><i class="fa-solid fa-plane"></i></div>
          <div><div class="city">${b.destination_code}</div><div class="sub">${b.destination_city}</div></div>
        </div>
        <div class="pass-details">
          <div><span>Flight</span><b>${b.flight_number}</b></div>
          <div><span>Date</span><b>${formatDate(b.departure_time)}</b></div>
          <div><span>Departs</span><b>${formatTime(b.departure_time)}</b></div>
          <div><span>Class</span><b style="text-transform:capitalize;">${b.class}</b></div>
          <div><span>Paid via</span><b style="text-transform:capitalize;">${b.payment_method === 'card' ? 'Card •••• ' + (b.card_last4 || '') : b.payment_method === 'wallet' ? 'Wallet' : 'Cash'}</b></div>
          <div><span>Payment status</span><span class="badge ${b.payment_status}" style="margin-left:4px;">${b.payment_status}</span></div>
          <div><span>Fare</span><b>${formatMoney(b.amount)}</b></div>
        </div>
      </div>
      <div class="pass-stub">
        <div><div class="seat-tag-label">Seat</div><div class="seat-tag">${b.seat_number}</div></div>
        <div class="stub-actions">
          <a href="/api/bookings/${b.id}/ticket" class="btn btn-amber btn-sm"><i class="fa-solid fa-file-pdf"></i> Ticket</a>
          <a href="receipt.html?bookingId=${b.id}" target="_blank" class="btn btn-outline btn-sm" style="border-color:rgba(255,255,255,.5);color:#fff;"><i class="fa-solid fa-print"></i> Receipt</a>
          ${b.status === 'confirmed' ? `<button class="btn btn-danger btn-sm" onclick="askCancel(${b.id})" style="border-color:rgba(255,255,255,.5);color:#fff;">Cancel</button>` : ''}
        </div>
      </div>
    </div>`;
}

async function loadBookings() {
  const { bookings } = await api(`/bookings/user/${session.user.id}`);
  const list = document.getElementById('bookings-list');
  if (!bookings.length) {
    list.innerHTML = `<div class="empty-state"><i class="fa-solid fa-ticket"></i><p>No bookings yet. Book your first flight!</p></div>`;
    return;
  }
  list.innerHTML = bookings.map(bookingCard).join('');
}

function askCancel(id) {
  pendingCancelId = id;
  document.getElementById('cancel-modal').classList.add('show');
}
document.getElementById('cancel-no').addEventListener('click', () => document.getElementById('cancel-modal').classList.remove('show'));
document.getElementById('cancel-yes').addEventListener('click', async () => {
  try {
    await api(`/bookings/${pendingCancelId}/cancel`, { method: 'POST' });
    toast('Booking cancelled.');
    document.getElementById('cancel-modal').classList.remove('show');
    loadBookings();
    loadOverview();
  } catch (err) {
    toast(err.message, 'error');
  }
});

async function loadOverview() {
  const { bookings } = await api(`/bookings/user/${session.user.id}`);
  const confirmed = bookings.filter((b) => b.status === 'confirmed');
  const cancelled = bookings.filter((b) => b.status === 'cancelled');
  const upcoming = confirmed.filter((b) => new Date(b.departure_time) > new Date()).sort((a, b) => new Date(a.departure_time) - new Date(b.departure_time));
  const spent = confirmed.reduce((sum, b) => sum + Number(b.amount), 0);

  document.getElementById('stat-upcoming').textContent = upcoming.length;
  document.getElementById('stat-total').textContent = bookings.length;
  document.getElementById('stat-spent').textContent = formatMoney(spent);
  document.getElementById('stat-cancelled').textContent = cancelled.length;

  const next = document.getElementById('overview-next');
  if (!upcoming.length) {
    next.innerHTML = `<div class="empty-state"><i class="fa-solid fa-plane-circle-check"></i><p>No upcoming trips. Book your next adventure!</p></div>`;
  } else {
    next.innerHTML = bookingCard(upcoming[0]);
  }
}

initUser();
loadOverview();

// ---------------- Wallet ----------------
function txnIcon(type) {
  if (type === 'topup') return 'fa-arrow-down';
  if (type === 'refund') return 'fa-rotate-left';
  return 'fa-plane';
}
function txnSign(type) {
  return type === 'payment' ? '-' : '+';
}

async function loadWallet() {
  try {
    const { wallet_balance, transactions } = await api(`/users/${session.user.id}/wallet`);
    session.user.wallet_balance = wallet_balance;
    setSession(session.role, session.user);
    document.getElementById('wallet-amount').textContent = formatMoney(wallet_balance);

    const list = document.getElementById('wallet-txn-list');
    if (!transactions.length) {
      list.innerHTML = `<div class="empty-state"><i class="fa-solid fa-wallet"></i><p>No transactions yet. Add money to get started.</p></div>`;
      return;
    }
    list.innerHTML = transactions.map((t) => `
      <div class="wallet-txn-row">
        <div class="icon-wrap">
          <div class="ic ${t.type}"><i class="fa-solid ${txnIcon(t.type)}"></i></div>
          <div>
            <b style="display:block;font-size:.9rem;">${t.description || t.type}</b>
            <span style="color:var(--muted);font-size:.78rem;">${formatDate(t.created_at)}, ${formatTime(t.created_at)}</span>
          </div>
        </div>
        <b class="amt ${t.type}">${txnSign(t.type)}${formatMoney(t.amount)}</b>
      </div>`).join('');
  } catch (err) {
    toast(err.message, 'error');
  }
}

document.getElementById('add-money-btn').addEventListener('click', () => {
  document.getElementById('topup-form').reset();
  document.getElementById('topup-modal').classList.add('show');
});
document.getElementById('topup-cancel').addEventListener('click', () => document.getElementById('topup-modal').classList.remove('show'));

document.getElementById('topup-c-number')?.addEventListener('input', (e) => {
  e.target.value = e.target.value.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
});
document.getElementById('topup-c-expiry')?.addEventListener('input', (e) => {
  let v = e.target.value.replace(/\D/g, '').slice(0, 4);
  if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2);
  e.target.value = v;
});

document.getElementById('topup-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const amount = document.getElementById('topup-amount').value;
  if (!amount || Number(amount) <= 0) {
    toast('Please enter a valid amount.', 'error');
    return;
  }
  const btn = document.getElementById('topup-submit');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-circle-notch spin"></i> Adding...';
  try {
    await api(`/users/${session.user.id}/wallet/topup`, {
      method: 'POST',
      body: JSON.stringify({ amount }),
    });
    toast('Money added to your wallet!');
    document.getElementById('topup-modal').classList.remove('show');
    loadWallet();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-wallet"></i> Add money';
  }
});
