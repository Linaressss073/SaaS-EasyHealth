import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendMailMock = vi.fn();

vi.mock('nodemailer', () => ({
  default: {
    createTransport: () => ({ sendMail: sendMailMock }),
  },
}));

vi.mock('./Env', () => ({
  Env: {
    MAILTRAP_HOST: 'sandbox.smtp.mailtrap.io',
    MAILTRAP_PORT: 2525,
    MAILTRAP_USER: 'user',
    MAILTRAP_PASS: 'pass',
    MAIL_FROM_ADDRESS: 'no-reply@easyhealth.dev',
    MAIL_FROM_NAME: 'EasyHealth',
    CLERK_WEBHOOK_SIGNING_SECRET: 'whsec_test',
  },
}));

const { sendWelcomeEmail } = await import('./Mail');

describe('sendWelcomeEmail', () => {
  beforeEach(() => {
    sendMailMock.mockReset();
    sendMailMock.mockResolvedValue(undefined);
  });

  it('sends a welcome email to the given address', async () => {
    await sendWelcomeEmail({ to: 'paciente@example.com', name: 'Ana' });

    expect(sendMailMock).toHaveBeenCalledTimes(1);
    const [args] = sendMailMock.mock.calls[0] as [{ to: string; subject: string; html: string; text: string }];
    expect(args.to).toBe('paciente@example.com');
    expect(args.subject).toContain('Bienvenido');
    expect(args.html).toContain('Ana');
    expect(args.text).toContain('Ana');
  });

  it('propagates errors when sending fails', async () => {
    sendMailMock.mockRejectedValueOnce(new Error('SMTP down'));

    await expect(sendWelcomeEmail({ to: 'paciente@example.com', name: 'Ana' })).rejects.toThrow('SMTP down');
  });
});
