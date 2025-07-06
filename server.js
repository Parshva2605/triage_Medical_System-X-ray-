const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');
const WebSocket = require('ws');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3002;
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/medical-system';

// WebSocket rooms for video calls
const rooms = new Map();

// WebSocket connection handling
wss.on('connection', (ws) => {
    console.log('WebSocket client connected');
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            handleWebSocketMessage(ws, data);
        } catch (error) {
            console.error('Error parsing WebSocket message:', error);
        }
    });
    
    ws.on('close', () => {
        console.log('WebSocket client disconnected');
        // Remove from all rooms
        rooms.forEach((participants, roomId) => {
            const index = participants.findIndex(p => p.ws === ws);
            if (index !== -1) {
                participants.splice(index, 1);
                // Notify other participants
                participants.forEach(participant => {
                    if (participant.ws.readyState === WebSocket.OPEN) {
                        participant.ws.send(JSON.stringify({
                            type: 'user-left',
                            userType: data.userType
                        }));
                    }
                });
            }
        });
    });
});

function handleWebSocketMessage(ws, data) {
    switch (data.type) {
        case 'join':
            handleJoinRoom(ws, data);
            break;
        case 'offer':
            handleOffer(ws, data);
            break;
        case 'answer':
            handleAnswer(ws, data);
            break;
        case 'ice-candidate':
            handleIceCandidate(ws, data);
            break;
    }
}

function handleJoinRoom(ws, data) {
    const { roomId, userType } = data;
    
    if (!rooms.has(roomId)) {
        rooms.set(roomId, []);
    }
    
    const room = rooms.get(roomId);
    room.push({ ws, userType });
    
    // Notify the joining user about current participants
    ws.send(JSON.stringify({
        type: 'room-joined',
        roomId: roomId,
        participants: room.map(p => p.userType)
    }));
    
    // Notify other participants about the new user
    room.forEach(participant => {
        if (participant.ws !== ws && participant.ws.readyState === WebSocket.OPEN) {
            participant.ws.send(JSON.stringify({
                type: 'user-joined',
                userType: userType
            }));
        }
    });
    
    console.log(`User ${userType} joined room ${roomId}. Total participants: ${room.length}`);
}

function handleOffer(ws, data) {
    const { roomId, offer } = data;
    const room = rooms.get(roomId);
    
    if (room) {
        room.forEach(participant => {
            if (participant.ws !== ws && participant.ws.readyState === WebSocket.OPEN) {
                participant.ws.send(JSON.stringify({
                    type: 'offer',
                    offer: offer
                }));
            }
        });
    }
}

function handleAnswer(ws, data) {
    const { roomId, answer } = data;
    const room = rooms.get(roomId);
    
    if (room) {
        room.forEach(participant => {
            if (participant.ws !== ws && participant.ws.readyState === WebSocket.OPEN) {
                participant.ws.send(JSON.stringify({
                    type: 'answer',
                    answer: answer
                }));
            }
        });
    }
}

function handleIceCandidate(ws, data) {
    const { roomId, candidate } = data;
    const room = rooms.get(roomId);
    
    if (room) {
        room.forEach(participant => {
            if (participant.ws !== ws && participant.ws.readyState === WebSocket.OPEN) {
                participant.ws.send(JSON.stringify({
                    type: 'ice-candidate',
                    candidate: candidate
                }));
            }
        });
    }
}

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)){
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: function(req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: function(req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Not an image! Please upload an image file.'), false);
    }
  }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Patient Schema
const patientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  mobile: { type: String, required: true },
  password: { type: String, required: true },
  userType: { type: String, default: 'patient' },
  createdAt: { type: Date, default: Date.now }
});

const Patient = mongoose.model('Patient', patientSchema);

