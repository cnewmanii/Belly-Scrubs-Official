import nodemailer from "nodemailer";
import { log } from "./index";
import type { Booking } from "@shared/schema";

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.office365.com",
      port: parseInt(process.env.SMTP_PORT || "587", 10),
      secure: false, // STARTTLS
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: {
        ciphers: "SSLv3",
        rejectUnauthorized: false,
      },
    });
  }
  return transporter;
}

function getFromAddress(): string {
  return process.env.SMTP_FROM || process.env.SMTP_USER || "info@bellyscrubs.com";
}

function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, "0")} ${period}`;
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Send the customer a booking quote email with price breakdown.
 */
export async function sendCustomerBookingEmail(booking: Booking): Promise<void> {
  const mail = getTransporter();
  const from = getFromAddress();

  const addOnsText = booking.addOns && booking.addOns.length > 0
    ? booking.addOns.join(", ")
    : "None";

  const depositNote = booking.depositStatus === "paid"
    ? `<p style="color: #16a34a; font-weight: bold;">✓ $25.00 non-refundable deposit received</p>
       <p>Remaining balance due at time of service: <strong>$${Math.max(0, booking.totalPrice - 25).toFixed(2)}</strong></p>`
    : `<p>Full balance of <strong>$${booking.totalPrice.toFixed(2)}</strong> due at time of service.</p>`;

  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #7ab8d0;">
        <h1 style="color: #1a2a33; margin: 0;">Belly scRubs</h1>
        <p style="color: #6b7280; margin: 5px 0 0;">Pet Grooming & Self-Service Dog Wash</p>
      </div>

      <div style="padding: 30px 0;">
        <h2 style="color: #1a2a33;">Hi ${booking.customerName}!</h2>
        <p>Thank you for booking with Belly scRubs. Here's your appointment quote:</p>

        <div style="background: #f0f7fa; border-radius: 12px; padding: 20px; margin: 20px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Service</td>
              <td style="padding: 8px 0; text-align: right; font-weight: 600;">${booking.serviceName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Add-ons</td>
              <td style="padding: 8px 0; text-align: right;">${addOnsText}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Date</td>
              <td style="padding: 8px 0; text-align: right; font-weight: 600;">${formatDate(booking.date)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Time</td>
              <td style="padding: 8px 0; text-align: right;">${formatTime(booking.time)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Pet</td>
              <td style="padding: 8px 0; text-align: right;">${booking.petName}${booking.petBreed ? ` (${booking.petBreed})` : ""}</td>
            </tr>
            <tr style="border-top: 1px solid #d1d5db;">
              <td style="padding: 12px 0 8px; font-weight: 700; font-size: 16px;">Estimated Total</td>
              <td style="padding: 12px 0 8px; text-align: right; font-weight: 700; font-size: 18px;">$${booking.totalPrice.toFixed(2)}</td>
            </tr>
          </table>
        </div>

        ${depositNote}

        <p style="color: #6b7280; font-size: 14px;">
          <strong>Please note:</strong> Final pricing may vary after consultation based on coat condition, matting, and temperament.
          We'll call you to confirm your appointment details.
        </p>

        <p style="color: #6b7280; font-size: 14px;">
          <strong>Cancellation Policy:</strong> We require 24-hour notice for cancellations or rescheduling.
          Late cancellations or no-shows may be subject to a fee.
        </p>
      </div>

      <div style="border-top: 2px solid #7ab8d0; padding: 20px 0; text-align: center; color: #6b7280; font-size: 13px;">
        <p style="margin: 0;"><strong>Belly scRubs</strong></p>
        <p style="margin: 4px 0;">119 State Route 34, Suite 1 • Hurricane, WV 25526</p>
        <p style="margin: 4px 0;">(304) 760-8989 • info@bellyscrubs.com</p>
      </div>
    </div>
  `;

  try {
    await mail.sendMail({
      from,
      to: booking.customerEmail,
      subject: `Your Belly scRubs Booking Quote - ${formatDate(booking.date)}`,
      html,
    });
    log(`Customer email sent to ${booking.customerEmail}`, "email");
  } catch (error: any) {
    log(`Failed to send customer email: ${error.message}`, "email");
  }
}

/**
 * Send staff notification email with booking details, photo attachment, and approval link.
 */
