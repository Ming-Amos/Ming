/** Real stdio MCP client. Usage: node scripts/mcp-call.mjs TOOL '{"taskId":"..."}'
 * This sends actual SDK protocol messages; it does not emulate tool results.
 * No LLM, Bob account, or API credit is used by this client.
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const require = createRequire(new URL('../apps/mcp/package.json', import.meta.url));
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport, getDefaultEnvironment } = require('@modelcontextprotocol/sdk/client/stdio.js');
const root = fileURLToPath(new URL('..', import.meta.url));
const client = new Client({ name: 'ming-codex-operator', version: '1.0.0' });
const transport = new StdioClientTransport({ command: process.execPath, args: [path.join(root, 'apps/mcp/dist/index.js')], cwd: root, stderr: 'pipe', env: { ...getDefaultEnvironment(), ...(process.env.MING_BASE_URL ? { MING_BASE_URL: process.env.MING_BASE_URL } : {}) } });
try {
  await client.connect(transport);
  const [name, json = '{}'] = process.argv.slice(2);
  if (!name || name === '--list') {
    console.log(JSON.stringify(await client.listTools(), null, 2));
  } else {
    const result = await client.callTool({ name, arguments: JSON.parse(json) });
    console.log(JSON.stringify(result, null, 2));
    if (result.isError) process.exitCode = 1;
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally { await client.close(); }
