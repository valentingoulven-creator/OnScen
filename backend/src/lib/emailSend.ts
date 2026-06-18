import nodemailer from 'nodemailer';
import { Resend } from 'resend';

let _transporter: nodemailer.Transporter | null = null;
let _resend: Resend | null = null;

function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  if (!_resend) _resend = new Resend(apiKey);
  return _resend;
}

function getTransporter(): nodemailer.Transporter | null {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT ?? '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) return null;

  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  }
  return _transporter;
}

export function isEmailConfigured(): boolean {
  if (process.env.RESEND_API_KEY) return true;
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  return !!(host && user && pass);
}

export function getEmailFrom(fallbackName = 'Soundy'): string {
  if (process.env.RESEND_FROM) return process.env.RESEND_FROM;
  if (process.env.SMTP_FROM) return process.env.SMTP_FROM;
  if (process.env.RESEND_API_KEY) return `${fallbackName} <onboarding@resend.dev>`;
  return `${fallbackName} <${process.env.SMTP_USER}>`;
}

export async function sendEmail(params: {
  to: string | string[];
  subject: string;
  text: string;
  html: string;
  from?: string;
}): Promise<void> {
  const from = params.from ?? getEmailFrom();
  const toList = Array.isArray(params.to) ? params.to : [params.to];

  const resend = getResend();
  if (resend) {
    const { error } = await resend.emails.send({
      from,
      to: toList,
      subject: params.subject,
      text: params.text,
      html: params.html,
    });
    if (error) throw error;
    return;
  }

  const transporter = getTransporter();
  if (!transporter) throw new Error('Email non configuré (RESEND_API_KEY ou SMTP_*)');

  await transporter.sendMail({
    from,
    to: toList.join(', '),
    subject: params.subject,
    text: params.text,
    html: params.html,
  });
}
