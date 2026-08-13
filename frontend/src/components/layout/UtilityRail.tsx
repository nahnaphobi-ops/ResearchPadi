import { MessageCircle, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function UtilityRail() {
  const navigate = useNavigate();

  return (
    <div className="fixed right-0 top-1/2 z-40 hidden -translate-y-1/2 md:flex">
      <div className="flex flex-col overflow-hidden rounded-l-xl bg-navy shadow-card">
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="grid h-12 w-11 place-items-center text-white hover:bg-navy-hover"
          aria-label="Sign in"
        >
          <UserRound size={18} />
        </button>
        <button
          type="button"
          onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
          className="grid h-12 w-11 place-items-center border-t border-white/15 text-white hover:bg-navy-hover"
          aria-label="Contact"
        >
          <MessageCircle size={18} />
        </button>
      </div>
    </div>
  );
}
