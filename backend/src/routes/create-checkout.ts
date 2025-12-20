import { Router, Response } from 'express';
import Stripe from 'stripe';
import { authMiddleware, AuthRequest } from '../middleware/auth';

export const createCheckoutRouter = Router();

createCheckoutRouter.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return res.status(500).json({ error: 'Stripe not configured' });
    }

    if (!req.user?.email) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { priceId, mode = 'subscription' } = req.body;

    if (!priceId) {
      return res.status(400).json({ error: 'Price ID required' });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: '2025-05-28.basil' as any });

    // Check if customer exists
    const customers = await stripe.customers.list({ email: req.user.email, limit: 1 });
    let customerId: string | undefined;

    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    const origin = req.headers.origin || 'http://localhost:5173';

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : req.user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: mode as 'subscription' | 'payment',
      success_url: `${origin}/payment-success`,
      cancel_url: `${origin}/pricing`,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Error creating checkout:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Internal error' 
    });
  }
});
