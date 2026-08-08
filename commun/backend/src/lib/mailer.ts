import { getEmailFrom, isEmailConfigured, sendEmail } from './emailSend';

export async function sendSupportAlertEmail(params: {
  fromUsername: string;
  fromEmail: string;
  messageId: string;
  bodyPreview: string;
  isFollowUp?: boolean;
}): Promise<void> {
  if (!isEmailConfigured()) {
    if (process.env.APP_ENV === 'production') {
      console.warn('[mailer] Email non configuré — alerte support non envoyée. Ajouter RESEND_API_KEY ou SMTP_* dans .env');
    }
    return;
  }

  const adminEmail = process.env.SMTP_ADMIN_EMAIL ?? 'admin@getsoundy.com';
  const from = getEmailFrom('OnScen');
  const adminUrl = `${process.env.WEB_APP_URL ?? 'https://getsoundy.com'}/admin?tab=support`;

  const preview =
    params.bodyPreview.length > 300
      ? `${params.bodyPreview.slice(0, 297)}…`
      : params.bodyPreview;

  const subjectSuffix = params.isFollowUp ? '(réponse)' : '';
  const subject = `Nouveau message support OnScen - ${params.fromUsername} ${subjectSuffix}`.trim();

  const safePreview = preview
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <h2 style="color:#7c3aed;margin-top:0;">🎵 ${params.isFollowUp ? 'Réponse utilisateur' : 'Nouveau message'} support OnScen</h2>
      <table style="border-collapse:collapse;width:100%;margin-bottom:16px;">
        <tr>
          <td style="padding:4px 8px 4px 0;color:#6b7280;font-size:14px;white-space:nowrap;">Utilisateur</td>
          <td style="padding:4px 0;font-weight:600;">${params.fromUsername}</td>
        </tr>
        <tr>
          <td style="padding:4px 8px 4px 0;color:#6b7280;font-size:14px;white-space:nowrap;">Email</td>
          <td style="padding:4px 0;">${params.fromEmail}</td>
        </tr>
      </table>
      <div style="background:#f5f3ff;border-left:4px solid #7c3aed;padding:12px 16px;border-radius:4px;margin:16px 0;">
        <p style="margin:0;white-space:pre-wrap;font-size:15px;">${safePreview}</p>
      </div>
      <a href="${adminUrl}" style="display:inline-block;background:#7c3aed;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;margin-top:8px;">
        Voir dans l'admin →
      </a>
      <p style="color:#9ca3af;font-size:12px;margin-top:24px;">
        Notification automatique OnScen — <a href="${adminUrl}" style="color:#7c3aed;">getsoundy.com/admin</a>
      </p>
    </div>
  `;

  const text = [
    `${params.isFollowUp ? 'Réponse utilisateur' : 'Nouveau message'} support OnScen`,
    ``,
    `Utilisateur : ${params.fromUsername}`,
    `Email       : ${params.fromEmail}`,
    ``,
    `Message :`,
    preview,
    ``,
    `Voir dans l'admin : ${adminUrl}`,
  ].join('\n');

  try {
    await sendEmail({ from, to: adminEmail, subject, text, html });
    console.info(`[mailer] Email support envoyé à ${adminEmail} pour ${params.fromUsername}`);
  } catch (err) {
    console.error('[mailer] Échec envoi email support:', err);
  }
}

export async function sendVerificationEmail(params: {
  toEmail: string;
  username: string;
  verificationUrl: string;
}): Promise<void> {
  if (!isEmailConfigured()) {
    if (process.env.APP_ENV === 'production') {
      console.warn('[mailer] Email non configuré — email de vérification non envoyé.');
    }
    return;
  }

  const from = getEmailFrom('OnScen');
  const subject = 'Vérifie ton adresse e-mail — OnScen';

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <h2 style="color:#7c3aed;margin-top:0;">🎵 Bienvenue sur OnScen, ${params.username} !</h2>
      <p style="color:#374151;font-size:15px;">
        Clique sur le bouton ci-dessous pour vérifier ton adresse e-mail et activer ton compte.
      </p>
      <div style="text-align:center;margin:32px 0;">
        <a href="${params.verificationUrl}"
           style="display:inline-block;background:#7c3aed;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">
          Vérifier mon e-mail →
        </a>
      </div>
      <p style="color:#6b7280;font-size:13px;">
        Ce lien expire dans 24 heures. Si tu n'as pas créé de compte OnScen, ignore cet e-mail.
      </p>
      <p style="color:#9ca3af;font-size:12px;margin-top:24px;">
        OnScen — <a href="https://getsoundy.com" style="color:#7c3aed;">getsoundy.com</a>
      </p>
    </div>
  `;

  const text = [
    `Bienvenue sur OnScen, ${params.username} !`,
    ``,
    `Vérifie ton adresse e-mail en cliquant sur ce lien :`,
    params.verificationUrl,
    ``,
    `Ce lien expire dans 24 heures.`,
  ].join('\n');

  try {
    await sendEmail({ from, to: params.toEmail, subject, text, html });
    console.info(`[mailer] Email de vérification envoyé à ${params.toEmail}`);
  } catch (err) {
    console.error('[mailer] Échec envoi email de vérification:', err);
  }
}

export async function sendPasswordResetEmail(params: {
  toEmail: string;
  username: string;
  resetUrl: string;
}): Promise<void> {
  if (!isEmailConfigured()) {
    if (process.env.APP_ENV === 'production') {
      console.warn('[mailer] Email non configuré — email de réinitialisation non envoyé.');
    }
    return;
  }

  const from = getEmailFrom('OnScen');
  const subject = 'Réinitialisation de ton mot de passe — OnScen';

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <h2 style="color:#7c3aed;margin-top:0;">🔐 Réinitialisation de mot de passe</h2>
      <p style="color:#374151;font-size:15px;">
        Tu as demandé la réinitialisation de ton mot de passe OnScen pour le compte <strong>${params.username}</strong>.
      </p>
      <div style="text-align:center;margin:32px 0;">
        <a href="${params.resetUrl}"
           style="display:inline-block;background:#7c3aed;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">
          Réinitialiser mon mot de passe →
        </a>
      </div>
      <p style="color:#6b7280;font-size:13px;">
        Ce lien expire dans 1 heure. Si tu n'as pas fait cette demande, ignore cet e-mail — ton mot de passe ne sera pas modifié.
      </p>
      <p style="color:#9ca3af;font-size:12px;margin-top:24px;">
        OnScen — <a href="https://getsoundy.com" style="color:#7c3aed;">getsoundy.com</a>
      </p>
    </div>
  `;

  const text = [
    `Réinitialisation de mot de passe OnScen`,
    ``,
    `Compte : ${params.username}`,
    ``,
    `Clique sur ce lien pour réinitialiser ton mot de passe (expire dans 1 heure) :`,
    params.resetUrl,
    ``,
    `Si tu n'as pas fait cette demande, ignore cet e-mail.`,
  ].join('\n');

  try {
    await sendEmail({ from, to: params.toEmail, subject, text, html });
    console.info(`[mailer] Email de réinitialisation envoyé à ${params.toEmail}`);
  } catch (err) {
    console.error('[mailer] Échec envoi email de réinitialisation:', err);
  }
}
