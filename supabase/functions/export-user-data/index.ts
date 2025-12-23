import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Tables that users can export (their own data only)
const USER_EXPORTABLE_TABLES = [
  'projects_analysis',
  'deployment_history',
  'server_deployments',
  'sync_configurations',
  'sync_history',
  'user_servers',
  'user_settings',
  'user_notifications',
];

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

    const { tables } = await req.json();
    
    console.log('[export-user-data] Starting user data export for:', user.email);
    console.log('[export-user-data] Tables requested:', tables);

    const tablesToExport = tables && tables.length > 0 
      ? tables.filter((t: string) => USER_EXPORTABLE_TABLES.includes(t))
      : USER_EXPORTABLE_TABLES;
    
    const exportData: Record<string, unknown[]> = {};
    const exportStats: Record<string, number> = {};
    let sqlInserts = '';

    for (const tableName of tablesToExport) {
      try {
        // All user tables have user_id column
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .eq('user_id', user.id);

        if (error) {
          console.error(`[export-user-data] Error fetching ${tableName}:`, error);
          exportData[tableName] = [];
          exportStats[tableName] = 0;
        } else {
          exportData[tableName] = data || [];
          exportStats[tableName] = data?.length || 0;
          
          // Generate SQL INSERT statements
          if (data && data.length > 0) {
            sqlInserts += `\n-- Table: ${tableName} (${data.length} rows)\n`;
            sqlInserts += `-- User: ${user.email}\n`;
            sqlInserts += `-- Note: Replace user_id with your new user ID before importing\n\n`;
            
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
        console.error(`[export-user-data] Exception for ${tableName}:`, err);
        exportData[tableName] = [];
        exportStats[tableName] = 0;
      }
    }

    const totalRows = Object.values(exportStats).reduce((a, b) => a + b, 0);
    console.log('[export-user-data] Export completed. Total rows:', totalRows);

    // Generate summary header
    const summaryHeader = `-- ================================================
-- USER DATA EXPORT
-- Generated: ${new Date().toISOString()}
-- User: ${user.email}
-- Total tables: ${Object.keys(exportStats).length}
-- Total rows: ${totalRows}
-- ================================================

-- IMPORTANT: Before importing to your new Supabase instance:
-- 1. Create the tables using the schema export
-- 2. Replace all user_id values with your new user ID
-- 3. Run these INSERT statements

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
      exportedAt: new Date().toISOString(),
      userId: user.id,
      userEmail: user.email
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[export-user-data] Error:', error);
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
