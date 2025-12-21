import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: any) => {
  console.log(`[USE-CREDIT] ${step}`, details ? JSON.stringify(details) : '');
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { credit_type, deployment_id } = await req.json();

    if (!credit_type) {
      return new Response(
        JSON.stringify({ error: 'credit_type is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    logStep('Processing credit request', { userId: user.id, credit_type, deployment_id });

    // Check if user is an unlimited tester
    const { data: testerRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'tester')
      .maybeSingle();

    if (testerRole) {
      logStep('User is unlimited tester - credit granted');
      return new Response(
        JSON.stringify({
          success: true,
          credit_source: 'tester',
          message: 'Crédit illimité (testeur)'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for available purchase credit
    const { data: purchase, error: purchaseError } = await supabase
      .from('user_purchases')
      .select('*')
      .eq('user_id', user.id)
      .eq('service_type', credit_type)
      .eq('status', 'completed')
      .eq('used', false)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (purchase) {
      logStep('Found available purchase credit', { purchaseId: purchase.id });

      // Mark as used
      const { error: updateError } = await supabase
        .from('user_purchases')
        .update({
          used: true,
          used_at: new Date().toISOString(),
          deployment_id: deployment_id || null
        })
        .eq('id', purchase.id);

      if (updateError) {
        logStep('Error marking credit as used', updateError);
        throw new Error('Failed to consume credit');
      }

      return new Response(
        JSON.stringify({
          success: true,
          credit_source: 'purchase',
          purchase_id: purchase.id,
          message: `Crédit ${credit_type} consommé`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check legacy credits (subscriptions table)
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('id, credits_remaining, free_credits')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subscription) {
      const totalLegacy = (subscription.credits_remaining || 0) + (subscription.free_credits || 0);
      
      if (totalLegacy > 0) {
        logStep('Using legacy credit', { subscriptionId: subscription.id, available: totalLegacy });

        // Deduct from free_credits first, then credits_remaining
        let newFreeCredits = subscription.free_credits || 0;
        let newCreditsRemaining = subscription.credits_remaining || 0;

        if (newFreeCredits > 0) {
          newFreeCredits -= 1;
        } else {
          newCreditsRemaining -= 1;
        }

        const { error: updateError } = await supabase
          .from('subscriptions')
          .update({
            free_credits: newFreeCredits,
            credits_remaining: newCreditsRemaining,
            updated_at: new Date().toISOString()
          })
          .eq('id', subscription.id);

        if (updateError) {
          logStep('Error updating legacy credit', updateError);
          throw new Error('Failed to consume legacy credit');
        }

        return new Response(
          JSON.stringify({
            success: true,
            credit_source: 'legacy',
            subscription_id: subscription.id,
            message: 'Crédit legacy consommé'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // No credits available
    logStep('No credits available', { credit_type });

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Crédit insuffisant',
        credit_type,
        message: `Vous n'avez pas de crédit "${credit_type}" disponible. Veuillez en acheter un pour continuer.`,
        redirect_to_pricing: true
      }),
      { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[USE-CREDIT] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