export async function sendStaffBookingEmail(
  booking: Booking,
  photoPath: string | null,
  approvalToken: string
): Promise<void> {
  const mail = getTransporter();
  const from = getFromAddress();
  const staffEmail = "info@bellyscrubs.com";

  const addOnsText = booking.addOns && booking.addOns.length > 0
    ? booking.addOns.join(", ")
    : "None";

  const baseUrl = process.env.REPLIT_DOMAINS
    ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`
    : "https://bellyscrubs.com";

  const approvalUrl = `${baseUrl}/api/bookings/${booking.id}/approve?token=${approvalToken}`;

  const depositInfo = booking.depositStatus === "paid"
    ? "✅ $25 DEPOSIT PAID"
    : "⚠️ No deposit collected (deposit disabled)";

  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #1a2a33; color: white; padding: 15px 20px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0;">🐾 New Online Booking Request</h2>
      </div>

      <div style="border: 1px solid #e5e7eb; border-top: none; padding: 20px; border-radius: 0 0 8px 8px;">
        <p style="font-size: 16px; font-weight: 600; color: #dc2626;">${depositInfo}</p>

        <h3 style="color: #1a2a33; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px;">Customer Info</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
          <tr><td style="padding: 4px 0; color: #6b7280; width: 120px;">Name</td><td style="padding: 4px 0; font-weight: 600;">${booking.customerName}</td></tr>
          <tr><td style="padding: 4px 0; color: #6b7280;">Phone</td><td style="padding: 4px 0;"><a href="tel:${booking.customerPhone}">${booking.customerPhone}</a></td></tr>
          <tr><td style="padding: 4px 0; color: #6b7280;">Email</td><td style="padding: 4px 0;"><a href="mailto:${booking.customerEmail}">${booking.customerEmail}</a></td></tr>
        </table>

        <h3 style="color: #1a2a33; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px;">Appointment</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
          <tr><td style="padding: 4px 0; color: #6b7280; width: 120px;">Service</td><td style="padding: 4px 0; font-weight: 600;">${booking.serviceName}</td></tr>
          <tr><td style="padding: 4px 0; color: #6b7280;">Add-ons</td><td style="padding: 4px 0;">${addOnsText}</td></tr>
          <tr><td style="padding: 4px 0; color: #6b7280;">Date</td><td style="padding: 4px 0; font-weight: 600;">${formatDate(booking.date)}</td></tr>
          <tr><td style="padding: 4px 0; color: #6b7280;">Time</td><td style="padding: 4px 0;">${formatTime(booking.time)}</td></tr>
          <tr><td style="padding: 4px 0; color: #6b7280;">Est. Total</td><td style="padding: 4px 0; font-weight: 600; font-size: 18px;">$${booking.totalPrice.toFixed(2)}</td></tr>
        </table>

        <h3 style="color: #1a2a33; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px;">Pet</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
          <tr><td style="padding: 4px 0; color: #6b7280; width: 120px;">Name</td><td style="padding: 4px 0; font-weight: 600;">${booking.petName}</td></tr>
          ${booking.petBreed ? `<tr><td style="padding: 4px 0; color: #6b7280;">Breed</td><td style="padding: 4px 0;">${booking.petBreed}</td></tr>` : ""}
          ${booking.notes ? `<tr><td style="padding: 4px 0; color: #6b7280;">Notes</td><td style="padding: 4px 0;">${booking.notes}</td></tr>` : ""}
        </table>

        <p style="font-size: 13px; color: #6b7280;">Pre-groom photo is attached below. Please review, call the customer to confirm, then click the button to approve.</p>

        <div style="text-align: center; margin: 24px 0;">
          <a href="${approvalUrl}"
             style="display: inline-block; background: #16a34a; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
            ✓ Approve & Create Square Appointment
          </a>
        </div>

        <p style="font-size: 12px; color: #9ca3af; text-align: center;">
          Booking ID: ${booking.id}
        </p>
      </div>
    </div>
  `;

  const attachments: nodemailer.Attachment[] = [];
  if (photoPath) {
    attachments.push({
      filename: `pre-groom-${booking.petName.toLowerCase().replace(/\s+/g, "-")}.jpg`,
      path: photoPath,
      cid: "petphoto",
    });
  }

  try {
    await mail.sendMail({
      from,
      to: staffEmail,
      subject: `🐾 New Booking: ${booking.petName} - ${booking.serviceName} on ${formatDate(booking.date)}`,
      html,
      attachments,
    });
    log(`Staff notification sent to ${staffEmail}`, "email");
  } catch (error: any) {
    log(`Failed to send staff email: ${error.message}`, "email");
  }
}

/**
 * Send confirmation email to customer after staff approves the booking.
 */
export async function sendBookingApprovedEmail(booking: Booking): Promise<void> {
  const mail = getTransporter();
  const from = getFromAddress();

  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #7ab8d0;">
        <h1 style="color: #1a2a33; margin: 0;">Belly scRubs</h1>
      </div>

      <div style="padding: 30px 0; text-align: center;">
        <div style="width: 60px; height: 60px; background: #dcfce7; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px;">
          <span style="font-size: 28px;">✓</span>
        </div>
        <h2 style="color: #1a2a33;">Your Appointment is Confirmed!</h2>
        <p style="color: #6b7280;">
          Great news, ${booking.customerName}! Your grooming appointment for <strong>${booking.petName}</strong> has been confirmed.
        </p>

        <div style="background: #f0f7fa; border-radius: 12px; padding: 20px; margin: 20px 0; text-align: left;">
          <p style="margin: 4px 0;"><strong>Date:</strong> ${formatDate(booking.date)}</p>
          <p style="margin: 4px 0;"><strong>Time:</strong> ${formatTime(booking.time)}</p>
          <p style="margin: 4px 0;"><strong>Service:</strong> ${booking.serviceName}</p>
          <p style="margin: 4px 0;"><strong>Location:</strong> 119 State Route 34, Suite 1, Hurricane, WV 25526</p>
        </div>

        <p style="color: #6b7280; font-size: 14px;">
          Please arrive 5 minutes early. If you need to cancel or reschedule, contact us at least 24 hours in advance.
        </p>
      </div>

      <div style="border-top: 2px solid #7ab8d0; padding: 20px 0; text-align: center; color: #6b7280; font-size: 13px;">
        <p style="margin: 0;">(304) 760-8989 • info@bellyscrubs.com</p>
      </div>
    </div>
  `;

  try {
    await mail.sendMail({
      from,
      to: booking.customerEmail,
      subject: `✓ Appointment Confirmed - ${booking.petName} at Belly scRubs`,
      html,
    });
    log(`Approval confirmation sent to ${booking.customerEmail}`, "email");
  } catch (error: any) {
    log(`Failed to send approval email: ${error.message}`, "email");
  }
}
