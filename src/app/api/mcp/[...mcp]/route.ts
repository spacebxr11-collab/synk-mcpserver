import { createMcpHandler } from '@vercel/mcp-adapter';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';

// 1. Setup Supabase
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 2. Define the Handler
const handler = createMcpHandler({
    name: 'synk-cloud-mcp',
    version: '1.0.0',
    description: 'Remote MCP server for SynK code coordination',
    basePath: '/api/mcp',
    tools: {
        read_sync_state: {
            description: 'Retrieves the latest code deltas and AI summaries from the persistent database',
            parameters: z.object({
                limit: z.number().optional().default(10),
                filename: z.string().optional(),
            }),
            execute: async ({ limit, filename }) => {
                let query = supabase
                    .from('sync_logs')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(limit);

                if (filename) {
                    query = query.eq('filename', filename);
                }

                const { data, error } = await query;
                if (error) throw new Error(error.message);

                return {
                    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
                };
            },
        },
        trigger_broadcast: {
            description: 'Forces a broadcast event to all listening agents',
            parameters: z.object({
                filename: z.string(),
                content: z.string(),
                summary: z.string(),
            }),
            execute: async ({ filename, content, summary }) => {
                const channel = supabase.channel('synk-stream');
                const payload = {
                    event: 'manual_update',
                    filename,
                    delta: content,
                    summary,
                    timestamp: Date.now(),
                };
                const status = await channel.send({
                    type: 'broadcast',
                    event: 'code_update',
                    payload,
                });
                return {
                    content: [{ type: 'text', text: `Broadcast Status: ${status}` }]
                };
            },
        }
    }
});

// 3. Export the GET/POST routes for the catch-all
export async function GET(req: Request) {
    return handler(req);
}

export async function POST(req: Request) {
    return handler(req);
}
