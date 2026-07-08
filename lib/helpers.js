function genBookingRef() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let ref = 'SA-';
  for (let i = 0; i < 6; i++) ref += chars[Math.floor(Math.random() * chars.length)];
  return ref;
}

// Builds seat labels: business rows use A-D (4 across), economy rows use A-F (6 across)
function buildSeatMap(businessSeats, economySeats) {
  const bRows = Math.ceil(businessSeats / 4);
  const eRows = Math.ceil(economySeats / 6);
  const business = [];
  const economy = [];
  let count = 0;
  for (let r = 1; r <= bRows && count < businessSeats; r++) {
    for (const l of ['A', 'B', 'C', 'D']) {
      if (count >= businessSeats) break;
      business.push(`${r}${l}`);
      count++;
    }
  }
  count = 0;
  const eStart = bRows + 1;
  for (let r = eStart; r < eStart + eRows && count < economySeats; r++) {
    for (const l of ['A', 'B', 'C', 'D', 'E', 'F']) {
      if (count >= economySeats) break;
      economy.push(`${r}${l}`);
      count++;
    }
  }
  return { business, economy };
}

module.exports = { genBookingRef, buildSeatMap };
