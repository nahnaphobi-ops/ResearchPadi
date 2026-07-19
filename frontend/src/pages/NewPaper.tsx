import { useNavigate } from 'react-router-dom';

export default function NewPaper() {
  const navigate = useNavigate();

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8 text-center">Choose Your Service</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-xl shadow-lg border-2 border-gray-200 hover:border-gray-500 transition cursor-pointer"
             onClick={() => navigate('/new-paper/full')}>
          <div className="text-4xl mb-4">📄</div>
          <h2 className="text-2xl font-bold mb-2">Full Paper Service</h2>
          <p className="text-gray-600 mb-4">Our AI writes your complete 10,000–15,000 word research paper from scratch.</p>
          <ul className="text-sm text-gray-500 space-y-2 mb-6">
            <li>• Comprehensive research included</li>
            <li>• APA 7th Edition formatting</li>
            <li>• Human-like writing style</li>
          </ul>
          <div className="text-xl font-bold text-gray-800">GHS 250</div>
        </div>

        <div
          className="bg-white p-8 rounded-xl shadow-lg border-2 border-gray-200 hover:border-gray-500 transition cursor-pointer"
          onClick={() => navigate('/subscribe')}
        >
          <div className="text-4xl mb-4">✍️</div>
          <h2 className="text-2xl font-bold mb-2">Assisted Workspace</h2>
          <p className="text-gray-600 mb-4">Write your paper with real-time AI assistance, suggestions, and citation finding.</p>
          <ul className="text-sm text-gray-500 space-y-2 mb-6">
            <li>• AI writing assistant (expand, rewrite, continue)</li>
            <li>• Real-time citation search</li>
            <li>• Rich text editor with auto-save</li>
          </ul>
          <div className="text-sm text-gray-500 mb-2">
            Standard from GHS 120/mo • Premium from GHS 200/mo
          </div>
          <div className="text-xl font-bold text-green-600">Get Started →</div>
        </div>
      </div>
    </div>
  );
}
