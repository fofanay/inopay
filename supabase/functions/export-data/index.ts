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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if user is admin
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!roleData || roleData.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Accès admin requis' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { tables } = await req.json();
    
    console.log('[export-data] Starting data export for admin:', user.email);
    console.log('[export-data] Tables requested:', tables);

    // List of all exportable tables
    const allTables = [
      'admin_activity_logs',
      'banned_users',
      'deployment_history',
      'email_campaigns',
      'email_contacts',
      'email_list_contacts',
      'email_lists',
      'email_logs',
      'email_sends',
      'email_templates',
      'health_check_logs',
      'newsletter_subscribers',
      'projects_analysis',
      'security_audit_logs',
      'server_deployments',
      'subscriptions',
      'sync_configurations',
      'sync_history',
      'user_notifications',
      'user_purchases',
      'user_roles',
      'user_servers',
      'user_settings'
    ];

    const tablesToExport = tables && tables.length > 0 ? tables : allTables;
    const exportData: Record<string, any[]> = {};
    const exportStats: Record<string, number> = {};
    let sqlInserts = '';

    for (const tableName of tablesToExport) {
      if (!allTables.includes(tableName)) {
        console.log(`[export-data] Skipping unknown table: ${tableName}`);
        continue;
      }

      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('*');

        if (error) {
          console.error(`[export-data] Error fetching ${tableName}:`, error);
          exportData[tableName] = [];
          exportStats[tableName] = 0;
        } else {
          exportData[tableName] = data || [];
          exportStats[tableName] = data?.length || 0;
          
          // Generate SQL INSERT statements
          if (data && data.length > 0) {
            sqlInserts += `\n-- Table: ${tableName} (${data.length} rows)\n`;
            sqlInserts += `-- TRUNCATE TABLE public.${tableName} CASCADE; -- Uncomment if needed\n\n`;
            
            for (const row of data) {
              const columns = Object.keys(row).join(', ');
              const values = Object.values(row).map(v => {
                if (v === null) return 'NULL';
                if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
                if (typeof v === 'number') return v.toString();
                if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
                if (Array.isArray(v)) return `ARRAY[${v.map(i => `'${String(i).replace(/'/g, "''")}'`).join(',')}]`;
                return `'${String(v).replace(/'/g, "''")}'`;
              }).join(', ');
              
              sqlInserts += `INSERT INTO public.${tableName} (${columns}) VALUES (${values}) ON CONFLICT DO NOTHING;\n`;
            }
          }
        }
      } catch (err) {
        console.error(`[export-data] Exception for ${tableName}:`, err);
        exportData[tableName] = [];
        exportStats[tableName] = 0;
      }
    }

    const totalRows = Object.values(exportStats).reduce((a, b) => a + b, 0);
    console.log('[export-data] Export completed. Total rows:', totalRows);

    // Generate summary header
    const summaryHeader = `-- ================================================
-- INOPAY Data Export
-- Generated: ${new Date().toISOString()}
-- Total tables: ${Object.keys(exportStats).length}
-- Total rows: ${totalRows}
-- ================================================

-- Statistics:
${Object.entries(exportStats).map(([table, count]) => `-- ${table}: ${count} rows`).join('\n')}

-- ================================================
-- INSERT STATEMENTS
-- ================================================
`;

    return new Response(JSON.stringify({
      success: true,
      stats: exportStats,
      totalRows,
      totalTables: Object.keys(exportStats).length,
      data: exportData,
      sql: summaryHeader + sqlInserts,
      exportedAt: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[export-data] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ 
      error: errorMessage,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
