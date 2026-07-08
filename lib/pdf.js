const PDFDocument = require('pdfkit');

// Streams a boarding-pass style PDF straight to the HTTP response.
function generateTicketPDF(res, booking) {
  const doc = new PDFDocument({ size: [420, 760], margin: 0 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=SkylineTicket-${booking.booking_ref}.pdf`);
  doc.pipe(res);

  const navy = '#0B1F3A';
  const amber = '#F2A93B';
  const steel = '#2F5D8C';
  const ink = '#1B1F27';
  const muted = '#6B7280';
  const linen = '#F7F9FC';

  // ---------- Header band ----------
  doc.rect(0, 0, 420, 130).fill(navy);
  doc.fillColor(amber).fontSize(11).font('Helvetica-Bold').text('SKYLINE AIRWAYS', 28, 26, { characterSpacing: 1.5 });
  doc.fillColor('#FFFFFF').fontSize(20).font('Helvetica-Bold').text('Boarding Pass', 28, 42);
  doc.fillColor('#C9D6E8').fontSize(9).font('Helvetica').text(`Booking Ref  ${booking.booking_ref}`, 28, 74);
  doc.fillColor('#C9D6E8').fontSize(9).text(`Status  ${booking.status.toUpperCase()}`, 28, 90);

  // amber circle plane badge
  doc.circle(378, 55, 26).fill(amber);
  doc.fillColor(navy).fontSize(18).text('\u2708', 366, 43);

  // ---------- Route strip ----------
  let y = 150;
  doc.fillColor(ink).fontSize(26).font('Helvetica-Bold').text(booking.origin_code, 28, y);
  doc.fillColor(muted).fontSize(9).font('Helvetica').text(booking.origin_city, 28, y + 30);

  doc.fillColor(steel).fontSize(12).text('----------------  \u2708  ----------------', 130, y + 8, { width: 160, align: 'center' });

  doc.fillColor(ink).fontSize(26).font('Helvetica-Bold').text(booking.destination_code, 300, y, { width: 92, align: 'right' });
  doc.fillColor(muted).fontSize(9).font('Helvetica').text(booking.destination_city, 300, y + 30, { width: 92, align: 'right' });

  // ---------- Details grid ----------
  y += 70;
  doc.moveTo(28, y).lineTo(392, y).dash(2, { space: 2 }).strokeColor('#D9DEE7').stroke();
  doc.undash();

  const fields = [
    ['PASSENGER', booking.passenger_name],
    ['FLIGHT', booking.flight_number],
    ['CLASS', booking.class.toUpperCase()],
    ['SEAT', booking.seat_number],
    ['DEPARTS', formatDT(booking.departure_time)],
    ['ARRIVES', formatDT(booking.arrival_time)],
    ['GATE', 'TBA'],
    ['PAID VIA', paymentLabel(booking)],
    ['PAYMENT STATUS', (booking.payment_status || 'pending').toUpperCase()],
    ['FARE', `PKR ${Number(booking.amount).toLocaleString()}`],
  ];

  y += 22;
  const colW = 182;
  fields.forEach(([label, value], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const fx = 28 + col * colW;
    const fy = y + row * 52;
    doc.fillColor(muted).fontSize(8).font('Helvetica-Bold').text(label, fx, fy, { characterSpacing: 1 });
    doc.fillColor(ink).fontSize(13).font('Helvetica-Bold').text(String(value), fx, fy + 12, { width: colW - 16 });
  });

  // ---------- Perforation + stub ----------
  const stubY = y + Math.ceil(fields.length / 2) * 52 + 26;
  doc.save();
  for (let x = 8; x < 412; x += 10) {
    doc.circle(x, stubY, 2).fill('#EDEFF3');
  }
  doc.restore();

  doc.rect(0, stubY, 420, 760 - stubY).fill(linen);
  doc.fillColor(steel).fontSize(9).font('Helvetica-Bold').text('PASSENGER COPY \u00b7 PRESENT AT GATE WITH VALID ID', 28, stubY + 22, { characterSpacing: .5 });

  // barcode-ish block
  doc.save();
  let bx = 28;
  const barY = stubY + 46;
  const seedNum = hashRef(booking.booking_ref);
  for (let i = 0; i < 60; i++) {
    const w = ((seedNum * (i + 3)) % 3) + 1;
    if ((seedNum + i) % 5 !== 0) doc.rect(bx, barY, w, 46).fill(navy);
    bx += w + 2;
    if (bx > 392) break;
  }
  doc.restore();
  doc.fillColor(muted).fontSize(8).font('Helvetica').text(booking.booking_ref, 28, barY + 54, { characterSpacing: 3 });

  doc.fillColor(muted).fontSize(8).text('Thank you for flying Skyline Airways. Wishing you a pleasant journey.', 28, 720, { width: 364 });

  doc.end();
}

function paymentLabel(booking) {
  if (booking.payment_method === 'card') return `Card •••• ${booking.card_last4 || '----'}`;
  if (booking.payment_method === 'wallet') return 'Skyline Wallet';
  return 'Cash at counter';
}

function formatDT(dt) {
  const d = new Date(dt);
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function hashRef(str) {
  let h = 7;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 97;
  return h || 3;
}

module.exports = { generateTicketPDF };
