import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ImportRequest {
  destUrl: string;
  destServiceKey: string;
  tableName: string;
  data: Record<string, any>[];
  onConflict?: 'ignore' | 'update';
}

interface BatchImportRequest {
  destUrl: string;
  destServiceKey: string;
  tables: {
    name: string;
    data: Record<string, any>[];
  }[];
}

const BATCH_SIZE = 100;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    
    // Detect if it's a batch import or single table import
    if (body.tables) {
      return handleBatchImport(body as BatchImportRequest);
    } else {
      return handleSingleTableImport(body as ImportRequest);
    }

  } catch (error: any) {
    console.error("[import-data-to-supabase] Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || "Erreur inconnue" 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

async function handleSingleTableImport(request: ImportRequest): Promise<Response> {
  const { destUrl, destServiceKey, tableName, data, onConflict = 'ignore' } = request;

  console.log(`[import-data-to-supabase] Importing ${data.length} rows to ${tableName}`);

  if (!destUrl || !destServiceKey || !tableName) {
    return new Response(
      JSON.stringify({ success: false, error: "Paramètres manquants" }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }

  const normalizedUrl = destUrl.endsWith('/') ? destUrl.slice(0, -1) : destUrl;
  const destClient = createClient(normalizedUrl, destServiceKey, {
    auth: { persistSession: false }
  });

  let inserted = 0;
  let errors: string[] = [];
  const totalBatches = Math.ceil(data.length / BATCH_SIZE);

  // Process in batches
  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, i + BATCH_SIZE);
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
    
    try {
      // Clean data: remove undefined values and ensure proper types
      const cleanedBatch = batch.map(row => {
        const cleaned: Record<string, any> = {};
        for (const [key, value] of Object.entries(row)) {
          if (value !== undefined) {
            cleaned[key] = value;
          }
        }
        return cleaned;
      });

      const { error, count } = await destClient
        .from(tableName)
        .upsert(cleanedBatch, { 
          onConflict: 'id',
          ignoreDuplicates: onConflict === 'ignore'
        });

      if (error) {
        console.error(`[import-data-to-supabase] Batch ${batchNumber} error:`, error);
        errors.push(`Batch ${batchNumber}: ${error.message}`);
      } else {
        inserted += batch.length;
        console.log(`[import-data-to-supabase] Batch ${batchNumber}/${totalBatches} complete: ${batch.length} rows`);
      }
    } catch (err: any) {
      errors.push(`Batch ${batchNumber}: ${err.message}`);
    }
  }

  return new Response(
    JSON.stringify({
      success: errors.length === 0,
      tableName,
      totalRows: data.length,
      inserted,
      errors: errors.length > 0 ? errors : undefined,
      message: errors.length === 0 
        ? `${inserted} lignes importées avec succès`
        : `${inserted}/${data.length} lignes importées avec ${errors.length} erreurs`
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleBatchImport(request: BatchImportRequest): Promise<Response> {
  const { destUrl, destServiceKey, tables } = request;

  console.log(`[import-data-to-supabase] Batch import of ${tables.length} tables`);

  if (!destUrl || !destServiceKey || !tables || tables.length === 0) {
    return new Response(
      JSON.stringify({ success: false, error: "Paramètres manquants" }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }

  const normalizedUrl = destUrl.endsWith('/') ? destUrl.slice(0, -1) : destUrl;
  const destClient = createClient(normalizedUrl, destServiceKey, {
    auth: { persistSession: false }
  });

  const results: {
    table: string;
    totalRows: number;
    inserted: number;
    success: boolean;
    error?: string;
  }[] = [];

  // Define import order to respect foreign key constraints
  const importOrder = [
    'profiles',
    'user_roles',
    'user_settings',
    'user_servers',
    'subscriptions',
    'projects_analysis',
    'cleaning_cache',
    'cleaning_estimates',
    'server_deployments',
    'deployment_history',
    'sync_configurations',
    'sync_history',
    'user_purchases',
    'user_notifications',
    'security_audit_logs',
    'health_check_logs',
    'admin_activity_logs',
    'admin_config',
    'banned_users',
    'email_templates',
    'email_lists',
    'email_contacts',
    'email_list_contacts',
    'email_campaigns',
    'email_logs',
    'email_sends',
    'newsletter_subscribers',
    'otp_verifications',
    'pending_liberation_payments',
    'liberation_upsell_views'
  ];

  // Sort tables by import order
  const sortedTables = [...tables].sort((a, b) => {
    const aIndex = importOrder.indexOf(a.name);
    const bIndex = importOrder.indexOf(b.name);
    if (aIndex === -1 && bIndex === -1) return 0;
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });

  for (const table of sortedTables) {
    if (!table.data || table.data.length === 0) {
      results.push({
        table: table.name,
        totalRows: 0,
        inserted: 0,
        success: true
      });
      continue;
    }

    let inserted = 0;
    let tableError = '';

    for (let i = 0; i < table.data.length; i += BATCH_SIZE) {
      const batch = table.data.slice(i, i + BATCH_SIZE);
      
      try {
        // Clean data
        const cleanedBatch = batch.map(row => {
          const cleaned: Record<string, any> = {};
          for (const [key, value] of Object.entries(row)) {
            if (value !== undefined) {
              cleaned[key] = value;
            }
          }
          return cleaned;
        });

        const { error } = await destClient
          .from(table.name)
          .upsert(cleanedBatch, { 
            onConflict: 'id',
            ignoreDuplicates: true
          });

        if (error) {
          console.error(`[import-data-to-supabase] ${table.name} batch error:`, error);
          tableError = error.message;
        } else {
          inserted += batch.length;
        }
      } catch (err: any) {
        tableError = err.message;
      }
    }

    results.push({
      table: table.name,
      totalRows: table.data.length,
      inserted,
      success: !tableError || inserted > 0,
      error: tableError || undefined
    });

    console.log(`[import-data-to-supabase] ${table.name}: ${inserted}/${table.data.length} rows imported`);
  }

  const totalInserted = results.reduce((sum, r) => sum + r.inserted, 0);
  const totalRows = results.reduce((sum, r) => sum + r.totalRows, 0);
  const failedTables = results.filter(r => !r.success);

  return new Response(
    JSON.stringify({
      success: failedTables.length === 0,
      tables: results,
      summary: {
        totalTables: tables.length,
        successfulTables: tables.length - failedTables.length,
        totalRows,
        totalInserted,
        failedTables: failedTables.map(t => t.table)
      }
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
