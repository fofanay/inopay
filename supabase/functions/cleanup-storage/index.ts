import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(JSON.stringify({ error: 'Authorization required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create client with user's auth to verify identity
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      console.error('Invalid authentication:', authError?.message);
      return new Response(JSON.stringify({ error: 'Invalid authentication' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user has admin role using the user_roles table
    const { data: roleData, error: roleError } = await supabaseAuth
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleError || !roleData) {
      console.error('User is not an admin:', user.id);
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Admin user authenticated:', user.id);
    
    // Use service role to access storage admin functions
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    console.log('Starting storage cleanup...');

    // Get all files from cleaned-archives bucket
    const { data: files, error: listError } = await supabase.storage
      .from('cleaned-archives')
      .list('', {
        limit: 1000,
        sortBy: { column: 'created_at', order: 'asc' }
      });

    if (listError) {
      console.error('Error listing files:', listError);
      return new Response(JSON.stringify({ error: 'Erreur lors de la liste des fichiers' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Calculate 24 hours ago timestamp
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const filesToDelete: string[] = [];

    // Files in cleaned-archives are organized by user_id folders
    // We need to list files within each folder
    for (const folder of files || []) {
      if (folder.id === null) {
        // This is a folder, list its contents
        const { data: folderFiles, error: folderError } = await supabase.storage
          .from('cleaned-archives')
          .list(folder.name, {
            limit: 1000,
            sortBy: { column: 'created_at', order: 'asc' }
          });

        if (folderError) {
          console.error(`Error listing folder ${folder.name}:`, folderError);
          continue;
        }

        for (const file of folderFiles || []) {
          if (file.created_at) {
            const fileDate = new Date(file.created_at);
            if (fileDate < twentyFourHoursAgo) {
              filesToDelete.push(`${folder.name}/${file.name}`);
            }
          }
        }
      } else if (folder.created_at) {
        // This is a file at root level
        const fileDate = new Date(folder.created_at);
        if (fileDate < twentyFourHoursAgo) {
          filesToDelete.push(folder.name);
        }
      }
    }

    console.log(`Found ${filesToDelete.length} files older than 24 hours`);

    let deletedCount = 0;
    let errorCount = 0;

    // Delete old files in batches
    if (filesToDelete.length > 0) {
      const { data: deleteData, error: deleteError } = await supabase.storage
        .from('cleaned-archives')
        .remove(filesToDelete);

      if (deleteError) {
        console.error('Error deleting files:', deleteError);
        errorCount = filesToDelete.length;
      } else {
        deletedCount = deleteData?.length || filesToDelete.length;
        console.log(`Successfully deleted ${deletedCount} files`);
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: `Nettoyage terminé: ${deletedCount} fichiers supprimés, ${errorCount} erreurs`,
      deletedCount,
      errorCount,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in cleanup-storage function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erreur interne';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
