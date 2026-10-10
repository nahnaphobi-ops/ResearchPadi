import { useState } from 'react';
import { apiErrorMessage } from '../utils/apiError';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { parsePlan, planDestination, withPlan } from '../utils/planIntent';
import { authService } from '../services/apiService';
import { useAuthStore } from '../store/useAuthStore';
import BrandLogo from '../components/common/BrandLogo';

const fields = [
  { name: 'full_name', label: 'Full name', placeholder: 'e.g. Kwesi Mensah', autoComplete: 'name' },
  { name: 'institution_name', label: 'Institution name', placeholder: 'e.g. KNUST', autoComplete: 'organization' },
  { name: 'programme', label: 'Programme', placeholder: 'e.g. BSc Computer Science', autoComplete: 'off' },
  { name: 'level', label: 'Level / year', placeholder: 'e.g. 400L or Final Year', autoComplete: 'off' },
] as const;

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
  const [searchParams] = useSearchParams();
  const plan = parsePlan(searchParams.get('plan'));
  const token = useAuthStore((state) => state.token);
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
      navigate(planDestination(plan));
    } catch (err) {
      setError(apiErrorMessage(err, 'Registration failed'));
    } finally {
      setLoading(false);
    }
  };

  // Profile setup needs the session from phone verification.
  if (!token) return <Navigate to={withPlan('/login', plan)} replace />;

  const nameField = fields[0];
  const otherFields = fields.slice(1);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-5 py-10 bg-navy-mist">
      <div className="w-full max-w-lg p-6 sm:p-8 bg-white rounded-[14px] border border-rule shadow-soft">
        <div className="flex justify-center mb-4">
          <BrandLogo markClassName="h-10 w-10" />
        </div>
        <p className="eyebrow text-center mb-2">Step 2 of 2</p>
        <h1 className="text-2xl font-bold mb-2 text-center text-navy">Complete your profile</h1>
        <p className="text-sm text-muted text-center mb-6">Tell us where you study so drafts match your university.</p>
        {error && <div role="alert" className="p-3 mb-4 text-sm text-red-700 bg-red-100 rounded-xl">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor={nameField.name} className="block mb-1 text-sm font-medium text-ink">{nameField.label}</label>
            <input
              id={nameField.name}
              name={nameField.name}
              type="text"
              className="w-full p-3 border rounded-[10px]"
              required
              autoFocus
              autoComplete={nameField.autoComplete}
              onChange={handleChange}
              placeholder={nameField.placeholder}
            />
          </div>
          <div>
            <label htmlFor="institution_type" className="block mb-1 text-sm font-medium text-ink">Institution type</label>
            <select
              id="institution_type"
              name="institution_type"
              className="w-full p-3 border rounded-[10px]"
              onChange={handleChange}
              value={formData.institution_type}
            >
              <option value="university">University</option>
              <option value="nmtc">NMTC</option>
              <option value="technical_university">Technical University</option>
              <option value="college_of_education">College of Education</option>
            </select>
          </div>
          {otherFields.map((f) => (
            <div key={f.name}>
              <label htmlFor={f.name} className="block mb-1 text-sm font-medium text-ink">{f.label}</label>
              <input
                id={f.name}
                name={f.name}
                type="text"
                className="w-full p-3 border rounded-[10px]"
                required
                autoComplete={f.autoComplete}
                onChange={handleChange}
                placeholder={f.placeholder}
              />
            </div>
          ))}
          <button
            disabled={loading}
            className="btn-primary w-full p-4 text-sm disabled:opacity-50"
          >
            {loading ? 'Saving profile...' : 'Finish registration'}
          </button>
        </form>
      </div>
    </div>
  );
}