// Doctor Schema
const doctorSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  licenseNumber: { type: String, required: true, unique: true },
  specialization: { type: String, required: true },
  degrees: { type: String, required: true },
  experience: { type: Number, required: true },
  affiliations: { type: String, required: true },
  consultationHours: { type: String, required: true },
  contactInfo: { type: String, required: true },
  userType: { type: String, default: 'doctor' },
  createdAt: { type: Date, default: Date.now }
});

const Doctor = mongoose.model('Doctor', doctorSchema);

// Symptom Submission Schema
const symptomSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  patientName: { type: String, required: true },
  patientEmail: { type: String, required: true },
  symptoms: [String],
  duration: String,
  chestPain: String,
  shortnessOfBreath: String,
  productiveCough: String,
  phlegmColor: String,
  medicalConditions: [String],
  smokingStatus: String,
  additionalInfo: String,
  xrayImage: String,
  pneumoniaDetected: { type: String, default: 'Pending Analysis' },
  submittedAt: { type: Date, default: Date.now },
  status: { type: String, default: 'Pending' }, // Pending, Reviewed, Diagnosed
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor' },
  reviewedAt: Date,
  diagnosis: String,
  recommendations: String
});

const SymptomSubmission = mongoose.model('SymptomSubmission', symptomSchema);

// Prescription Schema
const prescriptionSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
  doctorName: { type: String, required: true },
  title: { type: String, required: true },
  diagnosis: { type: String, required: true },
  medications: [{
    name: { type: String, required: true },
    dosage: { type: String, required: true },
    frequency: { type: String, required: true },
    instructions: { type: String, required: true }
  }],
  additionalInstructions: { type: String },
  issuedDate: { type: Date, default: Date.now },
  expiryDate: { type: Date, required: true }
});

const Prescription = mongoose.model('Prescription', prescriptionSchema);

// Video Call Schema
const videoCallSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
  patientName: { type: String, required: true },
  doctorName: { type: String, required: true },
  callDateTime: { type: Date, required: true },
  callDuration: { type: Number, required: true }, // in minutes
  callPurpose: { type: String, required: true },
  status: { type: String, enum: ['scheduled', 'in-progress', 'completed', 'cancelled'], default: 'scheduled' },
  roomId: { type: String, unique: true },
  createdAt: { type: Date, default: Date.now }
});

const VideoCall = mongoose.model('VideoCall', videoCallSchema);

// Authentication middleware
const authenticateJWT = (req, res, next) => {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, 'your_jwt_secret'); // Use same secret as login
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ success: false, message: 'Invalid token' });
  }
};

// Analyze X-ray with Python script
function analyzeChestDiseases(imagePath) {
  return new Promise((resolve, reject) => {
    // Use the new chest disease analysis script
    const pythonProcess = spawn('python', [
      path.join(__dirname, 'full', 'analyze_chest_diseases.py'), 
      imagePath
    ]);
    
    let result = '';
    
    pythonProcess.stdout.on('data', (data) => {
      result += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      console.error(`Python stderr: ${data}`);
    });
    
    pythonProcess.on('close', (code) => {
      if (code !== 0 || result.includes('Error:')) {
        // Fallback message if analysis fails
        resolve('X-ray received - A physician will review your case');
      } else {
        resolve(result.trim());
      }
    });
  });
}

// API Routes

