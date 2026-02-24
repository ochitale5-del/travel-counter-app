const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const { to12Hour } = require('../utils/time');

const outputDir = path.join(__dirname, '..', 'data', 'tickets');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

function formatCurrency(amount) {
  const value = Number(amount) || 0;
  // Use Rs. for robust rendering across fonts
  return `Rs. ${value.toFixed(2)}`;
}

function titleCase(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function drawHeader(doc, subtitle) {
  // Company name
  doc
    .fontSize(18)
    .fillColor('#000000')
    .text('RATNA CT TRAVELS', { align: 'center' });

  // Subtitle and contact details
  doc.moveDown(0.05);
  doc
    .fontSize(11)
    .fillColor('#555555')
    .text('(unit of ADOK Enterprises)', { align: 'center' });

  doc.moveDown(0.05);
  doc
    .fontSize(10)
    .fillColor('#333333')
    .text('Phone: 9702265959 / 9869521797', { align: 'center' });

  doc.moveDown(0.05);
  doc
    .fontSize(10)
    .text('Email: chitaletours@gmail.com', { align: 'center' });

  doc.moveDown(0.05);
  doc
    .fontSize(9)
    .fillColor('#555555')
    .text('F/16 Sarvodaya Nagar, Opp. Aarey Metro Station, Goregaon East, Mumbai 400065', {
      align: 'center',
    });

  if (subtitle) {
    doc.moveDown(0.25);
    doc
      .fontSize(11)
      .fillColor('#000000')
      .text(subtitle, { align: 'center' });
  }

  doc.moveDown(0.35);
  const { left, right } = doc.page.margins;
  const width = doc.page.width - left - right;
  const x = left;
  const y = doc.y;
  doc
    .moveTo(x, y)
    .lineTo(x + width, y)
    .strokeColor('#cccccc')
    .stroke();
  doc.moveDown(0.6);
  doc.fillColor('#000000');
}

function drawFooter(doc) {
  doc.moveDown(0.8);
  doc
    .fontSize(9)
    .fillColor('#555555')
    .text('Thank you for travelling with us!', { align: 'center' });
}

function passengerPartA(booking) {
  return new Promise((resolve, reject) => {
    const filename = `passenger-${booking.pnr}-partA.pdf`;
    const filepath = path.join(outputDir, filename);
    const doc = new PDFDocument({ size: 'A5', margin: 30 });

    const stream = fs.createWriteStream(filepath);
    doc.pipe(stream);

    drawHeader(doc, 'Passenger Ticket - Part A (Customer Copy)');

    // PNR row
    doc
      .fontSize(10)
      .fillColor('#555555')
      .text(`PNR: ${booking.pnr}`, { align: 'right' });
    doc.moveDown(0.2);

    // Passenger section
    doc
      .fontSize(12)
      .fillColor('#000000')
      .text('Passenger Details', { underline: true });
    doc.moveDown(0.25);
    doc.fontSize(10);
    doc.text(`Name: ${booking.customer_name || ''}`);
    doc.text(`Phone: ${booking.customer_phone || ''}`);
    if (booking.customer_email) doc.text(`Email: ${booking.customer_email}`);
    if (booking.customer_age) doc.text(`Age: ${booking.customer_age}`);
    doc.moveDown(0.5);

    // Journey section
    const from = titleCase(booking.from_place);
    const to = titleCase(booking.destination);

    doc
      .fontSize(12)
      .text('Journey Details', { underline: true });
    doc.moveDown(0.25);
    doc.fontSize(10);
    doc.text(`From: ${from}`);
    doc.text(`To: ${to}`);
    doc.text(`Date: ${booking.travel_date || ''}`);
    doc.text(`Seat: ${booking.seat_number || ''}`);
    doc.text(`Operator: ${booking.bus_operator || ''}`);
    doc.text(`Departure: ${to12Hour(booking.departure_time)}`);
    doc.moveDown(0.5);

    // Fare section (customer-facing only)
    doc
      .fontSize(12)
      .text('Fare Details', { underline: true });
    doc.moveDown(0.25);
    doc.fontSize(10);
    doc.text(`Fare collected: ${formatCurrency(booking.total_fare)}`);
    doc.moveDown(0.6);

    doc
      .fontSize(9)
      .fillColor('#555555')
      .text('- Customer Copy -', { align: 'center' });

    doc
      .fontSize(9)
      .fillColor('#555555')
      .text('- Thank you for your business. Have a safe journey! -', { align: 'center' });

    drawFooter(doc);
    doc.end();

    stream.on('finish', () => resolve(filepath));
    stream.on('error', reject);
  });
}

function passengerPartB(booking) {
  return new Promise((resolve, reject) => {
    const filename = `passenger-${booking.pnr}-partB.pdf`;
    const filepath = path.join(outputDir, filename);
    const doc = new PDFDocument({ size: 'A5', margin: 30 });

    const stream = fs.createWriteStream(filepath);
    doc.pipe(stream);

    drawHeader(doc, 'Passenger Ticket - Part B (Driver Copy)');

    doc
      .fontSize(10)
      .fillColor('#555555')
      .text(`PNR: ${booking.pnr}`, { align: 'right' });
    doc.moveDown(0.2);

    doc
      .fontSize(12)
      .fillColor('#000000')
      .text('Passenger Details', { underline: true });
    doc.moveDown(0.25);
    doc.fontSize(10);
    doc.text(`Name: ${booking.customer_name || ''}`);
    doc.text(`Phone: ${booking.customer_phone || ''}`);
    doc.moveDown(0.5);

    const from = titleCase(booking.from_place);
    const to = titleCase(booking.destination);

    doc
      .fontSize(12)
      .text('Journey Details', { underline: true });
    doc.moveDown(0.25);
    doc.fontSize(10);
    doc.text(`From: ${from}`);
    doc.text(`To: ${to}`);
    doc.text(`Date: ${booking.travel_date || ''}`);
    doc.text(`Seat: ${booking.seat_number || ''}`);
    doc.text(`Operator: ${booking.bus_operator || ''}`);
    doc.text(`Departure: ${to12Hour(booking.departure_time)}`);
    doc.moveDown(0.6);

    doc
      .fontSize(9)
      .fillColor('#555555')
      .text('Part B - Driver copy (no fare / commission details)', { align: 'center' });

    drawFooter(doc);

    doc.end();

    stream.on('finish', () => resolve(filepath));
    stream.on('error', reject);
  });
}

function parcelPartB(booking) {
  return new Promise((resolve, reject) => {
    const filename = `parcel-${booking.pnr}-partB.pdf`;
    const filepath = path.join(outputDir, filename);
    const doc = new PDFDocument({ size: 'A5', margin: 30 });

    const stream = fs.createWriteStream(filepath);
    doc.pipe(stream);

    drawHeader(doc, 'Parcel Waybill - Part B (Driver Copy)');

    doc
      .fontSize(10)
      .fillColor('#555555')
      .text(`PNR: ${booking.pnr}`, { align: 'right' });
    doc.moveDown(0.2);

    doc
      .fontSize(12)
      .fillColor('#000000')
      .text('Sender / Receiver', { underline: true });
    doc.moveDown(0.25);
    doc.fontSize(10);
    doc.text(`Sender: ${booking.sender_name || ''} | ${booking.sender_phone || ''}`);
    doc.text(`Receiver: ${booking.receiver_name || ''} | ${booking.receiver_phone || ''}`);
    doc.moveDown(0.5);

    const destination = titleCase(booking.destination);

    doc
      .fontSize(12)
      .text('Parcel / Journey', { underline: true });
    doc.moveDown(0.25);
    doc.fontSize(10);
    doc.text(`Destination: ${destination}`);
    doc.text(`Boxes: ${booking.num_boxes || 0}`);
    if (booking.bus_assigned) doc.text(`Bus: ${booking.bus_assigned}`);
    if (booking.bus_departure_time) doc.text(`Departure: ${to12Hour(booking.bus_departure_time)}`);
    doc.moveDown(0.6);

    doc
      .fontSize(9)
      .fillColor('#555555')
      .text('Driver copy (no rate / commission details)', { align: 'center' });

    drawFooter(doc);

    doc.end();

    stream.on('finish', () => resolve(filepath));
    stream.on('error', reject);
  });
}

function reportPdf(from, to, summary, passengers, parcels) {
  return new Promise((resolve, reject) => {
    const filename = `report-${from}-to-${to}.pdf`;
    const filepath = path.join(outputDir, filename);
    const doc = new PDFDocument({ size: 'A4', margin: 40 });

    const stream = fs.createWriteStream(filepath);
    doc.pipe(stream);

    drawHeader(doc, `Summary Report (${from} to ${to})`);

    doc.fontSize(12).text('Summary', { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(10);
    doc.text(`Total revenue collected: ${formatCurrency(summary.revenue)}`);
    doc.text(`Total commission earned: ${formatCurrency(summary.commission)}`);
    doc.text(`Total settlements paid to operators: ${formatCurrency(summary.settlementsPaid)}`);
    doc.text(`Passenger bookings: ${summary.passengerCount}`);
    doc.text(`Parcel bookings: ${summary.parcelCount}`);
    doc.moveDown(0.8);

    // Passenger table
    doc.fontSize(12).text('Passenger bookings', { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(9);
    const passHeaders = ['PNR', 'Customer', 'Destination', 'Date', 'Rate fare', 'Operator', 'Booked by'];
    const passCols = [60, 90, 90, 60, 70, 90, 90];
    let x = doc.page.margins.left;
    let y = doc.y;
    passHeaders.forEach((h, i) => {
      doc.text(h, x, y, { width: passCols[i], continued: i < passHeaders.length - 1 });
      x += passCols[i];
    });
    doc.moveDown(0.2);
    y = doc.y;
    passengers.forEach((p) => {
      x = doc.page.margins.left;
      const dest = titleCase(p.destination);
      const row = [
        p.pnr,
        p.customer_name || '',
        dest,
        p.travel_date || '',
        formatCurrency(p.total_fare),
        p.bus_operator || '',
        p.employee_name || '',
      ];
      row.forEach((val, i) => {
        doc.text(String(val), x, y, { width: passCols[i], continued: i < row.length - 1 });
        x += passCols[i];
      });
      y += 12;
      if (y > doc.page.height - doc.page.margins.bottom - 80) {
        doc.addPage();
        y = doc.page.margins.top;
      }
    });

    doc.addPage();

    // Parcel table
    drawHeader(doc, `Summary Report (${from} to ${to}) - Parcels`);
    doc.fontSize(12).text('Parcel bookings', { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(9);

    const parcelHeaders = ['PNR', 'Sender', 'Receiver', 'Destination', 'Boxes', 'Rate', 'Status'];
    const parcelCols = [60, 90, 90, 90, 40, 70, 80];
    x = doc.page.margins.left;
    y = doc.y;
    parcelHeaders.forEach((h, i) => {
      doc.text(h, x, y, { width: parcelCols[i], continued: i < parcelHeaders.length - 1 });
      x += parcelCols[i];
    });
    doc.moveDown(0.2);
    y = doc.y;

    parcels.forEach((p) => {
      x = doc.page.margins.left;
      const dest = titleCase(p.destination);
      const rate =
        p.rate_fare && p.rate_fare > 0
          ? p.rate_fare
          : (Number(p.price_per_box) || 0) * (p.num_boxes || 0) +
            (Number(p.loading_charges) || 0) +
            (Number(p.unloading_charges) || 0);
      let status = 'Pending';
      if (p.part_b_returned) status = 'Completed';
      else if (p.bus_assigned) status = 'On bus';
      const row = [
        p.pnr,
        p.sender_name || '',
        p.receiver_name || '',
        dest,
        p.num_boxes || 0,
        formatCurrency(rate),
        status,
      ];
      row.forEach((val, i) => {
        doc.text(String(val), x, y, { width: parcelCols[i], continued: i < row.length - 1 });
        x += parcelCols[i];
      });
      y += 12;
      if (y > doc.page.height - doc.page.margins.bottom - 80) {
        doc.addPage();
        y = doc.page.margins.top;
      }
    });

    drawFooter(doc);

    doc.end();

    stream.on('finish', () => resolve(filepath));
    stream.on('error', reject);
  });
}

module.exports = { passengerPartA, passengerPartB, parcelPartB, reportPdf, outputDir };
