// The only file that imports the MCP SDK. It lists the tools, routes calls and maps errors.
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { toolError, truncateMessage } from './errors';
import type { Outcome, ToolError } from './errors';
import { formatHear, formatMake, formatRoundTrip } from './format';
import { SAMPLE_ALERT } from './handlers';
import type { Handlers } from './handlers';

export const SERVER_NAME = 'dead-air-ears';
export const SERVER_VERSION = '1.0.0';
export const TOOL_NAMES = ['make_broadcast', 'hear_wav', 'round_trip'] as const;

const SAMPLE = JSON.stringify(SAMPLE_ALERT);
const NOISE_NOTE = 'Noise is white noise at a signal-to-noise ratio in dB (lower means more noise), added to clean audio. It is not a room.';

// No additionalProperties:false and no minimum/maximum keywords: the handlers check ranges and
// return their own named reasons. Ranges are written in the descriptions.
export const TOOLS = [
  {
    name: 'make_broadcast',
    description:
      `Turn a TEST alert (JSON) into a Dead Air broadcast WAV file, the same sound file the Broadcast page saves. Returns the file path, length in seconds, sample rate and message bytes. "test" must be true. "sentMinute" is optional and defaults to the current minute. Optional sampleRate: whole number 16000 to 96000, default 48000. Sample alert: ${SAMPLE}`,
    inputSchema: {
      type: 'object',
      properties: {
        alert: { type: 'object', description: 'The alert fields. "test" must be true.' },
        sampleRate: { type: 'integer', description: 'Hz, 16000 to 96000. Default 48000.' },
      },
      required: ['alert'],
    },
  },
  {
    name: 'hear_wav',
    description:
      `Run a WAV file (16-bit PCM, 1 or 2 channels, 16000 to 96000 Hz, up to 20 MB) through the same decoder the Listen page uses. Reports each payload heard and whether the check passed. A failed check shows only its length and reason. Optional noiseDb: -60 to 60. ${NOISE_NOTE}`,
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to the WAV file.' },
        noiseDb: { type: 'number', description: 'Optional signal-to-noise ratio in dB, -60 to 60.' },
        seed: { type: 'integer', description: 'Optional noise seed, 0 to 4294967295. Default 1.' },
      },
      required: ['path'],
    },
  },
  {
    name: 'round_trip',
    description:
      `Make a broadcast from a TEST alert, add noise, decode it, and count successes and failures over N tries. Same inputs give the same result. noiseDb: -60 to 60. tries: 1 to 200, default 20. ${NOISE_NOTE} Sample alert: ${SAMPLE}`,
    inputSchema: {
      type: 'object',
      properties: {
        alert: { type: 'object', description: 'The alert fields. "test" must be true.' },
        noiseDb: { type: 'number', description: 'Signal-to-noise ratio in dB, -60 to 60. Required.' },
        tries: { type: 'integer', description: '1 to 200. Default 20.' },
        seed: { type: 'integer', description: '0 to 4294967295. Default 1.' },
        sampleRate: { type: 'integer', description: 'Hz, 16000 to 96000. Default 48000.' },
      },
      required: ['alert', 'noiseDb'],
    },
  },
] as const;

export interface ToolCallResult {
  [key: string]: unknown;
  content: { type: 'text'; text: string }[];
  isError?: boolean;
}

function errorResult(e: ToolError): ToolCallResult {
  return { isError: true, content: [{ type: 'text', text: truncateMessage(`${e.reason}: ${e.message}`) }] };
}

/** Maps anything a handler throws to a short error result. No stack, no line breaks. */
export function mapThrown(thrown: unknown): ToolCallResult {
  const text = thrown instanceof Error ? thrown.message : String(thrown);
  return errorResult(toolError('internal-error', text));
}

function present<T>(outcome: Outcome<T>, format: (r: T) => string): ToolCallResult {
  if (!outcome.ok) return errorResult(outcome);
  return { content: [{ type: 'text', text: format(outcome as unknown as T) }] };
}

/** Runs one tool by name. Throws McpError only for an unknown tool name. */
export async function callTool(handlers: Handlers, name: string, args: unknown): Promise<ToolCallResult> {
  if (!(TOOL_NAMES as readonly string[]).includes(name)) {
    throw new McpError(ErrorCode.InvalidParams, `Unknown tool: ${name}`);
  }
  try {
    const input = args ?? {};
    if (name === 'make_broadcast') return present(await handlers.makeBroadcast(input), formatMake);
    if (name === 'hear_wav') return present(await handlers.hearWav(input), formatHear);
    return present(await handlers.roundTrip(input), formatRoundTrip);
  } catch (thrown) {
    return mapThrown(thrown);
  }
}

export async function startServer(handlers: Handlers, log: (line: string) => void): Promise<void> {
  const server = new Server({ name: SERVER_NAME, version: SERVER_VERSION }, { capabilities: { tools: {} } });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS.map((t) => ({ ...t })) }));
  server.setRequestHandler(CallToolRequestSchema, async (request) =>
    callTool(handlers, request.params.name, request.params.arguments),
  );
  await server.connect(new StdioServerTransport());
  log(`${SERVER_NAME} ${SERVER_VERSION} ready`);
}
