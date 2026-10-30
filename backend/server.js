const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
    console.log(`[DEBUG] ${req.method} ${req.url}`);
    next();
});
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- CONFIGURATION ---
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/siddha';
const JWT_SECRET = 'siddha_veda_intelligence_secret_key_2024';


// --- DATABASE CONNECTION ---
mongoose.connect(MONGODB_URI)
    .then(() => {
        console.log('✅ Connected to MongoDB');
        createInitialAdmin();
        seedCategories();
    })
    .catch(err => console.error('❌ MongoDB Connection Error:', err.message));

// --- FILE UPLOAD SETUP ---
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// Subdirectories for structured storage
const videoUploadDir = path.join(uploadDir, 'videos');
if (!fs.existsSync(videoUploadDir)) fs.mkdirSync(videoUploadDir, { recursive: true });

const thumbUploadDir = path.join(uploadDir, 'thumbnails');
if (!fs.existsSync(thumbUploadDir)) fs.mkdirSync(thumbUploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, `qb-${Date.now()}${path.extname(file.originalname)}`)
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = ['application/json', 'application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only JSON, PDF, and Images are allowed!'), false);
    }
};

const upload = multer({ storage, fileFilter });

// Video & Thumbnail storage engine for media uploads
const videoDiskStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (file.fieldname === 'video') {
            cb(null, videoUploadDir);
        } else if (file.fieldname === 'thumbnail') {
            cb(null, thumbUploadDir);
        } else {
            cb(null, uploadDir);
        }
    },
    filename: (req, file, cb) => {
        const cleanExt = path.extname(file.originalname).toLowerCase();
        const cleanBase = path.basename(file.originalname, cleanExt).replace(/[^a-zA-Z0-9_-]/g, '_');
        cb(null, `${file.fieldname}-${Date.now()}-${cleanBase}${cleanExt}`);
    }
});

const videoUpload = multer({
    storage: videoDiskStorage,
    limits: {
        fileSize: 1024 * 1024 * 1024 * 2 // Up to 2GB video support
    }
});



// --- MODELS ---

const UserSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['student', 'faculty', 'admin'], default: 'student' },
    category: { type: String, default: 'Both' },
    batch: { type: String, default: 'All' },
    // Student & Profile fields
    gender: String,
    dob: String,
    age: String,
    regNo: String,
    course: String,
    year: String,
    mobile: String,
    address: String,
    expertise: String, // Maps to bio
    studentId: { type: String, unique: true, sparse: true },
    // New Academic Fields
    ugCollege: String,
    ugYear: String,
    pgCollege: String,
    pgYear: String,
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    lastActive: Date,
    resetPasswordToken: String,
    resetPasswordExpires: Date
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);

const AdminUserSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['faculty', 'admin'], default: 'faculty' },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved' }, // Admin defaults to approved
    lastActive: Date,
    resetPasswordToken: String,
    resetPasswordExpires: Date
}, { timestamps: true });

const AdminUser = mongoose.model('AdminUser', AdminUserSchema);

const QuestionBankSchema = new mongoose.Schema({
    title: String,
    difficulty: String,
    category: { type: [String], default: ['Both'] },
    batches: { type: [String], default: ['All'] },
    filename: String,
    filenames: [String],
    questions: [{
        question: String,
        options: [String],
        answer: Number,
        filename: String
    }],
    questionsCount: { type: Number, default: 0 },
    attempts: { type: Number, default: 0 },
    negativeMarking: { type: Boolean, default: false },
    duration: { type: Number, default: 60 }, // Duration in minutes
    status: { type: String, enum: ['draft', 'published', 'disabled'], default: 'published' },
    startTime: { type: Date },
    endTime: { type: Date }
}, { timestamps: true });

const QuestionBank = mongoose.model('QuestionBank', QuestionBankSchema);

const CategorySchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    batches: { type: [String], default: [] }
}, { timestamps: true });

const Category = mongoose.model('Category', CategorySchema);

const seedCategories = async () => {
    try {
        const defaults = [
            { name: 'MRB', batches: [] },
            { name: 'AIAPGET', batches: [] },
            { name: 'Crash Course', batches: [] },
            { name: 'Both', batches: [] }
        ];
        for (const item of defaults) {
            const exists = await Category.findOne({ name: item.name });
            if (!exists) {
                await Category.create(item);
            }
        }
    } catch (e) {
        console.error('Category seed error:', e.message);
    }
};

const AttemptSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    testId: { type: mongoose.Schema.Types.ObjectId, ref: 'QuestionBank' },
    score: { type: Number, required: true },
    totalQuestions: Number,
    answers: [Number], // Student's selected option indices
    correctAnswers: [Number], // Correct option indices at time of attempt
    date: { type: Date, default: Date.now }
}, { timestamps: true });

const Attempt = mongoose.model('Attempt', AttemptSchema);

const ReAttemptRequestSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    testId: { type: mongoose.Schema.Types.ObjectId, ref: 'QuestionBank', required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    message: String
}, { timestamps: true });

const ReAttemptRequest = mongoose.model('ReAttemptRequest', ReAttemptRequestSchema);

const ReviewSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    role: { type: String, required: true },
    text: { type: String, required: true },
    rating: { type: Number, default: 5 },
    image: String,
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' }
}, { timestamps: true });

const Review = mongoose.model('Review', ReviewSchema);

const QuestionViewSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    testId: { type: mongoose.Schema.Types.ObjectId, ref: 'QuestionBank', required: true },
    viewedAt: { type: Date, default: Date.now }
}, { timestamps: true });

const QuestionView = mongoose.model('QuestionView', QuestionViewSchema);

const VideoSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    duration: { type: String, default: '00:00' },
    videoUrl: { type: String, required: true, trim: true },
    thumbnail: { type: String, default: '', trim: true },
    size: { type: Number, default: 0 },
    category: { type: String, default: 'General' },
    storageType: { type: String, enum: ['local', 'object_storage', 'external'], default: 'local' },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    views: { type: Number, default: 0 },
    isPublished: { type: Boolean, default: true }
}, { timestamps: true });

const Video = mongoose.model('Video', VideoSchema);


// --- MIDDLEWARE ---

const verifyToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Access denied' });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        console.error(`[AUTH] Token Verification Failed: ${err.message}`);
        res.status(401).json({ message: 'Invalid token' });
    }
};

