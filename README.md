# Ratna CT Travels Management App

A web app for managing passenger and parcel bookings, operator settlements, and daily operations for Ratna CT Travels in Mumbai.

## Tech stack

- **Node.js** + **Express**
- **SQLite** (better-sqlite3)
- **EJS** templates
- **PDFKit** for Part A / Part B tickets
- **Nodemailer** for email
- **bcrypt** + **express-session** for login

## Setup

1. Install dependencies (if not already done):
   ```bash
   npm install
   ```

2. Seed the database (creates tables and default employees):
   ```bash
   npm run seed
   ```
   Default logins: `admin` / `admin123`, `staff1` / `admin123`, `staff2` / `admin123`.

3. Optional: copy `.env.example` to `.env` and set:
   - `SESSION_SECRET` – for production
   - `SMTP_*` – to send ticket PDFs by email
   - `PUBLIC_BASE_URL` and `MEDIA_TOKEN` – if you want generated PDFs to be accessible via links included in WhatsApp messages

4. Start the app:
   ```bash
   npm start
   ```
   Open http://localhost:3000 and log in.

## Features

- **Login** – Multiple employees (name, username, password, role). Creator is stored with each booking.
- **Passenger bookings** – Customer details, from/destination/date/seat, operator/departure, fare & commission, auto PNR, Part A (with rates) and Part B (without rates), email PDF and WhatsApp message.
- **Parcel bookings** – Sender/receiver, destination, boxes, price, loading/unloading charges, auto PNR, Part B for driver, WhatsApp to sender/receiver when bus is assigned.
- **Dashboard** – Today’s bookings and parcels, revenue, pending operator settlements, departure schedule.
- **Operator settlements** – Amount owed per operator, mark as settled when Part B is returned, operator-wise breakdown.
- **Customer database** – Returning customers auto-filled by phone on the booking form.
- **Responsive** – Usable on desktop, tablet, and mobile.

## Data location

- Database: `data/travel.db`
- Generated PDFs: `data/tickets/`

## WhatsApp

WhatsApp notifications use simple `wa.me` links (WhatsApp Web/mobile) with a prefilled message.
Attachments are not supported by `wa.me` URLs. The server generates the message and redirects users
to WhatsApp so they can send it from their device.

If you later want programmatic sending with media attachments, integrate a provider (e.g. Twilio) and
restore server-side API usage.
