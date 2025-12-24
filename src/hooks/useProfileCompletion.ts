import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface ProfileCompletionStatus {
  isComplete: boolean;
  isLoading: boolean;
  missingFields: string[];
  phoneVerified: boolean;
}

export const useProfileCompletion = (): ProfileCompletionStatus => {
  const { user } = useAuth();
  const [status, setStatus] = useState<ProfileCompletionStatus>({
    isComplete: true,
    isLoading: true,
    missingFields: [],
    phoneVerified: false,
  });

  useEffect(() => {
    const checkProfileCompletion = async () => {
      if (!user?.id) {
        setStatus({
          isComplete: true,
          isLoading: false,
          missingFields: [],
          phoneVerified: false,
        });
        return;
      }

      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('first_name, last_name, billing_address_line1, billing_city, billing_postal_code, billing_country, phone, phone_verified')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Error fetching profile:', error);
          setStatus({
            isComplete: false,
            isLoading: false,
            missingFields: ['profile'],
            phoneVerified: false,
          });
          return;
        }

        const requiredFields = [
          { key: 'first_name', label: 'Prénom' },
          { key: 'last_name', label: 'Nom' },
          { key: 'billing_address_line1', label: 'Adresse' },
          { key: 'billing_city', label: 'Ville' },
          { key: 'billing_postal_code', label: 'Code postal' },
          { key: 'billing_country', label: 'Pays' },
        ];

        const missingFields = requiredFields
          .filter(field => !profile?.[field.key as keyof typeof profile])
          .map(field => field.label);

        const phoneVerified = profile?.phone_verified === true;

        setStatus({
          isComplete: missingFields.length === 0,
          isLoading: false,
          missingFields,
          phoneVerified,
        });
      } catch (err) {
        console.error('Error checking profile completion:', err);
        setStatus({
          isComplete: false,
          isLoading: false,
          missingFields: ['unknown'],
          phoneVerified: false,
        });
      }
    };

    checkProfileCompletion();
  }, [user?.id]);

  return status;
};
