import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen, User, Award, Flame, Clock,
  Calendar, FileText, ArrowRight, Copy, Edit, Trash2, Eye, Video, Play
} from 'lucide-react';
import DashboardLayout from '../components/Layout/DashboardLayout';
import EditQuestionBankModal from '../components/EditQuestionBankModal';

const API_URL = process.env.REACT_APP_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : "https://jclsiddhaacademy.in");

const Dashboard = () => {
  const [user, setUser] = useState({ fullName: "Scholar", role: "student" });
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  // State for re-attempt modal
  const [showReattemptModal, setShowReattemptModal] = useState(false);
  const [selectedTestToRequest, setSelectedTestToRequest] = useState(null);
  const [requestLoading, setRequestLoading] = useState(false);
  const [editingBank, setEditingBank] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      const headers = { Authorization: `Bearer ${token}` };

      // Fetch user profile
      const userRes = await fetch(`${API_URL}/api/user/profile`, { headers });
      let currentUserRole = 'student';
      if (userRes.ok) {
        const userData = await userRes.json();
        setUser(userData);
        currentUserRole = userData.role || 'student';
      } else {
        console.warn('Profile fetch failed:', userRes.status);
      }

      const isEducator = currentUserRole.toLowerCase() === 'faculty' || currentUserRole.toLowerCase() === 'admin';
      const testsUrl = isEducator
        ? `${API_URL}/api/admin/question-banks`
        : `${API_URL}/api/user/tests`;

      // Fetch tests
      const testsRes = await fetch(testsUrl, { headers });
      console.log('Tests API status:', testsRes.status);
      if (testsRes.ok) {
        const testsData = await testsRes.json();
        console.log('Tests loaded:', testsData.length);
        setExams(Array.isArray(testsData) ? testsData : []);
      } else {
        const errData = await testsRes.json().catch(() => ({}));
        console.error('Tests fetch failed:', testsRes.status, errData);
      }

    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);


  const handleTestClick = (exam) => {
    if (exam.hasAttempted && exam.requestStatus !== 'approved') {
      setSelectedTestToRequest(exam);
      setShowReattemptModal(true);
    } else {
      navigate(`/test/${exam._id}`);
    }
  };

  const handleSendReattemptRequest = async () => {
    if (!selectedTestToRequest) return;
    setRequestLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${process.env.REACT_APP_API_URL || "https://jclsiddhaacademy.in"}/api/user/tests/${selectedTestToRequest._id}/request-reattempt`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        alert("Request sent successfully to admin!");
        // Refresh data
        window.location.reload();
      } else {
        const data = await res.json();
        alert(data.message || "Failed to send request");
      }
    } catch (err) {
      console.error(err);
      alert("Error sending request");
    } finally {
      setRequestLoading(false);
      setShowReattemptModal(false);
    }
  };

  const handleDuplicate = async (exam) => {
    const defaultTitle = `${exam.title} (Copy)`;
    const newTitle = window.prompt(`Duplicate question paper "${exam.title}"? Enter title for duplicated paper:`, defaultTitle);
    if (newTitle === null) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/admin/question-banks/${exam._id}/duplicate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ title: newTitle.trim() || defaultTitle })
      });

      if (res.ok) {
        const data = await res.json();
        alert('Question paper duplicated successfully! Opening editor so you can edit, add, or remove questions...');
        await fetchData();
        if (data.bank) {
          setEditingBank(data.bank);
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(`Failed to duplicate: ${errData.message || 'Error duplicating paper'}`);
      }
    } catch (err) {
      console.error("Duplicate error:", err);
      alert('Error duplicating question paper');
    }
  };

  const handleDeletePaper = async (examId) => {
    if (!window.confirm("Are you sure you want to delete this question paper? This action cannot be undone.")) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/admin/question-banks/${examId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        alert("Question paper deleted successfully!");
        fetchData();
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(`Failed to delete: ${errData.message || 'Error deleting paper'}`);
      }
    } catch (err) {
      console.error("Delete error:", err);
      alert('Error deleting question paper');
    }
  };

  const stats = [
    { label: "Tests Completed", value: user.testsCompleted || "0", sub: "Keep going!", icon: BookOpen, color: "text-blue-900", bg: "bg-blue-50", category: "Overall" },
    { label: "Average Score", value: `${user.averageScore || 0}%`, sub: "View Details", icon: Award, color: "text-orange-600", bg: "bg-orange-50", category: "Performance", link: "/progresspage" },
    { label: "Day Streak", value: "7", sub: "Keep it up! 🔥", icon: Flame, color: "text-red-600", bg: "bg-red-50", category: "Current" },
    { label: "Role", value: (user.role || 'Student').toUpperCase(), sub: user.course || "BSMS", icon: User, color: "text-blue-600", bg: "bg-blue-50", category: "Account" },
  ];

  // Filter by user's category and batch (defense-in-depth isolation)
  const filteredExams = exams.filter(exam => {
      const isEducator = user.role?.toLowerCase() === 'admin' || user.role?.toLowerCase() === 'faculty';
      if (isEducator) return true;

      // Category match
      const examCats = Array.isArray(exam.category) ? exam.category : [exam.category];
      const catMatch = !exam.category || examCats.includes('Both') || examCats.includes(user.category);
      if (!catMatch) return false;

      // Batch match: strict isolation
      const userBatch = user.batch || 'All';
      const examBatches = Array.isArray(exam.batches) ? exam.batches : (exam.batches ? [exam.batches] : []);
      const isAllBatches = examBatches.length === 0 || examBatches.includes('All');
      const batchMatch = isAllBatches || (userBatch !== 'All' && examBatches.includes(userBatch));
      return batchMatch;
  });

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#FDFCFB]">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-900"></div>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="p-4 md:p-8 lg:p-12">
        <header className="mb-8 lg:mb-12 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-serif font-bold text-gray-900 mb-2">Welcome back, {user.fullName}</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-gray-500 text-base md:text-lg">Continue your journey through ancient wisdom</p>
              {user.category && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 border border-orange-200">
                  {user.category}
                </span>
              )}
              {user.batch && user.batch !== 'All' ? (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-100 text-teal-800 border border-teal-200">
                  Batch: {user.batch}
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                  All Batches
                </span>
              )}
            </div>
          </div>
        </header>

        {/* Re-attempt Request Modal */}
        <AnimatePresence>
          {showReattemptModal && (
            <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-gray-100"
              >
                <div className="bg-orange-50 w-16 h-16 rounded-2xl flex items-center justify-center text-orange-600 mb-6">
                  <FileText size={32} />
                </div>
                <h3 className="text-2xl font-serif font-bold text-slate-900 mb-2">Already Attempted</h3>
                <p className="text-gray-500 mb-8 leading-relaxed">
                  You have already completed this assessment. To re-attempt, you must obtain permission from the administrator. Would you like to send a re-attempt request now?
                </p>
                <div className="flex gap-4">
                  <button
                    onClick={() => setShowReattemptModal(false)}
                    className="flex-1 py-4 px-6 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={requestLoading}
                    onClick={handleSendReattemptRequest}
                    className="flex-1 py-4 px-6 rounded-xl font-bold text-white bg-blue-900 hover:bg-blue-800 transition-all shadow-lg shadow-blue-900/20 disabled:opacity-50"
                  >
                    {requestLoading ? 'Sending...' : 'Request Permission'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {stats.map((stat, idx) => (
            <motion.div
              whileHover={{ y: -5 }}
              key={idx}
              onClick={() => stat.link && navigate(stat.link)}
              className={`bg-white p-6 rounded-2xl border border-gray-100 shadow-sm transition-all ${stat.link ? 'cursor-pointer hover:border-blue-200' : ''}`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
                  {React.createElement(stat.icon, { size: 24 })}
                </div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{stat.category}</span>
              </div>
              <h3 className="text-3xl font-bold mb-1">{stat.value}</h3>
              <p className="text-sm font-medium text-gray-500">{stat.label}</p>
              {stat.link && <p className="text-xs text-blue-900 mt-2 font-bold flex items-center gap-1">View Analytics →</p>}
            </motion.div>
          ))}
        </div>

        {/* FACULTY TOOLS SECTION */}
        {user.role?.toLowerCase() === 'faculty' && (
          <section className="mb-12">
            <h3 className="text-2xl font-serif font-bold text-slate-800 mb-6">Faculty Tools</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <motion.div
                whileHover={{ y: -5 }}
                className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm transition-all hover:border-[#0F172A]/20 cursor-pointer group"
                onClick={() => navigate('/create-test')}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 rounded-xl bg-[#0F172A]/5 text-[#0F172A]">
                    <FileText size={24} />
                  </div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Assessment</span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-[#0F172A] transition-colors">Assign New Test</h3>
                <p className="text-sm text-gray-500 mb-6">Create questions, set topics, and define marking schemes for students.</p>
                <div className="flex items-center text-[#1e3a8a] font-bold text-sm gap-2">
                  Create Test <ArrowRight size={16} />
                </div>
              </motion.div>

              <motion.div
                whileHover={{ y: -5 }}
                className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm transition-all hover:border-[#0F172A]/20 cursor-pointer group"
                onClick={() => navigate('/admin')}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 rounded-xl bg-purple-50 text-purple-700">
                    <BookOpen size={24} />
                  </div>
                  <span className="text-[10px] font-bold text-purple-600 uppercase tracking-widest">Question Vault</span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-purple-700 transition-colors">Question Paper Vault</h3>
                <p className="text-sm text-gray-500 mb-6">Access all question banks, view attempt analytics, and manage papers.</p>
                <div className="flex items-center text-purple-700 font-bold text-sm gap-2">
                  Open Vault <ArrowRight size={16} />
                </div>
              </motion.div>
            </div>
          </section>
        )}

        {/* VIDEO LECTURES BANNER / SHORTCUT */}
        <div className="mb-10 bg-gradient-to-r from-[#0F172A] via-slate-900 to-blue-950 p-6 md:p-8 rounded-3xl text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
          <div className="absolute right-0 top-0 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="relative z-10 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-orange-600/20 border border-orange-500/30 flex items-center justify-center text-orange-400 shrink-0 shadow-inner">
              <Video size={28} />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-orange-500/20 text-orange-300 text-[10px] font-bold uppercase tracking-wider mb-1">
                Learning Hub
              </div>
              <h3 className="text-xl md:text-2xl font-bold font-serif text-white">Recorded Video Classes</h3>
              <p className="text-slate-300 text-xs md:text-sm mt-0.5 max-w-xl">
                Access structured syllabus lectures, clinical discussions, and revision classes.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/videos')}
            className="relative z-10 bg-[#C2410C] hover:bg-[#ea580c] text-white px-5 py-3 rounded-xl font-bold text-xs md:text-sm flex items-center gap-2 transition-all shadow-lg shadow-orange-900/20 shrink-0 active:scale-95"
          >
            <Play size={16} className="fill-white" /> Watch Video Classes
          </button>
        </div>

        {/* UPCOMING EXAMS SECTION */}
        <section className="mb-12">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 lg:mb-8 gap-4">
            <div>
              <h3 className="text-xl md:text-2xl font-serif font-bold text-slate-800">
                {user.role?.toLowerCase() === 'faculty' ? 'Manage Question Papers' : 'Available Assessments'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {user.role?.toLowerCase() === 'faculty' 
                  ? 'Set, edit, duplicate, and remove questions or papers for students.' 
                  : 'Select an assessment to start or review your results.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <AnimatePresence mode='popLayout'>
              {filteredExams.length === 0 && !loading && (
                <div className="col-span-2 text-center py-16 text-gray-400">
                  <BookOpen size={48} className="mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-semibold">No active tests available right now.</p>
                  <p className="text-sm mt-1">Check back later for new assessments.</p>
                </div>
              )}
              {filteredExams.map((exam) => {
                const isFacultyUser = user.role?.toLowerCase() === 'faculty' || user.role?.toLowerCase() === 'admin';

                return (
                  <motion.div
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    whileHover={{ y: -6 }}
                    key={exam._id}
                    className="bg-white p-6 md:p-8 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group flex flex-col justify-between"
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {isFacultyUser && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                              exam.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                            }`}>
                              {exam.status || 'published'}
                            </span>
                          )}
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                            exam.difficulty === 'Hard' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {exam.difficulty || 'Medium'}
                          </span>
                          {(Array.isArray(exam.category) ? exam.category : [exam.category || 'Both']).map((cat, idx) => (
                            <span key={idx} className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-100 text-slate-700">
                              {cat}
                            </span>
                          ))}
                        </div>

                        {!isFacultyUser && (exam.hasAttempted || exam.requestStatus ? (
                          <div className="flex flex-col items-end">
                            {exam.hasAttempted && <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-1 rounded-lg uppercase tracking-wider mb-1">Attempted</span>}
                            {exam.requestStatus === 'pending' && <span className="bg-orange-100 text-orange-600 text-[10px] font-bold px-2 py-1 rounded-lg uppercase tracking-wider animate-pulse">Re-attempt Pending</span>}
                            {exam.requestStatus === 'rejected' && <span className="bg-red-100 text-red-600 text-[10px] font-bold px-2 py-1 rounded-lg uppercase tracking-wider">Re-attempt Rejected</span>}
                            {exam.requestStatus === 'approved' && <span className="bg-blue-100 text-blue-600 text-[10px] font-bold px-2 py-1 rounded-lg uppercase tracking-wider">Re-attempt Approved</span>}
                          </div>
                        ) : (
                          <Calendar className="text-gray-300" size={20} />
                        ))}

                        {isFacultyUser && (
                          <span className="text-xs text-slate-400 font-medium">
                            {exam.attempts || 0} attempts
                          </span>
                        )}
                      </div>

                      <h4 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-blue-900 transition-colors">
                        {exam.title}
                      </h4>

                      <div className="flex flex-wrap gap-y-2 gap-x-4 lg:gap-x-6 text-sm text-gray-500 mb-6">
                        <div className="flex items-center gap-1.5"><Calendar size={14} className="text-blue-700" /> {new Date(exam.createdAt || Date.now()).toLocaleDateString()}</div>
                        <div className="flex items-center gap-1.5"><Clock size={14} className="text-blue-700" /> {exam.duration || 60} mins</div>
                        <div className="text-gray-500 font-semibold">{exam.questionsCount || (exam.questions ? exam.questions.length : 0)} Qs</div>
                      </div>
                    </div>

                    {/* Actions */}
                    {isFacultyUser ? (
                      <div className="grid grid-cols-2 gap-2 pt-4 border-t border-slate-100 mt-2">
                        <motion.button
                          whileTap={{ scale: 0.96 }}
                          onClick={() => setEditingBank(exam)}
                          className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-900/10 transition-all"
                          title="Edit questions, add or remove questions"
                        >
                          <Edit size={14} /> Edit & Set
                        </motion.button>
                        <motion.button
                          whileTap={{ scale: 0.96 }}
                          onClick={() => handleDuplicate(exam)}
                          className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md shadow-purple-900/10 transition-all"
                          title="Duplicate this question paper"
                        >
                          <Copy size={14} /> Duplicate
                        </motion.button>
                        <motion.button
                          whileTap={{ scale: 0.96 }}
                          onClick={() => navigate(`/test/preview/${exam._id}`)}
                          className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs transition-all"
                          title="Preview questions"
                        >
                          <Eye size={14} /> Preview
                        </motion.button>
                        <motion.button
                          whileTap={{ scale: 0.96 }}
                          onClick={() => handleDeletePaper(exam._id)}
                          className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 font-bold text-xs transition-all"
                          title="Delete question paper"
                        >
                          <Trash2 size={14} /> Delete
                        </motion.button>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleTestClick(exam)}
                          disabled={exam.requestStatus === 'pending' || exam.requestStatus === 'rejected'}
                          className={`w-full font-bold py-4 rounded-xl shadow-lg transition-all ${exam.hasAttempted
                            ? (exam.requestStatus === 'rejected' ? 'bg-red-50 text-red-400 cursor-not-allowed border border-red-100' : 'bg-orange-600 hover:bg-orange-700 text-white shadow-orange-900/20')
                            : 'bg-[#0F172A] hover:bg-[#1e293b] text-white'
                            } disabled:opacity-50`}
                        >
                          {exam.hasAttempted
                            ? (exam.requestStatus === 'pending' ? 'Request Pending' : exam.requestStatus === 'rejected' ? 'Request Rejected' : 'Re-attempt Test')
                            : 'Start Test'}
                        </motion.button>

                        {exam.hasAttempted && (
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => navigate(`/test/preview/${exam._id}`)}
                            className="w-full font-bold py-3 rounded-xl border-2 border-[#0F172A] text-[#0F172A] hover:bg-[#0F172A] hover:text-white transition-all"
                          >
                            Preview Test
                          </motion.button>
                        )}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </section>

        {/* Modal for Editing / Setting / Adding / Removing questions */}
        {editingBank && (
          <EditQuestionBankModal
            bank={editingBank}
            onClose={() => setEditingBank(null)}
            onSuccess={() => {
              setEditingBank(null);
              fetchData();
            }}
          />
        )}

        {/* HEATMAP SECTION */}

      </div>
    </DashboardLayout>
  );
};

export default Dashboard;