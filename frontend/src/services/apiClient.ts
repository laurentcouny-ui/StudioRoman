/**
 * Client API pour communiquer avec le backend Java (Spring Boot)
 * Le proxy Vite redirige automatiquement /api vers http://localhost:8080/api
 */
const BASE_URL = '/api/v1/ia';

export const apiClient = {
  async get(endpoint: string) {
    const response = await fetch(`${BASE_URL}${endpoint}`);
    if (!response.ok) throw new Error(`Erreur réseau: ${response.status}`);
    return response.json();
  },

  async post(endpoint: string, data: any) {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error(`Erreur réseau: ${response.status}`);
    return response.json();
  },

  async delete(endpoint: string) {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error(`Erreur réseau: ${response.status}`);
    // delete peut renvoyer une réponse vide, on gère ce cas
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }
};
