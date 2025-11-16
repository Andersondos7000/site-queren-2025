import type { NextApiRequest, NextApiResponse } from 'next';

import { getAbacatePayService } from '../../../../services/abacatePayService';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'ID da cobrança é obrigatório' });
  }

  try {
    const abacatePayService = getAbacatePayService();
    const cobranca = await abacatePayService.consultarCobranca(id);
    
    return res.status(200).json(cobranca);
  } catch (error) {
    console.error('Erro ao consultar cobrança:', error);
    return res.status(500).json({ error: 'Erro ao consultar cobrança' });
  }
}