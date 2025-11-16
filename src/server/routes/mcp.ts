import express from 'express';

const router = express.Router();

// Endpoint para extrair dados PIX via MCP
router.post('/extractPixData', async (req, res) => {
  try {
    const { apiKey, billingId, customerData } = req.body;

    if (!apiKey || !billingId || !customerData) {
      return res.status(400).json({
        success: false,
        error: 'Parâmetros obrigatórios: apiKey, billingId, customerData'
      });
    }

    // Chamar o MCP AbacatePay para extrair dados PIX
    const mcpResponse = await fetch('http://localhost:3001/mcp/tools/extractPixDataFromPaymentPage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        apiKey,
        billingId,
        customerData
      })
    });

    if (!mcpResponse.ok) {
      throw new Error(`MCP Error: ${mcpResponse.status}`);
    }

    const mcpResult = await mcpResponse.json();
    
    if (mcpResult.success) {
      return res.json({
        success: true,
        data: mcpResult.data
      });
    } else {
      return res.status(500).json({
        success: false,
        error: mcpResult.error || 'Erro ao extrair dados PIX'
      });
    }

  } catch (error) {
    console.error('Erro no endpoint extractPixData:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro interno do servidor'
    });
  }
});

export default router;