import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/apiService';
import { useAuthStore } from '../store/useAuthStore';
import BrandLogo from '../components/common/BrandLogo';

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
    <div className="flex flex-col items-center justify-center min-h-screen py-10 bg-navy-mist">
      <div className="w-full max-w-lg p-8 bg-white rounded-[14px] border border-rule shadow-soft">
        <div className="flex justify-center mb-4">
          <BrandLogo markClassName="h-10 w-10" />
        </div>
        <h2 className="text-2xl font-bold mb-2 text-center text-navy">Complete your profile</h2>
        <p className="text-sm text-muted text-center mb-6">Tell us where you study so drafts match your university.</p>
        {error && <div className="p-3 mb-4 text-red-700 bg-red-100 rounded-xl">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block mb-1 font-medium text-ink">Full Name</label>
            <input
              name="full_name"
              type="text"
              className="w-full p-3 border rounded-[10px]"
              required
              onChange={handleChange}
              placeholder="e.g. Kwesi Mensah"
            />
          </div>
          <div>
            <label className="block mb-1 font-medium text-ink">Institution Type</label>
            <select
              name="institution_type"
              className="w-full p-3 border rounded-[10px]"
              onChange={handleChange}
            >
              <option value="university">University</option>
              <option value="nmtc">NMTC</option>
              <option value="technical_university">Technical University</option>
              <option value="college_of_education">College of Education</option>
            </select>
          </div>
          <div>
            <label className="block mb-1 font-medium text-ink">Institution Name</label>
            <input
              name="institution_name"
              type="text"
              className="w-full p-3 border rounded-[10px]"
              required
              onChange={handleChange}
              placeholder="e.g. KNUST"
            />
          </div>
          <div>
            <label className="block mb-1 font-medium text-ink">Programme</label>
            <input
              name="programme"
              type="text"
              className="w-full p-3 border rounded-[10px]"
              required
              onChange={handleChange}
              placeholder="e.g. BSc Computer Science"
            />
          </div>
          <div>
            <label className="block mb-1 font-medium text-ink">Level / Year</label>
            <input
              name="level"
              type="text"
              className="w-full p-3 border rounded-[10px]"
              placeholder="e.g. 400L or Final Year"
              required
              onChange={handleChange}
            />
          </div>
          <button
            disabled={loading}
            className="btn-primary w-full p-4 text-sm disabled:opacity-50"
          >
            {loading ? 'Saving Profile...' : 'Finish Registration'}
          </button>
        </form>
      </div>
    </div>
  );
}
