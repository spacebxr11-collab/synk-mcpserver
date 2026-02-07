import { GET as catchAllGET, POST as catchAllPOST, OPTIONS as catchAllOPTIONS } from './[...mcp]/route';

export async function GET(req: Request) {
    return catchAllGET(req);
}

export async function POST(req: Request) {
    return catchAllPOST(req);
}

export async function OPTIONS() {
    return catchAllOPTIONS();
}
