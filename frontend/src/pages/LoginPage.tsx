/// <reference types="vite/client" />
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../lib/api';
import toast from 'react-hot-toast';

declare global {
  interface Window {
    google: any;
  }
}

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    // Initialize Google Sign-In
    if (window.google) {
      window.google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        callback: handleGoogleResponse,
      });

      window.google.accounts.id.renderButton(
        document.getElementById('google-signin-button'),
        {
          type: 'standard',
          size: 'large',
          text: 'signin_with',
          locale: 'en_US',
        }
      );
    }
  }, []);

  const handleGoogleResponse = async (response: any) => {
    try {
      setLoading(true);

      if (!response.credential) {
        throw new Error('No credential received from Google');
      }

      // Send token to backend
      const res = await api.post('/api/auth/google', {
        token: response.credential,
      });

      const { token, user } = res.data;

      // Store auth data
      setAuth(token, user);
      toast.success(`Welcome, ${user.name}!`);
      navigate('/');
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Login failed';
      toast.error(message);
      console.error('Login error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    // Google button is rendered automatically via renderButton
  };

  // Demo direct login (for development only)
  const handleDemoLogin = async () => {
    try {
      setLoading(true);
      // In production, remove this and only use Google OAuth
      const demoUser = {
        id: 1,
        email: 'demo@example.com',
        name: 'Demo User',
        role: 'Owner',
        businessId: 1,
      };
      const demoToken = 'demo-token';
      
      setAuth(demoToken, demoUser);
      toast.success('Demo login successful');
      navigate('/');
    } catch (error: any) {
      toast.error('Demo login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">POS System</h1>
          <p className="text-gray-600">Sign in to continue</p>
        </div>

        <div className="space-y-4">
          <div
            id="google-signin-button"
            className="flex justify-center"
            style={{ width: '100%' }}
          ></div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or for demo</span>
            </div>
          </div>

          <button
            onClick={handleDemoLogin}
            disabled={loading}
            className="w-full px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Demo Login'}
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-gray-500">
          Protected by Google OAuth 2.0
        </p>
      </div>
    </div>
  );
}
