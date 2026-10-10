export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-navy mt-auto">
      <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-center text-sm text-white/55">
        <p>&copy; {new Date().getFullYear()} ResearchPadi · AbusuaITLabs, Kumasi, Ghana</p>
        <a href="mailto:hello@researchpadi.com" className="hover:text-white transition">hello@researchpadi.com</a>
      </div>
    </footer>
  );
}
