import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Play, Search, Film, Clock, Video as VideoIcon, X, Sparkles, ChevronRight, RefreshCw
} from 'lucide-react';
import DashboardLayout from '../components/Layout/DashboardLayout';

const API_URL = process.env.REACT_APP_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : "https://jclsiddhaacademy.in");

export default function StudentVideosPage() {
    const [videos, setVideos] = useState([]);
    const [categories, setCategories] = useState(['Both', 'MRB', 'AIAPGET', 'Crash Course']);
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [activeVideo, setActiveVideo] = useState(null);
    const [userCategory, setUserCategory] = useState('');

    // Fetch user info from localStorage or profile
    useEffect(() => {
        try {
            const storedUser = localStorage.getItem('user');
            if (storedUser) {
                const parsed = JSON.parse(storedUser);
                if (parsed.category) {
                    setUserCategory(parsed.category);
                }
            }
        } catch (e) {
            console.error('Error reading user category:', e);
        }
    }, []);

    // Fetch categories
    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const res = await fetch(`${API_URL}/api/categories`);
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data) && data.length > 0) {
                        const names = data.map(c => typeof c === 'string' ? c : c.name).filter(Boolean);
                        if (names.length > 0) {
                            setCategories(names);
                        }
                    }
                }
            } catch (err) {
                console.error('Failed to load categories:', err);
            }
        };
        fetchCategories();
    }, []);

    // Fetch videos
    const fetchVideos = useCallback(async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const url = new URL(`${API_URL}/api/videos`);
            if (selectedCategory !== 'All') {
                url.searchParams.set('category', selectedCategory);
            }
            if (searchQuery.trim()) {
                url.searchParams.set('search', searchQuery.trim());
            }

            const res = await fetch(url.toString(), {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });

            if (res.ok) {
                const data = await res.json();
                setVideos(Array.isArray(data) ? data : []);
            }
        } catch (err) {
            console.error('Failed to load videos:', err);
        } finally {
            setLoading(false);
        }
    }, [selectedCategory, searchQuery]);

    useEffect(() => {
        fetchVideos();
    }, [fetchVideos]);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        fetchVideos();
    };

    const getCategoryBadgeClass = (cat) => {
        switch (cat) {
            case 'MRB':
                return 'bg-orange-100 text-orange-700 border-orange-200';
            case 'AIAPGET':
                return 'bg-indigo-100 text-indigo-700 border-indigo-200';
            case 'Crash Course':
                return 'bg-rose-100 text-rose-700 border-rose-200';
            case 'Both':
                return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            default:
                return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    return (
        <DashboardLayout>
            <div className="p-4 md:p-8 lg:p-12 max-w-7xl mx-auto space-y-8">
                {/* HERO / HEADER SECTION */}
                <header className="relative bg-gradient-to-br from-[#0F172A] via-slate-900 to-blue-950 text-white rounded-3xl p-6 md:p-10 shadow-xl overflow-hidden">
                    <div className="absolute top-0 right-0 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl pointer-events-none"></div>
                    <div className="absolute bottom-0 left-10 w-64 h-64 bg-blue-500/10 rounded-full blur-2xl pointer-events-none"></div>

                    <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="space-y-2 max-w-2xl">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-orange-400 text-xs font-bold uppercase tracking-wider">
                                <Sparkles size={14} /> Video Learning Center
                            </div>
                            <h1 className="text-2xl md:text-4xl font-serif font-bold text-white tracking-tight">
                                Recorded Classes & Video Lectures
                            </h1>
                            <p className="text-slate-300 text-sm md:text-base leading-relaxed">
                                Watch in-depth subject lectures, high-yield topic discussions, and exam revisions by our expert faculty.
                            </p>
                            {userCategory && (
                                <div className="pt-2 flex items-center gap-2">
                                    <span className="text-xs text-slate-400 font-medium">Your Enrolled Stream:</span>
                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-500/20 text-orange-300 border border-orange-500/30">
                                        {userCategory}
                                    </span>
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col sm:flex-row md:flex-col gap-3 shrink-0">
                            <div className="bg-white/5 border border-white/10 backdrop-blur-md p-4 rounded-2xl text-center">
                                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Available</p>
                                <p className="text-3xl font-extrabold text-white mt-1">{videos.length}</p>
                                <p className="text-[11px] text-emerald-400 font-semibold mt-0.5">Classes & Discussions</p>
                            </div>
                        </div>
                    </div>
                </header>

                {/* FILTER & SEARCH CONTROLS */}
                <div className="bg-white p-4 md:p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        {/* Search Bar */}
                        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                placeholder="Search lectures by title or topic..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all text-slate-800"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => { setSearchQuery(''); setTimeout(fetchVideos, 0); }}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </form>

                        {/* Refresh */}
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={fetchVideos}
                                className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors flex items-center gap-1.5 text-xs font-bold"
                                title="Refresh Videos"
                            >
                                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                                <span className="hidden sm:inline">Refresh</span>
                            </button>
                        </div>
                    </div>

                    {/* Category Filter Pills */}
                    <div className="pt-2 border-t border-slate-100 flex items-center gap-2 overflow-x-auto pb-1">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1 shrink-0">
                            Category:
                        </span>
                        <button
                            type="button"
                            onClick={() => setSelectedCategory('All')}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                                selectedCategory === 'All'
                                    ? 'bg-[#0F172A] text-white shadow-md'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            All Categories
                        </button>
                        {categories.map((cat) => (
                            <button
                                key={cat}
                                type="button"
                                onClick={() => setSelectedCategory(cat)}
                                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                                    selectedCategory === cat
                                        ? 'bg-blue-900 text-white shadow-md'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

                {/* VIDEOS GRID */}
                {loading ? (
                    <div className="py-20 text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-900 mx-auto mb-4"></div>
                        <p className="text-sm font-semibold text-slate-500">Loading video classes...</p>
                    </div>
                ) : videos.length === 0 ? (
                    <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center shadow-sm space-y-4">
                        <div className="w-16 h-16 bg-blue-50 text-blue-900 rounded-2xl flex items-center justify-center mx-auto">
                            <VideoIcon size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800">No Videos Found</h3>
                        <p className="text-sm text-slate-500 max-w-md mx-auto">
                            {selectedCategory !== 'All' || searchQuery
                                ? `No recorded classes found matching "${searchQuery || selectedCategory}". Try selecting another category or resetting filters.`
                                : 'There are currently no recorded lectures published. Please check back later.'}
                        </p>
                        {(selectedCategory !== 'All' || searchQuery) && (
                            <button
                                onClick={() => {
                                    setSelectedCategory('All');
                                    setSearchQuery('');
                                }}
                                className="px-5 py-2.5 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition-all shadow-md inline-flex items-center gap-2"
                            >
                                View All Categories
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {videos.map((vid) => (
                            <motion.div
                                key={vid._id}
                                whileHover={{ y: -4 }}
                                transition={{ duration: 0.2 }}
                                className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl transition-all overflow-hidden flex flex-col group cursor-pointer"
                                onClick={() => setActiveVideo(vid)}
                            >
                                {/* Thumbnail Container */}
                                <div className="relative aspect-video w-full bg-slate-900 overflow-hidden flex items-center justify-center">
                                    {vid.thumbnail ? (
                                        <img
                                            src={vid.thumbnail}
                                            alt={vid.title}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex flex-col items-center justify-center text-slate-400 p-4 text-center">
                                            <Film size={36} className="text-orange-400/80 mb-2" />
                                            <span className="text-xs font-medium text-slate-300 line-clamp-1">{vid.title}</span>
                                        </div>
                                    )}

                                    {/* Play Overlay */}
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <div className="w-12 h-12 rounded-full bg-[#C2410C] text-white flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                                            <Play size={22} className="ml-1 fill-white" />
                                        </div>
                                    </div>

                                    {/* Category Pill */}
                                    <div className="absolute top-3 left-3">
                                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border shadow-sm ${getCategoryBadgeClass(vid.category)}`}>
                                            {vid.category || 'General'}
                                        </span>
                                    </div>

                                    {/* Duration Badge */}
                                    {vid.duration && (
                                        <div className="absolute bottom-3 right-3 bg-black/80 backdrop-blur-xs text-white text-[11px] font-mono font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm">
                                            <Clock size={11} /> {vid.duration}
                                        </div>
                                    )}
                                </div>

                                {/* Body */}
                                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                                    <div>
                                        <h3 className="font-bold text-slate-900 text-base line-clamp-2 group-hover:text-blue-900 transition-colors" title={vid.title}>
                                            {vid.title}
                                        </h3>
                                        {vid.description && (
                                            <p className="text-xs text-slate-500 line-clamp-2 mt-2 leading-relaxed" title={vid.description}>
                                                {vid.description}
                                            </p>
                                        )}
                                    </div>

                                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                                        <span className="text-[11px] text-slate-400 font-medium">
                                            {vid.createdAt ? new Date(vid.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Lecture'}
                                        </span>

                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setActiveVideo(vid);
                                            }}
                                            className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-900 group-hover:text-[#C2410C] transition-colors"
                                        >
                                            Watch Video <ChevronRight size={14} />
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}

                {/* VIDEO PLAYER MODAL */}
                <AnimatePresence>
                    {activeVideo && (
                        <div
                            className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
                            onClick={() => setActiveVideo(null)}
                        >
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="bg-slate-900 rounded-3xl max-w-4xl w-full shadow-2xl overflow-hidden border border-slate-800 text-white flex flex-col"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* Player Header */}
                                <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
                                    <div className="pr-4">
                                        <h4 className="font-bold text-base text-slate-100 line-clamp-1">{activeVideo.title}</h4>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${getCategoryBadgeClass(activeVideo.category)}`}>
                                                {activeVideo.category || 'General'}
                                            </span>
                                            {activeVideo.duration && (
                                                <span className="text-[11px] text-slate-400 font-mono">
                                                    Duration: {activeVideo.duration}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setActiveVideo(null)}
                                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors shrink-0"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>

                                {/* HTML5 Video Player */}
                                <div className="aspect-video w-full bg-black flex items-center justify-center relative">
                                    <video
                                        src={activeVideo.videoUrl}
                                        controls
                                        autoPlay
                                        controlsList="nodownload"
                                        className="w-full h-full object-contain"
                                    >
                                        Your browser does not support the video tag.
                                    </video>
                                </div>

                                {/* Video Notes / Description */}
                                <div className="p-6 bg-slate-950/90 text-xs text-slate-300">
                                    <h5 className="font-bold text-sm text-white mb-1">About this Lecture</h5>
                                    <p className="leading-relaxed text-slate-300 whitespace-pre-line">
                                        {activeVideo.description || 'No detailed lecture notes provided for this session.'}
                                    </p>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </DashboardLayout>
    );
}
