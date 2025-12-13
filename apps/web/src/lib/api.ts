import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Health check
export async function checkHealth() {
  const response = await api.get('/health');
  return response.data;
}

// Bots
export async function createBot(data: any, authHeaders?: any) {
  try {
    const response = await api.post('/bots', data, { headers: authHeaders });
    return response.data;
  } catch (error: any) {
    // Re-throw with more context
    if (error.response) {
      // Server responded with error
      throw error;
    } else if (error.request) {
      // Request made but no response (network error)
      throw new Error('Network error: Could not connect to API server. Make sure it is running on ' + API_URL);
    } else {
      // Something else happened
      throw error;
    }
  }
}

export async function getBots(params?: any) {
  const response = await api.get('/bots', { params });
  return response.data;
}

export async function getBot(botId: string) {
  const response = await api.get(`/bots/${botId}`);
  return response.data;
}

export async function forkBot(botId: string, data: any, authHeaders?: any) {
  const response = await api.post(`/bots/${botId}/fork`, data, { headers: authHeaders });
  return response.data;
}

export async function sendTestSignal(botId: string, signal: string) {
  const response = await api.post(`/bots/${botId}/test-signal`, { signal });
  return response.data;
}

export async function deleteBot(botId: string) {
  const response = await api.delete(`/bots/${botId}`);
  return response.data;
}

export async function startBot(botId: string) {
  const response = await api.post(`/bots/${botId}/start`);
  return response.data;
}

export async function stopBot(botId: string) {
  const response = await api.post(`/bots/${botId}/stop`);
  return response.data;
}

export async function getBotSignals(botId: string, limit = 20) {
  const response = await api.get(`/bots/${botId}/signals`, { params: { limit } });
  return response.data;
}

// Marketplace
export async function getMarketplace(params?: any) {
  const response = await api.get('/marketplace', { params });
  return response.data;
}

export async function getMarketplaceBot(botId: string) {
  const response = await api.get(`/marketplace/${botId}`);
  return response.data;
}

// Webhook
export async function sendWebhook(botId: string, payload: any, secret?: string) {
  const headers: any = {};
  if (secret) {
    headers['X-Webhook-Secret'] = secret;
  }
  const response = await api.post(`/webhook/${botId}`, payload, { headers });
  return response.data;
}

// Admin
export async function simulateFill(data: any) {
  const response = await api.post('/admin/simulate-fill', data);
  return response.data;
}

// Balance
export async function getBalance(address: string) {
  const response = await api.get(`/balance/${address}`);
  return response.data;
}

export async function fundBalance(address: string, amount: number) {
  const response = await api.post('/balance/fund', { address, amount });
  return response.data;
}

export async function allocateToBot(address: string, botId: string, amount: number) {
  const response = await api.post('/balance/allocate-to-bot', { address, botId, amount });
  return response.data;
}

export async function withdrawBalance(address: string, amount: number, toAddress: string) {
  const response = await api.post('/balance/withdraw', { address, amount, toAddress });
  return response.data;
}

export async function withdrawFromBot(address: string, botId: string, amount: number, toAddress?: string, toPool?: boolean) {
  const response = await api.post(`/balance/bot/${botId}/withdraw`, { address, amount, toAddress, toPool });
  return response.data;
}

export async function getBotBalance(botId: string) {
  const response = await api.get(`/balance/bot/${botId}`);
  return response.data;
}

export default api;