const verifyAdmin = (req, res, next) => {
    verifyToken(req, res, () => {
        if (req.user.role !== 'admin') {
            console.warn(`[AUTH] Admin access denied for user ${req.user.id} (role: ${req.user.role})`);
            return res.status(403).json({ message: 'Admin only' });
        }
        next();
    });
};

const verifyEducator = (req, res, next) => {
    verifyToken(req, res, () => {
        if (req.user.role !== 'admin' && req.user.role !== 'faculty') {
            console.warn(`[AUTH] Educator access denied for user ${req.user.id} (role: ${req.user.role})`);
            return res.status(403).json({ message: 'Access denied: Educators only' });
        }
        next();
    });
};

// --- ROUTES ---

// 1. Auth & Profile
app.post('/api/auth/register', async (req, res) => {
    try {
        const { fullName, email, password, role } = req.body;

        if (!fullName || !email || !password) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        const lowerEmail = email.toLowerCase();
        if (!lowerEmail.endsWith('@gmail.com') && lowerEmail !== 'admin@siddhaveda.com') {
            return res.status(400).json({ message: 'Only @gmail.com email addresses are allowed.' });
        }

        const existsStudent = await User.findOne({ email });
        const existsAdmin = await AdminUser.findOne({ email });
        if (existsStudent || existsAdmin) return res.status(400).json({ message: 'User already exists' });

        const hashedPassword = await bcrypt.hash(password, 10);

        // Admins are approved by default, others start as pending
        // Admins are approved by default, others start as pending
        const status = role === 'admin' ? 'approved' : 'pending';

        let newUser;
        if (role === 'faculty' || role === 'admin') {
            newUser = new AdminUser({ ...req.body, password: hashedPassword, status });
        } else {
            newUser = new User({ ...req.body, password: hashedPassword, status });
        }
        await newUser.save();

        if (status === 'pending') {
            return res.status(201).json({
                message: 'Registration successful. Please wait for admin approval before logging in.',
                status: 'pending'
            });
        }

        const token = jwt.sign({ id: newUser._id, role: newUser.role }, JWT_SECRET, { expiresIn: '1d' });
        res.status(201).json({ token, user: { id: newUser._id, email: newUser.email, role: newUser.role, fullName: newUser.fullName } });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password, role: loginType } = req.body;

        const lowerEmail = email.toLowerCase();
        if (!lowerEmail || (!lowerEmail.endsWith('@gmail.com') && lowerEmail !== 'admin@siddhaveda.com')) {
            return res.status(400).json({ message: 'Only @gmail.com email addresses are allowed.' });
        }

        let user;
        let collectionName = 'User';

        if (loginType === 'faculty' || loginType === 'admin') {
            user = await AdminUser.findOne({ email });
            collectionName = 'AdminUser';
        } else {
            // Default to Student check
            user = await User.findOne({ email });
            if (user && user.role !== 'student') {
                return res.status(403).json({ message: 'Please use the Admin/Faculty login.' });
            }
        }

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        if (user.status === 'pending') {
            return res.status(403).json({ message: 'Your account is pending admin approval.' });
        }
        if (user.status === 'rejected') {
            return res.status(403).json({ message: 'Your account registration has been rejected.' });
        }

        user.lastActive = new Date();
        await user.save();

        const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });
        res.json({ token, user: { id: user._id, email: user.email, role: user.role, fullName: user.fullName } });
    } catch (err) { res.status(500).json({ message: err.message }); }
});


