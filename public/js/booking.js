const session = requireRole('user');
const flightId = qs('flightId');
if (!flightId) window.location.href = 'index.html';

let flight = null;
let seatMap = null;
let takenSeats = [];
let currentClass = 'economy';
let selectedSeat = null;
let lastBooking = null;
let paymentMethod = 'wallet';
let walletBalance = Number(session.user.wallet_balance || 0);

async function init() {
  try {
    const data = await api(`/flights/${flightId}`);
    flight = data.flight;
    seatMap = data.seatMap;
    takenSeats = data.takenSeats;
    renderSummary();
    renderSeats();
  } catch (err) {
    toast(err.message, 'error');
  }
}

function renderSummary() {
  document.getElementById('flight-summary').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:14px;">
      <div>
        <div style="font-family:var(--font-mono);color:var(--steel);font-size:.8rem;margin-bottom:6px;">${flight.flight_number} · ${formatDate(flight.departure_time)}</div>
        <div style="display:flex;align-items:center;gap:14px;">
          <div><b style="font-family:var(--font-display);font-size:1.3rem;color:var(--midnight);">${formatTime(flight.departure_time)}</b><div style="font-size:.78rem;color:var(--muted);">${flight.origin_city} (${flight.origin_code})</div></div>
          <i class="fa-solid fa-arrow-right" style="color:var(--amber);"></i>
          <div><b style="font-family:var(--font-display);font-size:1.3rem;color:var(--midnight);">${formatTime(flight.arrival_time)}</b><div style="font-size:.78rem;color:var(--muted);">${flight.destination_city} (${flight.destination_code})</div></div>
        </div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:.78rem;color:var(--muted);">Duration</div>
        <b style="color:var(--midnight);">${durationBetween(flight.departure_time, flight.arrival_time)}</b>
      </div>
    </div>`;
}

document.querySelectorAll('#class-tabs button').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#class-tabs button').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentClass = btn.dataset.class;
    selectedSeat = null;
    document.getElementById('to-step-2').disabled = true;
    document.getElementById('chosen-seat-label').textContent = '';
    renderSeats();
  });
});

function renderSeats() {
  const seats = seatMap[currentClass];
  const perRow = currentClass === 'business' ? 4 : 6;
  const rows = {};
  seats.forEach((s) => {
    const rowNum = s.match(/\d+/)[0];
    rows[rowNum] = rows[rowNum] || [];
    rows[rowNum].push(s);
  });

  const grid = document.getElementById('seat-grid');
  grid.innerHTML = Object.entries(rows).map(([rowNum, rowSeats]) => {
    const mid = Math.floor(perRow / 2);
    let cells = '';
    rowSeats.forEach((seatId, i) => {
      if (i === mid) cells += `<div class="aisle-gap"></div>`;
      const taken = takenSeats.includes(seatId);
      const cls = ['seat', currentClass === 'business' ? 'business-seat' : '', taken ? 'taken' : 'available', selectedSeat === seatId ? 'selected' : ''].filter(Boolean).join(' ');
      cells += `<div class="${cls}" data-seat="${seatId}" ${taken ? '' : 'onclick="pickSeat(\'' + seatId + '\')"'}>${seatId}</div>`;
    });
    return `<div class="seat-row"><div class="row-label">${rowNum}</div>${cells}</div>`;
  }).join('');
}

function pickSeat(seatId) {
  selectedSeat = seatId;
  renderSeats();
  document.getElementById('to-step-2').disabled = false;
  document.getElementById('chosen-seat-label').textContent = `(${seatId})`;
}

// ---------- step navigation ----------
function goStep(n) {
  [1, 2, 3, 4].forEach((i) => {
    document.getElementById(`step-${i}`).style.display = i === n ? 'block' : 'none';
    document.getElementById(`step-${i}-tab`).classList.toggle('active', i <= n);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.getElementById('to-step-2').addEventListener('click', () => {
  if (!selectedSeat) return;
  document.getElementById('p-email').value = session.user.email || '';
  document.getElementById('p-name').value = session.user.name || '';
  goStep(2);
});
document.getElementById('back-to-1').addEventListener('click', () => goStep(1));
document.getElementById('back-to-2').addEventListener('click', () => goStep(2));
document.getElementById('back-to-3').addEventListener('click', () => goStep(3));

document.getElementById('passenger-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  await refreshWalletBalance();
  goStep(3);
});

async function refreshWalletBalance() {
  try {
    const { wallet_balance } = await api(`/users/${session.user.id}/wallet`);
    walletBalance = Number(wallet_balance);
  } catch (err) {
    // fall back to whatever we had from session
  }
  renderWalletNote();
}

function renderWalletNote() {
  const price = currentClass === 'business' ? flight.business_price : flight.economy_price;
  document.getElementById('wallet-balance-label').textContent = formatMoney(walletBalance);
  const short = walletBalance < price;
  document.getElementById('wallet-topup-link').style.display = short ? 'inline-block' : 'none';
  const toStep4Btn = document.getElementById('to-step-4');
  if (paymentMethod === 'wallet' && short) {
    toStep4Btn.disabled = true;
    toStep4Btn.title = 'Insufficient wallet balance';
  } else {
    toStep4Btn.disabled = false;
    toStep4Btn.title = '';
  }
}

// ---------- payment ----------
document.querySelectorAll('#payment-tabs button').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#payment-tabs button').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    paymentMethod = btn.dataset.method;
    document.getElementById('wallet-note').style.display = paymentMethod === 'wallet' ? 'block' : 'none';
    document.getElementById('cash-note').style.display = paymentMethod === 'cash' ? 'block' : 'none';
    document.getElementById('card-form').style.display = paymentMethod === 'card' ? 'block' : 'none';
    renderWalletNote();
  });
});

document.getElementById('c-number').addEventListener('input', (e) => {
  e.target.value = e.target.value.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
});
document.getElementById('c-expiry').addEventListener('input', (e) => {
  let v = e.target.value.replace(/\D/g, '').slice(0, 4);
  if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2);
  e.target.value = v;
});

document.getElementById('to-step-4').addEventListener('click', () => {
  const price = currentClass === 'business' ? flight.business_price : flight.economy_price;
  if (paymentMethod === 'wallet' && walletBalance < price) {
    toast('Insufficient wallet balance. Please top up or choose another payment method.', 'error');
    return;
  }
  if (paymentMethod === 'card') {
    const name = document.getElementById('c-name').value.trim();
    const number = document.getElementById('c-number').value.replace(/\s/g, '');
    const expiry = document.getElementById('c-expiry').value.trim();
    const cvv = document.getElementById('c-cvv').value.trim();
    if (!name || number.length < 12 || !/^\d{2}\/\d{2}$/.test(expiry) || cvv.length < 3) {
      toast('Please enter valid card details.', 'error');
      return;
    }
  }
  renderReview();
  goStep(4);
});

function renderReview() {
  const price = currentClass === 'business' ? flight.business_price : flight.economy_price;
  const paymentLabel = paymentMethod === 'card'
    ? `Card ending •••• ${document.getElementById('c-number').value.replace(/\s/g, '').slice(-4)}`
    : paymentMethod === 'wallet'
      ? `Skyline Wallet (balance ${formatMoney(walletBalance)})`
      : 'Cash at counter';
  document.getElementById('review-block').innerHTML = `
    <div class="grid-2" style="margin-bottom:8px;">
      <div><span style="display:block;font-size:.72rem;color:var(--muted);text-transform:uppercase;">Passenger</span><b>${document.getElementById('p-name').value}</b></div>
      <div><span style="display:block;font-size:.72rem;color:var(--muted);text-transform:uppercase;">Email</span><b>${document.getElementById('p-email').value}</b></div>
      <div><span style="display:block;font-size:.72rem;color:var(--muted);text-transform:uppercase;">Class</span><b style="text-transform:capitalize;">${currentClass}</b></div>
      <div><span style="display:block;font-size:.72rem;color:var(--muted);text-transform:uppercase;">Seat</span><b>${selectedSeat}</b></div>
      <div><span style="display:block;font-size:.72rem;color:var(--muted);text-transform:uppercase;">Flight</span><b>${flight.flight_number}</b></div>
      <div><span style="display:block;font-size:.72rem;color:var(--muted);text-transform:uppercase;">Route</span><b>${flight.origin_code} → ${flight.destination_code}</b></div>
      <div><span style="display:block;font-size:.72rem;color:var(--muted);text-transform:uppercase;">Payment</span><b>${paymentLabel}</b></div>
    </div>
    <div style="border-top:1.5px dashed var(--line);margin-top:14px;padding-top:14px;display:flex;justify-content:space-between;align-items:center;">
      <span style="color:var(--muted);font-size:.9rem;">Total fare</span>
      <b style="font-family:var(--font-display);font-size:1.6rem;color:var(--midnight);">${formatMoney(price)}</b>
    </div>`;
}

document.getElementById('confirm-btn').addEventListener('click', async () => {
  const btn = document.getElementById('confirm-btn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-circle-notch spin"></i> Booking...';
  try {
    const cardNumber = document.getElementById('c-number').value.replace(/\s/g, '');
    const { booking, wallet_balance } = await api('/bookings', {
      method: 'POST',
      body: JSON.stringify({
        user_id: session.user.id,
        flight_id: flight.id,
        passenger_name: document.getElementById('p-name').value.trim(),
        passenger_age: document.getElementById('p-age').value,
        passenger_gender: document.getElementById('p-gender').value,
        passenger_email: document.getElementById('p-email').value.trim(),
        class: currentClass,
        seat_number: selectedSeat,
        payment_method: paymentMethod,
        card_last4: paymentMethod === 'card' ? cardNumber.slice(-4) : undefined,
      }),
    });
    if (wallet_balance !== null && wallet_balance !== undefined) {
      session.user.wallet_balance = wallet_balance;
      setSession(session.role, session.user);
    }
    lastBooking = booking;
    document.getElementById('step-1').style.display = 'none';
    document.getElementById('step-2').style.display = 'none';
    document.getElementById('step-3').style.display = 'none';
    document.getElementById('step-4').style.display = 'none';
    document.getElementById('flight-summary').style.display = 'none';
    document.querySelector('.step-track').style.display = 'none';
    document.getElementById('step-success').style.display = 'block';
    document.getElementById('success-ref').textContent = `Your booking reference is ${booking.booking_ref}. A copy of your e-ticket is ready below.`;
    document.getElementById('download-ticket-btn').href = `/api/bookings/${booking.id}/ticket`;
    document.getElementById('print-receipt-btn').href = `receipt.html?bookingId=${booking.id}`;
    toast('Seat booked successfully!');
  } catch (err) {
    toast(err.message, 'error');
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-lock"></i> Confirm & book';
    if (err.message.toLowerCase().includes('seat')) { goStep(1); init(); }
  }
});

init();
