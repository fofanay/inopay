import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ValidationRequest {
  destUrl: string;
  destServiceKey: string;
  expectedTables?: string[];
}

interface TableInfo {
  name: string;
  exists: boolean;
  rowCount?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { destUrl, destServiceKey, expectedTables = [] }: ValidationRequest = await req.json();

    console.log("[validate-supabase-destination] Testing connection to:", destUrl);

    // Validate inputs
    if (!destUrl || !destServiceKey) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "URL et Service Role Key requis" 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Normalize URL
    const normalizedUrl = destUrl.endsWith('/') ? destUrl.slice(0, -1) : destUrl;

    // Create client to destination
    const destClient = createClient(normalizedUrl, destServiceKey, {
      auth: { persistSession: false }
    });

    // Test connection by trying to query a system table
    // We'll try to query the profiles table or any table to test connectivity
    const testTables = ['profiles', 'users', 'subscriptions'];
    let connectionValid = false;
    let connectionError = '';
    
    // Test basic connectivity by checking auth
    try {
      // Try a simple query to test the connection
      const { data, error } = await destClient
        .from('profiles')
        .select('id')
        .limit(1);
      
      if (error && error.code !== 'PGRST116' && !error.message.includes('does not exist')) {
        // PGRST116 = no rows, which is fine
        // "does not exist" = table doesn't exist, also fine for testing
        if (error.code === 'PGRST301' || error.message.includes('Invalid API key')) {
          throw new Error("Clé API invalide ou expirée");
        }
        // Other errors might indicate a valid connection but different issues
        console.log("[validate-supabase-destination] Query returned error:", error);
      }
      connectionValid = true;
    } catch (err: any) {
      console.error("[validate-supabase-destination] Connection test failed:", err);
      connectionError = err.message || "Erreur de connexion inconnue";
    }

    if (!connectionValid) {
      // Try a raw fetch to check if the URL is reachable
      try {
        const healthCheck = await fetch(`${normalizedUrl}/rest/v1/`, {
          headers: {
            'apikey': destServiceKey,
            'Authorization': `Bearer ${destServiceKey}`
          }
        });
        
        if (healthCheck.status === 401) {
          connectionError = "Service Role Key invalide";
        } else if (healthCheck.status === 404) {
          connectionError = "URL Supabase invalide";
        } else if (!healthCheck.ok) {
          connectionError = `Erreur ${healthCheck.status}: ${healthCheck.statusText}`;
        } else {
          connectionValid = true;
        }
      } catch (fetchErr: any) {
        connectionError = "Impossible de joindre le serveur Supabase";
      }
    }

    if (!connectionValid) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: connectionError,
          connectionValid: false
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check expected tables
    const tableResults: TableInfo[] = [];
    const missingTables: string[] = [];
    const existingTables: string[] = [];

    for (const tableName of expectedTables) {
      try {
        const { count, error } = await destClient
          .from(tableName)
          .select('*', { count: 'exact', head: true });
        
        if (error) {
          if (error.message.includes('does not exist') || error.code === '42P01') {
            tableResults.push({ name: tableName, exists: false });
            missingTables.push(tableName);
          } else {
            // Table exists but might have RLS issues
            tableResults.push({ name: tableName, exists: true, rowCount: 0 });
            existingTables.push(tableName);
          }
        } else {
          tableResults.push({ name: tableName, exists: true, rowCount: count || 0 });
          existingTables.push(tableName);
        }
      } catch (err) {
        tableResults.push({ name: tableName, exists: false });
        missingTables.push(tableName);
      }
    }

    // Get project info
    let projectRef = '';
    const urlMatch = normalizedUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
    if (urlMatch) {
      projectRef = urlMatch[1];
    }

    console.log("[validate-supabase-destination] Validation complete:", {
      connectionValid,
      existingTables: existingTables.length,
      missingTables: missingTables.length
    });

    return new Response(
      JSON.stringify({
        success: true,
        connectionValid: true,
        projectRef,
        tables: tableResults,
        existingTables,
        missingTables,
        isSchemaReady: missingTables.length === 0 && expectedTables.length > 0,
        sqlEditorUrl: projectRef ? `https://supabase.com/dashboard/project/${projectRef}/sql/new` : null
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error("[validate-supabase-destination] Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || "Erreur inconnue" 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

