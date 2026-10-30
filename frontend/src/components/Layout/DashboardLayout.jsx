import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LayoutDashboard, LineChart, User,
    LogOut, Menu, X, FileText, Video
} from 'lucide-react';

const DashboardLayout = ({ children }) => {
    const [isSidebarOpen, setSidebarOpen] = useState(window.innerWidth > 1024);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth <= 1024;
            setIsMobile(mobile);
            if (!mobile) setSidebarOpen(true);
            else setSidebarOpen(false);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Close sidebar on navigation on mobile
    useEffect(() => {
        if (isMobile) setSidebarOpen(false);
    }, [location.pathname, isMobile]);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
    };

    return (
        <div className="flex min-h-screen bg-[#FDFCFB] font-sans text-slate-900 overflow-x-hidden">

            {/* MOBILE TOP BAR (Hidden on Desktop) */}
            <div className="lg:hidden fixed top-0 left-0 right-0 bg-[#0F172A] text-white h-16 px-4 flex items-center justify-between z-[60] shadow-md">
                <Link to="/student-home" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                    <div className="bg-white p-1 rounded-lg h-10 w-10 flex items-center justify-center">
                        <img src="/LOGO.jpeg" alt="Logo" className="h-full w-full object-contain rounded-sm" />
                    </div>
                    <span className="font-serif font-bold text-lg">JCL Siddha</span>
                </Link>
                <button
                    onClick={() => setSidebarOpen(!isSidebarOpen)}
                    className="p-2 hover:bg-slate-800 rounded-lg text-white"
                >
                    {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
            </div>

            {/* OVERLAY (Mobile only) */}
            <AnimatePresence>
                {isMobile && isSidebarOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setSidebarOpen(false)}
                        className="fixed inset-0 bg-black/50 z-[50] lg:hidden backdrop-blur-sm"
                    />
                )}
            </AnimatePresence>

            {/* SIDEBAR */}
            <aside className={`
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} 
        ${isSidebarOpen ? 'lg:w-64' : 'lg:w-24'} 
        bg-[#0F172A] text-white transition-all duration-300 flex flex-col fixed h-full z-[55] shadow-2xl overflow-hidden
      `}>

                {/* LOGO & BRANDING SECTION (Desktop only) */}
                <div className="hidden lg:flex p-4 mb-4 flex-col items-center">
                    <div className={`w-full flex items-center transition-all duration-300 ${isSidebarOpen ? 'justify-between mb-2' : 'justify-center'}`}>
                        <Link to="/student-home" className={`bg-white p-1.5 rounded-xl shadow-md transition-all duration-300 flex items-center justify-center hover:scale-105 active:scale-95 ${isSidebarOpen ? 'h-12 w-12' : 'h-14 w-14'}`}>
                            <img src="/LOGO.jpeg" alt="JCL Logo" className="h-full w-full object-contain rounded-md" />
                        </Link>
                        {isSidebarOpen && (
                            <button onClick={() => setSidebarOpen(false)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 focus:outline-none">
                                <X size={20} />
                            </button>
                        )}
                    </div>
                    <AnimatePresence>
                        {isSidebarOpen && (
                            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="w-full text-left mt-2 px-2">
                                <Link to="/student-home" className="hover:opacity-80 transition-opacity block group">
                                    <span className="text-lg font-serif font-bold tracking-tight text-white leading-tight block group-hover:text-blue-400">JCL Siddha</span>
                                    <span className="text-[10px] font-sans text-blue-400 font-bold uppercase tracking-widest">Academy</span>
                                </Link>
                            </motion.div>
                        )}
                    </AnimatePresence>
                    {!isSidebarOpen && (
                        <button onClick={() => setSidebarOpen(true)} className="mt-6 p-3 hover:bg-slate-800 rounded-xl text-slate-400 transition-colors focus:outline-none">
                            <Menu size={24} />
                        </button>
                    )}
                </div>

                {/* NAVIGATION */}
                <nav className="flex-1 mt-20 lg:mt-4 px-4 space-y-3">
                    <NavItem icon={<LayoutDashboard size={20} />} label="Dashboard" active={location.pathname === '/dashboard'} isOpen={isSidebarOpen} onClick={() => navigate('/dashboard')} />
                    <NavItem icon={<Video size={20} />} label="Video Classes" active={location.pathname === '/videos'} isOpen={isSidebarOpen} onClick={() => navigate('/videos')} />
                    {(() => {
                        let currentUser = null;
                        try { currentUser = JSON.parse(localStorage.getItem('user') || '{}'); } catch(e) {}
                        if (currentUser?.role === 'faculty' || currentUser?.role === 'admin') {
                            return <NavItem icon={<FileText size={20} />} label="Question Vault" active={location.pathname === '/admin'} isOpen={isSidebarOpen} onClick={() => navigate('/admin')} />;
                        }
                        return null;
                    })()}
                    <NavItem icon={<LineChart size={20} />} label="Progress" active={location.pathname === '/progresspage'} isOpen={isSidebarOpen} onClick={() => navigate('/progresspage')} />
                    <NavItem icon={<User size={20} />} label="Profile" active={location.pathname === '/profilepage'} isOpen={isSidebarOpen} onClick={() => navigate('/profilepage')} />
                </nav>

                {/* LOGOUT */}
                <div className="p-4 border-t border-slate-800">
                    <button onClick={handleLogout} className="flex items-center gap-4 px-4 py-3 w-full text-slate-400 hover:text-white transition-colors hover:bg-red-500/10 rounded-xl">
                        <LogOut size={20} />
                        {isSidebarOpen && <span className="font-medium text-sm">Logout</span>}
                    </button>
                </div>
            </aside>

            {/* MAIN CONTENT AREA */}
            <main className={`
        flex-1 transition-all duration-300 
        ${isSidebarOpen ? 'lg:ml-64' : 'lg:ml-24'} 
        mt-16 lg:mt-0 w-full min-h-screen
      `}>
                {children}
            </main>
        </div>
    );
};

const NavItem = ({ icon, label, active = false, isOpen, onClick }) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-4 px-4 py-3 rounded-xl w-full transition-all ${active ? 'bg-blue-800 text-white shadow-lg shadow-blue-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
    >
        <div className={`${!isOpen ? 'w-full flex justify-center' : ''}`}>{icon}</div>
        {isOpen && <span className="font-medium whitespace-nowrap">{label}</span>}
    </button>
);

export default DashboardLayout;
