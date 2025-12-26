import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { BrowserRouter } from 'react-router-dom'
import axios from 'axios'

// Configure axios interceptor for Safari/iOS token fallback
axios.interceptors.request.use(
  (config) => {
    // Get token from localStorage (Safari/iOS fallback)
    const token = localStorage.getItem('userToken');
    
    // If token exists and request needs credentials, add it as Authorization header
    if (token && config.withCredentials !== false) {
      config.headers = config.headers || {};
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
)