// Patient Signup Route
app.post('/api/patient/signup', async (req, res) => {
  try {
    const { name, email, mobile, password } = req.body;
    
    // Check if patient already exists
    const existingPatient = await Patient.findOne({ email });
    if (existingPatient) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Create new patient
    const newPatient = new Patient({
      name,
      email,
      mobile,
      password: hashedPassword
    });
    
    await newPatient.save();
    
    res.status(201).json({ message: 'Patient registered successfully' });
  } catch (error) {
    console.error('Patient signup error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Doctor Signup Route
app.post('/api/doctor/signup', async (req, res) => {
  try {
    const { 
      fullName, 
      email, 
      password, 
      licenseNumber, 
      specialization, 
      degrees, 
      experience, 
      affiliations, 
      consultationHours, 
      contactInfo 
    } = req.body;
    
    // Check if doctor already exists
    const existingDoctor = await Doctor.findOne({ 
      $or: [{ email }, { licenseNumber }]
    });
    
    if (existingDoctor) {
      return res.status(400).json({ 
        error: 'Email or license number already registered' 
      });
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Create new doctor
    const newDoctor = new Doctor({
      fullName,
      email,
      password: hashedPassword,
      licenseNumber,
      specialization,
      degrees,
      experience,
      affiliations,
      consultationHours,
      contactInfo
    });
    
    await newDoctor.save();
    
    res.status(201).json({ message: 'Doctor registered successfully' });
  } catch (error) {
    console.error('Doctor signup error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login endpoint
app.post('/api/login', async (req, res) => {
  try {
    const { email, password, userType } = req.body;
    
    let user = null;
    
    // Find user based on type
    if (userType === 'patient') {
      user = await Patient.findOne({ email });
    } else if (userType === 'doctor') {
      user = await Doctor.findOne({ email });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid user type'
      });
    }
    
    // Check if user exists
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
    
    // For simplicity in development, allow any password (REMOVE IN PRODUCTION)
    let isMatch = true;
    
    // Uncomment for real password checking
    // const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
    
    // Create payload with full user details (exclude password)
    const userObj = user.toObject();
    delete userObj.password;
    
    const payload = {
      id: user._id,
      userType: userType,
      userData: userObj
    };
    
    // Sign token with longer expiration
    const token = jwt.sign(
      payload,
      'your_jwt_secret',  // Use environment variable in production
      { expiresIn: '7d' }  // Extend to 7 days
    );
    
    // Set cookie with proper options
    res.cookie('token', token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
      sameSite: 'strict'
    });
    
    // Return success with user info
    return res.json({
      success: true,
      userType: userType,
      user: userObj,
      message: 'Login successful'
    });
    
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
});

// Simple auth check endpoint
app.get('/api/auth-check', (req, res) => {
  const token = req.cookies.token;
  
  if (!token) {
    return res.status(401).json({ authenticated: false });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET); // Use same secret as login
    return res.json({ 
      authenticated: true,
      userType: decoded.userType
    });
  } catch (err) {
    return res.status(401).json({ authenticated: false });
  }
});

// Improved user data endpoint
app.get('/api/user', (req, res) => {
  try {
    const token = req.cookies.token;
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'No authentication token found'
      });
    }
    
    // Verify token
    const decoded = jwt.verify(token, 'your_jwt_secret');
    
    // Return user data from token (no database query needed)
    return res.json({
      success: true,
      userType: decoded.userType,
      user: decoded.userData
    });
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
});

// Logout route
app.post('/api/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    path: '/',
    sameSite: 'strict'
  });
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// Home route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Submit symptoms and x-ray for analysis
app.post('/api/submit-symptoms', authenticateJWT, upload.single('xrayImage'), async (req, res) => {
  try {
    const {
      symptoms, duration, chestPain, shortnessOfBreath, 
      productiveCough, phlegmColor, conditions, smoking,
      additionalInfo
    } = req.body;

    // Check if user is a patient
    if (req.user.userType !== 'patient') {
      return res.status(403).json({ success: false, message: 'Only patients can submit symptoms' });
    }

    // Get patient details
    const patient = await Patient.findById(req.user.id);
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    let chestAnalysisResult = 'No X-ray provided';
    let xrayPath = null;

    // Process x-ray if uploaded
    if (req.file) {
      xrayPath = req.file.path;
      
      try {
        chestAnalysisResult = await analyzeChestDiseases(xrayPath);
      } catch (error) {
        console.error('X-ray analysis error:', error);
        chestAnalysisResult = 'Analysis error';
      }
    }

    // Create new symptom submission
    const submission = new SymptomSubmission({
      patientId: patient._id,
      patientName: patient.name,
      patientEmail: patient.email,
      symptoms: symptoms ? (Array.isArray(symptoms) ? symptoms : [symptoms]) : [],
      duration,
      chestPain,
      shortnessOfBreath,
      productiveCough,
      phlegmColor,
      medicalConditions: conditions ? (Array.isArray(conditions) ? conditions : [conditions]) : [],
      smokingStatus: smoking,
      additionalInfo,
      xrayImage: xrayPath ? `/uploads/${path.basename(xrayPath)}` : null,
      pneumoniaDetected: chestAnalysisResult
    });

    await submission.save();

    res.status(201).json({ 
      success: true, 
      message: 'Symptoms submitted successfully',
      chestAnalysisResult 
    });
  } catch (error) {
    console.error('Symptom submission error:', error);
    res.status(500).json({ success: false, message: 'Error submitting symptoms' });
  }
});

// Get patient's symptom submissions
app.get('/api/patient/symptom-submissions', authenticateJWT, async (req, res) => {
  try {
    if (req.user.userType !== 'patient') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const submissions = await SymptomSubmission.find({ patientId: req.user.id })
      .sort({ submittedAt: -1 });
    
    res.json({ success: true, submissions });
  } catch (error) {
    console.error('Error fetching symptom submissions:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get all symptom submissions for doctors
app.get('/api/doctor/symptom-submissions', authenticateJWT, async (req, res) => {
  try {
    if (req.user.userType !== 'doctor') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const submissions = await SymptomSubmission.find()
      .sort({ submittedAt: -1 });
    
    res.json({ success: true, submissions });
  } catch (error) {
    console.error('Error fetching symptom submissions:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Endpoint to get patient prescriptions
app.get('/api/patient/prescriptions', authenticateJWT, async (req, res) => {
  try {
    // Check if user is a patient
    if (req.user.userType !== 'patient') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Patient access only.' 
      });
    }
    
    // Get the patient ID from the JWT token
    const patientId = req.user.id;
    
    // Find all prescriptions for this patient
    const prescriptions = await Prescription.find({ patientId })
      .sort({ issuedDate: -1 }) // Sort by issue date (newest first)
      .lean(); // Convert to plain JavaScript objects
    
    return res.json({
      success: true,
      prescriptions
    });
    
  } catch (error) {
    console.error('Error fetching prescriptions:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching prescriptions'
    });
  }
});

// Create prescription (doctors only)
app.post('/api/doctor/prescriptions', authenticateJWT, async (req, res) => {
  try {
    if (req.user.userType !== 'doctor') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const {
      patientId, title, diagnosis, medications,
      additionalInstructions, expiryDate
    } = req.body;

    // Get doctor details
    const doctor = await Doctor.findById(req.user.id);
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    // Create prescription
    const prescription = new Prescription({
      patientId,
      doctorId: doctor._id,
      doctorName: doctor.fullName,
      title,
      diagnosis,
      medications,
      additionalInstructions,
      expiryDate: new Date(expiryDate)
    });

    await prescription.save();
    
    res.status(201).json({ success: true, message: 'Prescription created successfully' });
  } catch (error) {
    console.error('Error creating prescription:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create prescription endpoint
app.post('/api/prescriptions/create', authenticateJWT, async (req, res) => {
  try {
    // Check if user is a doctor
    if (req.user.userType !== 'doctor') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Only doctors can create prescriptions.' 
      });
    }
    
    // Extract prescription data
    const {
      patientId,
      title,
      diagnosis,
      medications,
      additionalInstructions,
      expiryDate
    } = req.body;
    
    // Get doctor info from the token
    const doctorId = req.user.id;
    const doctor = await Doctor.findById(doctorId);
    
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }
    
    // Validate that the patient exists
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }
    
    // Create new prescription
    const prescription = new Prescription({
      patientId,
      doctorId,
      doctorName: doctor.fullName || `Dr. ${doctor.email.split('@')[0]}`,
      title,
      diagnosis,
      medications,
      additionalInstructions,
      issuedDate: new Date(),
      expiryDate: new Date(expiryDate)
    });
    
    // Save prescription
    await prescription.save();
    
    return res.json({
      success: true,
      message: 'Prescription created successfully',
      prescriptionId: prescription._id
    });
    
  } catch (error) {
    console.error('Error creating prescription:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while creating prescription'
    });
  }
});

// Get prescription details (for doctors and patients)
app.get('/api/prescriptions/:id', authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if user is authorized (doctor or patient who owns the prescription)
    const prescription = await Prescription.findById(id);
    if (!prescription) {
      return res.status(404).json({ 
        success: false, 
        message: 'Prescription not found' 
      });
    }
    
    // Patients can only access their own prescriptions
    if (req.user.userType === 'patient' && prescription.patientId.toString() !== req.user.id) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. You can only access your own prescriptions.' 
      });
    }
    
    // For doctors, also fetch patient details
    let patientDetails = null;
    if (req.user.userType === 'doctor') {
      patientDetails = await Patient.findById(prescription.patientId);
    }
    
    res.json({ 
      success: true, 
      prescription, 
      patientDetails: patientDetails || null 
    });
  } catch (error) {
    console.error('Error fetching prescription details:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update prescription (doctors only)
app.put('/api/prescriptions/:id', authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if user is a doctor
    if (req.user.userType !== 'doctor') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    
    // Find prescription
    const prescription = await Prescription.findById(id);
    if (!prescription) {
      return res.status(404).json({ success: false, message: 'Prescription not found' });
    }
    
    // Update fields
    const updates = req.body;
    Object.assign(prescription, updates);
    
    await prescription.save();
    
    res.json({ success: true, message: 'Prescription updated successfully' });
  } catch (error) {
    console.error('Error updating prescription:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete prescription (doctors only)
app.delete('/api/prescriptions/:id', authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if user is a doctor
    if (req.user.userType !== 'doctor') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    
    // Delete prescription
    await Prescription.findByIdAndDelete(id);
    
    res.json({ success: true, message: 'Prescription deleted successfully' });
  } catch (error) {
    console.error('Error deleting prescription:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Schedule video call
app.post('/api/schedule-video-call', authenticateJWT, async (req, res) => {
  try {
    console.log('Video call scheduling request received:', req.body);
    console.log('User info:', req.user);
    
    if (req.user.userType !== 'doctor') {
      console.log('Unauthorized access attempt by:', req.user.userType);
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const {
      patientId,
      patientName,
      callDateTime,
      callDuration,
      callPurpose,
      doctorName
    } = req.body;

    console.log('Extracted data:', {
      patientId,
      patientName,
      callDateTime,
      callDuration,
      callPurpose,
      doctorName
    });

    // Validate required fields
    if (!patientId || !patientName || !callDateTime || !callDuration || !callPurpose) {
      console.log('Missing required fields');
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Generate unique room ID
    const roomId = 'room_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    console.log('Generated room ID:', roomId);

    // Create video call
    const videoCall = new VideoCall({
      patientId,
      doctorId: req.user.id, // Get from JWT token
      patientName,
      doctorName: doctorName || req.user.fullName || req.user.email,
      callDateTime: new Date(callDateTime),
      callDuration: parseInt(callDuration),
      callPurpose,
      roomId
    });

    console.log('Video call object created:', videoCall);

    await videoCall.save();
    console.log('Video call saved successfully');
    
    res.status(201).json({ 
      success: true, 
      message: 'Video call scheduled successfully',
      roomId 
    });
  } catch (error) {
    console.error('Error scheduling video call:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

// Instant video call
app.post('/api/instant-video-call', authenticateJWT, async (req, res) => {
  try {
    console.log('Instant video call request received:', req.body);
    console.log('User info:', req.user);
    
    if (req.user.userType !== 'doctor') {
      console.log('Unauthorized access attempt by:', req.user.userType);
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const {
      patientId,
      patientName,
      callDuration,
      callPurpose,
      doctorName
    } = req.body;

    console.log('Extracted instant call data:', {
      patientId,
      patientName,
      callDuration,
      callPurpose,
      doctorName
    });

    // Validate required fields
    if (!patientId || !patientName || !callDuration || !callPurpose) {
      console.log('Missing required fields for instant call');
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Generate unique room ID
    const roomId = 'room_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    console.log('Generated room ID for instant call:', roomId);

    // Create instant video call with immediate status
    const videoCall = new VideoCall({
      patientId,
      doctorId: req.user.id,
      patientName,
      doctorName: doctorName || req.user.fullName || req.user.email,
      callDateTime: new Date(), // Immediate call
      callDuration: parseInt(callDuration),
      callPurpose: callPurpose || 'Instant meeting',
      status: 'in-progress', // Set to in-progress immediately
      roomId
    });

    console.log('Instant video call object created:', videoCall);

    await videoCall.save();
    console.log('Instant video call saved successfully');
    
    res.status(201).json({ 
      success: true, 
      message: 'Instant video call initiated successfully',
      roomId,
      callId: videoCall._id
    });
  } catch (error) {
    console.error('Error initiating instant video call:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

// Get instant call notifications for patient
app.get('/api/patient/instant-calls', authenticateJWT, async (req, res) => {
  try {
    if (req.user.userType !== 'patient') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    // Get calls that are in-progress and created within the last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    const instantCalls = await VideoCall.find({ 
      patientId: req.user.id,
      status: 'in-progress',
      createdAt: { $gte: fiveMinutesAgo }
    }).sort({ createdAt: -1 });
    
    res.json({ success: true, calls: instantCalls });
  } catch (error) {
    console.error('Error fetching instant calls:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get scheduled calls for doctor
app.get('/api/scheduled-calls', authenticateJWT, async (req, res) => {
  try {
    if (req.user.userType !== 'doctor') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const calls = await VideoCall.find({ 
      doctorId: req.user.id,
      status: 'scheduled'
    }).sort({ callDateTime: 1 });
    
    res.json({ success: true, calls });
  } catch (error) {
    console.error('Error fetching scheduled calls:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get scheduled calls for patient
app.get('/api/patient/scheduled-calls', authenticateJWT, async (req, res) => {
  try {
    if (req.user.userType !== 'patient') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const calls = await VideoCall.find({ 
      patientId: req.user.id,
      status: 'scheduled'
    }).sort({ callDateTime: 1 });
    
    res.json({ success: true, calls });
  } catch (error) {
    console.error('Error fetching patient scheduled calls:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update call status
app.put('/api/video-call/:callId/status', authenticateJWT, async (req, res) => {
  try {
    const { status } = req.body;
    const callId = req.params.callId;

    const videoCall = await VideoCall.findById(callId);
    if (!videoCall) {
      return res.status(404).json({ success: false, message: 'Call not found' });
    }

    // Check if user is authorized to update this call
    if (req.user.userType === 'doctor' && videoCall.doctorId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    if (req.user.userType === 'patient' && videoCall.patientId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    videoCall.status = status;
    await videoCall.save();
    
    res.json({ success: true, message: 'Call status updated' });
  } catch (error) {
    console.error('Error updating call status:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unexpected error:', err);
  res.status(500).json({ success: false, message: 'Unexpected server error' });
});

// Start server with IP information
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
  
  // Get local network interfaces to display IP addresses
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  
  console.log('\n===== ACCESS LINKS =====');
  console.log(`Local: http://localhost:${PORT}`);
  
  // Display all IPv4 addresses for access from other devices
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip over internal and non-IPv4 addresses
      if (net.family === 'IPv4' && !net.internal) {
        console.log(`Network: http://${net.address}:${PORT}`);
      }
    }
  }
  console.log('=======================');
});

// Add graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});