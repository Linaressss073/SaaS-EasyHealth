import nodemailer from 'nodemailer';
import { Env } from './Env';

const transporter = nodemailer.createTransport({
  host: Env.MAILTRAP_HOST,
  port: Env.MAILTRAP_PORT,
  auth: {
    user: Env.MAILTRAP_USER,
    pass: Env.MAILTRAP_PASS,
  },
});

export type SendMailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export async function sendMail({ to, subject, html, text }: SendMailInput): Promise<void> {
  try {
    await transporter.sendMail({
      from: `"${Env.MAIL_FROM_NAME}" <${Env.MAIL_FROM_ADDRESS}>`,
      to,
      subject,
      html,
      text,
    });
  } catch (error) {
    console.error(`[mail] failed to send "${subject}" to ${to}`, error);
    throw error;
  }
}

export type SendWelcomeEmailInput = {
  to: string;
  name: string;
};

export async function sendWelcomeEmail({ to, name }: SendWelcomeEmailInput): Promise<void> {
  await sendMail({
    to,
    subject: 'Bienvenido/a a EasyHealth',
    text: `Hola ${name}, bienvenido/a a EasyHealth. Tu cuenta ya está lista para usarse.`,
    html: `<p>Hola ${name},</p><p>Bienvenido/a a EasyHealth. Tu cuenta ya está lista para usarse.</p>`,
  });
}
