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

function passengerPartA_A4(booking) {
  return new Promise((resolve, reject) => {
    const filename = `passenger-${booking.pnr}-partA-A4.pdf`;
    const filepath = path.join(outputDir, filename);
    const doc = new PDFDocument({ size: 'A4', margin: 40 });

    const stream = fs.createWriteStream(filepath);
    doc.pipe(stream);

    drawHeader(doc, 'Passenger Ticket (A4 Copy)');

    doc
      .fontSize(11)
      .fillColor('#555555')
      .text(`PNR: ${booking.pnr}`, { align: 'right' });
    doc.moveDown(0.4);

    const from = titleCase(booking.from_place);
    const to = titleCase(booking.destination);

    doc.fontSize(13).fillColor('#000000').text('Passenger & Journey', { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(11);
    doc.text(`Passenger: ${booking.customer_name || ''}`);
    doc.text(`Phone: ${booking.customer_phone || ''}`);
    if (booking.customer_email) doc.text(`Email: ${booking.customer_email}`);
    if (booking.customer_age) doc.text(`Age: ${booking.customer_age}`);
    if (booking.boarding_point) doc.text(`Boarding point: ${booking.boarding_point}`);
    doc.moveDown(0.4);
    doc.text(`From: ${from}`);
    doc.text(`To: ${to}`);
    doc.text(`Date: ${booking.travel_date || ''}`);
    doc.text(`Seat(s): ${booking.seat_number || ''}`);
    doc.text(`Operator: ${booking.bus_operator || ''}`);
    doc.text(`Departure: ${to12Hour(booking.departure_time)}`);
    doc.moveDown(0.6);

    doc.fontSize(13).text('Fare', { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(11).text(`Fare collected: ${formatCurrency(booking.total_fare)}`);

    drawFooter(doc);
    doc.end();

    stream.on('finish', () => resolve({ filepath, filename }));
    stream.on('error', reject);
  });
}

function createThermalDoc() {
  // 80mm paper width ≈ 226.77 pt
  const doc = new PDFDocument({ size: [226.77, 520], margin: 12 });
  // mark the document so helpers can adjust layout/font if needed
  doc._isThermal = true;
  return doc;
}

function passengerPartA(booking) {
  return new Promise((resolve, reject) => {
    const filename = `passenger-${booking.pnr}-partA-thermal.pdf`;
    const filepath = path.join(outputDir, filename);
    const doc = createThermalDoc();

    const stream = fs.createWriteStream(filepath);
    doc.pipe(stream);

    drawHeader(doc, 'Passenger Ticket - Part A (Thermal)');

    // PNR row - bold and large for readability
    doc.font('Helvetica-Bold').fontSize(14).fillColor('#000000').text(`PNR: ${booking.pnr}`, { align: 'right' });
    doc.moveDown(0.3);

    // Passenger section - bold headings, larger body
    doc.font('Helvetica-Bold').fontSize(14).text('Passenger Details', { underline: true });
    doc.moveDown(0.35);
    doc.font('Helvetica').fontSize(12);
    doc.text(`Name: ${booking.customer_name || ''}`);
    doc.moveDown(0.15);
    doc.text(`Phone: ${booking.customer_phone || ''}`);
    if (booking.customer_email) { doc.moveDown(0.1); doc.text(`Email: ${booking.customer_email}`); }
    if (booking.customer_age) { doc.moveDown(0.1); doc.text(`Age: ${booking.customer_age}`); }
    doc.moveDown(0.4);

    // Journey section
    const from = titleCase(booking.from_place);
    const to = titleCase(booking.destination);

    doc.font('Helvetica-Bold').fontSize(14).text('Journey Details', { underline: true });
    doc.moveDown(0.35);
    doc.font('Helvetica').fontSize(12);
    doc.text(`From: ${from}`);
    doc.moveDown(0.12);
    doc.text(`To: ${to}`);
    doc.moveDown(0.12);
    doc.text(`Date: ${booking.travel_date || ''}`);
    doc.moveDown(0.12);
    doc.text(`Seat: ${booking.seat_number || ''}`);
    doc.moveDown(0.12);
    doc.text(`Operator: ${booking.bus_operator || ''}`);
    doc.moveDown(0.12);
    doc.text(`Departure: ${to12Hour(booking.departure_time)}`);
    doc.moveDown(0.45);

    // Fare section (customer-facing only) - visible but spaced
    doc.font('Helvetica-Bold').fontSize(14).text('Fare Details', { underline: true });
    doc.moveDown(0.25);
    doc.font('Helvetica').fontSize(12).text(`Fare collected: ${formatCurrency(booking.total_fare)}`);
    doc.moveDown(0.6);

    doc.font('Helvetica-Bold').fontSize(10).fillColor('#555555').text('- Customer Copy -', { align: 'center' });

    drawFooter(doc);
    doc.end();

    stream.on('finish', () => resolve({ filepath, filename }));
    stream.on('error', reject);
  });
}

function passengerPartB(booking) {
  return new Promise((resolve, reject) => {
    const filename = `passenger-${booking.pnr}-partB-thermal.pdf`;
    const filepath = path.join(outputDir, filename);
    const doc = createThermalDoc();

    const stream = fs.createWriteStream(filepath);
    doc.pipe(stream);

    drawHeader(doc, 'Passenger Ticket - Part B (Thermal)');

    // PNR - big and bold for driver visibility
    doc.font('Helvetica-Bold').fontSize(14).fillColor('#000000').text(`PNR: ${booking.pnr}`, { align: 'right' });
    doc.moveDown(0.3);

    doc.font('Helvetica-Bold').fontSize(14).fillColor('#000000').text('Passenger Details', { underline: true });
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(12);
    doc.text(`Name: ${booking.customer_name || ''}`);
    doc.moveDown(0.12);
    doc.text(`Phone: ${booking.customer_phone || ''}`);
    doc.moveDown(0.4);

    const from = titleCase(booking.from_place);
    const to = titleCase(booking.destination);

    doc.font('Helvetica-Bold').fontSize(14).text('Journey Details', { underline: true });
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(12);
    doc.text(`From: ${from}`);
    doc.moveDown(0.12);
    doc.text(`To: ${to}`);
    doc.moveDown(0.12);
    doc.text(`Date: ${booking.travel_date || ''}`);
    doc.moveDown(0.12);
    doc.text(`Seat: ${booking.seat_number || ''}`);
    doc.moveDown(0.12);
    doc.text(`Operator: ${booking.bus_operator || ''}`);
    doc.moveDown(0.5);

    doc.font('Helvetica-Bold').fontSize(10).fillColor('#555555').text('Driver copy', { align: 'center' });

    drawFooter(doc);

    doc.end();

    stream.on('finish', () => resolve({ filepath, filename }));
    stream.on('error', reject);
  });
}

function parcelPartB(booking) {
  return new Promise((resolve, reject) => {
    const filename = `parcel-${booking.pnr}-partB-thermal.pdf`;
    const filepath = path.join(outputDir, filename);
    const doc = createThermalDoc();

    const stream = fs.createWriteStream(filepath);
    doc.pipe(stream);

    drawHeader(doc, 'Parcel Waybill - Part B (Thermal)');

    doc.font('Helvetica-Bold').fontSize(14).fillColor('#000000').text(`PNR: ${booking.pnr}`, { align: 'right' });
    doc.moveDown(0.3);

    doc.font('Helvetica-Bold').fontSize(14).text('Sender / Receiver', { underline: true });
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(12);
    doc.text(`Sender: ${booking.sender_name || ''}`);
    doc.moveDown(0.12);
    doc.text(`Phone: ${booking.sender_phone || ''}`);
    doc.moveDown(0.18);
    doc.text(`Receiver: ${booking.receiver_name || ''}`);
    doc.moveDown(0.12);
    doc.text(`Phone: ${booking.receiver_phone || ''}`);
    doc.moveDown(0.4);

    const destination = titleCase(booking.destination);

    doc.font('Helvetica-Bold').fontSize(14).text('Parcel / Journey', { underline: true });
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(12);
    doc.text(`Destination: ${destination}`);
    doc.moveDown(0.12);
    doc.text(`No. of parcels: ${booking.num_boxes || 0}`);
    if (booking.bus_assigned) { doc.moveDown(0.12); doc.text(`Bus: ${booking.bus_assigned}`); }
    if (booking.bus_number) { doc.moveDown(0.12); doc.text(`Bus no: ${booking.bus_number}`); }
    if (booking.bus_departure_time) { doc.moveDown(0.12); doc.text(`Departure: ${to12Hour(booking.bus_departure_time)}`); }
    doc.moveDown(0.4);

    doc.font('Helvetica-Bold').fontSize(10).fillColor('#555555').text('Driver copy', { align: 'center' });

    drawFooter(doc);

    doc.end();

    stream.on('finish', () => resolve({ filepath, filename }));
    stream.on('error', reject);
  });
}

function parcelReceipt_A4(booking) {
  return new Promise((resolve, reject) => {
    const filename = `parcel-${booking.pnr}-receipt-A4.pdf`;
    const filepath = path.join(outputDir, filename);
    const doc = new PDFDocument({ size: 'A4', margin: 40 });

    const stream = fs.createWriteStream(filepath);
    doc.pipe(stream);

    drawHeader(doc, 'Parcel Receipt (A4 Copy)');

    doc
      .fontSize(11)
      .fillColor('#555555')
      .text(`PNR: ${booking.pnr}`, { align: 'right' });
    doc.moveDown(0.4);

    const destination = titleCase(booking.destination);

    doc.fontSize(13).fillColor('#000000').text('Sender / Receiver', { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(11);
    doc.text(`Sender: ${booking.sender_name || ''} | ${booking.sender_phone || ''}`);
    if (booking.sender_address) doc.text(`Sender address: ${booking.sender_address}`);
    doc.moveDown(0.2);
    doc.text(`Receiver: ${booking.receiver_name || ''} | ${booking.receiver_phone || ''}`);
    if (booking.receiver_address) doc.text(`Receiver address: ${booking.receiver_address}`);
    doc.moveDown(0.5);

    doc.fontSize(13).text('Parcel', { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(11);
    doc.text(`Destination: ${destination}`);
    doc.text(`Boxes: ${booking.num_boxes || 0}`);

    const baseRate = (Number(booking.price_per_box) || 0) * (Number(booking.num_boxes) || 0);
    const loading = Number(booking.loading_charges) || 0;
    const unloading = Number(booking.unloading_charges) || 0;
    const total = baseRate + loading + unloading;

    doc.moveDown(0.4);
    doc.fontSize(13).text('Charges', { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(11);
    doc.text(`Base rate: ${formatCurrency(baseRate)}`);
    doc.text(`Loading charges: ${formatCurrency(loading)}`);
    doc.text(`Unloading charges: ${formatCurrency(unloading)}`);
    doc.text(`Total collected: ${formatCurrency(total)}`);

    if (booking.bus_assigned || booking.bus_departure_time) {
      doc.moveDown(0.5);
      doc.fontSize(13).text('Bus assignment', { underline: true });
      doc.moveDown(0.3);
      doc.fontSize(11);
      if (booking.bus_assigned) doc.text(`Bus / Operator: ${booking.bus_assigned}`);
      if (booking.bus_number) doc.text(`Bus number: ${booking.bus_number}`);
      if (booking.driver_name) doc.text(`Driver: ${booking.driver_name}`);
      if (booking.driver_phone) doc.text(`Driver phone: ${booking.driver_phone}`);
      if (booking.lr_number) doc.text(`LR number: ${booking.lr_number}`);
      if (booking.bus_departure_time) doc.text(`Departure: ${to12Hour(booking.bus_departure_time)}`);
    }

    drawFooter(doc);
    doc.end();

    stream.on('finish', () => resolve({ filepath, filename }));
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

    function drawTable(headers, colWidths, rows) {
      const startX = doc.page.margins.left;
      const rowH = 14;
      let y = doc.y;

      // header background
      doc.save();
      doc.rect(startX, y - 2, colWidths.reduce((a, b) => a + b, 0), rowH + 4).fill('#f2f2f2');
      doc.restore();

      doc.fillColor('#000000').fontSize(9);
      let x = startX;
      headers.forEach((h, i) => {
        doc.text(h, x + 2, y, { width: colWidths[i] - 4, align: 'left' });
        x += colWidths[i];
      });
      y += rowH + 6;

      rows.forEach((r) => {
        if (y > doc.page.height - doc.page.margins.bottom - 40) {
          doc.addPage();
          y = doc.page.margins.top;
        }
        x = startX;
        r.forEach((val, i) => {
          doc.text(String(val), x + 2, y, { width: colWidths[i] - 4, align: 'left' });
          x += colWidths[i];
        });
        y += rowH;
      });

      doc.moveDown(0.5);
      doc.y = y;
    }

    // Passenger table
    doc.fontSize(12).fillColor('#000000').text('Passenger bookings', { underline: true });
    doc.moveDown(0.3);
    const passHeaders = ['PNR', 'Customer', 'Destination', 'Date', 'Rate fare', 'Operator', 'Booked by'];
    const passCols = [70, 110, 110, 70, 80, 110, 110];
    const passRows = passengers.map((p) => [
      p.pnr,
      p.customer_name || '',
      titleCase(p.destination),
      p.travel_date || '',
      formatCurrency(p.total_fare),
      p.bus_operator || '',
      p.employee_name || '',
    ]);
    drawTable(passHeaders, passCols, passRows);

    doc.addPage();

    // Parcel table
    drawHeader(doc, `Summary Report (${from} to ${to}) - Parcels`);
    doc.fontSize(12).text('Parcel bookings', { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(9);

    const parcelHeaders = ['PNR', 'Sender', 'Receiver', 'Destination', 'Boxes', 'Rate', 'Status'];
    const parcelCols = [70, 120, 120, 120, 50, 90, 90];
    const parcelRows = parcels.map((p) => {
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
      return [
        p.pnr,
        p.sender_name || '',
        p.receiver_name || '',
        dest,
        p.num_boxes || 0,
        formatCurrency(rate),
        status,
      ];
    });
    drawTable(parcelHeaders, parcelCols, parcelRows);

    drawFooter(doc);

    doc.end();

    stream.on('finish', () => resolve(filepath));
    stream.on('error', reject);
  });
}

module.exports = {
  passengerPartA,
  passengerPartB,
  passengerPartA_A4,
  parcelPartB,
  parcelReceipt_A4,
  reportPdf,
  outputDir,
};
