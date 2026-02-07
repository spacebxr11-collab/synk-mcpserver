import { createMcpHandler } from '@vercel/mcp-adapter';

export const runtime = 'nodejs';

import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';

// 1. Setup Supabase
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 2. Define the Handler
const handler = createMcpHandler(async (server) => {
    server.tool(
        'read_sync_state',
        {
            limit: z.number().optional().default(10),
            filename: z.string().optional(),
        },
        async ({ limit, filename }) => {
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
        }
    );

    server.tool(
        'trigger_broadcast',
        {
            filename: z.string(),
            content: z.string(),
            summary: z.string(),
        },
        async ({ filename, content, summary }) => {
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
        }
    );
},
    {
        serverInfo: { name: 'synk-cloud-mcp', version: '1.0.0' }
    },
    {
        basePath: '/api/mcp',
        verboseLogs: true
    });

// 3. CORS & SSE Helper
function optimizeResponse(res: Response) {
    res.headers.set('Access-Control-Allow-Origin', '*');
    res.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-mcp-version');

    // Disable buffering for SSE (Crucial for Vercel/Nginx)
    res.headers.set('X-Accel-Buffering', 'no');
    res.headers.set('Cache-Control', 'no-cache, no-transform');
    res.headers.set('Connection', 'keep-alive');

    return res;
}

// 4. Export the GET/POST routes for the catch-all
export async function GET(req: Request) {
    const url = new URL(req.url);

    // Quick health check
    if (url.pathname.endsWith('/health')) {
        return applyCors(new Response(JSON.stringify({ status: 'ok', timestamp: Date.now() }), {
            headers: { 'Content-Type': 'application/json' }
        }));
    }

    try {
        const res = await handler(req);
        return optimizeResponse(res);
    } catch (err: any) {
        return applyCors(new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        }));
    }
}

export async function POST(req: Request) {
    try {
        const res = await handler(req);
        return optimizeResponse(res);
    } catch (err: any) {
        return applyCors(new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        }));
    }
}

function applyCors(res: Response) {
    res.headers.set('Access-Control-Allow-Origin', '*');
    res.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-mcp-version');
    return res;
}

export async function OPTIONS() {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-mcp-version',
            'Access-Control-Max-Age': '86400',
        }
    });
}
