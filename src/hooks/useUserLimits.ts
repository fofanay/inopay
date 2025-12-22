import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { PLAN_LIMITS, LIMIT_SOURCES } from '@/lib/constants';

export interface UserLimits {
  maxFiles: number;
  maxRepos: number;
  source: 'plan' | 'purchase' | 'tester';
  hasEnterpriseAccess: boolean;
  isLoading: boolean;
  credits: {
    deploy: number;
    redeploy: number;
    server: number;
    total: number;
  };
  isTester: boolean;
  isPro: boolean;
}

export function useUserLimits(): UserLimits {
  const { user } = useAuth();
  const [limits, setLimits] = useState<UserLimits>({
    maxFiles: PLAN_LIMITS.free.maxFiles,
    maxRepos: PLAN_LIMITS.free.maxRepos,
    source: 'plan',
    hasEnterpriseAccess: false,
    isLoading: true,
    credits: { deploy: 0, redeploy: 0, server: 0, total: 0 },
    isTester: false,
    isPro: false,
  });

  useEffect(() => {
    const fetchLimits = async () => {
      if (!user) {
        setLimits(prev => ({ ...prev, isLoading: false }));
        return;
      }

      try {
        // Check if user is a tester
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single();

        const isTester = roleData?.role === 'admin' || roleData?.role === 'moderator';

        if (isTester) {
          setLimits({
            maxFiles: PLAN_LIMITS.enterprise.maxFiles,
            maxRepos: PLAN_LIMITS.enterprise.maxRepos,
            source: 'tester',
            hasEnterpriseAccess: true,
            isLoading: false,
            credits: { deploy: 999, redeploy: 999, server: 999, total: 999 },
            isTester: true,
            isPro: true,
          });
          return;
        }

        // Check for recent deploy purchase (grants enterprise limits)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const { data: recentPurchase } = await supabase
          .from('user_purchases')
          .select('*')
          .eq('user_id', user.id)
          .eq('service_type', 'deploy')
          .eq('status', 'completed')
          .gte('created_at', sevenDaysAgo.toISOString())
          .limit(1)
          .single();

        // Count available credits
        const { data: purchases } = await supabase
          .from('user_purchases')
          .select('service_type')
          .eq('user_id', user.id)
          .eq('status', 'completed')
          .eq('used', false)
          .eq('is_subscription', false);

        const credits = {
          deploy: 0,
          redeploy: 0,
          server: 0,
          total: 0,
        };

        purchases?.forEach(p => {
          if (p.service_type === 'deploy') credits.deploy++;
          if (p.service_type === 'redeploy') credits.redeploy++;
          if (p.service_type === 'server') credits.server++;
        });
        credits.total = credits.deploy + credits.redeploy + credits.server;

        // Check subscription
        const { data: subscription } = await supabase
          .from('subscriptions')
          .select('plan_type, status')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .single();

        const isPro = subscription?.plan_type === 'pro' || subscription?.plan_type === 'enterprise' || subscription?.plan_type === 'portfolio';
        const isPortfolio = subscription?.plan_type === 'portfolio';

        // Determine limits based on purchase or subscription
        if (recentPurchase) {
          setLimits({
            maxFiles: PLAN_LIMITS.enterprise.maxFiles,
            maxRepos: PLAN_LIMITS.enterprise.maxRepos,
            source: 'purchase',
            hasEnterpriseAccess: true,
            isLoading: false,
            credits,
            isTester: false,
            isPro,
          });
        } else if (isPortfolio) {
          setLimits({
            maxFiles: PLAN_LIMITS.portfolio.maxFiles,
            maxRepos: PLAN_LIMITS.portfolio.maxRepos,
            source: 'plan',
            hasEnterpriseAccess: true,
            isLoading: false,
            credits,
            isTester: false,
            isPro: true,
          });
        } else if (isPro) {
          const planLimits = subscription?.plan_type === 'enterprise' 
            ? PLAN_LIMITS.enterprise 
            : PLAN_LIMITS.pro;
          
          setLimits({
            maxFiles: planLimits.maxFiles,
            maxRepos: planLimits.maxRepos,
            source: 'plan',
            hasEnterpriseAccess: subscription?.plan_type === 'enterprise',
            isLoading: false,
            credits,
            isTester: false,
            isPro: true,
          });
        } else {
          setLimits({
            maxFiles: PLAN_LIMITS.free.maxFiles,
            maxRepos: PLAN_LIMITS.free.maxRepos,
            source: 'plan',
            hasEnterpriseAccess: false,
            isLoading: false,
            credits,
            isTester: false,
            isPro: false,
          });
        }
      } catch (error) {
        console.error('Error fetching user limits:', error);
        setLimits(prev => ({ ...prev, isLoading: false }));
      }
    };

    fetchLimits();
  }, [user]);

  return limits;
}
