import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Upload, Play, Trash2, Edit3, Eye, Copy, Check,
    Film, Clock, Search, Filter, RefreshCw,
    X, AlertCircle, FileVideo, Image as ImageIcon,
    ExternalLink
} from 'lucide-react';

const DEFAULT_ADMIN_CATEGORIES = ['Both', 'MRB', 'AIAPGET', 'Crash Course'];

export default function VideoManagement({ API_URL }) {
    const [videos, setVideos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [categories, setCategories] = useState(DEFAULT_ADMIN_CATEGORIES);
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'

    // Modals
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [selectedVideoToPlay, setSelectedVideoToPlay] = useState(null);
    const [editingVideo, setEditingVideo] = useState(null);
    const [deletingVideoId, setDeletingVideoId] = useState(null);

    // Upload Form State
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const [copiedId, setCopiedId] = useState(null);

    // Form inputs
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        category: 'Both',
        duration: '00:00',
        size: 0,
        videoUrl: '',
        thumbnail: ''
    });

    // File references
    const [videoFile, setVideoFile] = useState(null);
    const [thumbFile, setThumbFile] = useState(null);
    const [thumbPreview, setThumbPreview] = useState('');

    // Fetch videos
    const fetchVideos = useCallback(async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/api/admin/videos`, {
                headers: { Authorization: `Bearer ${token}` },
                params: {
                    category: selectedCategory !== 'All' ? selectedCategory : undefined,
                    search: searchQuery || undefined
                }
            });
            setVideos(res.data);
        } catch (err) {
            console.error('Failed to load videos:', err);
        } finally {
            setLoading(false);
        }
    }, [API_URL, selectedCategory, searchQuery]);

    // Fetch categories dynamically
    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const res = await axios.get(`${API_URL}/api/categories`);
                if (Array.isArray(res.data) && res.data.length > 0) {
                    const catNames = res.data
                        .map(c => typeof c === 'string' ? c : c.name)
                        .filter(Boolean);
                    if (catNames.length > 0) {
                        setCategories(catNames);
                    }
                }
            } catch (err) {
                console.error('Failed to load categories:', err);
            }
        };
        fetchCategories();
    }, [API_URL]);

    useEffect(() => {
        fetchVideos();
    }, [fetchVideos]);

    // Handle search submission or debouncing
    const handleSearchSubmit = (e) => {
        e.preventDefault();
        fetchVideos();
    };

    // Format file size
    const formatBytes = (bytes) => {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // Format duration helper
    const formatDurationSecs = (seconds) => {
        if (!seconds || isNaN(seconds)) return '00:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        const hrs = Math.floor(mins / 60);
        if (hrs > 0) {
            const remMins = mins % 60;
            return `${hrs}:${remMins < 10 ? '0' : ''}${remMins}:${secs < 10 ? '0' : ''}${secs}`;
        }
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    // Handle video file selection: auto-detect size and duration
    const handleVideoFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setVideoFile(file);
        setUploadError('');

        // Pre-fill title if empty
        const defaultTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
        setFormData(prev => ({
            ...prev,
            title: prev.title || defaultTitle,
            size: file.size
        }));

        // Load into object URL to read metadata (duration) & auto thumbnail
        const fileObjUrl = URL.createObjectURL(file);
        const tempVideo = document.createElement('video');
        tempVideo.src = fileObjUrl;
        tempVideo.preload = 'metadata';

        tempVideo.onloadedmetadata = () => {
            const detectedDuration = formatDurationSecs(tempVideo.duration);
            setFormData(prev => ({
                ...prev,
                duration: detectedDuration
            }));

            // Auto capture snapshot at 1s as thumbnail if not provided
            tempVideo.currentTime = Math.min(1, tempVideo.duration / 2);
        };

        tempVideo.onseeked = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = tempVideo.videoWidth || 640;
                canvas.height = tempVideo.videoHeight || 360;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
                const snapshotUrl = canvas.toDataURL('image/jpeg', 0.85);
                if (!thumbPreview && !thumbFile) {
                    setThumbPreview(snapshotUrl);
                    setFormData(prev => ({ ...prev, thumbnail: snapshotUrl }));
                }
            } catch (err) {
                console.warn('Could not auto-generate thumbnail frame:', err);
            }
        };
    };

    // Handle thumbnail file selection
    const handleThumbFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setThumbFile(file);
        const previewUrl = URL.createObjectURL(file);
        setThumbPreview(previewUrl);
    };

    // Submit video upload (Direct Video File Upload)
    const handleUploadSubmit = async (e) => {
        e.preventDefault();
        setUploadError('');

        if (!formData.title.trim()) {
            setUploadError('Please provide a video title.');
            return;
        }

        if (!videoFile) {
            setUploadError('Please select a video file to upload.');
            return;
        }

        const token = localStorage.getItem('token');

        try {
            setIsUploading(true);
            setUploadProgress(0);

            // Step 1: Upload physical files to backend storage
            const uploadPayload = new FormData();
            uploadPayload.append('video', videoFile);
            if (thumbFile) {
                uploadPayload.append('thumbnail', thumbFile);
            } else if (thumbPreview && thumbPreview.startsWith('data:image')) {
                const res = await fetch(thumbPreview);
                const blob = await res.blob();
                uploadPayload.append('thumbnail', blob, 'thumbnail.jpg');
            }

            const uploadRes = await axios.post(`${API_URL}/api/admin/videos/upload`, uploadPayload, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                },
                onUploadProgress: (progressEvent) => {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
                    setUploadProgress(percentCompleted);
                }
            });

            const finalVideoUrl = uploadRes.data.videoUrl;
            const finalThumbnail = uploadRes.data.thumbnailUrl || '';
            const finalSize = uploadRes.data.size || videoFile.size;

            // Step 2: Save Video metadata in MongoDB
            await axios.post(`${API_URL}/api/admin/videos`, {
                title: formData.title.trim(),
                description: formData.description.trim(),
                category: formData.category || categories[0] || 'Both',
                duration: formData.duration || '00:00',
                videoUrl: finalVideoUrl,
                thumbnail: finalThumbnail,
                size: Number(finalSize) || 0,
                storageType: 'local'
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // Reset form & reload
            resetUploadForm();
            setIsUploadModalOpen(false);
            fetchVideos();
        } catch (err) {
            console.error('Video upload failed:', err);
            setUploadError(err.response?.data?.message || err.message || 'Failed to upload video');
        } finally {
            setIsUploading(false);
        }
    };

    // Update existing video
    const handleUpdateVideo = async (e) => {
        e.preventDefault();
        if (!editingVideo) return;
        try {
            const token = localStorage.getItem('token');
            await axios.put(`${API_URL}/api/admin/videos/${editingVideo._id}`, editingVideo, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setEditingVideo(null);
            fetchVideos();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to update video');
        }
    };

    // Delete video
    const handleDeleteVideo = async (id) => {
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`${API_URL}/api/admin/videos/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setDeletingVideoId(null);
            fetchVideos();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to delete video');
        }
    };

    const copyToClipboard = (text, id) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const resetUploadForm = () => {
        setFormData({
            title: '',
            description: '',
            category: categories[0] || 'Both',
            duration: '00:00',
            size: 0,
            videoUrl: '',
            thumbnail: ''
        });
        setVideoFile(null);
        setThumbFile(null);
        setThumbPreview('');
        setUploadProgress(0);
        setUploadError('');
    };

    // Aggregate statistics
    const totalVideosCount = videos.length;

    return (
        <div className="space-y-6 pb-12">
            {/* STATS OVERVIEW CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Videos</p>
                        <h3 className="text-2xl font-bold text-slate-800 mt-1">{totalVideosCount}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">In catalog</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-orange-50 text-[#C2410C] flex items-center justify-center">
                        <Film size={24} />
                    </div>
                </div>

                <div className="bg-gradient-to-br from-[#0F172A] to-slate-800 p-5 rounded-2xl text-white shadow-lg shadow-slate-900/10 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-orange-400">Video Center</p>
                        <p className="text-sm text-slate-200 mt-1 font-medium">Upload lecture videos for students</p>
                    </div>
                    <button
                        onClick={() => {
                            resetUploadForm();
                            setIsUploadModalOpen(true);
                        }}
                        className="bg-[#C2410C] hover:bg-[#ea580c] text-white px-5 py-2.5 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
                    >
                        <Upload size={14} /> Upload Video
                    </button>
                </div>
            </div>

            {/* FILTER & CONTROLS TOOLBAR */}
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col lg:flex-row items-center justify-between gap-4">
                {/* Search Bar */}
                <form onSubmit={handleSearchSubmit} className="relative w-full lg:w-80">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search videos by title or topic..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C2410C] focus:bg-white transition-all"
                    />
                </form>

                {/* Categories & Actions */}
                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-between lg:justify-end">
                    {/* Category Dropdown */}
                    <div className="flex items-center gap-2">
                        <Filter size={16} className="text-slate-400" />
                        <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C2410C]"
                        >
                            <option value="All">All Categories</option>
                            {categories.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>

                    {/* Refresh */}
                    <button
                        onClick={fetchVideos}
                        className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
                        title="Refresh catalog"
                    >
                        <RefreshCw size={18} className={loading ? "animate-spin text-[#C2410C]" : ""} />
                    </button>

                    {/* View Switcher */}
                    <div className="bg-slate-100 p-1 rounded-xl flex items-center">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${viewMode === 'grid' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                        >
                            Grid
                        </button>
                        <button
                            onClick={() => setViewMode('table')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${viewMode === 'table' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                        >
                            List
                        </button>
                    </div>

                    {/* Upload Button */}
                    <button
                        onClick={() => {
                            resetUploadForm();
                            setIsUploadModalOpen(true);
                        }}
                        className="bg-[#C2410C] hover:bg-[#9a3412] text-white px-4 py-2 rounded-xl font-semibold text-xs flex items-center gap-2 transition-all shadow-md shadow-orange-900/10 active:scale-95"
                    >
                        <Upload size={15} /> Upload Video
                    </button>
                </div>
            </div>

            {/* VIDEO LIST / GRID */}
            {loading ? (
                <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center shadow-sm">
                    <div className="inline-block animate-spin text-[#C2410C] mb-3">
                        <RefreshCw size={32} />
                    </div>
                    <p className="text-slate-500 font-medium">Loading video library...</p>
                </div>
            ) : videos.length === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-16 text-center shadow-sm">
                    <div className="w-16 h-16 rounded-2xl bg-orange-50 text-[#C2410C] flex items-center justify-center mx-auto mb-4">
                        <FileVideo size={32} />
                    </div>
                    <h3 className="text-lg font-serif font-bold text-slate-800">No videos found</h3>
                    <p className="text-slate-500 text-sm max-w-sm mx-auto mt-1 mb-6">
                        {searchQuery ? `No videos matching "${searchQuery}" in ${selectedCategory}.` : 'Start by uploading your first lecture or practical video.'}
                    </p>
                    <button
                        onClick={() => {
                            resetUploadForm();
                            setIsUploadModalOpen(true);
                        }}
                        className="bg-[#C2410C] hover:bg-[#9a3412] text-white px-5 py-2.5 rounded-xl font-semibold text-sm inline-flex items-center gap-2 transition-all shadow-md"
                    >
                        <Upload size={16} /> Upload Video Now
                    </button>
                </div>
            ) : viewMode === 'grid' ? (
                /* GRID VIEW */
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {videos.map((vid) => (
                        <div
                            key={vid._id}
                            className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col group"
                        >
                            {/* Video Thumbnail */}
                            <div className="relative aspect-video bg-slate-900 overflow-hidden flex items-center justify-center">
                                {vid.thumbnail ? (
                                    <img
                                        src={vid.thumbnail}
                                        alt={vid.title}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                        onError={(e) => {
                                            e.target.onerror = null;
                                            e.target.src = 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=640&q=80';
                                        }}
                                    />
                                ) : (
                                    <div className="flex flex-col items-center justify-center text-slate-500">
                                        <Film size={36} />
                                        <span className="text-[10px] mt-1 font-bold uppercase tracking-wider">Video Lecture</span>
                                    </div>
                                )}

                                {/* Duration Badge */}
                                <div className="absolute bottom-2 right-2 bg-black/80 text-white px-2 py-0.5 rounded-md text-[11px] font-mono font-medium flex items-center gap-1 backdrop-blur-xs">
                                    <Clock size={11} /> {vid.duration || '00:00'}
                                </div>

                                {/* Category Badge */}
                                <div className="absolute top-2 left-2 bg-[#0F172A]/85 text-orange-300 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider backdrop-blur-xs">
                                    {vid.category || 'General'}
                                </div>

                                {/* Play Overlay */}
                                <button
                                    onClick={() => setSelectedVideoToPlay(vid)}
                                    className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                                    title="Play Video"
                                >
                                    <div className="w-12 h-12 rounded-full bg-[#C2410C] text-white flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                                        <Play size={22} className="ml-1 fill-white" />
                                    </div>
                                </button>
                            </div>

                            {/* Details */}
                            <div className="p-4 flex-1 flex flex-col justify-between">
                                <div>
                                    <h4 className="font-bold text-slate-900 text-sm line-clamp-1 group-hover:text-[#C2410C] transition-colors" title={vid.title}>
                                        {vid.title}
                                    </h4>
                                    {vid.description && (
                                        <p className="text-xs text-slate-500 line-clamp-2 mt-1" title={vid.description}>
                                            {vid.description}
                                        </p>
                                    )}
                                </div>

                                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                                    <span className="font-mono font-medium bg-slate-50 px-2 py-0.5 rounded-md text-slate-600">
                                        {formatBytes(vid.size)}
                                    </span>

                                    <div className="flex items-center gap-1">
                                        {/* Copy Link */}
                                        <button
                                            onClick={() => copyToClipboard(vid.videoUrl, vid._id)}
                                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-colors"
                                            title="Copy Direct Video Link"
                                        >
                                            {copiedId === vid._id ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                                        </button>

                                        {/* Edit */}
                                        <button
                                            onClick={() => setEditingVideo(vid)}
                                            className="p-1.5 hover:bg-blue-50 rounded-lg text-slate-500 hover:text-blue-600 transition-colors"
                                            title="Edit Metadata"
                                        >
                                            <Edit3 size={14} />
                                        </button>

                                        {/* Delete */}
                                        <button
                                            onClick={() => setDeletingVideoId(vid._id)}
                                            className="p-1.5 hover:bg-red-50 rounded-lg text-slate-500 hover:text-red-600 transition-colors"
                                            title="Delete Video"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                /* TABLE / LIST VIEW */
                <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                <tr>
                                    <th className="px-6 py-3.5">Video</th>
                                    <th className="px-6 py-3.5">Category</th>
                                    <th className="px-6 py-3.5">Duration</th>
                                    <th className="px-6 py-3.5">Size</th>
                                    <th className="px-6 py-3.5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-sm">
                                {videos.map(vid => (
                                    <tr key={vid._id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-3">
                                            <div className="flex items-center gap-3">
                                                <div
                                                    onClick={() => setSelectedVideoToPlay(vid)}
                                                    className="w-16 h-10 rounded-lg bg-slate-900 overflow-hidden shrink-0 cursor-pointer relative group flex items-center justify-center"
                                                >
                                                    {vid.thumbnail ? (
                                                        <img src={vid.thumbnail} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <Film size={18} className="text-slate-500" />
                                                    )}
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                                        <Play size={14} className="fill-white" />
                                                    </div>
                                                </div>
                                                <div className="max-w-xs">
                                                    <p className="font-bold text-slate-900 text-sm truncate" title={vid.title}>
                                                        {vid.title}
                                                    </p>
                                                    <p className="text-xs text-slate-400 truncate" title={vid.videoUrl}>
                                                        {vid.videoUrl}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-3">
                                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-orange-50 text-[#C2410C]">
                                                {vid.category || 'General'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3 font-mono text-xs text-slate-700">
                                            {vid.duration || '00:00'}
                                        </td>
                                        <td className="px-6 py-3 font-mono text-xs text-slate-700">
                                            {formatBytes(vid.size)}
                                        </td>
                                        <td className="px-6 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button
                                                    onClick={() => setSelectedVideoToPlay(vid)}
                                                    className="p-1.5 text-slate-600 hover:text-[#C2410C] hover:bg-orange-50 rounded-lg transition-colors"
                                                    title="Preview"
                                                >
                                                    <Eye size={16} />
                                                </button>
                                                <button
                                                    onClick={() => copyToClipboard(vid.videoUrl, vid._id)}
                                                    className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                                                    title="Copy URL"
                                                >
                                                    {copiedId === vid._id ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                                                </button>
                                                <button
                                                    onClick={() => setEditingVideo(vid)}
                                                    className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="Edit"
                                                >
                                                    <Edit3 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => setDeletingVideoId(vid._id)}
                                                    className="p-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ============================================================== */}
            {/* UPLOAD MODAL (Direct Storage Upload OR Object Storage URL) */}
            {/* ============================================================== */}
            <AnimatePresence>
                {isUploadModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 15 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 15 }}
                            className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-100 overflow-hidden my-8"
                        >
                            {/* Modal Header */}
                            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                <div>
                                    <h3 className="text-xl font-serif font-bold text-slate-900">Upload Video</h3>
                                    <p className="text-xs text-slate-500 mt-0.5">Upload lecture or revision video for students</p>
                                </div>
                                <button
                                    onClick={() => !isUploading && setIsUploadModalOpen(false)}
                                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Modal Form */}
                            <form onSubmit={handleUploadSubmit} className="p-6 space-y-4">
                                {uploadError && (
                                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
                                        <AlertCircle size={16} className="shrink-0" />
                                        <span>{uploadError}</span>
                                    </div>
                                )}

                                {/* FILE UPLOAD SECTION */}
                                <div className="space-y-4">
                                    {/* Video Dropzone */}
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                                            Video File (MP4, WebM, MKV, MOV up to 2GB) *
                                        </label>
                                        <label className={`border-2 border-dashed rounded-2xl p-5 flex flex-col items-center justify-center cursor-pointer transition-colors ${videoFile ? 'border-emerald-300 bg-emerald-50/40' : 'border-slate-200 hover:border-[#C2410C] bg-slate-50/50'}`}>
                                            <input
                                                type="file"
                                                accept="video/mp4,video/webm,video/mkv,video/quicktime,video/x-msvideo"
                                                onChange={handleVideoFileChange}
                                                className="hidden"
                                                disabled={isUploading}
                                            />
                                            {videoFile ? (
                                                <div className="text-center">
                                                    <FileVideo size={32} className="text-emerald-600 mx-auto mb-1" />
                                                    <p className="font-bold text-xs text-slate-800">{videoFile.name}</p>
                                                    <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                                                        {formatBytes(videoFile.size)} • Duration: {formData.duration}
                                                    </p>
                                                    <span className="text-[10px] text-emerald-700 font-bold uppercase mt-1 block">Click to change</span>
                                                </div>
                                            ) : (
                                                <div className="text-center">
                                                    <Upload size={32} className="text-slate-400 mx-auto mb-1 group-hover:text-[#C2410C]" />
                                                    <p className="font-bold text-xs text-slate-800">Click or drag & drop video file here</p>
                                                    <p className="text-[11px] text-slate-400 mt-0.5">MP4, WebM, MKV recommended for smooth streaming</p>
                                                </div>
                                            )}
                                        </label>
                                    </div>

                                    {/* Thumbnail Dropzone */}
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                                            Video Thumbnail (Optional)
                                        </label>
                                        <div className="flex items-center gap-4">
                                            <label className="flex-1 border-2 border-dashed border-slate-200 hover:border-slate-300 rounded-2xl p-4 flex items-center justify-center cursor-pointer bg-slate-50/50">
                                                <input
                                                    type="file"
                                                    accept="image/jpeg,image/png,image/webp"
                                                    onChange={handleThumbFileChange}
                                                    className="hidden"
                                                    disabled={isUploading}
                                                />
                                                <div className="flex items-center gap-2 text-slate-600">
                                                    <ImageIcon size={18} />
                                                    <span className="text-xs font-medium">Select custom thumbnail image</span>
                                                </div>
                                            </label>

                                            {thumbPreview && (
                                                <div className="w-24 h-14 rounded-xl border border-slate-200 overflow-hidden bg-slate-900 shrink-0">
                                                    <img src={thumbPreview} alt="Preview" className="w-full h-full object-cover" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* COMMON FIELDS: Title, Category, Description */}
                                <div className="space-y-3 pt-2 border-t border-slate-100">
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div className="sm:col-span-2">
                                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                                                Video Title *
                                            </label>
                                            <input
                                                type="text"
                                                required
                                                placeholder="e.g. Siddha Diagnosis: Naadi Pariksha Demonstration"
                                                value={formData.title}
                                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#C2410C] focus:bg-white focus:outline-none"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                                                Category
                                            </label>
                                            <select
                                                value={formData.category}
                                                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#C2410C] focus:bg-white focus:outline-none font-semibold text-slate-700"
                                            >
                                                {categories.map(c => (
                                                    <option key={c} value={c}>{c}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                                            Description & Notes
                                        </label>
                                        <textarea
                                            rows="2"
                                            placeholder="Provide a detailed explanation or summary of key topics covered in this video..."
                                            value={formData.description}
                                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                            className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#C2410C] focus:bg-white focus:outline-none"
                                        />
                                    </div>
                                </div>

                                {/* UPLOAD PROGRESS BAR */}
                                {isUploading && (
                                    <div className="space-y-1.5 pt-2">
                                        <div className="flex justify-between text-xs font-semibold text-slate-700">
                                            <span>Uploading media to storage...</span>
                                            <span>{uploadProgress}%</span>
                                        </div>
                                        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                                            <div
                                                className="bg-[#C2410C] h-full transition-all duration-200 rounded-full"
                                                style={{ width: `${uploadProgress}%` }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Modal Actions */}
                                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                                    <button
                                        type="button"
                                        disabled={isUploading}
                                        onClick={() => setIsUploadModalOpen(false)}
                                        className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isUploading}
                                        className="bg-[#C2410C] hover:bg-[#9a3412] disabled:opacity-50 text-white px-6 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shadow-lg shadow-orange-900/10 active:scale-95"
                                    >
                                        {isUploading ? (
                                            <>
                                                <RefreshCw size={14} className="animate-spin" /> Uploading ({uploadProgress}%)
                                            </>
                                        ) : (
                                            <>
                                                <Upload size={14} /> Complete Upload
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* ============================================================== */}
            {/* VIDEO PLAYER PREVIEW MODAL */}
            {/* ============================================================== */}
            <AnimatePresence>
                {selectedVideoToPlay && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-slate-900 rounded-3xl max-w-4xl w-full shadow-2xl overflow-hidden border border-slate-800 text-white flex flex-col"
                        >
                            {/* Player Bar */}
                            <div className="px-6 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
                                <div>
                                    <h4 className="font-bold text-sm text-slate-100 line-clamp-1">{selectedVideoToPlay.title}</h4>
                                    <p className="text-[11px] text-orange-400 font-mono mt-0.5">{selectedVideoToPlay.category} • {selectedVideoToPlay.duration}</p>
                                </div>
                                <button
                                    onClick={() => setSelectedVideoToPlay(null)}
                                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* HTML5 Video Element */}
                            <div className="aspect-video w-full bg-black flex items-center justify-center relative">
                                <video
                                    src={selectedVideoToPlay.videoUrl}
                                    controls
                                    autoPlay
                                    className="w-full h-full object-contain"
                                >
                                    Your browser does not support the video tag.
                                </video>
                            </div>

                            {/* Video Information Footnote */}
                            <div className="p-5 bg-slate-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
                                <div>
                                    <p className="text-slate-300 font-medium">{selectedVideoToPlay.description || 'No description provided.'}</p>
                                    <p className="text-slate-500 font-mono text-[11px] mt-1 truncate max-w-md">
                                        URL: {selectedVideoToPlay.videoUrl}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <button
                                        onClick={() => copyToClipboard(selectedVideoToPlay.videoUrl, 'player')}
                                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-semibold text-xs flex items-center gap-1.5 transition-colors"
                                    >
                                        {copiedId === 'player' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                                        Copy Link
                                    </button>
                                    <a
                                        href={selectedVideoToPlay.videoUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-3 py-1.5 bg-[#C2410C] hover:bg-[#ea580c] text-white rounded-xl font-semibold text-xs flex items-center gap-1.5 transition-colors"
                                    >
                                        <ExternalLink size={14} /> Open in Tab
                                    </a>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* ============================================================== */}
            {/* EDIT VIDEO MODAL */}
            {/* ============================================================== */}
            <AnimatePresence>
                {editingVideo && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden"
                        >
                            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                                <h3 className="text-lg font-serif font-bold text-slate-900">Edit Video Details</h3>
                                <button onClick={() => setEditingVideo(null)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
                                    <X size={18} />
                                </button>
                            </div>
                            <form onSubmit={handleUpdateVideo} className="p-6 space-y-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Title</label>
                                    <input
                                        type="text"
                                        required
                                        value={editingVideo.title}
                                        onChange={(e) => setEditingVideo({ ...editingVideo, title: e.target.value })}
                                        className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#C2410C] focus:outline-none"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Category</label>
                                        <select
                                            value={editingVideo.category}
                                            onChange={(e) => setEditingVideo({ ...editingVideo, category: e.target.value })}
                                            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#C2410C] focus:outline-none font-semibold text-slate-700"
                                        >
                                            {categories.map(c => (
                                                <option key={c} value={c}>{c}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Duration</label>
                                        <input
                                            type="text"
                                            value={editingVideo.duration}
                                            onChange={(e) => setEditingVideo({ ...editingVideo, duration: e.target.value })}
                                            className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#C2410C] focus:outline-none font-mono"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Description</label>
                                    <textarea
                                        rows="3"
                                        value={editingVideo.description || ''}
                                        onChange={(e) => setEditingVideo({ ...editingVideo, description: e.target.value })}
                                        className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#C2410C] focus:outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Video Stream URL</label>
                                    <input
                                        type="url"
                                        required
                                        value={editingVideo.videoUrl}
                                        onChange={(e) => setEditingVideo({ ...editingVideo, videoUrl: e.target.value })}
                                        className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#C2410C] focus:outline-none font-mono"
                                    />
                                </div>

                                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setEditingVideo(null)}
                                        className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="bg-[#C2410C] hover:bg-[#9a3412] text-white px-5 py-2 rounded-xl font-bold text-xs transition-colors shadow-md"
                                    >
                                        Save Changes
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* ============================================================== */}
            {/* DELETE CONFIRMATION MODAL */}
            {/* ============================================================== */}
            <AnimatePresence>
                {deletingVideoId && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 text-center"
                        >
                            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-3">
                                <Trash2 size={24} />
                            </div>
                            <h4 className="font-serif font-bold text-slate-900 text-lg">Delete Video?</h4>
                            <p className="text-xs text-slate-500 mt-1 mb-6">
                                This will remove the video record from MongoDB and delete any local storage media files. This action cannot be undone.
                            </p>
                            <div className="flex items-center justify-center gap-3">
                                <button
                                    onClick={() => setDeletingVideoId(null)}
                                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleDeleteVideo(deletingVideoId)}
                                    className="px-5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-md shadow-red-900/10"
                                >
                                    Delete Video
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
