import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { getSupabaseAdmin } from '../services/supabase';

export const stripeWebhookRouter = Router();

// Raw body parser for Stripe webhooks
import express from 'express';
stripeWebhookRouter.use(express.raw({ type: 'application/json' }));

stripeWebhookRouter.post('/', async (req: Request, res: Response) => {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeKey) {
    console.error('STRIPE_SECRET_KEY not configured');
    return res.status(500).json({ error: 'Stripe not configured' });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2025-05-28.basil' as any });
  const sig = req.headers['stripe-signature'] as string;

  let event: Stripe.Event;

  try {
    if (webhookSecret && sig) {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } else {
      event = JSON.parse(req.body.toString());
    }
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return res.status(400).json({ error: 'Webhook signature verification failed' });
  }

  console.log(`[STRIPE-WEBHOOK] Event: ${event.type}`);

  const supabase = getSupabaseAdmin();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerEmail = session.customer_email;
        const customerId = session.customer as string;

        if (!customerEmail) {
          console.error('No customer email in session');
          break;
        }

        // Find user by email
        const { data: users } = await supabase.auth.admin.listUsers();
        const user = users?.users?.find(u => u.email === customerEmail);

        if (!user) {
          console.error('User not found for email:', customerEmail);
          break;
        }

        if (session.mode === 'subscription') {
          const subscriptionId = session.subscription as string;
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);

          await supabase.from('subscriptions').upsert({
            user_id: user.id,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            plan_type: 'pro',
            status: 'active',
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          }, { onConflict: 'user_id' });

          console.log(`Subscription created for user ${user.id}`);
        } else if (session.mode === 'payment') {
          // One-time payment (pack)
          await supabase.from('subscriptions').upsert({
            user_id: user.id,
            stripe_customer_id: customerId,
            plan_type: 'pack',
            status: 'active',
            credits_remaining: 10,
          }, { onConflict: 'user_id' });

          console.log(`Pack purchased for user ${user.id}`);
        }
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const { data: existingSub } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('stripe_customer_id', customerId)
          .maybeSingle();

        if (existingSub) {
          await supabase.from('subscriptions').update({
            status: subscription.status === 'active' ? 'active' : 'inactive',
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          }).eq('stripe_customer_id', customerId);

          console.log(`Subscription updated for customer ${customerId}`);
        }
        break;
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});
