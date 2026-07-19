import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/apiService';
import { useAuthStore } from '../store/useAuthStore';

export default function Register() {
  const [formData, setFormData] = useState({
    full_name: '',
    institution_type: 'university',
    institution_name: '',
    programme: '',
    level: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await authService.updateProfile(formData);
      const { user, token } = response.data;
      if (token) {
        setAuth(token, user);
      }
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-10 bg-gray-50">
      <div className="w-full max-w-lg p-8 bg-white rounded shadow-xl">
        <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Complete Your Profile</h2>
        {error && <div className="p-3 mb-4 text-red-700 bg-red-100 rounded">{error}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block mb-1 font-medium text-gray-700">Full Name</label>
            <input 
              name="full_name" 
              type="text" 
              className="w-full p-3 border rounded focus:ring-2 focus:ring-gray-500" 
              required 
              onChange={handleChange} 
              placeholder="e.g. Kwesi Mensah"
            />
          </div>
          <div>
            <label className="block mb-1 font-medium text-gray-700">Institution Type</label>
            <select 
              name="institution_type" 
              className="w-full p-3 border rounded focus:ring-2 focus:ring-gray-500" 
              onChange={handleChange}
            >
              <option value="university">University</option>
              <option value="nmtc">NMTC</option>
              <option value="technical_university">Technical University</option>
              <option value="college_of_education">College of Education</option>
            </select>
          </div>
          <div>
            <label className="block mb-1 font-medium text-gray-700">Institution Name</label>
            <input 
              name="institution_name" 
              type="text" 
              className="w-full p-3 border rounded focus:ring-2 focus:ring-gray-500" 
              required 
              onChange={handleChange} 
              placeholder="e.g. KNUST"
            />
          </div>
          <div>
            <label className="block mb-1 font-medium text-gray-700">Programme</label>
            <input 
              name="programme" 
              type="text" 
              className="w-full p-3 border rounded focus:ring-2 focus:ring-gray-500" 
              required 
              onChange={handleChange} 
              placeholder="e.g. BSc Computer Science"
            />
          </div>
          <div>
            <label className="block mb-1 font-medium text-gray-700">Level / Year</label>
            <input 
              name="level" 
              type="text" 
              className="w-full p-3 border rounded focus:ring-2 focus:ring-gray-500" 
              placeholder="e.g. 400L or Final Year" 
              required 
              onChange={handleChange} 
            />
          </div>
          <button 
            disabled={loading}
            className="w-full p-4 bg-gray-800 text-white rounded font-bold hover:bg-gray-900 disabled:bg-gray-400 transition duration-200"
          >
            {loading ? 'Saving Profile...' : 'Finish Registration'}
          </button>
        </form>
      </div>
    </div>
  );
}
