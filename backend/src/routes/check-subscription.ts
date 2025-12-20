import { Router, Response } from 'express';
import Stripe from 'stripe';
import { authMiddleware, AuthRequest } from '../middleware/auth';

export const checkSubscriptionRouter = Router();

checkSubscriptionRouter.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return res.status(500).json({ error: 'Stripe not configured' });
    }

    if (!req.user?.email) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: '2025-05-28.basil' as any });

    // Find customer by email
    const customers = await stripe.customers.list({ email: req.user.email, limit: 1 });

    if (customers.data.length === 0) {
      return res.json({ subscribed: false, plan_type: 'free' });
    }

    const customerId = customers.data[0].id;

    // Check for active subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 1,
    });

    if (subscriptions.data.length > 0) {
      const subscription = subscriptions.data[0];
      return res.json({
        subscribed: true,
        plan_type: 'pro',
        subscription_end: new Date(subscription.current_period_end * 1000).toISOString(),
      });
    }

    res.json({ subscribed: false, plan_type: 'free' });
  } catch (error) {
    console.error('Error checking subscription:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Internal error' 
    });
  }
});
