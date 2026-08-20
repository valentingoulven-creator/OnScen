import nodemailer from 'nodemailer';
import { Resend } from 'resend';

let _transporter: nodemailer.Transporter | null = null;
let _resend: Resend | null = null;

function smtpVarsPresent(): boolean {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  return !!(host && user && pass);
}

/** SMTP outbound is blocked on Scaleway VPS; only use when explicitly enabled (local dev). */
function isSmtpEnabled(): boolean {
  if (!smtpVarsPresent()) return false;
  const flag = process.env.SMTP_ENABLED?.trim().toLowerCase();
  if (flag === 'true' || flag === '1' || flag === 'yes') return true;
  if (flag === 'false' || flag === '0' || flag === 'no') return false;
  const appEnv = process.env.APP_ENV?.trim().toLowerCase();
  return appEnv !== 'production';
}

function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return null;
  if (!_resend) _resend = new Resend(apiKey);
  return _resend;
}

function getTransporter(): nodemailer.Transporter | null {
  if (!isSmtpEnabled()) return null;

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
  if (process.env.RESEND_API_KEY?.trim()) return true;
  return isSmtpEnabled();
}

export function isResendSandboxFrom(from: string): boolean {
  return /@resend\.dev\b/i.test(from);
}

/** Health / startup : clé présente mais From sandbox = pas prêt pour la prod. */
export function isProductionEmailMisconfigured(): boolean {
  if (process.env.APP_ENV !== 'production') return false;
  const from = process.env.RESEND_FROM?.trim() || process.env.SMTP_FROM?.trim() || '';
  if (!process.env.RESEND_API_KEY?.trim() && !isSmtpEnabled()) return true;
  return Boolean(from) && isResendSandboxFrom(from);
}

function assertProductionFrom(from: string): void {
  if (process.env.APP_ENV === 'production' && isResendSandboxFrom(from)) {
    throw new Error(
      'RESEND_FROM utilise encore @resend.dev en production. Utilisez OnScen <noreply@onscen.com> (domaine vérifié) et une clé API Production.',
    );
  }
}

function wrapResendError(error: unknown): Error {
  const msg =
    error && typeof error === 'object' && 'message' in error
      ? String((error as { message: unknown }).message)
      : String(error);
  if (/testing emails|own email address/i.test(msg)) {
    return new Error(
      'Resend refuse l’envoi : la clé API est encore en mode test (sandbox). ' +
        'Créez une clé Production sur resend.com/api-keys, vérifiez le domaine onscen.com, ' +
        'puis mettez à jour RESEND_API_KEY sur le VPS (/opt/onscen/.env) et redémarrez PM2.',
    );
  }
  if (error instanceof Error) return error;
  return new Error(msg);
}

export function getEmailFrom(fallbackName = 'OnScen'): string {
  if (process.env.RESEND_FROM) {
    assertProductionFrom(process.env.RESEND_FROM);
    return process.env.RESEND_FROM;
  }
  if (process.env.SMTP_FROM) {
    assertProductionFrom(process.env.SMTP_FROM);
    return process.env.SMTP_FROM;
  }
  if (process.env.APP_ENV === 'production') {
    throw new Error('RESEND_FROM ou SMTP_FROM obligatoire en production');
  }
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
  assertProductionFrom(from);
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
    if (error) throw wrapResendError(error);
    return;
  }

  const transporter = getTransporter();
  if (!transporter) {
    throw new Error(
      'Email non configuré (RESEND_API_KEY requis en production; SMTP désactivé ou incomplet)',
    );
  }

  await transporter.sendMail({
    from,
    to: toList.join(', '),
    subject: params.subject,
    text: params.text,
    html: params.html,
  });
}
