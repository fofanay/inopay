import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Parse TypeScript types to extract table schemas
function parseTypesToSQL(typesContent: string): string[] {
  const sqlStatements: string[] = [];
  
  // Extract table definitions from the types.ts format
  const tableRegex = /(\w+):\s*\{[\s\S]*?Row:\s*\{([\s\S]*?)\}/g;
  let match;

  while ((match = tableRegex.exec(typesContent)) !== null) {
    const tableName = match[1];
    const rowContent = match[2];
    
    // Skip internal tables
    if (tableName.startsWith('_') || tableName === '__InternalSupabase') continue;
    
    // Parse columns
    const columns: string[] = [];
    const columnRegex = /(\w+):\s*([^|]+?)(?:\s*\|\s*null)?(?:\n|$)/g;
    let colMatch;

    while ((colMatch = columnRegex.exec(rowContent)) !== null) {
      const colName = colMatch[1].trim();
      let colType = colMatch[2].trim();
      const isNullable = rowContent.includes(`${colName}:`) && rowContent.includes('| null');
      
      // Map TypeScript types to PostgreSQL types
      let pgType = 'TEXT';
      if (colType === 'string') pgType = 'TEXT';
      else if (colType === 'number') pgType = 'INTEGER';
      else if (colType === 'boolean') pgType = 'BOOLEAN';
      else if (colType.includes('Json')) pgType = 'JSONB';
      else if (colName === 'id') pgType = 'UUID PRIMARY KEY DEFAULT gen_random_uuid()';
      else if (colName.endsWith('_id')) pgType = 'UUID';
      else if (colName.includes('_at') || colName === 'created_at' || colName === 'updated_at') {
        pgType = 'TIMESTAMP WITH TIME ZONE DEFAULT now()';
      }
      
      const nullable = isNullable && !colName.includes('id') ? '' : ' NOT NULL';
      
      // Skip primary key duplicate NOT NULL
      if (pgType.includes('PRIMARY KEY')) {
        columns.push(`  ${colName} ${pgType}`);
      } else {
        columns.push(`  ${colName} ${pgType}${nullable}`);
      }
    }

    if (columns.length > 0) {
      const createSQL = `CREATE TABLE IF NOT EXISTS public.${tableName} (\n${columns.join(',\n')}\n);`;
      sqlStatements.push(createSQL);
      
      // Add RLS
      sqlStatements.push(`ALTER TABLE public.${tableName} ENABLE ROW LEVEL SECURITY;`);
    }
  }

  return sqlStatements;
}

// Generate migration SQL from file structure
function generateMigrationSQL(files: Record<string, string>): string[] {
  const sqlStatements: string[] = [];

  // Check for types.ts file
  const typesFile = files['src/integrations/supabase/types.ts'];
  if (typesFile) {
    console.log('[migrate-schema] Found types.ts, extracting schema...');
    const parsed = parseTypesToSQL(typesFile);
    sqlStatements.push(...parsed);
  }

  // Check for migration files
  Object.keys(files).forEach(path => {
    if (path.startsWith('supabase/migrations/') && path.endsWith('.sql')) {
      console.log(`[migrate-schema] Found migration file: ${path}`);
      sqlStatements.push(files[path]);
    }
  });

  return sqlStatements;
}

serve(async (req) => {
  // Handle CORS preflight requests
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
        JSON.stringify({ error: 'Authorization header required' }),
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

    const { server_id, files, custom_sql } = await req.json();

    if (!server_id) {
      return new Response(
        JSON.stringify({ error: 'server_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[migrate-schema] Starting migration for server: ${server_id}`);

    // Get server info
    const { data: server, error: serverError } = await supabase
      .from('user_servers')
      .select('*')
      .eq('id', server_id)
      .eq('user_id', user.id)
      .single();

    if (serverError || !server) {
      console.error('[migrate-schema] Server not found:', serverError);
      return new Response(
        JSON.stringify({ error: 'Server not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!server.db_url || server.db_status !== 'ready') {
      return new Response(
        JSON.stringify({ error: 'Database is not ready. Please setup database first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate SQL migrations
    let sqlStatements: string[] = [];

    if (files && Object.keys(files).length > 0) {
      console.log(`[migrate-schema] Analyzing ${Object.keys(files).length} files...`);
      sqlStatements = generateMigrationSQL(files);
    }

    if (custom_sql) {
      sqlStatements.push(custom_sql);
    }

    if (sqlStatements.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No migrations needed',
          migrations: []
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[migrate-schema] Generated ${sqlStatements.length} SQL statements`);

    // Execute migrations on the remote database
    // Note: In production, this would connect to the PostgreSQL database on the VPS
    // For now, we'll store the migrations and provide them for manual execution
    const results: { statement: string; status: 'pending' | 'executed' | 'failed'; error?: string }[] = [];

    // Since we can't directly connect to the remote PostgreSQL from edge functions,
    // we'll generate a migration script that can be executed via Coolify
    const migrationScript = `
#!/bin/bash
# Inopay Database Migration Script
# Generated at: ${new Date().toISOString()}

export PGPASSWORD="${server.db_password}"

${sqlStatements.map((sql, i) => `
echo "Executing migration ${i + 1}/${sqlStatements.length}..."
psql -h ${server.db_host} -p ${server.db_port} -U ${server.db_user} -d ${server.db_name} -c "${sql.replace(/"/g, '\\"').replace(/\n/g, ' ')}"
`).join('\n')}

echo "All migrations completed!"
`;

    // Store migration for reference
    for (const statement of sqlStatements) {
      results.push({
        statement: statement.substring(0, 200) + (statement.length > 200 ? '...' : ''),
        status: 'pending'
      });
    }

    // Try to execute via Coolify's execute API if available
    if (server.coolify_url && server.coolify_token) {
      try {
        console.log('[migrate-schema] Attempting to execute migrations via Coolify...');
        
        const coolifyHeaders = {
          'Authorization': `Bearer ${server.coolify_token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        };

        // Find the PostgreSQL database UUID
        const dbListResponse = await fetch(`${server.coolify_url}/api/v1/databases`, {
          method: 'GET',
          headers: coolifyHeaders
        });

        if (dbListResponse.ok) {
          const databases = await dbListResponse.json();
          const inopayDb = databases.find((db: any) => 
            db.name === 'inopay-postgresql' || db.name?.includes('inopay')
          );

          if (inopayDb) {
            // Execute command in database container
            for (let i = 0; i < sqlStatements.length; i++) {
              const sql = sqlStatements[i];
              console.log(`[migrate-schema] Executing statement ${i + 1}/${sqlStatements.length}`);
              
              const execResponse = await fetch(`${server.coolify_url}/api/v1/databases/${inopayDb.uuid}/execute`, {
                method: 'POST',
                headers: coolifyHeaders,
                body: JSON.stringify({
                  command: `psql -U ${server.db_user} -d ${server.db_name} -c "${sql.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`
                })
              });

              if (execResponse.ok) {
                results[i].status = 'executed';
              } else {
                const errorText = await execResponse.text();
                results[i].status = 'failed';
                results[i].error = errorText;
              }
            }
          }
        }
      } catch (execError) {
        console.error('[migrate-schema] Coolify execution error:', execError);
      }
    }

    const executed = results.filter(r => r.status === 'executed').length;
    const failed = results.filter(r => r.status === 'failed').length;
    const pending = results.filter(r => r.status === 'pending').length;

    return new Response(
      JSON.stringify({
        success: true,
        message: `Migration complete: ${executed} executed, ${failed} failed, ${pending} pending`,
        migrations: results,
        migration_script: migrationScript,
        summary: {
          total: sqlStatements.length,
          executed,
          failed,
          pending
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[migrate-schema] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
