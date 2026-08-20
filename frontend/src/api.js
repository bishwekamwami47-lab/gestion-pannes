import axios from 'axios';

const API = axios.create({
  // En production, l'API est servie par le même domaine → '/api/'.
  // En dev ou si l'API est ailleurs, définir VITE_API_URL (ex. https://api.exemple.com/api/).
  baseURL: import.meta.env.VITE_API_URL || '/api/',
});

// Ajouter le token JWT à chaque requête si l'utilisateur est connecté
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Gestion des erreurs 401 : tentative de rafraîchissement du token
let refreshing = null;

API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;

    if (status === 401 && !original._retry && localStorage.getItem('refresh_token')) {
      original._retry = true;
      try {
        refreshing =
          refreshing ||
          API.post('auth/refresh/', { refresh: localStorage.getItem('refresh_token') });
        const { data } = await refreshing;
        refreshing = null;
        localStorage.setItem('access_token', data.access);
        if (data.refresh) {
          localStorage.setItem('refresh_token', data.refresh);
        }
        original.headers.Authorization = `Bearer ${data.access}`;
        return API(original);
      } catch (refreshError) {
        refreshing = null;
        localStorage.clear();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    if (status === 401) {
      localStorage.clear();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default API;
