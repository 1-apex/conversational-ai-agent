import { NextRequest } from "next/server";

let ipCounter = 0;

// A different IP per request, so tests don't share rate-limit windows
export function jsonRequest(path: string, body: unknown, headers: Record<string, string> = {}) {
  ipCounter += 1;
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": `10.0.0.${ipCounter}`, ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

export function getRequest(path: string) {
  ipCounter += 1;
  return new NextRequest(`http://localhost${path}`, { headers: { "x-real-ip": `10.0.1.${ipCounter}` } });
}

export function groqReply(content: string, status = 200) {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status });
}