app.post('/api/auth/direct-password-reset', async (req, res) => {
    try {
        const { email, password } = req.body;

        const lowerEmail = email.toLowerCase();
        if (!lowerEmail || (!lowerEmail.endsWith('@gmail.com') && lowerEmail !== 'admin@siddhaveda.com')) {
            return res.status(400).json({ message: 'Only @gmail.com email addresses are allowed.' });
        }

        let user = await User.findOne({ email }) || await AdminUser.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: 'User with this email does not exist.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        user.password = hashedPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        res.json({ message: 'Your password has been successfully updated.' });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

app.get('/api/user/profile', verifyToken, async (req, res) => {
    try {
        let user;
        if (req.user.role === 'admin' || req.user.role === 'faculty') {
            user = await AdminUser.findById(req.user.id).select('-password');
            res.json(user);
        } else {
            user = await User.findById(req.user.id).select('-password');
            if (user && user.role === 'student') {
                const attempts = await Attempt.find({ userId: user._id });
                const avg = attempts.length > 0 ? (attempts.reduce((a, b) => a + b.score, 0) / attempts.length).toFixed(1) : 0;
                const userObj = user.toObject();
                userObj.testsCompleted = attempts.length;
                userObj.averageScore = avg;
                res.json(userObj);
            } else {
                res.json(user);
            }
        }
    } catch (err) { res.status(500).json({ message: err.message }); }
});

app.post('/api/user/update', verifyToken, async (req, res) => {
    try {
        const updates = req.body;
        const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true }).select('-password');
        res.json(user);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// 2. Admin: Dashboard Stats & Student List
app.get('/api/admin/dashboard-stats', verifyEducator, async (req, res) => {
    try {
        const totalStudents = await User.countDocuments({ role: 'student' });
        const totalTests = await QuestionBank.countDocuments();

        // Calculate dynamic stats
        const allAttempts = await Attempt.find();
        const globalAverage = allAttempts.length > 0
            ? (allAttempts.reduce((acc, curr) => acc + curr.score, 0) / allAttempts.length).toFixed(1)
            : 0;

        const activeToday = await User.countDocuments({
            lastActive: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
        });

        res.json({
            stats: { totalStudents, totalTests, globalAverage, activeToday },
            charts: {
                performanceDistribution: [
                    { name: 'Overall Performance', score: 85 }
                ],
                performanceTrend: [
                    { month: 'Jan', score: 60 }, { month: 'Feb', score: 75 }
                ]
            }
        });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

app.get('/api/admin/users', verifyAdmin, async (req, res) => {
    try {
        const users = await User.find({ role: 'student' }).select('-password');
        // Enhance user objects with stats
        const usersWithStats = await Promise.all(users.map(async (u) => {
            const attempts = await Attempt.find({ userId: u._id });
            const avg = attempts.length > 0 ? (attempts.reduce((a, b) => a + b.score, 0) / attempts.length).toFixed(1) : 0;
            return {
                ...u._doc,
                testsCompleted: attempts.length,
                averageScore: avg
            };
        }));
        res.json(usersWithStats);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

app.delete('/api/admin/users/:id', verifyAdmin, async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.id);
        await Attempt.deleteMany({ userId: req.params.id });
        await ReAttemptRequest.deleteMany({ userId: req.params.id });
        res.json({ message: 'Student and related data deleted successfully' });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

app.put('/api/admin/users/:id', verifyEducator, async (req, res) => {
    try {
        const { category, batch, fullName, regNo, status } = req.body;
        let user = await User.findById(req.params.id);
        if (!user) {
            user = await AdminUser.findById(req.params.id);
        }
        if (!user) return res.status(404).json({ message: 'Student not found' });

        if (category) user.category = category;
        if (batch !== undefined) user.batch = batch;
        if (fullName) user.fullName = fullName;
        if (regNo !== undefined) user.regNo = regNo;
        if (status) user.status = status;

        await user.save();
        res.json({ message: 'Student details updated successfully', user });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Category / Batch Management Endpoints
app.get('/api/categories', async (req, res) => {
    try {
        const categories = await Category.find().sort({ createdAt: 1 });
        const defaults = [
            { name: 'MRB', batches: [] },
            { name: 'AIAPGET', batches: [] },
            { name: 'Crash Course', batches: [] },
            { name: 'Both', batches: [] }
        ];
        const existingNames = categories.map(c => c.name);
        for (const def of defaults) {
            if (!existingNames.includes(def.name)) {
                categories.push(new Category(def));
            }
        }
        res.json(categories);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Add batch INSIDE a specific category
app.post('/api/admin/categories/:categoryName/batches', verifyEducator, async (req, res) => {
    try {
        const { categoryName } = req.params;
        const { batchName } = req.body;
        if (!batchName || !batchName.trim()) {
            return res.status(400).json({ message: 'Batch name is required' });
        }
        const trimmedBatch = batchName.trim();
        let cat = await Category.findOne({ name: { $regex: new RegExp(`^${categoryName}$`, 'i') } });
        if (!cat) {
            cat = new Category({ name: categoryName, batches: [trimmedBatch] });
        } else {
            if (!cat.batches) cat.batches = [];
            const exists = cat.batches.some(b => b.toLowerCase() === trimmedBatch.toLowerCase());
            if (exists) {
                return res.status(400).json({ message: `Batch "${trimmedBatch}" already exists in ${categoryName}` });
            }
            cat.batches.push(trimmedBatch);
        }
        await cat.save();
        res.status(201).json({ message: `Batch "${trimmedBatch}" added to ${categoryName}`, category: cat });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Delete batch from INSIDE a specific category
app.delete('/api/admin/categories/:categoryName/batches/:batchName', verifyEducator, async (req, res) => {
    try {
        const { categoryName, batchName } = req.params;
        const cat = await Category.findOne({ name: { $regex: new RegExp(`^${categoryName}$`, 'i') } });
        if (!cat) return res.status(404).json({ message: 'Category not found' });
        if (cat.batches) {
            cat.batches = cat.batches.filter(b => b.toLowerCase() !== batchName.toLowerCase());
            await cat.save();
        }
        res.json({ message: `Batch "${batchName}" removed from ${categoryName}`, category: cat });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.post('/api/admin/categories', verifyEducator, async (req, res) => {
    try {
        const { name, batches } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ message: 'Category name is required' });
        }
        const trimmed = name.trim();
        const existing = await Category.findOne({ name: { $regex: new RegExp(`^${trimmed}$`, 'i') } });
        if (existing) {
            return res.status(400).json({ message: 'Category already exists' });
        }
        const initialBatches = Array.isArray(batches) ? batches : [];
        const newCat = new Category({ name: trimmed, batches: initialBatches });
        await newCat.save();
        res.status(201).json({ message: 'Category added successfully', category: newCat });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.delete('/api/admin/categories/:name', verifyEducator, async (req, res) => {
    try {
        const { name } = req.params;
        if (['Both', 'MRB', 'AIAPGET', 'Crash Course'].includes(name)) {
            return res.status(400).json({ message: 'Default categories cannot be deleted' });
        }
        await Category.findOneAndDelete({ name });
        res.json({ message: 'Category deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Admin Review Endpoints
app.get('/api/admin/pending-registrations', verifyAdmin, async (req, res) => {
    try {
        const studentPending = await User.find({ status: 'pending' }).select('-password');
        const facultyPending = await AdminUser.find({ status: 'pending' }).select('-password');
        res.json([...studentPending, ...facultyPending]);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

app.put('/api/admin/approve-registration/:id', verifyAdmin, async (req, res) => {
    try {
        let user = await User.findByIdAndUpdate(req.params.id, { status: 'approved' }, { new: true });
        if (!user) {
            user = await AdminUser.findByIdAndUpdate(req.params.id, { status: 'approved' }, { new: true });
        }
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json({ message: 'User registration approved', user });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

app.put('/api/admin/reject-registration/:id', verifyAdmin, async (req, res) => {
    try {
        let user = await User.findByIdAndUpdate(req.params.id, { status: 'rejected' }, { new: true });
        if (!user) {
            user = await AdminUser.findByIdAndUpdate(req.params.id, { status: 'rejected' }, { new: true });
        }
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json({ message: 'User registration rejected', user });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// 3. Question Bank Management
app.get('/api/admin/question-banks', verifyEducator, async (req, res) => {
    try {
        const banks = await QuestionBank.find().sort({ createdAt: -1 }).lean();
        
        // Count actual attempts per bank to ensure "outside" count matches "inside" list
        const attemptCounts = await Attempt.aggregate([
            { $project: { testIdStr: { $toString: "$testId" } } },
            { $group: { _id: "$testIdStr", count: { $sum: 1 } } }
        ]);
        
        const countsMap = {};
        attemptCounts.forEach(curr => {
            if (curr._id) {
                const idStr = curr._id.toString();
                countsMap[idStr] = (countsMap[idStr] || 0) + curr.count;
            }
        });
        
        const banksWithActualCounts = banks.map(bank => ({
            ...bank,
            attempts: countsMap[bank._id.toString()] || 0
        }));
        
        res.json(banksWithActualCounts);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

app.post('/api/admin/question-banks', verifyEducator, upload.any(), async (req, res) => {
    try {
        let questions = [];
        let questionsCount = 0;

        if (req.body.manualQuestions) {
            try {
                questions = JSON.parse(req.body.manualQuestions);

                // Map uploaded question images
                if (req.files) {
                    req.files.forEach(file => {
                        if (file.fieldname === 'questionImages') {
                            const match = file.originalname.match(/^q-(\d+)$/);
                            if (match) {
                                const qIdx = parseInt(match[1]);
                                if (questions[qIdx]) {
                                    questions[qIdx].filename = file.filename;
                                }
                            }
                        }
                    });
                }
                questionsCount = questions.length;
            } catch (pErr) {
                console.error("Failed to parse manual questions:", pErr);
                return res.status(400).json({ message: "Invalid question data format" });
            }
        }

        const filenames = req.files ? req.files.filter(f => f.fieldname === 'files').map(f => f.filename) : [];

        const newBank = new QuestionBank({
            ...req.body,
            filename: filenames.length > 0 ? filenames[0] : null,
            filenames: filenames,
            questions: questions,
            questionsCount: questionsCount || req.body.questionsCount || 0,
            category: Array.isArray(req.body.category) ? req.body.category : (typeof req.body.category === 'string' ? req.body.category.split(',').map(s => s.trim()).filter(Boolean) : ['Both']),
            batches: Array.isArray(req.body.batches) ? req.body.batches : (typeof req.body.batches === 'string' && req.body.batches ? req.body.batches.split(',').map(s => s.trim()).filter(Boolean) : (req.body.batch ? [req.body.batch] : ['All'])),
            negativeMarking: req.body.negativeMarking === 'true' || req.body.negativeMarking === true,
            duration: req.body.duration ? parseInt(req.body.duration) : 60,
            status: req.body.status || 'published',
            startTime: req.body.startTime ? new Date(req.body.startTime) : null,
            endTime: req.body.endTime ? new Date(req.body.endTime) : null
        });
        await newBank.save();
        res.status(201).json(newBank);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

app.delete('/api/admin/question-banks/:id', verifyEducator, async (req, res) => {
    try {
        const bank = await QuestionBank.findById(req.params.id);
        if (!bank) return res.status(404).json({ message: 'Not found' });

        // Helper to safely delete file
        const deleteFile = (filename) => {
            if (!filename) return;
            try {
                const filePath = path.join(uploadDir, filename);
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            } catch (e) {
                console.error(`Failed to delete file ${filename}:`, e);
            }
        };

        // Delete legacy single file
        if (bank.filename) deleteFile(bank.filename);

        // Delete multiple files
        if (bank.filenames && bank.filenames.length > 0) {
            bank.filenames.forEach(f => deleteFile(f));
        }

        await QuestionBank.findByIdAndDelete(req.params.id);
        res.json({ message: 'Question bank deleted' });
    } catch (err) { res.status(500).json({ message: err.message }); }
});
// Toggle Status (Separate route to avoid Multer issues with simple updates)
app.patch('/api/admin/question-banks/:id/status', verifyEducator, async (req, res) => {
    try {
        const { status } = req.body;
        console.log(`[PATCH] ${req.params.id} -> ${status}`);

        if (!['draft', 'published', 'disabled'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status value' });
        }

        const bank = await QuestionBank.findByIdAndUpdate(
            req.params.id,
            { status: status },
            { new: true, runValidators: false }
        );

        if (!bank) {
            console.error(`Bank not found: ${req.params.id}`);
            return res.status(404).json({ message: 'Question bank not found' });
        }

        console.log(`Status updated to ${bank.status}`);
        res.json({ message: 'Status updated', status: bank.status });
    } catch (err) {
        console.error("PATCH status error:", err);
        res.status(500).json({ message: err.message });
    }
});

// Duplicate Question Bank (Question Paper)
app.post('/api/admin/question-banks/:id/duplicate', verifyEducator, async (req, res) => {
    try {
        const originalBank = await QuestionBank.findById(req.params.id);
        if (!originalBank) {
            return res.status(404).json({ message: 'Question paper not found' });
        }

        // Helper to copy files if exists
        const fileMap = {};
        const copyFileIfExists = (oldFilename) => {
            if (!oldFilename) return null;
            if (fileMap[oldFilename]) return fileMap[oldFilename];
            const oldPath = path.join(uploadDir, oldFilename);
            if (!fs.existsSync(oldPath)) return oldFilename;
            const ext = path.extname(oldFilename);
            const newFilename = `qb-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
            const newPath = path.join(uploadDir, newFilename);
            try {
                fs.copyFileSync(oldPath, newPath);
                fileMap[oldFilename] = newFilename;
                return newFilename;
            } catch (e) {
                console.error("Failed to copy file:", e);
                return oldFilename;
            }
        };

        // Clone questions deep copy
        const clonedQuestions = (originalBank.questions || []).map(q => {
            const newFilename = q.filename ? copyFileIfExists(q.filename) : undefined;
            return {
                question: q.question,
                options: Array.isArray(q.options) ? [...q.options] : [],
                answer: typeof q.answer === 'number' ? q.answer : 0,
                ...(newFilename ? { filename: newFilename } : {})
            };
        });

        // Clone filenames
        let clonedFilenames = [];
        if (originalBank.filenames && originalBank.filenames.length > 0) {
            clonedFilenames = originalBank.filenames.map(f => copyFileIfExists(f)).filter(Boolean);
        }
        const clonedPrimaryFilename = originalBank.filename ? copyFileIfExists(originalBank.filename) : (clonedFilenames[0] || null);

        const newTitle = (req.body.title && req.body.title.trim()) ? req.body.title.trim() : `${originalBank.title} (Copy)`;

        const duplicatedBank = new QuestionBank({
            title: newTitle,
            difficulty: originalBank.difficulty || 'Medium',
            category: originalBank.category || ['Both'],
            batches: originalBank.batches || ['All'],
            duration: originalBank.duration || 60,
            negativeMarking: originalBank.negativeMarking || false,
            status: req.body.status || originalBank.status || 'draft',
            filename: clonedPrimaryFilename,
            filenames: clonedFilenames,
            questions: clonedQuestions,
            questionsCount: clonedQuestions.length,
            attempts: 0
        });

        await duplicatedBank.save();
        console.log(`[DUPLICATE] Created duplicated paper: ${duplicatedBank._id} ("${duplicatedBank.title}") from ${originalBank._id}`);
        res.status(201).json({
            message: 'Question paper duplicated successfully',
            bank: duplicatedBank
        });
    } catch (err) {
        console.error("Duplicate question bank error:", err);
        res.status(500).json({ message: err.message });
    }
});

// Get single Question Bank
app.get('/api/admin/question-banks/:id', verifyEducator, async (req, res) => {
    try {
        const bank = await QuestionBank.findById(req.params.id);
        if (!bank) return res.status(404).json({ message: 'Question paper not found' });
        res.json(bank);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.put('/api/admin/question-banks/:id', verifyEducator, upload.any(), async (req, res) => {
    try {
        const { title, subject, difficulty, category } = req.body;
        const bank = await QuestionBank.findById(req.params.id);
        if (!bank) return res.status(404).json({ message: 'Question bank not found' });

        // Update metadata
        if (title) bank.title = title;
        if (difficulty) bank.difficulty = difficulty;
        if (category) bank.category = Array.isArray(category) ? category : (typeof category === 'string' ? category.split(',').map(s => s.trim()).filter(Boolean) : category);
        if (req.body.batches !== undefined) {
            bank.batches = Array.isArray(req.body.batches) ? req.body.batches : (typeof req.body.batches === 'string' && req.body.batches ? req.body.batches.split(',').map(s => s.trim()).filter(Boolean) : (req.body.batch ? [req.body.batch] : ['All']));
        }
        if (req.body.negativeMarking !== undefined) {
            bank.negativeMarking = req.body.negativeMarking === 'true' || req.body.negativeMarking === true;
        }
        if (req.body.duration !== undefined) {
            bank.duration = parseInt(req.body.duration);
        }
        if (req.body.status !== undefined) {
            bank.status = req.body.status;
        }
        // Timing removed as per user request
        bank.startTime = null;
        bank.endTime = null;

        // Initialize with existing state
        let finalFilenames = bank.filenames && bank.filenames.length > 0 ? bank.filenames : (bank.filename ? [bank.filename] : []);
        let finalQuestions = bank.questions || [];

        // Process Updates & New Files
        if (req.body.updatedQuestions) {
            try {
                const incomingQuestions = JSON.parse(req.body.updatedQuestions);

                // Existing files in the bank for deletion check
                const existingFilenames = bank.questions.map(q => q.filename).filter(f => f);
                // Filenames kept in the incoming update
                const keptFilenames = incomingQuestions.map(q => q.filename).filter(f => f);
                const filesToDelete = existingFilenames.filter(f => !keptFilenames.includes(f));

                filesToDelete.forEach(filename => {
                    const filePath = path.join(uploadDir, filename);
                    if (fs.existsSync(filePath)) {
                        try { fs.unlinkSync(filePath); } catch (e) {
                            console.error("Failed to delete file:", filename, e);
                        }
                    }
                });

                // Map new files to questions
                if (req.files) {
                    req.files.forEach(file => {
                        if (file.fieldname === 'questionImages') {
                            const match = file.originalname.match(/^q-(\d+)$/);
                            if (match) {
                                const qIdx = parseInt(match[1]);
                                if (incomingQuestions[qIdx]) {
                                    incomingQuestions[qIdx].filename = file.filename;
                                }
                            }
                        }
                    });
                }
                finalQuestions = incomingQuestions;
                finalFilenames = finalQuestions.filter(q => q.filename).map(q => q.filename);
            } catch (err) {
                console.error("Update failed logic:", err);
                return res.status(400).json({ message: "Invalid update data" });
            }
        }

        // Apply final changes
        bank.filenames = finalFilenames;
        bank.filename = finalFilenames.length > 0 ? finalFilenames[0] : null;
        bank.questions = finalQuestions;
        bank.questionsCount = finalQuestions.length;

        await bank.save();
        res.json(bank);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

app.get('/api/admin/question-banks/:id/download', verifyEducator, async (req, res) => {
    try {
        console.log(`[DEBUG] Download request for bank ID: ${req.params.id}`);
        const bank = await QuestionBank.findById(req.params.id);
        if (!bank) return res.status(404).json({ message: 'Not found' });

        // Check if there are multiple files
        if (bank.filenames && bank.filenames.length > 0) {
            const mainFile = bank.filenames[0];
            const filePath = path.join(uploadDir, mainFile);
            if (fs.existsSync(filePath)) {
                return res.download(filePath, mainFile);
            }
        }
        else if (bank.filename) {
            const filePath = path.join(uploadDir, bank.filename);
            if (fs.existsSync(filePath)) {
                return res.download(filePath, bank.filename);
            }
        }

        // If no file, or file missing, generate JSON
        console.log(`[DEBUG] No physical file found for bank ${bank._id}, sending questions JSON`);
        const jsonData = JSON.stringify(bank.questions || [], null, 2);
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${bank.title.replace(/[^a-z0-9]/gi, '_')}.json"`);
        res.send(jsonData);
    } catch (err) {
        console.error("Download error:", err);
        res.status(500).json({ message: err.message });
    }
});



// 4. Student: Tests & Progress
app.get('/api/user/tests', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id) || await AdminUser.findById(req.user.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const attempts = await Attempt.find({ userId: req.user.id });
        const attemptedTestIds = attempts.map(a => a.testId ? a.testId.toString() : '');

        const requests = await ReAttemptRequest.find({ userId: req.user.id });

        const catFilter = {
            $or: [
                { category: 'Both' },
                { category: user.category }
            ]
        };

        const userBatch = user.batch || 'All';
        const batchConditions = [
            { batches: { $exists: false } },
            { batches: { $size: 0 } },
            { batches: 'All' }
        ];
        if (userBatch && userBatch !== 'All') {
            batchConditions.push({ batches: userBatch });
        }

        const tests = await QuestionBank.find({
            status: 'published',
            $and: [
                catFilter,
                { $or: batchConditions }
            ]
        }).select('-questions.answer');

        console.log(`[DEBUG] Found ${tests.length} published tests for user ${req.user.id}`);

        const testsWithStatus = tests.map(t => {
            const reqsForTest = requests.filter(r => r.testId && r.testId.toString() === t._id.toString());
            let reqForTest = reqsForTest.find(r => r.status === 'approved');
            if (!reqForTest && reqsForTest.length > 0) {
                reqForTest = reqsForTest.sort((a, b) => b.createdAt - a.createdAt)[0];
            }
            return {
                ...t._doc,
                hasAttempted: attemptedTestIds.includes(t._id.toString()),
                requestStatus: reqForTest ? reqForTest.status : null
            };
        });

        res.json(testsWithStatus);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// Re-attempt Request Routes
app.post('/api/user/tests/:id/request-reattempt', verifyToken, async (req, res) => {
    try {
        const existing = await ReAttemptRequest.findOne({ userId: req.user.id, testId: req.params.id, status: 'pending' });
        if (existing) return res.status(400).json({ message: 'Request already pending' });

        const request = new ReAttemptRequest({
            userId: req.user.id,
            testId: req.params.id
        });
        await request.save();
        res.status(201).json({ message: 'Request sent to admin' });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

app.get('/api/admin/reattempt-requests', verifyAdmin, async (req, res) => {
    try {
        const requests = await ReAttemptRequest.find()
            .populate('userId', 'fullName email')
            .populate('testId', 'title')
            .sort({ createdAt: -1 });
        res.json(requests);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

app.put('/api/admin/reattempt-requests/:id', verifyAdmin, async (req, res) => {
    try {
        const { status } = req.body;
        const request = await ReAttemptRequest.findById(req.params.id);
        if (!request) return res.status(404).json({ message: 'Request not found' });

        request.status = status;
        await request.save();

        // Removed Attempt.deleteOne to keep history accessible via Review button

        res.json({ message: `Request ${status}` });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// Review Routes
app.post('/api/user/reviews', verifyToken, async (req, res) => {
    try {
        const { text, rating } = req.body;
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const review = new Review({
            userId: user._id,
            name: user.fullName,
            role: user.expertise || 'Scholar',
            text,
            rating,
            image: "https://images.unsplash.com/photo-1559839734-2b71f1e9cbee?auto=format&fit=crop&q=80&w=200&h=200", // Default image or user image if available
            status: 'pending'
        });
        await review.save();
        res.status(201).json({ message: 'Review submitted for approval', review });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

app.get('/api/reviews/approved', async (req, res) => {
    try {
        const reviews = await Review.find({ status: 'approved' }).sort({ createdAt: -1 });
        res.json(reviews);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

app.get('/api/admin/reviews', verifyAdmin, async (req, res) => {
    try {
        const reviews = await Review.find().populate('userId', 'fullName email').sort({ createdAt: -1 });
        res.json(reviews);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

app.put('/api/admin/reviews/:id', verifyAdmin, async (req, res) => {
    try {
        const updates = req.body;
        const review = await Review.findByIdAndUpdate(req.params.id, updates, { new: true });
        res.json(review);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

app.delete('/api/admin/reviews/:id', verifyAdmin, async (req, res) => {
    try {
        await Review.findByIdAndDelete(req.params.id);
        res.json({ message: 'Review deleted' });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ==========================================
// --- VIDEO MANAGEMENT & OBJECT STORAGE ---
// ==========================================

// 1. Upload Video & Thumbnail files to storage
app.post('/api/admin/videos/upload', verifyEducator, (req, res) => {
    videoUpload.fields([
        { name: 'video', maxCount: 1 },
        { name: 'thumbnail', maxCount: 1 }
    ])(req, res, (err) => {
        if (err) {
            console.error('❌ Video upload error:', err);
            return res.status(400).json({ message: err.message || 'File upload failed' });
        }

        try {
            const host = req.get('host');
            const protocol = req.protocol;
            const baseUrl = `${protocol}://${host}`;

            let videoUrl = '';
            let thumbnailUrl = '';
            let size = 0;

            if (req.files && req.files['video'] && req.files['video'][0]) {
                const videoFile = req.files['video'][0];
                videoUrl = `${baseUrl}/uploads/videos/${videoFile.filename}`;
                size = videoFile.size;
            }

            if (req.files && req.files['thumbnail'] && req.files['thumbnail'][0]) {
                const thumbFile = req.files['thumbnail'][0];
                thumbnailUrl = `${baseUrl}/uploads/thumbnails/${thumbFile.filename}`;
            }

            res.json({
                message: 'Upload successful',
                videoUrl,
                thumbnailUrl,
                size
            });
        } catch (error) {
            console.error('Error generating file URLs:', error);
            res.status(500).json({ message: 'Failed to process uploaded files' });
        }
    });
});

// 2. Create Video Entry (Saves metadata to MongoDB)
app.post('/api/admin/videos', verifyEducator, async (req, res) => {
    try {
        const { title, description, duration, videoUrl, thumbnail, size, category } = req.body;

        if (!title || !videoUrl) {
            return res.status(400).json({ message: 'Title and Video URL are required' });
        }

        const isLocal = videoUrl.includes('/uploads/videos/');

        const newVideo = new Video({
            title,
            description: description || '',
            duration: duration || '00:00',
            videoUrl,
            thumbnail: thumbnail || '',
            size: Number(size) || 0,
            category: category || 'General',
            storageType: isLocal ? 'local' : 'object_storage',
            uploadedBy: req.user?.id
        });

        await newVideo.save();
        res.status(201).json({ message: 'Video registered successfully', video: newVideo });
    } catch (err) {
        console.error('Error creating video record:', err);
        res.status(500).json({ message: err.message });
    }
});

// 3. Get All Videos (Admin)
app.get('/api/admin/videos', verifyEducator, async (req, res) => {
    try {
        const { search, category } = req.query;
        let query = {};

        if (category && category !== 'All') {
            query.category = category;
        }

        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }

        const videos = await Video.find(query)
            .sort({ createdAt: -1 })
            .populate('uploadedBy', 'fullName email');

        res.json(videos);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 4. Get Published Videos (Student / Public feed)
app.get('/api/videos', async (req, res) => {
    try {
        const { category, search } = req.query;
        let query = { isPublished: true };

        if (category && category !== 'All') {
            if (category === 'Both' || req.query.exact === 'true') {
                query.category = category;
            } else {
                query.category = { $in: [category, 'Both'] };
            }
        }

        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }

        const videos = await Video.find(query).sort({ createdAt: -1 });
        res.json(videos);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 5. Get Single Video
app.get('/api/admin/videos/:id', verifyEducator, async (req, res) => {
    try {
        const video = await Video.findById(req.params.id);
        if (!video) return res.status(404).json({ message: 'Video not found' });
        res.json(video);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 6. Update Video
app.put('/api/admin/videos/:id', verifyEducator, async (req, res) => {
    try {
        const { title, description, duration, videoUrl, thumbnail, size, category, isPublished } = req.body;
        const video = await Video.findById(req.params.id);
        if (!video) return res.status(404).json({ message: 'Video not found' });

        if (title !== undefined) video.title = title;
        if (description !== undefined) video.description = description;
        if (duration !== undefined) video.duration = duration;
        if (videoUrl !== undefined) video.videoUrl = videoUrl;
        if (thumbnail !== undefined) video.thumbnail = thumbnail;
        if (size !== undefined) video.size = Number(size);
        if (category !== undefined) video.category = category;
        if (isPublished !== undefined) video.isPublished = isPublished;

        await video.save();
        res.json({ message: 'Video updated successfully', video });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 7. Delete Video & Cleanup Storage
app.delete('/api/admin/videos/:id', verifyAdmin, async (req, res) => {
    try {
        const video = await Video.findById(req.params.id);
        if (!video) return res.status(404).json({ message: 'Video not found' });

        // Clean up local video file if stored locally
        if (video.videoUrl && video.videoUrl.includes('/uploads/videos/')) {
            const filename = path.basename(video.videoUrl);
            const filePath = path.join(videoUploadDir, filename);
            if (fs.existsSync(filePath)) {
                try { fs.unlinkSync(filePath); } catch (e) { console.error('Error removing video file:', e); }
            }
        }

        // Clean up local thumbnail if stored locally
        if (video.thumbnail && video.thumbnail.includes('/uploads/thumbnails/')) {
            const thumbName = path.basename(video.thumbnail);
            const thumbPath = path.join(thumbUploadDir, thumbName);
            if (fs.existsSync(thumbPath)) {
                try { fs.unlinkSync(thumbPath); } catch (e) { console.error('Error removing thumb file:', e); }
            }
        }

        await Video.findByIdAndDelete(req.params.id);
        res.json({ message: 'Video deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.get('/api/user/tests/:id', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id) || await AdminUser.findById(req.user.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const test = await QuestionBank.findById(req.params.id).select('-questions.answer');
        if (!test) return res.status(404).json({ message: 'Test not found' });

        // Enforce category & batch isolation for students
        if (user.role === 'student') {
            if (test.status !== 'published') {
                return res.status(403).json({ message: 'Test is not published' });
            }
            const testCats = Array.isArray(test.category) ? test.category : [test.category];
            const hasCatAccess = testCats.includes('Both') || testCats.includes(user.category);
            if (!hasCatAccess) {
                return res.status(403).json({ message: 'This test is not accessible to your category' });
            }
            const testBatches = Array.isArray(test.batches) ? test.batches : (test.batches ? [test.batches] : []);
            const isAllBatches = testBatches.length === 0 || testBatches.includes('All');
            const userBatch = user.batch || 'All';
            const hasBatchAccess = isAllBatches || (userBatch !== 'All' && testBatches.includes(userBatch));
            if (!hasBatchAccess) {
                return res.status(403).json({ message: 'This test is not accessible to your batch' });
            }
        }

        const attempt = await Attempt.findOne({ userId: req.user.id, testId: req.params.id });
        let request = await ReAttemptRequest.findOne({ userId: req.user.id, testId: req.params.id, status: 'approved' });
        if (!request) {
            request = await ReAttemptRequest.findOne({ userId: req.user.id, testId: req.params.id }).sort({ createdAt: -1 });
        }

        res.json({
            ...test.toObject(),
            hasAttempted: !!attempt,
            requestStatus: request ? request.status : null
        });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// Record a view
app.post('/api/user/tests/:id/view', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        
        // Only record if not already viewed recently (e.g., within the last hour) or just always record
        // Let's just record every unique user-test pair for simplicity in "who viewed", or maybe every view is fine.
        // The user wants to see "who", so unique is probably better for a list.
        const existing = await QuestionView.findOne({ userId, testId: id });
        if (!existing) {
            const newView = new QuestionView({ userId, testId: id });
            await newView.save();
        } else {
            existing.viewedAt = new Date();
            await existing.save();
        }
        res.json({ message: "View recorded" });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// Get viewers and attemptors for a test
app.get('/api/admin/question-banks/:id/stats', verifyEducator, async (req, res) => {
    try {
        const id = req.params.id;
        // Find the bank questions too
        const bank = await QuestionBank.findById(id).select('questions');

        // Search by both ObjectId and String just in case
        let query = { $or: [{ testId: id }] };
        try {
            query.$or.push({ testId: new mongoose.Types.ObjectId(id) });
        } catch (e) {
            console.log(`[DEBUG] Could not cast ${id} to ObjectId`);
        }

        // Find all attempts
        const attempts = await Attempt.find(query)
            .populate('userId', 'fullName email mobile')
            .sort({ createdAt: -1 });
            
        console.log(`[DEBUG] Found ${attempts.length} attempts for query:`, JSON.stringify(query));
            
        // Find all views
        const views = await QuestionView.find(query)
            .populate('userId', 'fullName email mobile')
            .sort({ viewedAt: -1 });
            
        console.log(`[DEBUG] Found ${views.length} views`);
            
        // Combine them to see who viewed vs who attempted
        const result = {
            questions: bank?.questions || [],
            attempts: attempts.map(a => ({
                userId: a.userId?._id,
                fullName: a.userId?.fullName,
                email: a.userId?.email,
                mobile: a.userId?.mobile,
                score: a.score,
                date: a.createdAt,
                answers: a.answers,
                correctAnswers: a.correctAnswers
            })),
            viewers: views.map(v => ({
                userId: v.userId?._id,
                fullName: v.userId?.fullName,
                email: v.userId?.email,
                mobile: v.userId?.mobile,
                viewedAt: v.viewedAt
            }))
        };
        
        res.json(result);
    } catch (err) { res.status(500).json({ message: err.message }); }
});


app.post('/api/user/tests/:id/submit', verifyToken, async (req, res) => {
    try {
        const { answers } = req.body; // Array of selected option indices
        const user = await User.findById(req.user.id) || await AdminUser.findById(req.user.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const test = await QuestionBank.findById(req.params.id);
        if (!test) return res.status(404).json({ message: 'Test not found' });

        // Enforce category & batch isolation for students
        if (user.role === 'student') {
            const testCats = Array.isArray(test.category) ? test.category : [test.category];
            const hasCatAccess = testCats.includes('Both') || testCats.includes(user.category);
            if (!hasCatAccess) {
                return res.status(403).json({ message: 'This test is not accessible to your category' });
            }
            const testBatches = Array.isArray(test.batches) ? test.batches : (test.batches ? [test.batches] : []);
            const isAllBatches = testBatches.length === 0 || testBatches.includes('All');
            const userBatch = user.batch || 'All';
            const hasBatchAccess = isAllBatches || (userBatch !== 'All' && testBatches.includes(userBatch));
            if (!hasBatchAccess) {
                return res.status(403).json({ message: 'This test is not accessible to your batch' });
            }
        }

        const existingAttempt = await Attempt.findOne({ userId: req.user.id, testId: req.params.id });
        const reattemptApproved = await ReAttemptRequest.findOne({ userId: req.user.id, testId: req.params.id, status: 'approved' });

        if (existingAttempt && !reattemptApproved) {
            return res.status(403).json({ message: 'Test already attempted and no re-attempt is approved' });
        }

        let score = 0;
        let correctCount = 0;
        let wrongCount = 0;

        test.questions.forEach((q, idx) => {
            if (answers[idx] === q.answer) {
                correctCount++;
            } else if (answers[idx] !== null && answers[idx] !== undefined && answers[idx] !== '') {
                wrongCount++;
            }
        });

        if (test.negativeMarking) {
            score = correctCount - (wrongCount * 0.25);
        } else {
            score = correctCount;
        }

        const percentage = ((score / test.questions.length) * 100).toFixed(1);

        const attempt = new Attempt({
            userId: req.user.id,
            testId: test._id,
            score: parseFloat(percentage),
            totalQuestions: test.questions.length,
            answers: answers,
            correctAnswers: test.questions.map(q => q.answer)
        });
        await attempt.save();

        if (reattemptApproved) {
            await ReAttemptRequest.deleteOne({ _id: reattemptApproved._id });
        }

        test.attempts += 1;
        await test.save();

        // Clear any re-attempt requests for this test
        await ReAttemptRequest.deleteMany({ userId: req.user.id, testId: req.params.id });

        res.json({
            message: "Test submitted successfully",
            score: percentage,
            correct: correctCount,
            total: test.questions.length,
            answers: test.questions.map(q => q.answer) // Return correct answers for immediate review
        });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

app.get('/api/user/tests/:id/preview', verifyToken, async (req, res) => {
    try {
        const test = await QuestionBank.findById(req.params.id);
        if (!test) {
            console.error(`Preview Failed: Test ${req.params.id} not found`);
            return res.status(404).json({ message: 'Test metadata not found' });
        }

        const attempt = await Attempt.findOne({ userId: req.user.id, testId: req.params.id }).sort({ createdAt: -1 });
        if (!attempt) {
            console.error(`Preview Failed: No attempt for User ${req.user.id} on Test ${req.params.id}`);
            return res.status(404).json({ message: 'Attempt record not found' });
        }

        res.json({ test, attempt });
    } catch (err) {
        console.error('Preview Error:', err);
        res.status(500).json({ message: err.message });
    }
});

app.get('/api/user/progress', verifyToken, async (req, res) => {
    try {
        const attempts = await Attempt.find({ userId: req.user.id }).sort({ date: 1 });

        if (attempts.length === 0) return res.json({ data: null });

        // Calculate Stats
        const avgScore = (attempts.reduce((a, b) => a + b.score, 0) / attempts.length).toFixed(1);
        let improvement = 0;
        if (attempts.length >= 2) {
            improvement = (attempts[attempts.length - 1].score - attempts[attempts.length - 2].score).toFixed(1);
        }

        // Aggregate Assessment Mastery (Grouping by Test Title)
        const subjectStats = await Attempt.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(req.user.id) } },
            { 
                $lookup: {
                    from: 'questionbanks',
                    localField: 'testId',
                    foreignField: '_id',
                    as: 'testInfo'
                }
            },
            { $unwind: '$testInfo' },
            { $group: { _id: "$testInfo.title", avg: { $avg: "$score" } } }
        ]);

        res.json({
            data: {
                history: attempts.map(a => ({
                    date: new Date(a.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                    score: a.score
                })),
                stats: { avgScore, improvement, totalTests: attempts.length, rank: "Assessment Tier 1" },
                performanceData: subjectStats.map(s => ({ title: s._id, score: s.avg, fullMark: 100 }))
            }
        });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// 5. Submit Test Result (Mocking an exam finish)
app.post('/api/user/submit-test', verifyToken, async (req, res) => {
    try {
        const { score, testId } = req.body;
        const newAttempt = new Attempt({ userId: req.user.id, score, testId });
        await newAttempt.save();
        res.json({ message: "Score saved successfully" });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// --- HELPER: INITIAL ADMIN ---
async function createInitialAdmin() {
    try {
        const adminEmail = 'admin@siddhaveda.com';
        const exists = await AdminUser.findOne({ email: adminEmail });
        if (!exists) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await AdminUser.create({ fullName: 'Admin', email: adminEmail, password: hashedPassword, role: 'admin' });
            console.log('🚀 Admin Ready in AdminUser DB: admin@siddhaveda.com / admin123');
        } else {
            // Ensure password is synchronized with requested admin123
            const isMatch = await bcrypt.compare('admin123', exists.password);
            if (!isMatch) {
                exists.password = await bcrypt.hash('admin123', 10);
                await exists.save();
                console.log('🔄 Admin Password Updated: admin@siddhaveda.com / admin123');
            }
        }
    } catch (err) {
        console.error('Error creating initial admin:', err.message);
    }
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`📡 Server: http://localhost:${PORT}`));