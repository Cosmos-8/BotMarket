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

export default api;

