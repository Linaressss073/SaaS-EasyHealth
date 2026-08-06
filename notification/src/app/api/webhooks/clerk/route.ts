import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { Env } from '@/libs/Env';
import { sendWelcomeEmail } from '@/libs/Mail';

export const runtime = 'nodejs';

type ClerkUserCreatedEvent = {
  type: string;
  data: {
    id: string;
    email_addresses: { id: string; email_address: string }[];
    primary_email_address_id: string | null;
    first_name: string | null;
    last_name: string | null;
  };
};

export async function POST(request: NextRequest) {
  const payload = await request.text();
  const svixId = request.headers.get('svix-id');
  const svixTimestamp = request.headers.get('svix-timestamp');
  const svixSignature = request.headers.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Missing svix headers' }, { status: 400 });
  }

  const webhook = new Webhook(Env.CLERK_WEBHOOK_SIGNING_SECRET);

  let event: ClerkUserCreatedEvent;
  try {
    event = webhook.verify(payload, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ClerkUserCreatedEvent;
  } catch (error) {
    console.error('[webhooks/clerk] signature verification failed', error);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type !== 'user.created') {
    return NextResponse.json({ received: true });
  }

  const primaryEmail = event.data.email_addresses.find(
    email => email.id === event.data.primary_email_address_id,
  )?.email_address ?? event.data.email_addresses[0]?.email_address;

  if (!primaryEmail) {
    console.error('[webhooks/clerk] user.created event without an email address', event.data.id);
    return NextResponse.json({ received: true });
  }

  const name = [event.data.first_name, event.data.last_name].filter(Boolean).join(' ') || 'ahí';

  try {
    await sendWelcomeEmail({ to: primaryEmail, name });
  } catch (error) {
    // No fallar la respuesta del webhook por un error de envío: Clerk reintenta
    // webhooks fallidos, y un fallo transitorio de SMTP no debe disparar reintentos.
    console.error('[webhooks/clerk] failed to send welcome email', error);
  }

  return NextResponse.json({ received: true });
}
