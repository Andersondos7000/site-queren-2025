import { Client } from '@modelcontextprotocol/sdk/client'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

async function main() {
  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['tsx', 'src/mcp/resend-server.ts'],
    env: process.env,
    stderr: 'pipe'
  })

  const client = new Client({ name: 'mcp-test-client', version: '1.0.0' })
  await client.connect(transport)

  const tools = await client.listTools()
  console.log('[MCP TEST] Ferramentas disponíveis:', JSON.stringify(tools))

  // Opcional: chamar send_email se houver email de teste
  const to = process.env.MCP_TEST_TO_EMAIL
  if (to) {
    const result = await client.callTool('send_email', {
      to,
      subject: 'Teste MCP Resend',
      html: '<h1>Teste</h1><p>Conexão MCP Resend OK.</p>'
    })
    console.log('[MCP TEST] Resultado send_email:', JSON.stringify(result))
  } else {
    console.log('[MCP TEST] Skipping send_email (defina MCP_TEST_TO_EMAIL para enviar)')
  }

  await client.close()
}

main().catch((err) => {
  console.error('[MCP TEST] Erro:', err)
  process.exit(1)
})
