import React, { useState, useEffect, useCallback } from 'react';
import { X, Trash2, Plus, Image as ImageIcon, Save } from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : "https://jclsiddhaacademy.in");

const EditQuestionBankModal = ({ bank, categories: propCategories, onClose, onSuccess }) => {
    const [categoriesList, setCategoriesList] = useState(
        propCategories && propCategories.length > 0
            ? propCategories
            : ['Both', 'MRB', 'AIAPGET', 'Crash Course']
    );

    useEffect(() => {
        if (propCategories && propCategories.length > 0) {
            setCategoriesList(propCategories);
        } else {
            axios.get(`${API_URL}/api/categories`)
                .then(res => {
                    const list = Array.isArray(res.data) ? res.data : (res.data?.categories || []);
                    if (list.length > 0) {
                        setCategoriesList(list);
                    }
                })
                .catch(() => {});
        }
    }, [propCategories]);

    const getCatName = (cat) => typeof cat === 'string' ? cat : (cat?.name || '');
    const getCatBatches = (catName) => {
        const found = categoriesList.find(c => getCatName(c) === catName);
        return (found && typeof found === 'object' && Array.isArray(found.batches)) ? found.batches : [];
    };

    const [formData, setFormData] = useState({
        title: bank.title || '',
        difficulty: bank.difficulty || 'Easy',
        category: Array.isArray(bank.category) ? bank.category : (bank.category ? [bank.category] : ['Both']),
        batches: Array.isArray(bank.batches) ? bank.batches : (bank.batches ? [bank.batches] : ['All']),
        duration: bank.duration || 60,
        status: bank.status || 'published',
        negativeMarking: bank.negativeMarking || false
    });

    const activeSelectedCats = Array.isArray(formData.category) ? formData.category : [formData.category];
    const availableBatchesForSelection = Array.from(new Set(
        activeSelectedCats.flatMap(cat => getCatBatches(cat))
    ));

    const [questions, setQuestions] = useState(
        (bank.questions || []).map((q) => ({
            ...q,
            options: Array.isArray(q.options) && q.options.length === 4 ? [...q.options] : [
                q.options?.[0] || '',
                q.options?.[1] || '',
                q.options?.[2] || '',
                q.options?.[3] || ''
            ],
            answer: typeof q.answer === 'number' ? q.answer : (q.answer !== undefined && q.answer !== null && q.answer !== '' ? Number(q.answer) : null),
            imagePreview: q.filename ? `${API_URL}/uploads/${q.filename}` : null
        }))
    );
    const [loading, setLoading] = useState(false);
    const [autoSaveStatus, setAutoSaveStatus] = useState('Auto-save ON');

    // Auto-save to server for Edit (has existing ID)
    const autoSaveToServer = useCallback(async () => {
        if (!bank._id) return;
        setAutoSaveStatus('Saving...');
        try {
            const data = new FormData();
            data.append('title', formData.title);
            data.append('difficulty', formData.difficulty);
            data.append('category', Array.isArray(formData.category) ? formData.category.join(',') : formData.category);
            data.append('batches', Array.isArray(formData.batches) ? formData.batches.join(',') : (formData.batches || 'All'));
            data.append('negativeMarking', formData.negativeMarking);
            data.append('duration', formData.duration);
            data.append('status', formData.status);
            const questionsToSave = questions.map(q => ({
                question: q.question,
                options: q.options,
                answer: q.answer,
                filename: q.filename,
                _id: q._id
            }));
            data.append('updatedQuestions', JSON.stringify(questionsToSave));
            data.append('updatedFilenames', JSON.stringify([]));
            const token = localStorage.getItem('token');
            await axios.put(`${API_URL}/api/admin/question-banks/${bank._id}`, data, {
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
            });
            setAutoSaveStatus(`Saved at ${new Date().toLocaleTimeString()}`);
        } catch (e) {
            setAutoSaveStatus('Auto-save failed');
        }
    }, [bank._id, formData, questions]);

    useEffect(() => {
        const interval = setInterval(autoSaveToServer, 30000);
        return () => clearInterval(interval);
    }, [autoSaveToServer]);

    useEffect(() => {
        setAutoSaveStatus('Unsaved changes...');
        const t = setTimeout(() => autoSaveToServer(), 3000);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formData, questions]);

    const handleAddQuestion = () => {
        setQuestions(prev => [
            ...prev,
            { question: '', options: ['', '', '', ''], answer: null }
        ]);
    };

    const handleRemoveQuestion = (index) => {
        if (window.confirm(`Are you sure you want to remove Question ${index + 1}?`)) {
            setQuestions(prev => prev.filter((_, i) => i !== index));
        }
    };

    const handleQuestionChange = (index, field, value) => {
        const updatedQuestions = [...questions];
        if (field === 'options') {
            const { optIdx, val } = value;
            updatedQuestions[index].options[optIdx] = val;
        } else if (field === 'image') {
            const file = value;
            updatedQuestions[index].image = file;
            updatedQuestions[index].imagePreview = file ? URL.createObjectURL(file) : null;
        } else {
            updatedQuestions[index][field] = value;
        }
        setQuestions(updatedQuestions);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const missingAnswerIdx = questions.findIndex(q => q.answer === null || q.answer === undefined || q.answer === '');
        if (missingAnswerIdx !== -1) {
            return alert(`Please select the correct option for Question ${missingAnswerIdx + 1}`);
        }
        setLoading(true);

        const data = new FormData();
        data.append('title', formData.title);
        data.append('difficulty', formData.difficulty);
        data.append('category', Array.isArray(formData.category) ? formData.category.join(',') : formData.category);
        data.append('batches', Array.isArray(formData.batches) ? formData.batches.join(',') : (formData.batches || 'All'));
        data.append('negativeMarking', formData.negativeMarking);
        data.append('duration', formData.duration);
        data.append('status', formData.status);

        const questionsToSave = questions.map((q, index) => {
            if (q.image) {
                data.append('questionImages', q.image, `q-${index}`);
            }
            return {
                question: q.question,
                options: q.options,
                answer: q.answer,
                filename: q.filename,
                _id: q._id
            };
        });

        data.append('updatedQuestions', JSON.stringify(questionsToSave));
        data.append('updatedFilenames', JSON.stringify([]));

        try {
            const token = localStorage.getItem('token');
            await axios.put(`${API_URL}/api/admin/question-banks/${bank._id}`, data, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });
            alert('Question paper updated successfully!');
            onSuccess();
        } catch (err) {
            console.error("Update failed", err);
            alert(`Update failed: ${err.response?.data?.message || err.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-3 md:p-6 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[92vh] shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="p-4 md:p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/70">
                    <div>
                        <h3 className="text-lg md:text-xl font-serif font-bold text-slate-800">
                            Edit Question Paper
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Set, add, edit, or remove questions in this question paper
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-gray-200 rounded-full transition-colors text-gray-500"
                        title="Close"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Auto-save status bar */}
                <div className="flex items-center justify-between px-4 md:px-6 py-2 bg-emerald-50 border-b border-emerald-100 text-xs">
                    <div className="flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span className="font-bold text-emerald-800 uppercase tracking-wider text-[10px]">Auto-save</span>
                        <span className="text-emerald-700">• {autoSaveStatus}</span>
                    </div>
                    <span className="font-bold text-slate-600 text-xs">
                        {questions.length} {questions.length === 1 ? 'Question' : 'Questions'}
                    </span>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                    <form id="edit-qb-form" onSubmit={handleSubmit} className="space-y-6">
                        {/* Paper Metadata Settings */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <div className="md:col-span-2 lg:col-span-1">
                                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                                    Paper Title
                                </label>
                                <input
                                    required
                                    type="text"
                                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-600/20 text-sm font-medium"
                                    value={formData.title}
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                                    Difficulty
                                </label>
                                <select
                                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-600/20 text-sm bg-white"
                                    value={formData.difficulty}
                                    onChange={e => setFormData({ ...formData, difficulty: e.target.value })}
                                >
                                    <option>Easy</option>
                                    <option>Medium</option>
                                    <option>Hard</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                                    Duration (Minutes)
                                </label>
                                <input
                                    required
                                    type="number"
                                    min="1"
                                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-600/20 text-sm"
                                    value={formData.duration}
                                    onChange={e => setFormData({ ...formData, duration: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                                    Paper Status
                                </label>
                                <select
                                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-600/20 text-sm bg-white font-medium"
                                    value={formData.status}
                                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                                >
                                    <option value="published">Published (Visible to students)</option>
                                    <option value="draft">Draft (Hidden from students)</option>
                                    <option value="disabled">Disabled</option>
                                </select>
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                                    Target Categories
                                </label>
                                <div className="flex flex-wrap gap-x-4 gap-y-2">
                                    {Array.from(new Set([...categoriesList.map(getCatName), ...(Array.isArray(formData.category) ? formData.category : [formData.category])].filter(Boolean))).map(cat => (
                                        <label key={cat} className="flex items-center gap-1.5 cursor-pointer text-xs">
                                            <input
                                                type="checkbox"
                                                name="category-choice"
                                                value={cat}
                                                checked={Array.isArray(formData.category) ? formData.category.includes(cat) : formData.category === cat}
                                                onChange={e => {
                                                    const checked = e.target.checked;
                                                    let newCats = Array.isArray(formData.category) ? [...formData.category] : [formData.category];
                                                    if (checked) {
                                                        if (cat === 'Both') newCats = ['Both'];
                                                        else {
                                                            newCats = newCats.filter(c => c !== 'Both');
                                                            if (!newCats.includes(cat)) newCats.push(cat);
                                                        }
                                                    } else {
                                                        newCats = newCats.filter(c => c !== cat);
                                                        if (newCats.length === 0) newCats = ['Both'];
                                                    }
                                                    setFormData({ ...formData, category: newCats, batches: ['All'] });
                                                }}
                                                className="w-4 h-4 accent-blue-600 rounded"
                                            />
                                            <span className="font-semibold text-slate-700">{cat}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Target Batches */}
                            <div className="md:col-span-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                                    Target Batches (Visible ONLY to students of selected batches)
                                </label>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                                    <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                                        <input
                                            type="checkbox"
                                            checked={formData.batches?.includes('All')}
                                            onChange={e => {
                                                if (e.target.checked) {
                                                    setFormData({ ...formData, batches: ['All'] });
                                                } else {
                                                    setFormData({ ...formData, batches: [] });
                                                }
                                            }}
                                            className="w-4 h-4 accent-blue-600 rounded"
                                        />
                                        <span className="font-bold text-slate-800">All Batches</span>
                                    </label>
                                    {availableBatchesForSelection.map(bName => (
                                        <label key={bName} className="flex items-center gap-1.5 cursor-pointer text-xs">
                                            <input
                                                type="checkbox"
                                                checked={!formData.batches?.includes('All') && formData.batches?.includes(bName)}
                                                onChange={e => {
                                                    let cur = formData.batches?.filter(b => b !== 'All') || [];
                                                    if (e.target.checked) {
                                                        cur = [...cur, bName];
                                                    } else {
                                                        cur = cur.filter(b => b !== bName);
                                                    }
                                                    if (cur.length === 0) cur = ['All'];
                                                    setFormData({ ...formData, batches: cur });
                                                }}
                                                className="w-4 h-4 accent-blue-600 rounded"
                                            />
                                            <span className="font-semibold text-slate-700">{bName}</span>
                                        </label>
                                    ))}
                                    {availableBatchesForSelection.length === 0 && (
                                        <span className="text-xs text-slate-400 italic">No batches created for this category yet. Test will be available to All Batches.</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Negative marking bar */}
                        <div className="flex items-center justify-between p-3.5 bg-amber-50 rounded-xl border border-amber-200">
                            <div>
                                <h4 className="text-sm font-bold text-slate-800">Negative Marking</h4>
                                <p className="text-xs text-slate-600">Deduct marks for incorrect answers (-0.25)</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.negativeMarking}
                                    onChange={e => setFormData({ ...formData, negativeMarking: e.target.checked })}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                        </div>

                        {/* Questions Management */}
                        <div className="space-y-4">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-2 border-b border-gray-100">
                                <div>
                                    <h4 className="font-bold text-slate-800 uppercase tracking-widest text-xs">
                                        Questions in this Paper ({questions.length})
                                    </h4>
                                    <p className="text-[11px] text-slate-500">
                                        Click radio button next to an option to set it as the correct answer
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleAddQuestion}
                                    className="bg-blue-600 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors flex items-center gap-1.5 shadow-sm"
                                >
                                    <Plus size={16} /> Add Question
                                </button>
                            </div>

                            {questions.length === 0 ? (
                                <div className="text-center py-12 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-slate-500">
                                    <p className="font-medium text-sm">No questions in this paper yet.</p>
                                    <button
                                        type="button"
                                        onClick={handleAddQuestion}
                                        className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-colors"
                                    >
                                        <Plus size={16} /> Add First Question
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {questions.map((q, qIdx) => (
                                        <div
                                            key={qIdx}
                                            className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm relative group hover:border-blue-300 transition-colors"
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-md">
                                                    Question {qIdx + 1}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveQuestion(qIdx)}
                                                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                                    title="Remove Question"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>

                                            <div className="space-y-3">
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                                                        Question Statement
                                                    </label>
                                                    <textarea
                                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-600/20 text-sm min-h-[70px] resize-y font-medium text-slate-800"
                                                        placeholder={`Enter Question ${qIdx + 1}...`}
                                                        value={q.question || ''}
                                                        onChange={e => handleQuestionChange(qIdx, 'question', e.target.value)}
                                                    />
                                                </div>

                                                {/* Optional Question Image */}
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                                                        Question Diagram / Image (Optional)
                                                    </label>
                                                    <div className="flex items-center gap-3">
                                                        <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors">
                                                            <ImageIcon size={14} />
                                                            <span>{q.imagePreview ? 'Change Image' : 'Attach Image'}</span>
                                                            <input
                                                                type="file"
                                                                accept="image/*"
                                                                className="hidden"
                                                                onChange={e => {
                                                                    if (e.target.files && e.target.files[0]) {
                                                                        handleQuestionChange(qIdx, 'image', e.target.files[0]);
                                                                    }
                                                                }}
                                                            />
                                                        </label>
                                                        {q.imagePreview && (
                                                            <div className="flex items-center gap-2">
                                                                <img
                                                                    src={q.imagePreview}
                                                                    alt="Preview"
                                                                    className="h-10 w-10 object-cover rounded-md border border-slate-200"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleQuestionChange(qIdx, 'image', null)}
                                                                    className="text-xs text-red-600 hover:underline"
                                                                >
                                                                    Remove
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* 4 Options */}
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                                                        Options & Correct Answer
                                                    </label>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                                        {(q.options || ['', '', '', '']).map((opt, oIdx) => (
                                                            <div
                                                                key={oIdx}
                                                                className={`flex items-center gap-2 p-1.5 rounded-lg border transition-all ${
                                                                    q.answer === oIdx
                                                                        ? 'border-emerald-500 bg-emerald-50/50'
                                                                        : 'border-slate-200 bg-white'
                                                                }`}
                                                            >
                                                                <div
                                                                    className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${
                                                                        q.answer === oIdx
                                                                            ? 'bg-emerald-600 text-white'
                                                                            : 'bg-slate-100 text-slate-600'
                                                                    }`}
                                                                >
                                                                    {String.fromCharCode(65 + oIdx)}
                                                                </div>
                                                                <input
                                                                    type="text"
                                                                    className="flex-1 px-2.5 py-1 text-sm bg-transparent border-0 focus:outline-none focus:ring-0 text-slate-800"
                                                                    placeholder={`Option ${String.fromCharCode(65 + oIdx)}`}
                                                                    value={opt || ''}
                                                                    onChange={e => handleQuestionChange(qIdx, 'options', { optIdx: oIdx, val: e.target.value })}
                                                                />
                                                                <label className="flex items-center gap-1 cursor-pointer pr-1">
                                                                    <input
                                                                        type="radio"
                                                                        name={`edit-answer-${qIdx}`}
                                                                        checked={q.answer === oIdx}
                                                                        onChange={() => handleQuestionChange(qIdx, 'answer', oIdx)}
                                                                        className="w-4 h-4 accent-emerald-600 cursor-pointer"
                                                                    />
                                                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Correct</span>
                                                                </label>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {questions.length > 0 && (
                                <div className="flex justify-center pt-2">
                                    <button
                                        type="button"
                                        onClick={handleAddQuestion}
                                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 border border-slate-200"
                                    >
                                        <Plus size={16} /> Add Another Question
                                    </button>
                                </div>
                            )}
                        </div>
                    </form>
                </div>

                {/* Footer Actions */}
                <div className="p-4 md:p-6 border-t border-gray-100 bg-gray-50 flex flex-col sm:flex-row gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full sm:flex-1 py-2.5 rounded-xl border border-gray-300 font-bold text-slate-700 hover:bg-gray-100 transition-colors text-sm"
                    >
                        Cancel
                    </button>
                    <button
                        form="edit-qb-form"
                        type="submit"
                        disabled={loading}
                        className="w-full sm:flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md shadow-blue-900/20 transition-all disabled:opacity-60 text-sm flex items-center justify-center gap-2"
                    >
                        <Save size={16} />
                        {loading ? 'Saving Changes...' : 'Save All Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EditQuestionBankModal;
