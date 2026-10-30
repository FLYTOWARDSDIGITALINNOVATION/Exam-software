import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Save, Hash, AlertTriangle, Wand2, Check, Loader2, BookOpen } from 'lucide-react';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import axios from 'axios';

const CreateTest = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [categories, setCategories] = useState([]);
    const [formData, setFormData] = useState({
        topic: '',
        questionCount: '',
        category: 'MRB',
        batches: ['All'],
        negativeMarking: false
    });
    const [questions, setQuestions] = useState([]);

    useEffect(() => {
        axios.get(`${process.env.REACT_APP_API_URL || "https://jclsiddhaacademy.in"}/api/categories`)
            .then(res => {
                if (Array.isArray(res.data)) setCategories(res.data);
            })
            .catch(() => {});
    }, []);


    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleQuestionChange = (index, field, value) => {
        const newQuestions = [...questions];
        newQuestions[index] = { ...newQuestions[index], [field]: value };
        setQuestions(newQuestions);
    };

    const handleOptionChange = (qIndex, oIndex, value) => {
        const newQuestions = [...questions];
        if (!newQuestions[qIndex].options) newQuestions[qIndex].options = ['', '', '', ''];
        newQuestions[qIndex].options[oIndex] = value;
        setQuestions(newQuestions);
    };

    // --- MOCK AI GENERATOR ---
    const generateQuestions = async () => {
        setLoading(true);
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1500));

        const count = parseInt(formData.questionCount) || 5;
        const topic = formData.topic || "General Siddha";

        const newQuestions = Array.from({ length: count }, (_, i) => {
            // Simple mock logic based on topic keywords
            let qText = `Question ${i + 1} regarding ${topic}`;
            let options = ["Option A", "Option B", "Option C", "Option D"];

            if (topic.toLowerCase().includes('noi')) {
                qText = `Identify the symptom associated with ${topic} - Case ${i + 1}`;
                options = ["Vatham imbalance", "Pitham imbalance", "Kapham imbalance", "None of the above"];
            } else if (topic.toLowerCase().includes('guna')) {
                qText = `What is the medicinal property of Herb ${i + 1} in ${topic}?`;
                options = ["Suvai", "Veeryam", "Pirivu", "Mahabhuta"];
            }

            return {
                id: Date.now() + i,
                question: qText,
                options: options,
                correctAnswer: null
            };
        });

        setQuestions(newQuestions);
        setLoading(false);
        setStep(2);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const missingAnswerIdx = questions.findIndex(q => q.correctAnswer === null || q.correctAnswer === undefined || q.correctAnswer === '');
        if (missingAnswerIdx !== -1) {
            alert(`Please select the correct option for Question ${missingAnswerIdx + 1}`);
            return;
        }
        try {
            const token = localStorage.getItem('token');
            const payload = {
                title: formData.topic || "Untitled Assessment",
                difficulty: 'Medium',
                category: formData.category ? [formData.category] : ['MRB'],
                batches: formData.batches || ['All'],
                negativeMarking: formData.negativeMarking,
                questionsCount: questions.length,
                manualQuestions: JSON.stringify(questions.map(q => ({
                    question: q.question,
                    options: q.options,
                    answer: q.correctAnswer
                })))
            };

            await axios.post(`${process.env.REACT_APP_API_URL || "https://jclsiddhaacademy.in"}/api/admin/question-banks`, payload, {
                headers: { Authorization: `Bearer ${token}` }
            });

            alert("Test Created & Published Successfully!");
            navigate('/dashboard');
        } catch (err) {
            console.error("Failed to create test:", err);
            alert("Failed to publish test. Please try again.");
        }
    };

    return (
        <div className="min-h-screen bg-[#FDFCFB] p-6 md:p-12 font-sans text-slate-900">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-4xl mx-auto"
            >
                <button
                    onClick={() => step === 1 ? navigate('/dashboard') : setStep(1)}
                    className="flex items-center gap-2 text-gray-500 hover:text-[#0F172A] transition-colors mb-8"
                >
                    <ArrowLeft size={20} />
                    <span>{step === 1 ? 'Back to Dashboard' : 'Back to Test Details'}</span>
                </button>

                <div className="bg-white rounded-3xl p-8 md:p-10 shadow-xl border border-gray-100">
                    <div className="mb-8">
                        <h1 className="text-3xl font-serif font-bold text-[#0F172A] mb-2">
                            {step === 1 ? 'Assign New Test' : 'Review Generated Questions'}
                        </h1>
                        <p className="text-gray-500">
                            {step === 1 ? 'Enter details to generate AI-powered questions.' : `Review and edit the ${questions.length} generated questions.`}
                        </p>
                    </div>

                    {step === 1 ? (
                        <div className="space-y-6">
                            <Input
                                label="Test Topic / Title"
                                name="topic"
                                placeholder="e.g. Annual Final Exam"
                                icon={BookOpen}
                                value={formData.topic}
                                onChange={handleChange}
                                required
                            />

                            <Input
                                label="Number of Questions"
                                name="questionCount"
                                type="number"
                                placeholder="e.g. 10"
                                icon={Hash}
                                value={formData.questionCount}
                                onChange={handleChange}
                                required
                                min="1"
                                max="50"
                            />



                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Target Category</label>
                                    <select
                                        name="category"
                                        value={formData.category}
                                        onChange={(e) => {
                                            setFormData(prev => ({
                                                ...prev,
                                                category: e.target.value,
                                                batches: ['All']
                                            }));
                                        }}
                                        className="w-full p-3.5 rounded-xl border border-gray-200 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0F172A]/20"
                                    >
                                        {categories.length > 0 ? (
                                            categories.map(c => (
                                                <option key={c.name} value={c.name}>{c.name}</option>
                                            ))
                                        ) : (
                                            <>
                                                <option value="MRB">MRB</option>
                                                <option value="AIAPGET">AIAPGET</option>
                                                <option value="Crash Course">Crash Course</option>
                                                <option value="Both">Both</option>
                                            </>
                                        )}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Target Batch</label>
                                    <select
                                        value={formData.batches?.[0] || 'All'}
                                        onChange={(e) => {
                                            setFormData(prev => ({
                                                ...prev,
                                                batches: [e.target.value]
                                            }));
                                        }}
                                        className="w-full p-3.5 rounded-xl border border-gray-200 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0F172A]/20"
                                    >
                                        <option value="All">All Batches (Open to everyone in {formData.category})</option>
                                        {(categories.find(c => c.name === formData.category)?.batches || []).map(b => (
                                            <option key={b} value={b}>{b} (Only {b} students)</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${formData.negativeMarking ? 'bg-red-100 text-red-600' : 'bg-gray-200 text-gray-500'}`}>
                                        <AlertTriangle size={20} />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900">Negative Marking</h3>
                                        <p className="text-sm text-gray-500">Enable penalty for wrong answers</p>
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        name="negativeMarking"
                                        checked={formData.negativeMarking}
                                        onChange={handleChange}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#0F172A]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0F172A]"></div>
                                </label>
                            </div>

                            <div className="pt-4">
                                <Button
                                    onClick={generateQuestions}
                                    disabled={loading || !formData.topic || !formData.questionCount}
                                    className="w-full !bg-[#0F172A] !hover:bg-[#1e293b] !shadow-[#0F172A]/20 flex justify-center items-center gap-2"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="animate-spin" size={20} />
                                            <span>Generating...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Wand2 size={20} />
                                            <span>Generate Questions with AI</span>
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-12">
                            {questions.map((q, qIdx) => (
                                <div key={q.id} className="p-6 rounded-2xl bg-gray-50 border border-gray-200">
                                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[#0F172A] text-white text-sm">
                                            {qIdx + 1}
                                        </span>
                                        Question Text
                                    </h3>
                                    <textarea
                                        value={q.question}
                                        onChange={(e) => handleQuestionChange(qIdx, 'question', e.target.value)}
                                        className="w-full p-4 rounded-xl border-2 border-gray-200 focus:border-[#0F172A] focus:ring-4 focus:ring-[#0F172A]/10 outline-none transition-all mb-6"
                                        rows="2"
                                        required
                                    />

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                        {q.options.map((opt, oIdx) => (
                                            <div key={oIdx} className="relative">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">
                                                    {String.fromCharCode(65 + oIdx)}
                                                </span>
                                                <input
                                                    type="text"
                                                    value={opt}
                                                    onChange={(e) => handleOptionChange(qIdx, oIdx, e.target.value)}
                                                    className={`w-full pl-10 p-3 rounded-xl border-2 outline-none transition-all ${q.correctAnswer === oIdx ? 'border-[#0F172A] bg-[#0F172A]/5' : 'border-gray-200 focus:border-gray-300'}`}
                                                    required
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => handleQuestionChange(qIdx, 'correctAnswer', oIdx)}
                                                    className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full transition-colors ${q.correctAnswer === oIdx ? 'text-[#0F172A]' : 'text-gray-300 hover:text-gray-400'}`}
                                                >
                                                    <Check size={20} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}

                            <div className="pt-4 flex gap-4">
                                <Button
                                    type="button"
                                    onClick={() => setStep(1)}
                                    className="flex-1 !bg-gray-100 !text-gray-600 hover:!bg-gray-200 !shadow-none"
                                >
                                    Back
                                </Button>
                                <Button
                                    type="submit"
                                    className="flex-2 w-full !bg-[#0F172A] !hover:bg-[#1e293b] !shadow-[#0F172A]/20"
                                >
                                    <Save size={20} />
                                    <span>Publish Test</span>
                                </Button>
                            </div>
                        </form>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

export default CreateTest;
